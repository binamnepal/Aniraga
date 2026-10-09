"""Talks to the Anivexa Node API and normalises its responses for the React player."""
import os
import threading
import time
from concurrent.futures import ThreadPoolExecutor

import requests
from django.conf import settings
from django.core.cache import cache
from rest_framework.exceptions import APIException, ValidationError

from . import proxy


class ProviderError(APIException):
    status_code = 502
    default_detail = "That source could not be loaded."
    default_code = "provider_error"


# Order = which source we try first. MKissa can be slow (captcha retries) so it goes last.
# AnimeOnsen only serves DASH, which the web player does not play, so it is left out.
PROVIDERS = {
    "reanime": "ReAnime",
    "anizone": "AniZone",
    "aniwaves": "AniWaves",
    "anikoto": "AniKoto",
    "animedunya": "AnimeDunya",
    "anineko": "AniNeko",
    "animegg": "AnimeGG",
    "senshi": "Senshi",
    "anibd": "AniBD",
    "anidbapp": "AniDB",
    "kaa": "KickAssAnime",
    "animenosub": "AnimeNoSub",
    "mkissa": "MKissa",
}
META_KEYS = {"page", "type", "mappings", "_unknownProviders"}


# Statuses a sleeping free-tier service answers with while it wakes up.
_WAKING = (502, 503, 504)
# Pauses between retries (seconds). Total ~58s, enough for a Render cold start (~30-50s).
_RETRY_DELAYS = (3, 5, 8, 10, 12, 20)
# Never keep retrying longer than this, whatever the per-request timeout is.
_WAKE_BUDGET = 75


def _node_base():
    # The environment variable wins; the settings value is only a fallback.
    return (os.getenv("ANIVEXA_API_URL") or getattr(settings, "ANIVEXA_API_URL", "") or "http://localhost:4000").rstrip("/")


def _get(path, timeout):
    base = _node_base()
    deadline = time.monotonic() + max(timeout, _WAKE_BUDGET)
    res = None
    last_error = None
    for attempt in range(len(_RETRY_DELAYS) + 1):
        res, last_error = None, None
        try:
            res = requests.get(base + path, timeout=timeout, headers={"Accept": "application/json"})
        except requests.RequestException as exc:
            last_error = exc
        # A sleeping free-tier service answers 502/503/504 (or times out) while it wakes up:
        # wait and retry instead of failing on the first try.
        waking = last_error is not None or res.status_code in _WAKING
        if waking and attempt < len(_RETRY_DELAYS):
            delay = _RETRY_DELAYS[attempt]
            if time.monotonic() + delay < deadline:
                time.sleep(delay)
                continue
        break
    if res is None:
        raise ProviderError("The streaming API is not reachable. It may still be waking up, please try again in a moment.")
    try:
        data = res.json()
    except ValueError:
        raise ProviderError(
            f"The streaming API returned something unexpected (HTTP {res.status_code}). "
            "Check that the Node service is Live and that ANIVEXA_API_URL points to it."
        )
    if res.status_code >= 400:
        message = data.get("error") if isinstance(data, dict) else None
        raise ProviderError(str(message or f"The streaming API returned an error (HTTP {res.status_code}).")[:200])
    if not isinstance(data, dict):
        raise ProviderError("The streaming API returned an unexpected response.")
    return data


def warm_up():
    """Fire-and-forget ping so a sleeping Node service starts waking before it is needed."""
    def _ping():
        try:
            requests.get(_node_base() + "/health", timeout=90)
        except requests.RequestException:
            pass
    threading.Thread(target=_ping, daemon=True).start()


def _as_int(value):
    try:
        f = float(value)
    except (TypeError, ValueError):
        return None
    return int(f) if f == int(f) and f > 0 else None


# Sources that normally answer in a few seconds. Everything else is fetched in parallel
# but never holds up the first response.
FAST = ["reanime", "anizone", "aniwaves", "anikoto"]
SLOW = [p for p in PROVIDERS if p not in FAST]
FAST_TIMEOUT = 90   # a sleeping free-tier Node API needs ~50s just to wake up
SLOW_TIMEOUT = 120

_pool = ThreadPoolExecutor(max_workers=8, thread_name_prefix="eps")
_lock = threading.Lock()
_inflight = {}  # anilist_id -> (fast_future, slow_future)


def _fetch_group(anilist_id, names, timeout):
    """One Node call for a group of providers.

    Never raises: a failed group comes back as {"_error": "..."} so the caller can tell
    "the API is down" apart from "the API answered but nobody has this title".
    """
    try:
        return _get(f"/episodes/{'/'.join(names)}/{int(anilist_id)}?map=false", timeout=timeout)
    except Exception as exc:
        return {"_error": str(getattr(exc, "detail", exc))[:200]}


def _build(anilist_id, raw, complete):
    merged, providers = {}, []
    for name in PROVIDERS:
        block = raw.get(name)
        if not isinstance(block, dict) or block.get("error"):
            continue
        episodes = block.get("episodes") or {}
        entry = {"id": name, "name": PROVIDERS[name], "sub": [], "dub": []}
        for audio in ("sub", "dub"):
            for ep in episodes.get(audio) or []:
                number = _as_int(ep.get("number"))
                if number is None:
                    continue
                entry[audio].append(number)
                row = merged.setdefault(
                    number, {"number": number, "title": None, "filler": False, "sub": False, "dub": False}
                )
                row[audio] = True
                row["title"] = row["title"] or (ep.get("title") or None)
                row["filler"] = row["filler"] or bool(ep.get("filler"))
        if entry["sub"] or entry["dub"]:
            providers.append(entry)
    return {
        "anilist_id": int(anilist_id),
        "episodes": [merged[n] for n in sorted(merged)],
        "providers": providers,
        "has_dub": any(e["dub"] for e in providers),
        "complete": complete,
    }


def _finish(anilist_id, fast_raw, slow_future):
    """Runs when the slow group is done: merge everything and cache the full result."""
    try:
        slow_raw = slow_future.result()
    except Exception:
        slow_raw = {}
    both_failed = "_error" in fast_raw and "_error" in slow_raw
    if not both_failed:
        full = _build(anilist_id, {**fast_raw, **slow_raw}, True)
        cache.set(f"eps:{anilist_id}", full, 600 if full["providers"] else 60)
    with _lock:
        _inflight.pop(anilist_id, None)


def get_episodes(anilist_id):
    """Answers as soon as the fast sources are back; slower sources join in the background.

    `complete: false` in the response tells the frontend to ask again shortly.
    """
    anilist_id = int(anilist_id)
    key = f"eps:{anilist_id}"
    cached = cache.get(key)
    if cached is not None:
        return cached

    with _lock:
        pair = _inflight.get(anilist_id)
        if pair is None:
            fast = _pool.submit(_fetch_group, anilist_id, FAST, FAST_TIMEOUT)
            slow = _pool.submit(_fetch_group, anilist_id, SLOW, SLOW_TIMEOUT)
            _inflight[anilist_id] = pair = (fast, slow)
            fast.add_done_callback(lambda f, i=anilist_id, sl=slow: _after_fast(i, f, sl))
    fast, slow = pair

    fast_raw = fast.result()
    quick = _build(anilist_id, fast_raw, False)
    if quick["episodes"]:
        cache.set(key, quick, 60)
        return quick
    # Nothing from the fast group: the slow sources are all we have, so wait for them.
    slow_raw = slow.result()
    if "_error" in fast_raw and "_error" in slow_raw:
        # Not "no episodes": the streaming API itself failed. Say so, and don't cache it.
        raise ProviderError(fast_raw["_error"])
    full = _build(anilist_id, {**fast_raw, **slow_raw}, True)
    cache.set(key, full, 600 if full["providers"] else 60)
    return full


def _after_fast(anilist_id, fast_future, slow_future):
    try:
        fast_raw = fast_future.result()
    except Exception:
        fast_raw = {}
    slow_future.add_done_callback(lambda _f: _finish(anilist_id, fast_raw, slow_future))


def _range(value):
    """Intro/outro can arrive as {start,end} or [start,end]; return {start,end} or None."""
    if isinstance(value, dict):
        start, end = value.get("start"), value.get("end")
    elif isinstance(value, (list, tuple)) and len(value) == 2:
        start, end = value
    else:
        return None
    try:
        start, end = float(start or 0), float(end or 0)
    except (TypeError, ValueError):
        return None
    return {"start": start, "end": end} if end > start else None


def _subtitles(request, items, referer):
    out = []
    for sub in items or []:
        if not isinstance(sub, dict):
            continue
        url = sub.get("url") or sub.get("file")
        fmt = (sub.get("format") or "vtt").lower()
        if not url or fmt not in ("vtt", "webvtt") and not str(url).lower().split("?")[0].endswith(".vtt"):
            continue  # the browser <track> element only understands WebVTT
        out.append({
            "url": proxy.build_url(request, url, referer=referer),
            "label": sub.get("label") or sub.get("title") or sub.get("lang") or "Subtitles",
            "lang": sub.get("srclang") or sub.get("language") or sub.get("lang") or "",
            "default": bool(sub.get("default")),
        })
    return out


def get_streams(request, provider, anilist_id, audio, episode):
    if provider not in PROVIDERS:
        raise ValidationError({"provider": "Unknown source."})
    if audio not in ("sub", "dub"):
        raise ValidationError({"audio": "Use sub or dub."})
    data = _get(
        f"/watch/{provider}/{int(anilist_id)}/{audio}/{provider}-{int(episode)}",
        timeout=75 if provider == "mkissa" else 35,
    )

    top_intro, top_outro = _range(data.get("intro")), _range(data.get("outro"))
    streams = []
    for s in data.get("streams") or []:
        if not isinstance(s, dict) or not s.get("url"):
            continue
        url, kind = s["url"], str(s.get("type") or "hls").lower()
        path = url.lower().split("?")[0]
        if path.endswith(".m3u8"):
            kind = "hls"
        elif path.endswith(".mp4"):
            kind = "mp4"
        if kind not in ("hls", "mp4", "embed"):
            continue
        referer = s.get("referer")
        item = {
            "server": s.get("server") or "Server",
            "type": kind,
            "url": url,
            "quality": s.get("quality"),
            "active": s.get("isActive", True) is not False,
            "priority": s.get("priority") or 0,
            "intro": _range(s.get("intro")) or top_intro,
            "outro": _range(s.get("outro")) or top_outro,
            "subtitles": _subtitles(request, s.get("subtitles") or data.get("subtitles"), referer),
        }
        if kind in ("hls", "mp4"):
            item["play_url"] = proxy.build_url(
                request, url, referer=referer, key=s.get("playlist_key") or s.get("key")
            )
        streams.append(item)

    streams.sort(key=lambda x: (not x["active"], x["type"] == "embed", -x["priority"]))
    if not streams:
        raise ProviderError("This source has no playable stream for that episode.")
    return {
        "anilist_id": int(anilist_id),
        "episode": int(episode),
        "audio": audio,
        "provider": provider,
        "streams": streams,
    }
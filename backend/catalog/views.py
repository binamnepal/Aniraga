from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta

from django.db.models import Count
from django.utils import timezone
from rest_framework.decorators import api_view
from rest_framework.exceptions import NotFound, ValidationError
from rest_framework.response import Response

from library.models import ViewEvent

from . import anilist as al

HOME_SECTIONS = {
    "trending": dict(sort="TRENDING_DESC", per_page=20),
    "airing": dict(sort="POPULARITY_DESC", per_page=18, status="RELEASING"),
    "popular": dict(sort="POPULARITY_DESC", per_page=18),
    "favourites": dict(sort="FAVOURITES_DESC", per_page=18),
    "completed": dict(sort="END_DATE_DESC", per_page=18, status="FINISHED", popMin=3000),
    "recent": dict(sort="ID_DESC", per_page=18, popMin=500),
    "movies": dict(sort="POPULARITY_DESC", per_page=18, format="MOVIE"),
}


def _int(value, default, lo=1, hi=10_000):
    try:
        return max(lo, min(hi, int(value)))
    except (TypeError, ValueError):
        return default


def _section(name):
    try:
        return al.media_page(**HOME_SECTIONS[name])["media"]
    except Exception:  # one slow/failed section should not blank the whole home page
        return []


@api_view(["GET"])
def home(request):
    def spotlight():
        try:
            items = al.run(al.SPOT_Q, ttl=900)["Page"]["media"]
        except Exception:
            return []
        return [m for m in items if m.get("bannerImage") and al.keep_anime(m)][:8]

    with ThreadPoolExecutor(max_workers=8) as pool:
        spot = pool.submit(spotlight)
        futures = {name: pool.submit(_section, name) for name in HOME_SECTIONS}
        data = {name: f.result() for name, f in futures.items()}
        data["spotlight"] = spot.result()
    return Response(data)


@api_view(["GET"])
def browse(request):
    q = request.query_params
    sort = q.get("sort") if q.get("sort") in al.SORTS else None
    search = (q.get("q") or "").strip() or None
    if not sort and not search:
        sort = "POPULARITY_DESC"
    filters = {
        "search": search,
        "genres": [g for g in (q.get("genre") or "").split(",") if g.strip()] or None,
        "format": q.get("format") if q.get("format") in al.FORMATS else None,
        "status": q.get("status") if q.get("status") in al.STATUSES else None,
        "season": q.get("season") if q.get("season") in al.SEASONS else None,
        "year": _int(q.get("year"), None, 1950, 2100) if q.get("year") else None,
    }
    page = al.media_page(page=_int(q.get("page"), 1, 1, 500), per_page=_int(q.get("per_page"), 24, 1, 50), sort=sort, **filters)
    return Response({"page": page["pageInfo"], "results": [m for m in page["media"] if al.keep_anime(m)]})


@api_view(["GET"])
def suggest(request):
    q = (request.query_params.get("q") or "").strip()
    if len(q) < 2:
        return Response([])
    page = al.media_page(per_page=7, search=q, ttl=300)
    return Response([m for m in page["media"] if al.keep_anime(m)])


@api_view(["GET"])
def genres(request):
    return Response(al.GENRES)


@api_view(["GET"])
def detail(request, anilist_id):
    media = al.run(al.DETAIL_Q, {"id": anilist_id}, ttl=1800).get("Media")
    if not media or not al.keep_anime(media):
        raise NotFound("We couldn't find that anime.")
    media["characters"] = [
        {"role": e["role"], "character": e["node"], "voice_actor": (e.get("voiceActors") or [None])[0]}
        for e in (media.pop("characters", None) or {}).get("edges", [])
    ]
    media["relations"] = [
        {"relation": e["relationType"], "media": e["node"]}
        for e in (media.pop("relations", None) or {}).get("edges", [])
        if al.keep_anime(e.get("node"))
    ]
    media["recommendations"] = [
        n["mediaRecommendation"]
        for n in (media.pop("recommendations", None) or {}).get("nodes", [])
        if al.keep_anime(n.get("mediaRecommendation"))
    ]
    studios = (media.pop("studios", None) or {}).get("edges", [])
    media["studios"] = [s["node"]["name"] for s in studios if s.get("isMain")] or [s["node"]["name"] for s in studios[:2]]
    media["tags"] = [t["name"] for t in (media.get("tags") or []) if not t.get("isMediaSpoiler")][:10]
    return Response(media)


@api_view(["GET"])
def schedule(request):
    start = _int(request.query_params.get("start"), None, 0, 4_102_444_800)
    end = _int(request.query_params.get("end"), None, 0, 4_102_444_800)
    if start is None or end is None or end <= start or end - start > 8 * 86400:
        raise ValidationError({"detail": "Pass start and end as unix seconds, at most 8 days apart."})
    items, page = [], 1
    while page <= 6:
        data = al.run(al.SCHEDULE_Q, {"page": page, "start": start - 1, "end": end}, ttl=300)["Page"]
        items += data["airingSchedules"]
        if not data["pageInfo"]["hasNextPage"]:
            break
        page += 1
    out = [
        i for i in items
        if al.keep_anime(i["media"]) and i["media"].get("format") != "MUSIC"
    ]
    return Response(out)


PERIODS = {"day": 1, "week": 7, "month": 30}


@api_view(["GET"])
def top(request):
    """Top 10 for day / week / month.

    Ranked by episode starts on this site first; if the site is new (or quiet) the
    list is topped up from AniList trending / popularity so it is never empty.
    """
    period = request.query_params.get("period", "day")
    if period not in PERIODS:
        period = "day"
    since = timezone.now() - timedelta(days=PERIODS[period])
    rows = list(
        ViewEvent.objects.filter(created_at__gte=since)
        .values("anilist_id").annotate(n=Count("id")).order_by("-n")[:10]
    )
    items, seen = [], set()
    if rows:
        ids = [r["anilist_id"] for r in rows]
        by_id = {m["id"]: m for m in al.media_page(per_page=len(ids), ids=ids, ttl=300)["media"]}
        counts = {r["anilist_id"]: r["n"] for r in rows}
        for i in ids:
            if i in by_id and al.keep_anime(by_id[i]):
                items.append({**by_id[i], "views": counts[i]})
                seen.add(i)
    if len(items) < 10:
        fill = {
            "day": dict(sort="TRENDING_DESC"),
            "week": dict(sort="POPULARITY_DESC", status="RELEASING"),
            "month": dict(sort="SCORE_DESC", status="RELEASING", popMin=5000),
        }[period]
        for m in al.media_page(per_page=20, ttl=900, **fill)["media"]:
            if m["id"] not in seen and al.keep_anime(m):
                items.append(m)
                seen.add(m["id"])
            if len(items) >= 10:
                break
    return Response(items[:10])

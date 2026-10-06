"""Signed streaming proxy.

Many hosts only serve video when the request carries their own Referer, which a
browser will not let us set. This view fetches the file server-side, rewrites HLS
playlists so every segment also goes through us, and handles the two ReAnime /
FlixCloud tricks described in the Aniraga API README (XOR-encrypted manifests and
image-wrapped segments).

Only URLs that this backend itself signed can be fetched, so it is not an open proxy.
"""
import base64
import hashlib
import hmac
import ipaddress
import re
import socket
import time
from urllib.parse import urlencode, urljoin, urlparse

import requests
from requests.adapters import HTTPAdapter
from django.conf import settings
from django.http import HttpResponse, StreamingHttpResponse
from django.urls import reverse
from django.views.decorators.http import require_http_methods

UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
MAX_PLAYLIST = 4 * 1024 * 1024
FLIX_IMAGE_XOR = bytes([157, 42, 241, 71, 179, 142, 92, 112, 166, 25, 228, 59, 216, 98, 15, 197])
B64_CHARS = set(b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=\r\n \t")


def _b64e(text):
    return base64.urlsafe_b64encode(text.encode()).decode().rstrip("=")


def _b64d(text):
    return base64.urlsafe_b64decode(text + "=" * (-len(text) % 4)).decode()


def _sign(url, referer, key):
    msg = f"{url}\n{referer or ''}\n{key or ''}".encode()
    return hmac.new(settings.SECRET_KEY.encode(), msg, hashlib.sha256).hexdigest()[:40]


def build_url(request, url, referer=None, key=None):
    params = {"u": _b64e(url), "s": _sign(url, referer, key)}
    if referer:
        params["r"] = referer
    if key:
        params["k"] = key
    return request.build_absolute_uri(reverse("stream-proxy")) + "?" + urlencode(params)


# One shared session: reuses TCP/TLS connections to the video hosts instead of opening a
# fresh connection (and doing a TLS handshake) for every single segment.
_session = requests.Session()
_session.mount("http://", HTTPAdapter(pool_connections=32, pool_maxsize=64))
_session.mount("https://", HTTPAdapter(pool_connections=32, pool_maxsize=64))

# Hostname -> (expires_at, is_public). A video has hundreds of segments on the same few
# hosts, so resolving DNS for each one only added delay.
_DNS_TTL = 300
_dns_cache = {}


def _host_is_public(host, port):
    now = time.monotonic()
    hit = _dns_cache.get((host, port))
    if hit and hit[0] > now:
        return hit[1]
    try:
        infos = socket.getaddrinfo(host, port)
        ok = all(ipaddress.ip_address(i[4][0]).is_global for i in infos)
    except (ValueError, OSError):
        ok = False
    if len(_dns_cache) > 2000:
        _dns_cache.clear()
    _dns_cache[(host, port)] = (now + _DNS_TTL, ok)
    return ok


def _is_public(url):
    try:
        parts = urlparse(url)
        if parts.scheme not in ("http", "https") or not parts.hostname:
            return False
        return _host_is_public(parts.hostname, parts.port or (443 if parts.scheme == "https" else 80))
    except ValueError:
        return False


def _open(url, headers):
    """GET with manual redirect handling so every hop is checked."""
    for _ in range(4):
        if not _is_public(url):
            return None, url
        res = _session.get(url, headers=headers, stream=True, timeout=(8, 30), allow_redirects=False)
        if res.status_code in (301, 302, 303, 307, 308) and res.headers.get("Location"):
            url = urljoin(url, res.headers["Location"])
            res.close()
            continue
        return res, url
    return None, url


def _xor_manifest(text, key_b64):
    key = base64.b64decode(key_b64 + "=" * (-len(key_b64) % 4))
    payload = base64.b64decode(text.strip() + "=" * (-len(text.strip()) % 4))
    out = bytes(b ^ key[i % len(key)] for i, b in enumerate(payload))
    return out.decode("utf-8", "replace").strip()


def _unwrap_image_segment(body):
    offset = 0
    if len(body) > 12 and body[:4] == b"RIFF" and body[8:12] == b"WEBP":
        offset = 12
    elif len(body) > 8 and body[:8] == b"\x89PNG\r\n\x1a\n":
        offset = 8
    if not offset:
        return None
    data = body[offset:]
    if data[:1] != b"G":  # 0x47 is the MPEG-TS sync byte; if it is missing the payload is XOR-masked
        data = bytes(b ^ FLIX_IMAGE_XOR[i % 16] for i, b in enumerate(data))
    return data


def _rewrite_playlist(request, text, base, referer, key):
    def wrap(ref):
        return build_url(request, urljoin(base, ref), referer=referer, key=key)

    lines = []
    for line in text.splitlines():
        stripped = line.strip()
        if not stripped:
            lines.append(line)
        elif stripped.startswith("#"):
            lines.append(re.sub(r'URI="([^"]+)"', lambda m: f'URI="{wrap(m.group(1))}"', line))
        else:
            lines.append(wrap(stripped))
    return "\n".join(lines) + "\n"


def _text(response, status=400):
    return HttpResponse(response, status=status, content_type="text/plain")


@require_http_methods(["GET", "HEAD"])
def stream_proxy(request):
    token, sig = request.GET.get("u", ""), request.GET.get("s", "")
    referer, key = request.GET.get("r", ""), request.GET.get("k", "")
    try:
        url = _b64d(token)
    except Exception:
        return _text("Bad url")
    if not hmac.compare_digest(sig, _sign(url, referer, key)):
        return _text("Bad signature", 403)

    headers = {"User-Agent": UA, "Accept": "*/*", "Accept-Encoding": "identity"}
    if referer:
        origin = urlparse(referer)
        headers["Referer"] = referer
        headers["Origin"] = f"{origin.scheme}://{origin.netloc}"
    if request.META.get("HTTP_RANGE"):
        headers["Range"] = request.META["HTTP_RANGE"]

    try:
        upstream, final_url = _open(url, headers)
    except requests.RequestException:
        return _text("Upstream unreachable", 502)
    if upstream is None:
        return _text("Blocked or too many redirects", 403)
    if upstream.status_code >= 400:
        code = upstream.status_code
        upstream.close()
        return _text(f"Upstream returned {code}", 502 if code >= 500 else code)

    chunks = upstream.iter_content(262144)
    first = next(chunks, b"")

    is_plain_playlist = first.lstrip()[:7] == b"#EXTM3U"
    is_masked_playlist = bool(key) and bool(first) and all(b in B64_CHARS for b in first[:512]) and first[:1] != b"G"
    if is_plain_playlist or is_masked_playlist:
        body = bytearray(first)
        for chunk in chunks:
            body += chunk
            if len(body) > MAX_PLAYLIST:
                break
        upstream.close()
        text = bytes(body).decode("utf-8", "replace")
        if not text.lstrip().startswith("#EXTM3U"):
            try:
                text = _xor_manifest(text, key)
            except Exception:
                return _text("Could not decode manifest", 502)
            if not text.startswith("#EXTM3U"):
                return _text("Could not decode manifest", 502)
        response = HttpResponse(
            _rewrite_playlist(request, text, final_url, referer, key),
            content_type="application/vnd.apple.mpegurl",
        )
        response["Cache-Control"] = "public, max-age=120"
        return response

    # Image-wrapped FlixCloud segments (PNG / WEBP with TS inside) need unwrapping.
    if first[:4] == b"RIFF" or first[:4] == b"\x89PNG":
        body = bytearray(first)
        for chunk in chunks:
            body += chunk
        upstream.close()
        data = _unwrap_image_segment(bytes(body))
        if data is not None:
            response = HttpResponse(data, content_type="video/mp2t")
            response["Cache-Control"] = "public, max-age=3600"
            return response
        first, chunks = bytes(body), iter(())

    def body_iter():
        try:
            if first:
                yield first
            for chunk in chunks:
                yield chunk
        finally:
            upstream.close()

    response = StreamingHttpResponse(
        body_iter(),
        status=upstream.status_code,
        content_type=upstream.headers.get("Content-Type", "application/octet-stream"),
    )
    for name in ("Content-Length", "Content-Range", "Accept-Ranges"):
        if upstream.headers.get(name):
            response[name] = upstream.headers[name]
    response["Cache-Control"] = "public, max-age=3600"
    return response

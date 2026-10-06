import { useEffect, useRef, useState } from "react";
import Hls from "hls.js";
import Icon from "./Icon";

const SPEEDS = [0.75, 1, 1.25, 1.5, 2];
const fsElement = () => document.fullscreenElement || document.webkitFullscreenElement || null;
const typing = () => /input|textarea|select/i.test(document.activeElement?.tagName || "");

/**
 * Plays one stream. Mount it with key={stream.play_url ?? stream.url} so a new stream
 * gets a fresh <video>. HLS goes through hls.js, MP4 plays natively, embeds use an iframe.
 */
export default function Player({
  stream, startAt = 0, autoSkip, autoNext, hasNext, hasPrev,
  onNext, onPrev, onProgress, onFatal, onStart,
}) {
  const wrap = useRef(null);
  const video = useRef(null);
  const hlsRef = useRef(null);
  const lastReport = useRef(0);
  const [levels, setLevels] = useState([]);
  const [level, setLevel] = useState(-1);
  const [speed, setSpeed] = useState(1);
  const [now, setNow] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffering, setBuffering] = useState(true);
  const [upNext, setUpNext] = useState(null); // seconds left before auto-next
  const [isFs, setIsFs] = useState(false);

  // Always call the latest callbacks without re-attaching the stream.
  const cb = useRef({});
  cb.current = { onNext, onPrev, onProgress, onFatal, onStart, hasNext, hasPrev, autoSkip };

  const isEmbed = stream.type === "embed";

  const report = (v, force, ended) => {
    if (!v || !Number.isFinite(v.duration) || v.duration < 1) return;
    const t = Date.now();
    if (!force && t - lastReport.current < 15000) return;
    lastReport.current = t;
    cb.current.onProgress?.({
      position: v.currentTime,
      duration: v.duration,
      completed: ended || v.currentTime / v.duration > 0.9,
    });
  };

  // Attach the source.
  useEffect(() => {
    const v = video.current;
    if (!v || isEmbed) return undefined;
    let hls = null;
    let netRetries = 0;
    let recovered = false;
    let seeked = false;
    const seekToStart = () => {
      if (seeked) return;
      seeked = true;
      if (startAt > 5) v.currentTime = startAt;
    };

    if (stream.type === "hls" && Hls.isSupported()) {
      hls = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
        startFragPrefetch: true, // begin fetching the first segment while the playlist is still parsing
        capLevelToPlayerSize: true, // don't pull 1080p into a small player
        maxBufferLength: 40,
        maxMaxBufferLength: 90,
        backBufferLength: 30,
        manifestLoadingMaxRetry: 2,
        levelLoadingMaxRetry: 2,
        fragLoadingMaxRetry: 4,
      });
      hlsRef.current = hls;
      hls.loadSource(stream.play_url);
      hls.attachMedia(v);
      hls.on(Hls.Events.MANIFEST_PARSED, (_, data) => {
        setLevels(data.levels.map((l, index) => ({ index, height: l.height })).filter((l) => l.height));
        seekToStart();
        v.play().catch(() => {});
      });
      hls.on(Hls.Events.ERROR, (_, data) => {
        if (!data.fatal) return;
        if (data.type === Hls.ErrorTypes.NETWORK_ERROR && netRetries < 2) {
          netRetries += 1;
          hls.startLoad();
        } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR && !recovered) {
          recovered = true;
          hls.recoverMediaError();
        } else {
          cb.current.onFatal?.(data.details || "playback failed");
        }
      });
    } else {
      // Safari plays HLS natively; MP4 works everywhere.
      v.src = stream.play_url;
      v.addEventListener("loadedmetadata", seekToStart, { once: true });
      v.play().catch(() => {});
    }

    return () => {
      report(v, true);
      hls?.destroy();
      hlsRef.current = null;
      v.pause();
      v.removeAttribute("src");
      v.load();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stream.play_url]);

  // Skip intro / outro.
  const intro = stream.intro;
  const outro = stream.outro;
  const inIntro = !!intro && now >= intro.start && now < intro.end - 1;
  const inOutro = !!outro && now >= outro.start && now < outro.end;
  const nearEnd = duration > 0 && duration - now < 75;
  useEffect(() => {
    if (inIntro && cb.current.autoSkip && video.current) video.current.currentTime = intro.end;
  }, [inIntro, intro]);

  // Auto-play next: a short countdown the viewer can cancel.
  useEffect(() => {
    if (upNext == null) return undefined;
    if (upNext <= 0) {
      setUpNext(null);
      cb.current.onNext?.();
      return undefined;
    }
    const t = setTimeout(() => setUpNext((n) => (n == null ? n : n - 1)), 1000);
    return () => clearTimeout(t);
  }, [upNext]);

  // Keyboard shortcuts (ignored while typing in a field).
  useEffect(() => {
    const onKey = (e) => {
      const v = video.current;
      if (!v || typing() || e.ctrlKey || e.metaKey || e.altKey) return;
      const seek = (s) => {
        v.currentTime = Math.max(0, Math.min(v.duration || Infinity, v.currentTime + s));
      };
      switch (e.key) {
        case " ":
        case "k":
          e.preventDefault();
          v.paused ? v.play() : v.pause();
          break;
        case "ArrowLeft": e.preventDefault(); seek(-5); break;
        case "ArrowRight": e.preventDefault(); seek(5); break;
        case "j": seek(-10); break;
        case "l": seek(10); break;
        case "ArrowUp": e.preventDefault(); v.volume = Math.min(1, v.volume + 0.05); break;
        case "ArrowDown": e.preventDefault(); v.volume = Math.max(0, v.volume - 0.05); break;
        case "m": v.muted = !v.muted; break;
        case "f": toggleFullscreen(); break;
        case "n": if (cb.current.hasNext) cb.current.onNext?.(); break;
        case "p": if (cb.current.hasPrev) cb.current.onPrev?.(); break;
        default:
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Fullscreen the whole player (not just the <video>) so Skip intro, Next episode and the
  // quality/speed bar keep working. iPhone Safari can only fullscreen the <video> itself.
  const toggleFullscreen = () => {
    const el = wrap.current;
    const v = video.current;
    if (fsElement()) {
      (document.exitFullscreen || document.webkitExitFullscreen)?.call(document);
      return;
    }
    if (!el) return;
    if (el.requestFullscreen || el.webkitRequestFullscreen) {
      const req = (el.requestFullscreen || el.webkitRequestFullscreen).call(el);
      Promise.resolve(req)
        .then(() => screen.orientation?.lock?.("landscape")) // phones: turn to landscape
        .catch(() => {});
    } else if (v?.webkitEnterFullscreen) {
      v.webkitEnterFullscreen();
    }
  };

  useEffect(() => {
    const onChange = () => {
      const on = fsElement() === wrap.current;
      setIsFs(on);
      if (!on) {
        try { screen.orientation?.unlock?.(); } catch { /* not supported */ }
      }
    };
    document.addEventListener("fullscreenchange", onChange);
    document.addEventListener("webkitfullscreenchange", onChange);
    return () => {
      document.removeEventListener("fullscreenchange", onChange);
      document.removeEventListener("webkitfullscreenchange", onChange);
    };
  }, []);

  const pickLevel = (value) => {
    const n = Number(value);
    setLevel(n);
    if (hlsRef.current) hlsRef.current.currentLevel = n; // -1 = automatic
  };
  const pickSpeed = (value) => {
    const n = Number(value);
    setSpeed(n);
    if (video.current) video.current.playbackRate = n;
  };

  if (isEmbed) {
    return (
      <div className="player" ref={wrap}>
        <iframe
          className="player-embed"
          src={stream.url}
          title="Video player"
          allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
          allowFullScreen
        />
        <div className="player-tools">
        <button
          type="button"
          className="icon-btn glass"
          onClick={toggleFullscreen}
          aria-label={isFs ? "Exit fullscreen (f)" : "Fullscreen (f)"}
          title={isFs ? "Exit fullscreen (f)" : "Fullscreen (f)"}
        >
          <Icon name={isFs ? "compress" : "expand"} size={18} />
        </button>
        </div>
      </div>
    );
  }

  return (
    <div className="player" ref={wrap}>
      <video
        ref={video}
        className="player-video"
        controls
        controlsList="nofullscreen"
        playsInline
        preload="auto"
        crossOrigin="anonymous"
        onDoubleClick={toggleFullscreen}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
        onTimeUpdate={(e) => {
          setNow(e.currentTarget.currentTime);
          report(e.currentTarget, false);
        }}
        onPlaying={() => {
          setBuffering(false);
          setUpNext(null);
          cb.current.onStart?.();
        }}
        onWaiting={() => setBuffering(true)}
        onCanPlay={() => setBuffering(false)}
        onPause={(e) => report(e.currentTarget, true)}
        onEnded={(e) => {
          report(e.currentTarget, true, true);
          if (autoNext && cb.current.hasNext) setUpNext(5);
        }}
        onError={() => !hlsRef.current && cb.current.onFatal?.("media error")}
      >
        {(stream.subtitles || []).map((s, i) => (
          <track key={s.url} kind="subtitles" src={s.url} srcLang={s.lang || "en"} label={s.label} default={s.default || i === 0} />
        ))}
      </video>

      {buffering && <div className="player-spin" aria-label="Loading video" />}

      <div className="player-tools">
        <button
          type="button"
          className="icon-btn glass"
          onClick={toggleFullscreen}
          aria-label={isFs ? "Exit fullscreen (f)" : "Fullscreen (f)"}
          title={isFs ? "Exit fullscreen (f)" : "Fullscreen (f)"}
        >
          <Icon name={isFs ? "compress" : "expand"} size={18} />
        </button>
      </div>

      <div className="player-skips">
        {inIntro && (
          <button type="button" className="btn btn-light btn-sm" onClick={() => (video.current.currentTime = intro.end)}>
            Skip intro
          </button>
        )}
        {hasNext && (inOutro || nearEnd) && upNext == null && (
          <button type="button" className="btn btn-primary btn-sm" onClick={() => onNext?.()}>
            Next episode <Icon name="next" size={14} />
          </button>
        )}
      </div>

      {upNext != null && (
        <div className="player-upnext">
          <p>Next episode in {upNext}</p>
          <div>
            <button type="button" className="btn btn-primary btn-sm" onClick={() => onNext?.()}>Play now</button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setUpNext(null)}>Cancel</button>
          </div>
        </div>
      )}

      <div className="player-bar">
        {levels.length > 1 && (
          <label>
            Quality
            <select value={level} onChange={(e) => pickLevel(e.target.value)}>
              <option value={-1}>Auto</option>
              {[...levels].sort((a, b) => b.height - a.height).map((l) => (
                <option key={l.index} value={l.index}>{l.height}p</option>
              ))}
            </select>
          </label>
        )}
        <label>
          Speed
          <select value={speed} onChange={(e) => pickSpeed(e.target.value)}>
            {SPEEDS.map((s) => <option key={s} value={s}>{s}x</option>)}
          </select>
        </label>
        <span className="player-hint">Space play, arrows seek, F fullscreen, N next</span>
      </div>
    </div>
  );
}

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Anime, Lib, Stream } from "../api/client";
import AnimeCard from "../components/AnimeCard";
import Comments from "../components/Comments";
import EpisodeList from "../components/EpisodeList";
import Icon from "../components/Icon";
import LibraryActions from "../components/LibraryActions";
import Player from "../components/Player";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { useAsync, usePageTitle } from "../hooks/useAsync";
import { useEpisodes } from "../hooks/useEpisodes";
import { usePref } from "../hooks/usePref";
import { animeProgress, saveProgress } from "../lib/progress";
import { cleanDesc, colorOf, coverOf, titleOf } from "../lib/util";

export default function Watch() {
  const { id } = useParams();
  const anilistId = Number(id);
  const [sp, setSp] = useSearchParams();
  const nav = useNavigate();
  const { user } = useAuth();
  const toast = useToast();

  const media = useAsync((s) => Anime.detail(anilistId, s), [anilistId]);
  const eps = useEpisodes(anilistId);
  const [progress, setProgress] = useState({ ready: false, rows: [] });

  const [autoNext, setAutoNext] = usePref("autonext", true);
  const [autoSkip, setAutoSkip] = usePref("autoskip", false);
  const [focus, setFocus] = useState(false);
  const [prefAudio, setPrefAudio] = usePref("audio", "sub");
  const [prefSrc, setPrefSrc] = usePref("source", "");

  const episodes = eps.data?.episodes || [];
  const epNum = Number(sp.get("ep")) || 1;
  const current = episodes.find((e) => e.number === epNum);
  const wantedAudio = sp.get("audio") || prefAudio;
  const audio = current ? (current[wantedAudio] ? wantedAudio : current.sub ? "sub" : "dub") : wantedAudio;
  const providers = useMemo(
    () => (eps.data?.providers || []).filter((p) => p[audio].includes(epNum)),
    [eps.data, audio, epNum]
  );
  const providersRef = useRef(providers);
  providersRef.current = providers;
  const nextEp = episodes.find((e) => e.number > epNum);
  const prevEp = [...episodes].reverse().find((e) => e.number < epNum);

  const title = media.data ? titleOf(media.data) : "";
  usePageTitle(title ? `${title} - Episode ${epNum}` : "Watch");

  useEffect(() => {
    if (media.data) document.documentElement.style.setProperty("--ambient", colorOf(media.data));
    return () => document.documentElement.style.removeProperty("--ambient");
  }, [media.data]);

  // Saved progress for this anime (resume position, watched marks).
  useEffect(() => {
    setProgress({ ready: false, rows: [] });
    animeProgress(user, anilistId).then((rows) => setProgress({ ready: true, rows }));
  }, [user?.id, anilistId]);
  const watched = useMemo(() => new Set(progress.rows.filter((r) => r.completed).map((r) => r.episode)), [progress.rows]);
  const startAt = useMemo(() => {
    const row = progress.rows.find((r) => r.episode === epNum);
    return row && !row.completed && row.position > 10 ? row.position : 0;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [progress.ready, epNum, anilistId]);

  // An episode number that doesn't exist (e.g. a stale link) falls back to the first one.
  useEffect(() => {
    if (episodes.length && !current) {
      setSp({ ep: String(episodes[0].number) }, { replace: true });
    }
  }, [episodes, current, setSp]);

  // ---- Loading streams, with automatic fallback across sources -------------
  const [load, setLoad] = useState({ state: "idle", streams: [], provider: null, error: null });
  const [streamIdx, setStreamIdx] = useState(0);
  const tried = useRef(new Set());
  const reqId = useRef(0);

  const fetchFrom = useCallback(
    async (providerId) => {
      const mine = ++reqId.current;
      tried.current.add(providerId);
      setLoad({ state: "loading", streams: [], provider: providerId, error: null });
      setStreamIdx(0);
      try {
        const res = await Stream.watch(anilistId, { provider: providerId, audio, ep: epNum });
        if (mine !== reqId.current) return;
        setLoad({ state: "ready", streams: res.streams, provider: providerId, error: null });
      } catch (e) {
        if (mine !== reqId.current) return;
        const list = providersRef.current;
        const next = list.find((p) => !tried.current.has(p.id));
        if (next) {
          const name = list.find((p) => p.id === providerId)?.name || providerId;
          toast(`${name} didn't respond. Trying ${next.name}...`);
          fetchFrom(next.id);
        } else {
          setLoad({ state: "error", streams: [], provider: providerId, error: e.message });
        }
      }
    },
    [anilistId, audio, epNum, toast]
  );

  const key = `${anilistId}:${epNum}:${audio}`;
  useEffect(() => {
    if (!eps.data || !current) return undefined;
    tried.current = new Set();
    if (providers.length === 0) {
      reqId.current += 1;
      setLoad({ state: "none", streams: [], provider: null, error: null });
      return undefined;
    }
    fetchFrom((providers.find((p) => p.id === prefSrc) || providers[0]).id);
    return () => {
      reqId.current += 1; // drop any in-flight response for the old episode
    };
    // Only restart when the episode changes or the first source appears; sources that join
    // later just show up in the picker without interrupting playback.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, Boolean(eps.data), providers.length > 0]);

  const onFatal = useCallback(() => {
    if (streamIdx + 1 < load.streams.length) {
      toast("That server failed. Trying the next one.");
      setStreamIdx((i) => i + 1);
      return;
    }
    const next = providersRef.current.find((p) => !tried.current.has(p.id));
    if (next) {
      toast(`Playback failed. Trying ${next.name}...`);
      fetchFrom(next.id);
    } else {
      setLoad((l) => ({ ...l, state: "error", error: "Playback failed on every source. Try again in a moment." }));
    }
  }, [streamIdx, load.streams.length, fetchFrom, toast]);

  const pickSource = (pid) => {
    setPrefSrc(pid);
    tried.current = new Set();
    fetchFrom(pid);
  };

  // ---- Reporting ----------------------------------------------------------
  const viewed = useRef(new Set());
  const onStart = useCallback(() => {
    const k = `${anilistId}:${epNum}`;
    if (viewed.current.has(k)) return;
    viewed.current.add(k);
    Lib.recordView(anilistId).catch(() => {});
  }, [anilistId, epNum]);

  const onProgress = useCallback(
    (p) => {
      const payload = {
        anilist_id: anilistId,
        episode: epNum,
        audio,
        provider: load.provider || "",
        position: Math.round(p.position),
        duration: Math.round(p.duration),
        completed: p.completed,
        title,
        cover: media.data ? coverOf(media.data) : "",
        total_episodes: media.data?.episodes || null,
      };
      saveProgress(user, payload);
      setProgress((prev) => ({
        ...prev,
        rows: [...prev.rows.filter((r) => r.episode !== epNum), { ...payload, updated_at: new Date().toISOString() }],
      }));
    },
    [anilistId, epNum, audio, load.provider, title, media.data, user]
  );

  // ---- Navigation -----------------------------------------------------------
  const goEpisode = (n) => setSp({ ep: String(n), audio }, { replace: false });
  const goNext = () => nextEp && goEpisode(nextEp.number);
  const goPrev = () => prevEp && goEpisode(prevEp.number);
  const chooseAudio = (a) => {
    setPrefAudio(a);
    setSp({ ep: String(epNum), audio: a });
  };

  const stream = load.streams[streamIdx];

  let slot;
  if (eps.loading || (eps.data && !current && episodes.length > 0)) {
    slot = <Status busy title="Finding sources" text="The first lookup for a title can take up to a minute. Hang tight." />;
  } else if (eps.error) {
    slot = (
      <Status title="Couldn't reach the streaming API" text={eps.error.message}>
        <button type="button" className="btn btn-primary" onClick={eps.reload}>Try again</button>
      </Status>
    );
  } else if (eps.data && episodes.length === 0) {
    slot = <Status title="No sources yet" text="None of our sources have episodes for this title. If it just started airing, check back after the first episode." />;
  } else if (load.state === "none" && eps.data?.complete === false) {
    slot = <Status busy title="Checking more sources" text="This episode isn't on the quick sources. Looking through the rest." />;
  } else if (load.state === "none") {
    slot = (
      <Status title={`No ${audio === "dub" ? "dubbed" : "subbed"} source for episode ${epNum}`} text="Try the other audio track or another episode." />
    );
  } else if (load.state === "loading" || load.state === "idle" || !progress.ready) {
    const name = providers.find((p) => p.id === load.provider)?.name;
    slot = <Status busy title={name ? `Loading from ${name}` : "Loading"} text="Switching to another source automatically if this one fails." />;
  } else if (load.state === "error") {
    slot = (
      <Status title="This episode wouldn't load" text={load.error}>
        <button type="button" className="btn btn-primary" onClick={() => { tried.current = new Set(); fetchFrom(providers[0].id); }}>
          Try again
        </button>
      </Status>
    );
  } else if (stream) {
    slot = (
      <Player
        key={`${key}:${load.provider}:${stream.play_url || stream.url}`}
        stream={stream}
        startAt={startAt}
        autoSkip={autoSkip}
        autoNext={autoNext}
        hasNext={!!nextEp}
        hasPrev={!!prevEp}
        onNext={goNext}
        onPrev={goPrev}
        onProgress={onProgress}
        onFatal={onFatal}
        onStart={onStart}
      />
    );
  }

  const m = media.data;
  return (
    <div className={`page watch ${focus ? "is-focus" : ""}`}>
      <nav className="crumbs" aria-label="Breadcrumb">
        <Link to="/">Home</Link>
        <span aria-hidden="true">/</span>
        <Link to={`/anime/${anilistId}`}>{title || "Anime"}</Link>
        <span aria-hidden="true">/</span>
        <span>Episode {epNum}</span>
      </nav>

      <div className="watch-grid">
        <div className="watch-main">
          <div className="player-slot">{slot}</div>

          <div className="panel watch-controls">
            <div className="wc-row">
              <button type="button" className="btn btn-ghost btn-sm" disabled={!prevEp} onClick={goPrev}>
                <Icon name="prev" size={14} /> Previous
              </button>
              <button type="button" className="btn btn-ghost btn-sm" disabled={!nextEp} onClick={goNext}>
                Next <Icon name="next" size={14} />
              </button>
              <label className="toggle"><input type="checkbox" checked={autoNext} onChange={(e) => setAutoNext(e.target.checked)} /> Auto next</label>
              <label className="toggle"><input type="checkbox" checked={autoSkip} onChange={(e) => setAutoSkip(e.target.checked)} /> Auto skip intro</label>
              <button type="button" className={`btn btn-sm ${focus ? "btn-soft" : "btn-ghost"}`} onClick={() => setFocus((f) => !f)} aria-pressed={focus}>
                <Icon name="bulb" size={14} /> Focus
              </button>
            </div>

            {current && (
              <div className="wc-row">
                <span className="wc-label">Audio</span>
                <div className="seg">
                  <button type="button" className={audio === "sub" ? "is-on" : ""} disabled={!current.sub} onClick={() => chooseAudio("sub")}>Sub</button>
                  <button type="button" className={audio === "dub" ? "is-on" : ""} disabled={!current.dub} onClick={() => chooseAudio("dub")}>Dub</button>
                </div>
              </div>
            )}
            {providers.length > 0 && (
              <div className="wc-row">
                <span className="wc-label">Source</span>
                <div className="chips">
                  {providers.map((p) => (
                    <button key={p.id} type="button" className={`chip-btn ${load.provider === p.id ? "is-on" : ""}`} onClick={() => pickSource(p.id)}>
                      {p.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {load.streams.length > 1 && (
              <div className="wc-row">
                <span className="wc-label">Server</span>
                <div className="chips">
                  {load.streams.map((s, i) => (
                    <button key={`${s.server}-${i}`} type="button" className={`chip-btn ${i === streamIdx ? "is-on" : ""}`} onClick={() => setStreamIdx(i)}>
                      {s.server}{s.type === "embed" ? " (embed)" : ""}{s.quality ? ` ${s.quality}` : ""}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="watch-info">
            <h1>{title || "Loading..."}</h1>
            <p className="watch-ep">
              Episode {epNum}{current?.title ? `: ${current.title}` : ""}
              {current?.filler && <span className="pill pill-gold">Filler</span>}
            </p>
            {m && <p className="watch-desc">{cleanDesc(m.description).slice(0, 360)}{cleanDesc(m.description).length > 360 ? "..." : ""}</p>}
            {m && <LibraryActions media={m} />}
          </div>

          <Comments anilistId={anilistId} episode={epNum} title={title} />
        </div>

        <aside className="watch-side">
          {episodes.length > 0 && (
            <EpisodeList episodes={episodes} current={epNum} audio={audio} watched={watched} onSelect={goEpisode} />
          )}
          {m?.recommendations?.length > 0 && (
            <div className="panel">
              <header className="panel-head"><h2>More like this</h2></header>
              <div className="side-cards">
                {m.recommendations.slice(0, 4).map((r) => <AnimeCard key={r.id} media={r} />)}
              </div>
            </div>
          )}
        </aside>
      </div>
      {focus && <div className="focus-dim" onClick={() => setFocus(false)} aria-hidden="true" />}
    </div>
  );
}

function Status({ title, text, busy, children }) {
  return (
    <div className="player player-status" role="status">
      {busy ? <div className="player-spin is-static" /> : <Icon name="alert" size={30} />}
      <h2>{title}</h2>
      {text && <p>{text}</p>}
      {children}
    </div>
  );
}

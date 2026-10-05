import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Anime } from "../api/client";
import AnimeCard from "../components/AnimeCard";
import Comments from "../components/Comments";
import EpisodeList from "../components/EpisodeList";
import Icon from "../components/Icon";
import LibraryActions from "../components/LibraryActions";
import { Row } from "../components/Section";
import { useAuth } from "../context/AuthContext";
import { useAsync, usePageTitle } from "../hooks/useAsync";
import { useEpisodes } from "../hooks/useEpisodes";
import { animeProgress } from "../lib/progress";
import {
  FORMAT_LABEL, STATUS_LABEL, cleanDesc, colorOf, countdown, coverOf, fuzzyDate, scoreOf, seasonLabel, titleOf,
} from "../lib/util";

const RELATION = (r) => r.replace(/_/g, " ").toLowerCase().replace(/^./, (c) => c.toUpperCase());

export default function Detail() {
  const { id } = useParams();
  const nav = useNavigate();
  const { user } = useAuth();
  const { data: m, loading, error, reload } = useAsync((s) => Anime.detail(id, s), [id]);
  const eps = useEpisodes(id);
  const [progress, setProgress] = useState([]);
  const [more, setMore] = useState(false);
  const [trailer, setTrailer] = useState(false);

  usePageTitle(m ? titleOf(m) : "Anime");
  useEffect(() => { setMore(false); setTrailer(false); }, [id]);
  useEffect(() => { animeProgress(user, id).then(setProgress); }, [user?.id, id]);
  useEffect(() => {
    if (m) document.documentElement.style.setProperty("--ambient", colorOf(m));
    return () => document.documentElement.style.removeProperty("--ambient");
  }, [m]);

  const watched = useMemo(() => new Set(progress.filter((r) => r.completed).map((r) => r.episode)), [progress]);
  const last = useMemo(() => [...progress].sort((a, b) => (b.updated_at || "").localeCompare(a.updated_at || ""))[0], [progress]);

  if (error) {
    return (
      <div className="page empty">
        <h1>{error.status === 404 ? "We couldn't find that anime" : "Something went wrong"}</h1>
        <p className="muted">{error.message}</p>
        <div className="row-gap">
          {error.status !== 404 && <button type="button" className="btn btn-primary" onClick={reload}>Try again</button>}
          <Link to="/browse" className="btn btn-ghost">Browse anime</Link>
        </div>
      </div>
    );
  }
  if (loading || !m) return <div className="page"><div className="skel detail-skel" aria-label="Loading" /></div>;

  const desc = cleanDesc(m.description);
  const score = scoreOf(m);
  const trailerOk = m.trailer?.site === "youtube" && m.trailer?.id;
  const nextAir = m.nextAiringEpisode;
  const resumeEp = last ? (last.completed ? last.episode + 1 : last.episode) : 1;
  const firstEp = eps.data?.episodes?.[0]?.number ?? 1;
  const hasEp = (n) => !eps.data || eps.data.episodes.some((e) => e.number === n);
  const watchEp = last && hasEp(resumeEp) ? resumeEp : firstEp;
  const facts = [
    ["Type", FORMAT_LABEL[m.format] || m.format],
    ["Episodes", m.episodes || (nextAir ? `${nextAir.episode - 1}+` : "?")],
    ["Duration", m.duration ? `${m.duration} min` : null],
    ["Status", STATUS_LABEL[m.status]],
    ["Season", seasonLabel(m)],
    ["Aired", m.startDate?.year ? `${fuzzyDate(m.startDate)}${m.endDate?.year ? ` to ${fuzzyDate(m.endDate)}` : ""}` : null],
    ["Studio", m.studios?.join(", ")],
    ["Source", m.source ? m.source.replace(/_/g, " ").toLowerCase() : null],
  ].filter(([, v]) => v);

  return (
    <div className="detail">
      <div className="detail-banner" aria-hidden="true">
        {m.bannerImage ? <img src={m.bannerImage} alt="" /> : <img src={coverOf(m)} alt="" className="is-cover" />}
      </div>

      <div className="page detail-top">
        <img className="detail-poster" src={m.coverImage?.extraLarge || coverOf(m)} alt={`${titleOf(m)} poster`} />
        <div className="detail-info">
          <div className="hero-chips">
            <span className="pill">{FORMAT_LABEL[m.format] || m.format}</span>
            <span className="pill">{STATUS_LABEL[m.status]}</span>
            {score && <span className="pill pill-gold"><Icon name="star" size={12} fill="currentColor" /> {score}</span>}
            {m.duration && <span className="pill">{m.duration} min</span>}
          </div>
          <h1 className="detail-title">{titleOf(m)}</h1>
          {m.title?.native && <p className="hero-native" lang="ja">{m.title.native}</p>}

          {nextAir && (
            <p className="airing-note">
              <Icon name="clock" size={16} /> Episode {nextAir.episode} airs in {countdown(nextAir.airingAt - Date.now() / 1000)}
            </p>
          )}

          <div className="hero-actions">
            <Link to={`/watch/${m.id}?ep=${watchEp}`} className="btn btn-primary btn-lg">
              <Icon name="play" size={18} /> {last ? `Continue episode ${watchEp}` : "Watch now"}
            </Link>
            {trailerOk && (
              <button type="button" className="btn btn-ghost btn-lg" onClick={() => setTrailer((t) => !t)}>
                {trailer ? "Hide trailer" : "Trailer"}
              </button>
            )}
            <LibraryActions media={m} />
          </div>

          <p className={`detail-desc ${more ? "is-open" : ""}`}>{desc || "No synopsis yet."}</p>
          {desc.length > 320 && (
            <button type="button" className="link-btn" onClick={() => setMore((v) => !v)}>
              {more ? "Show less" : "Read more"}
            </button>
          )}

          <div className="tag-row">
            {m.genres?.map((g) => <Link key={g} to={`/browse?genre=${encodeURIComponent(g)}`} className="chip-btn">{g}</Link>)}
          </div>
        </div>
      </div>

      <div className="page detail-body">
        {trailer && trailerOk && (
          <div className="trailer">
            <iframe src={`https://www.youtube.com/embed/${m.trailer.id}?autoplay=1`} title="Trailer" allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen />
          </div>
        )}

        <dl className="facts">
          {facts.map(([k, v]) => (
            <div key={k}><dt>{k}</dt><dd>{v}</dd></div>
          ))}
        </dl>

        <section className="section">
          <header className="section-head"><h2>Episodes</h2></header>
          {eps.loading && <p className="muted">Looking for sources. The first lookup for a title can take up to 45 seconds.</p>}
          {eps.error && (
            <div className="notice notice-error">
              <p>{eps.error.message}</p>
              <button type="button" className="btn btn-primary btn-sm" onClick={eps.reload}>Try again</button>
            </div>
          )}
          {eps.data && eps.data.episodes.length === 0 && (
            <p className="muted">No source has episodes for this title yet. Check back after it airs.</p>
          )}
          {eps.data?.episodes.length > 0 && (
            <EpisodeList
              episodes={eps.data.episodes}
              current={null}
              audio="sub"
              watched={watched}
              onSelect={(n) => nav(`/watch/${m.id}?ep=${n}`)}
            />
          )}
          {eps.data?.has_dub && <p className="muted note">English dub is available for some episodes. Pick it on the watch page.</p>}
          {eps.data && eps.data.complete === false && <p className="muted note">Checking more sources in the background...</p>}
        </section>

        {m.characters?.length > 0 && (
          <Row title="Characters">
            {m.characters.map(({ character, role, voice_actor }) => (
              <div className="person" key={character.id}>
                <img src={character.image?.large} alt="" loading="lazy" />
                <b>{character.name.full}</b>
                <small>{role === "MAIN" ? "Main" : "Supporting"}</small>
                {voice_actor && <small className="muted">{voice_actor.name.full}</small>}
              </div>
            ))}
          </Row>
        )}

        {m.relations?.length > 0 && (
          <Row title="Related">
            {m.relations.map((r) => <AnimeCard key={r.media.id} media={r.media} sub={RELATION(r.relation)} />)}
          </Row>
        )}

        {m.recommendations?.length > 0 && (
          <Row title="You might also like">
            {m.recommendations.map((r) => <AnimeCard key={r.id} media={r} />)}
          </Row>
        )}

        <Comments anilistId={m.id} title={titleOf(m)} />
      </div>
    </div>
  );
}

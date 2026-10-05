import { Link } from "react-router-dom";
import Icon from "./Icon";
import {
  FORMAT_LABEL, STATUS_LABEL, colorOf, coverOf, releasedEpisodes, scoreOf, seasonLabel, titleOf,
} from "../lib/util";

function episodeBadge(m) {
  if (m.format === "MOVIE") return null;
  if (m.status === "RELEASING") {
    const out = releasedEpisodes(m);
    return out ? `Ep ${out}${m.episodes ? ` / ${m.episodes}` : ""}` : null;
  }
  return m.episodes ? `${m.episodes} eps` : null;
}

/** `to` and `sub` let the same card serve continue-watching and history rows. */
export default function AnimeCard({ media, to, sub, progress }) {
  const title = titleOf(media);
  const eps = episodeBadge(media);
  const score = scoreOf(media);
  return (
    <Link to={to || `/anime/${media.id}`} className="card" style={{ "--c": colorOf(media) }} title={title}>
      <div className="card-poster">
        <img src={coverOf(media)} alt="" loading="lazy" onError={(e) => (e.currentTarget.style.visibility = "hidden")} />
        {media.format && <span className="chip chip-format">{FORMAT_LABEL[media.format] || media.format}</span>}
        {score && (
          <span className="chip chip-score">
            <Icon name="star" size={11} fill="currentColor" />
            {score}
          </span>
        )}
        {eps && <span className="chip chip-eps">{eps}</span>}
        <span className="card-play" aria-hidden="true">
          <Icon name="play" size={26} />
        </span>
        {progress != null && (
          <span className="card-bar">
            <i style={{ width: `${Math.min(100, Math.round(progress * 100))}%` }} />
          </span>
        )}
      </div>
      <div className="card-title">{title}</div>
      <div className="card-meta">{sub ?? (seasonLabel(media) || STATUS_LABEL[media.status] || "")}</div>
    </Link>
  );
}

export function CardSkeletons({ n = 12 }) {
  return Array.from({ length: n }, (_, i) => (
    <div className="card card-skel" key={i} aria-hidden="true">
      <div className="card-poster skel" />
      <div className="skel skel-line" />
      <div className="skel skel-line short" />
    </div>
  ));
}

import { useState } from "react";
import { Link } from "react-router-dom";
import { Anime } from "../api/client";
import { useAsync } from "../hooks/useAsync";
import { FORMAT_LABEL, coverOf, releasedEpisodes, titleOf, colorOf } from "../lib/util";

const PERIODS = [["day", "Day"], ["week", "Week"], ["month", "Month"]];

export default function Top10() {
  const [period, setPeriod] = useState("day");
  const { data, loading, error } = useAsync((s) => Anime.top(period, s), [period]);

  return (
    <aside className="panel top10" aria-label="Top 10">
      <header className="panel-head">
        <h2>Top 10</h2>
        <div className="seg" role="tablist">
          {PERIODS.map(([key, label]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={period === key}
              className={period === key ? "is-on" : ""}
              onClick={() => setPeriod(key)}
            >
              {label}
            </button>
          ))}
        </div>
      </header>
      {error && <p className="muted pad">Couldn't load the ranking. Try again shortly.</p>}
      <ol className="top-list">
        {loading &&
          Array.from({ length: 10 }, (_, i) => (
            <li key={i} className="top-item">
              <span className="top-rank">{i + 1}</span>
              <div className="skel top-thumb" />
              <div className="skel skel-line" style={{ flex: 1 }} />
            </li>
          ))}
        {(data || []).map((m, i) => {
          const out = releasedEpisodes(m);
          return (
            <li key={m.id}>
              <Link to={`/anime/${m.id}`} className="top-item" style={{ "--c": colorOf(m) }}>
                <span className={`top-rank ${i < 3 ? "is-podium" : ""}`}>{i + 1}</span>
                <img src={coverOf(m)} alt="" loading="lazy" className="top-thumb" />
                <span className="top-info">
                  <span className="top-title">{titleOf(m)}</span>
                  <span className="top-meta">
                    <span>{FORMAT_LABEL[m.format] || m.format}</span>
                    {out ? <span>Ep {out}</span> : null}
                    {m.views ? <span>{m.views} views</span> : null}
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ol>
    </aside>
  );
}

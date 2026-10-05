import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Anime } from "../api/client";
import { useAsync, usePageTitle } from "../hooks/useAsync";
import { FORMAT_LABEL, colorOf, countdown, coverOf, titleOf } from "../lib/util";

const dayStart = (offset) => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + offset);
  return d;
};

export default function Schedule() {
  usePageTitle("Airing schedule");
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => dayStart(i)), []);
  const [sel, setSel] = useState(0);
  const [now, setNow] = useState(Date.now() / 1000);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now() / 1000), 30000);
    return () => clearInterval(t);
  }, []);

  const start = Math.floor(days[sel].getTime() / 1000);
  const end = Math.floor(dayStart(sel + 1).getTime() / 1000);
  const { data, loading, error, reload } = useAsync((s) => Anime.schedule(start, end, s), [start]);

  return (
    <div className="page">
      <header className="page-head">
        <h1>Airing schedule</h1>
        <p className="muted">Times are shown in your local time zone.</p>
      </header>

      <div className="day-tabs" role="tablist">
        {days.map((d, i) => (
          <button key={i} type="button" role="tab" aria-selected={i === sel} className={i === sel ? "is-on" : ""} onClick={() => setSel(i)}>
            <span>{i === 0 ? "Today" : d.toLocaleDateString([], { weekday: "short" })}</span>
            <b>{d.getDate()}</b>
            <small>{d.toLocaleDateString([], { month: "short" })}</small>
          </button>
        ))}
      </div>

      {error && (
        <div className="notice notice-error">
          <p>{error.message}</p>
          <button type="button" className="btn btn-primary btn-sm" onClick={reload}>Try again</button>
        </div>
      )}
      {loading && <p className="muted">Loading the schedule...</p>}
      {data && data.length === 0 && <div className="empty"><h2>Nothing airs on this day</h2></div>}

      <ol className="sched">
        {(data || []).map((item) => {
          const aired = item.airingAt <= now;
          const m = item.media;
          return (
            <li key={item.id} style={{ "--c": colorOf(m) }}>
              <time className="sched-time">
                {new Date(item.airingAt * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </time>
              <Link to={`/anime/${m.id}`} className="sched-main">
                <img src={coverOf(m)} alt="" loading="lazy" />
                <span>
                  <b>{titleOf(m)}</b>
                  <small>{FORMAT_LABEL[m.format] || m.format}, episode {item.episode}</small>
                </span>
              </Link>
              {aired ? (
                <Link to={`/watch/${m.id}?ep=${item.episode}`} className="btn btn-soft btn-sm">Watch</Link>
              ) : (
                <span className="sched-count">in {countdown(item.airingAt - now)}</span>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

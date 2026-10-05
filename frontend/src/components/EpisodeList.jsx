import { useEffect, useMemo, useState } from "react";
import Icon from "./Icon";

const SIZE = 100;

export default function EpisodeList({ episodes, current, audio, watched, onSelect, height }) {
  const [view, setView] = useState(() => localStorage.getItem("anivexa.epview") || "grid");
  const ranges = useMemo(() => {
    const out = new Map();
    episodes.forEach((e) => {
      const g = Math.floor((e.number - 1) / SIZE);
      if (!out.has(g)) out.set(g, []);
      out.get(g).push(e);
    });
    return [...out.entries()].sort((a, b) => a[0] - b[0]);
  }, [episodes]);
  const [group, setGroup] = useState(Math.floor(((current || 1) - 1) / SIZE));

  useEffect(() => setGroup(Math.floor(((current || 1) - 1) / SIZE)), [current]);
  useEffect(() => localStorage.setItem("anivexa.epview", view), [view]);

  const shown = ranges.find(([g]) => g === group)?.[1] || ranges[0]?.[1] || [];

  return (
    <section className="panel eps" aria-label="Episodes" style={height ? { maxHeight: height } : undefined}>
      <header className="panel-head">
        <h2>Episodes <span className="muted">{episodes.length}</span></h2>
        <div className="seg">
          <button type="button" className={view === "grid" ? "is-on" : ""} onClick={() => setView("grid")} aria-label="Grid view">
            <Icon name="grid" size={16} />
          </button>
          <button type="button" className={view === "list" ? "is-on" : ""} onClick={() => setView("list")} aria-label="List view">
            <Icon name="list" size={16} />
          </button>
        </div>
      </header>

      {ranges.length > 1 && (
        <div className="eps-ranges">
          {ranges.map(([g, list]) => (
            <button key={g} type="button" className={g === group ? "is-on" : ""} onClick={() => setGroup(g)}>
              {list[0].number} to {list[list.length - 1].number}
            </button>
          ))}
        </div>
      )}

      <div className={`eps-body eps-${view}`}>
        {shown.map((e) => {
          const missing = !e[audio];
          const cls = [
            "ep",
            e.number === current ? "is-current" : "",
            watched?.has(e.number) ? "is-watched" : "",
            e.filler ? "is-filler" : "",
            missing ? "is-missing" : "",
          ].join(" ");
          return (
            <button
              key={e.number}
              type="button"
              className={cls}
              onClick={() => onSelect(e.number)}
              title={`${e.title || `Episode ${e.number}`}${e.filler ? " (filler)" : ""}${missing ? ` - no ${audio}` : ""}`}
            >
              <span className="ep-num">{e.number}</span>
              {view === "list" && (
                <span className="ep-title">
                  {e.title || `Episode ${e.number}`}
                  {e.filler && <em>Filler</em>}
                  {e.dub && <em>Dub</em>}
                </span>
              )}
              {watched?.has(e.number) && <Icon name="check" size={13} className="ep-check" />}
            </button>
          );
        })}
      </div>
    </section>
  );
}

import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import Icon from "./Icon";
import {
  FORMAT_LABEL, STATUS_LABEL, cleanDesc, colorOf, coverOf, releasedEpisodes, scoreOf, titleOf,
} from "../lib/util";

const SLIDE_MS = 8000;

export default function Hero({ items }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const touchX = useRef(null);
  const count = items.length;
  const current = items[index] || items[0];

  // The page glow follows the slide: the whole site takes on the poster's color.
  useEffect(() => {
    if (current) document.documentElement.style.setProperty("--ambient", colorOf(current));
  }, [current]);
  useEffect(() => () => document.documentElement.style.removeProperty("--ambient"), []);

  useEffect(() => {
    if (paused || count < 2) return undefined;
    const t = setInterval(() => setIndex((i) => (i + 1) % count), SLIDE_MS);
    return () => clearInterval(t);
  }, [paused, count, index]);

  if (!current) return null;
  const out = releasedEpisodes(current);
  const score = scoreOf(current);
  const go = (n) => setIndex((n + count) % count);

  return (
    <section
      className="hero"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      onTouchStart={(e) => (touchX.current = e.touches[0].clientX)}
      onTouchEnd={(e) => {
        if (touchX.current == null) return;
        const dx = e.changedTouches[0].clientX - touchX.current;
        if (Math.abs(dx) > 50) go(index + (dx < 0 ? 1 : -1));
        touchX.current = null;
      }}
      aria-roledescription="carousel"
      aria-label="Featured anime"
    >
      {items.map((m, i) => (
        <div key={m.id} className={`hero-bg ${i === index ? "is-active" : ""}`} aria-hidden="true">
          <img src={m.bannerImage} alt="" loading={i === 0 ? "eager" : "lazy"} />
        </div>
      ))}
      <div className="hero-shade" />

      <div className="hero-copy" key={current.id}>
        <div className="hero-chips">
          <span className="pill pill-hot">#{index + 1} trending</span>
          {current.format && <span className="pill">{FORMAT_LABEL[current.format] || current.format}</span>}
          {out ? <span className="pill">Episode {out}</span> : null}
          {score && (
            <span className="pill pill-gold">
              <Icon name="star" size={12} fill="currentColor" /> {score}
            </span>
          )}
          <span className="pill">{STATUS_LABEL[current.status] || current.status}</span>
        </div>
        <h1 className="hero-title">{titleOf(current)}</h1>
        {current.title?.native && <p className="hero-native" lang="ja">{current.title.native}</p>}
        <p className="hero-desc">{cleanDesc(current.description)}</p>
        <div className="hero-actions">
          <Link to={`/watch/${current.id}?ep=1`} className="btn btn-primary btn-lg">
            <Icon name="play" size={18} /> Watch now
          </Link>
          <Link to={`/anime/${current.id}`} className="btn btn-ghost btn-lg">
            <Icon name="info" size={18} /> Details
          </Link>
        </div>
      </div>

      {count > 1 && (
        <div className="hero-thumbs" role="tablist" aria-label="Choose a slide">
          {items.map((m, i) => (
            <button
              key={m.id}
              type="button"
              role="tab"
              aria-selected={i === index}
              aria-label={titleOf(m)}
              className={`hero-thumb ${i === index ? "is-active" : ""}`}
              onClick={() => setIndex(i)}
              style={{ "--dur": `${SLIDE_MS}ms` }}
            >
              <img src={coverOf(m)} alt="" loading="lazy" />
              {i === index && !paused && <i className="hero-timer" key={`${index}-t`} />}
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

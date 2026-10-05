import { useRef } from "react";
import { Link } from "react-router-dom";
import Icon from "./Icon";

export function Section({ title, to, children, className = "" }) {
  return (
    <section className={`section ${className}`}>
      <header className="section-head">
        <h2>{title}</h2>
        {to && (
          <Link to={to} className="link-quiet">
            View all
          </Link>
        )}
      </header>
      {children}
    </section>
  );
}

/** Horizontally scrolling shelf with arrow buttons. */
export function Row({ title, to, children }) {
  const ref = useRef(null);
  const move = (dir) =>
    ref.current?.scrollBy({ left: dir * ref.current.clientWidth * 0.85, behavior: "smooth" });
  return (
    <section className="section">
      <header className="section-head">
        <h2>{title}</h2>
        {to && (
          <Link to={to} className="link-quiet">
            View all
          </Link>
        )}
        <div className="row-arrows">
          <button type="button" className="icon-btn" onClick={() => move(-1)} aria-label="Scroll left">
            <Icon name="chevL" size={18} />
          </button>
          <button type="button" className="icon-btn" onClick={() => move(1)} aria-label="Scroll right">
            <Icon name="chevR" size={18} />
          </button>
        </div>
      </header>
      <div className="row" ref={ref}>
        {children}
      </div>
    </section>
  );
}

import { useEffect, useRef, useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { Anime } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { GENRES, TYPES } from "../lib/constants";
import { FORMAT_LABEL, coverOf, titleOf } from "../lib/util";
import Icon from "./Icon";
import Logo from "./Logo";

function SearchBox({ onDone }) {
  const nav = useNavigate();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [busy, setBusy] = useState(false);
  const box = useRef(null);
  const input = useRef(null);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) {
      setItems([]);
      return undefined;
    }
    const ctrl = new AbortController();
    setBusy(true);
    const t = setTimeout(() => {
      Anime.suggest(term, ctrl.signal)
        .then(setItems)
        .catch(() => {})
        .finally(() => setBusy(false));
    }, 250);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q]);

  useEffect(() => {
    const away = (e) => !box.current?.contains(e.target) && setOpen(false);
    const slash = (e) => {
      if (e.key === "/" && !/input|textarea|select/i.test(document.activeElement?.tagName)) {
        e.preventDefault();
        input.current?.focus();
      }
    };
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", slash);
    return () => {
      document.removeEventListener("mousedown", away);
      document.removeEventListener("keydown", slash);
    };
  }, []);

  const submit = (e) => {
    e.preventDefault();
    if (!q.trim()) return;
    setOpen(false);
    onDone?.();
    nav(`/browse?q=${encodeURIComponent(q.trim())}`);
  };

  return (
    <div className="search" ref={box}>
      <form onSubmit={submit} role="search">
        <Icon name="search" size={18} />
        <input
          ref={input}
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
          placeholder="Search anime  (press /)"
          aria-label="Search anime"
          autoComplete="off"
        />
      </form>
      {open && q.trim().length >= 2 && (
        <div className="suggest" role="listbox">
          {busy && !items.length && <p className="muted pad">Searching...</p>}
          {!busy && !items.length && <p className="muted pad">Nothing found for "{q.trim()}".</p>}
          {items.map((m) => (
            <Link
              key={m.id}
              to={`/anime/${m.id}`}
              className="suggest-item"
              onClick={() => {
                setOpen(false);
                setQ("");
                onDone?.();
              }}
            >
              <img src={coverOf(m)} alt="" />
              <span>
                <b>{titleOf(m)}</b>
                <small>
                  {FORMAT_LABEL[m.format] || m.format}
                  {m.seasonYear ? `  ${m.seasonYear}` : ""}
                </small>
              </span>
            </Link>
          ))}
          {items.length > 0 && (
            <Link to={`/browse?q=${encodeURIComponent(q.trim())}`} className="suggest-all" onClick={() => setOpen(false)}>
              See all results
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

export default function Header() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [menu, setMenu] = useState(null); // 'genres' | 'types' | 'user'
  const [drawer, setDrawer] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const bar = useRef(null);

  useEffect(() => {
    setMenu(null);
    setDrawer(false);
  }, [location.pathname, location.search]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    const away = (e) => !bar.current?.contains(e.target) && setMenu(null);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    document.addEventListener("mousedown", away);
    return () => {
      window.removeEventListener("scroll", onScroll);
      document.removeEventListener("mousedown", away);
    };
  }, []);

  const toggle = (name) => setMenu((m) => (m === name ? null : name));

  const nav = (
    <>
      <NavLink to="/" end>Home</NavLink>
      <NavLink to="/browse" end>Browse</NavLink>
      <NavLink to="/schedule">Schedule</NavLink>
      <div className="drop">
        <button type="button" onClick={() => toggle("genres")} aria-expanded={menu === "genres"}>
          Genres <Icon name="chevD" size={14} />
        </button>
        {menu === "genres" && (
          <div className="drop-panel drop-genres">
            {GENRES.map((g) => (
              <Link key={g} to={`/browse?genre=${encodeURIComponent(g)}`}>{g}</Link>
            ))}
          </div>
        )}
      </div>
      <div className="drop">
        <button type="button" onClick={() => toggle("types")} aria-expanded={menu === "types"}>
          Type <Icon name="chevD" size={14} />
        </button>
        {menu === "types" && (
          <div className="drop-panel">
            {TYPES.map(([key, label]) => (
              <Link key={key} to={`/browse?format=${key}`}>{label}</Link>
            ))}
            <Link to="/browse?status=RELEASING&sort=POPULARITY_DESC">Airing now</Link>
            <Link to="/browse?status=FINISHED&sort=SCORE_DESC">Completed</Link>
          </div>
        )}
      </div>
    </>
  );

  return (
    <header className={`site-header ${scrolled ? "is-scrolled" : ""}`} ref={bar}>
      <div className="site-header-in">
        <button type="button" className="icon-btn only-mobile" onClick={() => setDrawer((d) => !d)} aria-label="Menu">
          <Icon name={drawer ? "close" : "menu"} />
        </button>
        <Logo />
        <nav className="nav only-desktop" aria-label="Main">{nav}</nav>
        <SearchBox />
        <div className="head-user">
          {user ? (
            <div className="drop">
              <button type="button" className="avatar" onClick={() => toggle("user")} aria-label="Account menu">
                {user.username[0].toUpperCase()}
              </button>
              {menu === "user" && (
                <div className="drop-panel drop-right">
                  <p className="drop-name">{user.username}</p>
                  <Link to="/profile">Continue watching</Link>
                  <Link to="/profile?tab=watchlist">My list</Link>
                  <Link to="/profile?tab=favorites">Favorites</Link>
                  <Link to="/profile?tab=settings">Account</Link>
                  <button type="button" onClick={logout}>
                    <Icon name="logout" size={16} /> Sign out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <Link to="/login" state={{ from: location.pathname + location.search }} className="btn btn-primary btn-sm">
              Sign in
            </Link>
          )}
        </div>
      </div>
      {drawer && <nav className="drawer only-mobile" aria-label="Main">{nav}</nav>}
    </header>
  );
}

import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Lib } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { LIST_STATUS, coverOf, titleOf } from "../lib/util";
import Icon from "./Icon";

/** "Add to list" menu and the favorite heart, shared by the detail and watch pages. */
export default function LibraryActions({ media }) {
  const { user } = useAuth();
  const toast = useToast();
  const nav = useNavigate();
  const location = useLocation();
  const [state, setState] = useState({ watchlist: null, favorite: false });
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    setState({ watchlist: null, favorite: false });
    if (user && media) Lib.status(media.id).then(setState).catch(() => {});
  }, [user, media?.id]);

  useEffect(() => {
    const away = (e) => !ref.current?.contains(e.target) && setOpen(false);
    document.addEventListener("mousedown", away);
    return () => document.removeEventListener("mousedown", away);
  }, []);

  const needLogin = () => {
    toast("Sign in to save anime to your list.");
    nav("/login", { state: { from: location.pathname + location.search } });
  };
  const snapshot = () => ({
    anilist_id: media.id,
    title: titleOf(media),
    cover: coverOf(media),
    format: media.format || "",
    episodes: media.episodes || null,
  });

  const setStatus = async (status) => {
    if (!user) return needLogin();
    setOpen(false);
    try {
      if (status === null) {
        await Lib.removeWatchlist(media.id);
        setState((s) => ({ ...s, watchlist: null }));
        toast("Removed from your list.");
      } else {
        await Lib.setWatchlist({ ...snapshot(), status });
        setState((s) => ({ ...s, watchlist: status }));
        toast(`Saved as "${LIST_STATUS[status]}".`, "success");
      }
    } catch (e) {
      toast(e.message, "error");
    }
  };

  const toggleFavorite = async () => {
    if (!user) return needLogin();
    try {
      if (state.favorite) {
        await Lib.removeFavorite(media.id);
        setState((s) => ({ ...s, favorite: false }));
        toast("Removed from favorites.");
      } else {
        const { anilist_id, title, cover, format } = snapshot();
        await Lib.addFavorite({ anilist_id, title, cover, format });
        setState((s) => ({ ...s, favorite: true }));
        toast("Added to favorites.", "success");
      }
    } catch (e) {
      toast(e.message, "error");
    }
  };

  return (
    <div className="lib-actions">
      <div className="drop" ref={ref}>
        <button type="button" className={`btn ${state.watchlist ? "btn-soft" : "btn-ghost"}`} onClick={() => setOpen((o) => !o)} aria-expanded={open}>
          <Icon name={state.watchlist ? "check" : "plus"} size={18} />
          {state.watchlist ? LIST_STATUS[state.watchlist] : "Add to list"}
        </button>
        {open && (
          <div className="drop-panel">
            {Object.entries(LIST_STATUS).map(([key, label]) => (
              <button key={key} type="button" className={state.watchlist === key ? "is-on" : ""} onClick={() => setStatus(key)}>
                {label}
              </button>
            ))}
            {state.watchlist && (
              <button type="button" onClick={() => setStatus(null)}>
                <Icon name="trash" size={15} /> Remove
              </button>
            )}
          </div>
        )}
      </div>
      <button
        type="button"
        className={`btn btn-icon ${state.favorite ? "btn-fav" : "btn-ghost"}`}
        onClick={toggleFavorite}
        aria-pressed={state.favorite}
        aria-label={state.favorite ? "Remove from favorites" : "Add to favorites"}
      >
        <Icon name="heart" size={18} fill={state.favorite ? "currentColor" : "none"} />
      </button>
    </div>
  );
}

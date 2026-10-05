import { useState } from "react";
import { Link, Navigate, useSearchParams } from "react-router-dom";
import { Auth, Lib } from "../api/client";
import AnimeCard, { CardSkeletons } from "../components/AnimeCard";
import Icon from "../components/Icon";
import { ContinueCard, fromSaved } from "../components/SavedCards";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { useAsync, usePageTitle } from "../hooks/useAsync";
import { clearHistory, continueList, historyList } from "../lib/progress";
import { LIST_STATUS, timeAgo } from "../lib/util";

const TABS = [
  ["continue", "Continue watching"],
  ["watchlist", "My list"],
  ["favorites", "Favorites"],
  ["history", "History"],
  ["settings", "Account"],
];

export default function Profile() {
  usePageTitle("My profile");
  const { user, ready, logout } = useAuth();
  const [sp, setSp] = useSearchParams();
  const tab = TABS.some(([k]) => k === sp.get("tab")) ? sp.get("tab") : "continue";

  if (!ready) return <div className="page"><CardSkeletons n={6} /></div>;
  if (!user) return <Navigate to="/login" state={{ from: "/profile" }} replace />;

  return (
    <div className="page">
      <header className="profile-head">
        <span className="avatar avatar-lg" aria-hidden="true">{user.username[0].toUpperCase()}</span>
        <div>
          <h1>{user.username}</h1>
          <p className="muted">Member since {new Date(user.date_joined).toLocaleDateString([], { month: "long", year: "numeric" })}</p>
        </div>
      </header>
      <div className="tabs" role="tablist">
        {TABS.map(([k, label]) => (
          <button key={k} type="button" role="tab" aria-selected={tab === k} className={tab === k ? "is-on" : ""} onClick={() => setSp({ tab: k })}>
            {label}
          </button>
        ))}
      </div>
      {tab === "continue" && <ContinueTab user={user} />}
      {tab === "watchlist" && <WatchlistTab />}
      {tab === "favorites" && <FavoritesTab />}
      {tab === "history" && <HistoryTab user={user} />}
      {tab === "settings" && <SettingsTab onLogout={logout} />}
    </div>
  );
}

function Empty({ title, text }) {
  return (
    <div className="empty">
      <h2>{title}</h2>
      <p className="muted">{text}</p>
      <Link to="/browse" className="btn btn-primary">Find something to watch</Link>
    </div>
  );
}

function ContinueTab({ user }) {
  const { data, loading } = useAsync(() => continueList(user), [user.id]);
  if (!loading && !data?.length) return <Empty title="Nothing in progress" text="Start an episode and it will show up here." />;
  return (
    <div className="grid">
      {loading && <CardSkeletons n={6} />}
      {data?.map((row) => <ContinueCard key={row.anilist_id} row={row} />)}
    </div>
  );
}

function SavedGrid({ items, onRemove, sub }) {
  return (
    <div className="grid">
      {items.map((it) => (
        <div key={it.anilist_id} className="saved">
          <AnimeCard media={fromSaved(it)} sub={sub?.(it)} />
          <button type="button" className="link-btn" onClick={() => onRemove(it.anilist_id)}>
            <Icon name="trash" size={14} /> Remove
          </button>
        </div>
      ))}
    </div>
  );
}

function WatchlistTab() {
  const [status, setStatus] = useState("");
  const { data, loading, reload } = useAsync(() => Lib.watchlist(status), [status]);
  const toast = useToast();
  const remove = async (id) => {
    await Lib.removeWatchlist(id).catch((e) => toast(e.message, "error"));
    reload();
  };
  return (
    <>
      <div className="chips">
        <button type="button" className={`chip-btn ${status === "" ? "is-on" : ""}`} onClick={() => setStatus("")}>All</button>
        {Object.entries(LIST_STATUS).map(([k, l]) => (
          <button key={k} type="button" className={`chip-btn ${status === k ? "is-on" : ""}`} onClick={() => setStatus(k)}>{l}</button>
        ))}
      </div>
      {loading && <div className="grid"><CardSkeletons n={6} /></div>}
      {!loading && !data?.length && <Empty title="Your list is empty" text="Use Add to list on any anime page." />}
      {data?.length > 0 && <SavedGrid items={data} onRemove={remove} sub={(it) => LIST_STATUS[it.status]} />}
    </>
  );
}

function FavoritesTab() {
  const { data, loading, reload } = useAsync(() => Lib.favorites(), []);
  const toast = useToast();
  const remove = async (id) => {
    await Lib.removeFavorite(id).catch((e) => toast(e.message, "error"));
    reload();
  };
  if (loading) return <div className="grid"><CardSkeletons n={6} /></div>;
  if (!data?.length) return <Empty title="No favorites yet" text="Tap the heart on an anime page to keep it here." />;
  return <SavedGrid items={data} onRemove={remove} />;
}

function HistoryTab({ user }) {
  const { data, loading, reload } = useAsync(() => historyList(user), [user.id]);
  const toast = useToast();
  if (loading) return <p className="muted">Loading history...</p>;
  if (!data?.length) return <Empty title="No watch history" text="Episodes you watch will be listed here." />;
  return (
    <>
      <div className="row-gap">
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={async () => {
            if (!window.confirm("Clear your whole watch history?")) return;
            await clearHistory(user).catch((e) => toast(e.message, "error"));
            reload();
          }}
        >
          <Icon name="trash" size={14} /> Clear history
        </button>
      </div>
      <ul className="history">
        {data.map((r) => (
          <li key={`${r.anilist_id}-${r.episode}`}>
            <Link to={`/watch/${r.anilist_id}?ep=${r.episode}&audio=${r.audio || "sub"}`}>
              <img src={r.cover} alt="" loading="lazy" />
              <span>
                <b>{r.title}</b>
                <small>Episode {r.episode}, {r.completed ? "watched" : `${Math.round((r.position / (r.duration || 1)) * 100)}% in`}</small>
                <i className="hist-bar"><s style={{ width: `${r.completed ? 100 : Math.round((r.position / (r.duration || 1)) * 100)}%` }} /></i>
              </span>
              <time>{r.updated_at ? timeAgo(r.updated_at) : ""}</time>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}

function SettingsTab({ onLogout }) {
  const { user, setUser } = useAuth();
  const toast = useToast();
  const [profile, setProfile] = useState({ username: user.username, email: user.email });
  const [pw, setPw] = useState({ old_password: "", new_password: "" });
  const [errors, setErrors] = useState({});

  const saveProfile = async (e) => {
    e.preventDefault();
    setErrors({});
    try {
      setUser(await Auth.update(profile));
      toast("Account updated.", "success");
    } catch (err) {
      setErrors({ profile: err.message });
    }
  };
  const savePassword = async (e) => {
    e.preventDefault();
    setErrors({});
    try {
      await Auth.changePassword(pw);
      setPw({ old_password: "", new_password: "" });
      toast("Password changed.", "success");
    } catch (err) {
      setErrors({ password: err.message });
    }
  };

  return (
    <div className="settings">
      <form onSubmit={saveProfile} className="panel pad">
        <h2>Profile</h2>
        <label className="form-field"><span>Username</span><input value={profile.username} onChange={(e) => setProfile({ ...profile, username: e.target.value })} required /></label>
        <label className="form-field"><span>Email</span><input type="email" value={profile.email} onChange={(e) => setProfile({ ...profile, email: e.target.value })} required /></label>
        {errors.profile && <p className="form-error">{errors.profile}</p>}
        <button type="submit" className="btn btn-primary">Save changes</button>
      </form>
      <form onSubmit={savePassword} className="panel pad">
        <h2>Password</h2>
        <label className="form-field"><span>Current password</span><input type="password" autoComplete="current-password" value={pw.old_password} onChange={(e) => setPw({ ...pw, old_password: e.target.value })} required /></label>
        <label className="form-field"><span>New password (8+ characters)</span><input type="password" autoComplete="new-password" value={pw.new_password} onChange={(e) => setPw({ ...pw, new_password: e.target.value })} required /></label>
        {errors.password && <p className="form-error">{errors.password}</p>}
        <button type="submit" className="btn btn-primary">Change password</button>
      </form>
      <div className="panel pad">
        <h2>Session</h2>
        <button type="button" className="btn btn-ghost" onClick={onLogout}><Icon name="logout" size={16} /> Sign out</button>
      </div>
    </div>
  );
}

import { Link } from "react-router-dom";
import { Comments } from "../api/client";
import { useAsync } from "../hooks/useAsync";
import { timeAgo } from "../lib/util";

export default function RecentComments() {
  const { data } = useAsync(() => Comments.recent(), []);
  if (!data || data.length === 0) return null;
  return (
    <aside className="panel" aria-label="Recent comments">
      <header className="panel-head"><h2>Recent comments</h2></header>
      <ul className="rc-list">
        {data.map((c) => (
          <li key={c.id}>
            <Link to={c.episode ? `/watch/${c.anilist_id}?ep=${c.episode}` : `/anime/${c.anilist_id}`}>
              <span className="avatar avatar-sm" aria-hidden="true">{c.username[0].toUpperCase()}</span>
              <span className="rc-text">
                <b>{c.username}</b> on {c.anime_title || "an anime"}{c.episode ? `, episode ${c.episode}` : ""}
                <q>{c.body.length > 90 ? `${c.body.slice(0, 90)}...` : c.body}</q>
                <small>{timeAgo(c.created_at)}</small>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </aside>
  );
}

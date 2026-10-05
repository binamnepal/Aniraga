import { useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Comments as CommentApi } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { useAsync } from "../hooks/useAsync";
import { timeAgo } from "../lib/util";
import Icon from "./Icon";

function Form({ onSubmit, placeholder, autoFocus, onCancel }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    setBusy(true);
    try {
      await onSubmit(text.trim());
      setText("");
    } finally {
      setBusy(false);
    }
  };
  return (
    <form className="c-form" onSubmit={submit}>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={placeholder}
        maxLength={1000}
        rows={2}
        autoFocus={autoFocus}
        aria-label={placeholder}
      />
      <div className="c-form-actions">
        <span className="muted">{text.length}/1000</span>
        {onCancel && <button type="button" className="btn btn-ghost btn-sm" onClick={onCancel}>Cancel</button>}
        <button type="submit" className="btn btn-primary btn-sm" disabled={busy || !text.trim()}>
          {busy ? "Posting..." : "Post comment"}
        </button>
      </div>
    </form>
  );
}

function Item({ c, replies, onReply, onDelete, canReply, replyingTo, setReplyingTo }) {
  return (
    <li className="c-item">
      <span className="avatar avatar-sm" aria-hidden="true">{c.username[0].toUpperCase()}</span>
      <div className="c-main">
        <p className="c-head">
          <b>{c.username}</b>
          <time dateTime={c.created_at}>{timeAgo(c.created_at)}</time>
        </p>
        <p className="c-body">{c.body}</p>
        <p className="c-actions">
          {canReply && !c.parent && (
            <button type="button" onClick={() => setReplyingTo(replyingTo === c.id ? null : c.id)}>Reply</button>
          )}
          {c.mine && <button type="button" onClick={() => onDelete(c.id)}>Delete</button>}
        </p>
        {replyingTo === c.id && (
          <Form placeholder={`Reply to ${c.username}`} autoFocus onCancel={() => setReplyingTo(null)} onSubmit={(t) => onReply(c.id, t)} />
        )}
        {replies?.length > 0 && (
          <ul className="c-replies">
            {replies.map((r) => (
              <Item key={r.id} c={r} onDelete={onDelete} canReply={false} />
            ))}
          </ul>
        )}
      </div>
    </li>
  );
}

export default function Comments({ anilistId, episode = null, title }) {
  const { user } = useAuth();
  const toast = useToast();
  const location = useLocation();
  const { data, loading, error, reload } = useAsync(() => CommentApi.list(anilistId, episode), [anilistId, episode]);
  const [replyingTo, setReplyingTo] = useState(null);

  const { roots, repliesOf } = useMemo(() => {
    const list = data || [];
    const map = {};
    list.filter((c) => c.parent).forEach((c) => (map[c.parent] ||= []).push(c));
    Object.values(map).forEach((arr) => arr.reverse());
    return { roots: list.filter((c) => !c.parent), repliesOf: map };
  }, [data]);

  const post = async (body, parent = null) => {
    try {
      await CommentApi.create({ anilist_id: anilistId, episode, anime_title: title || "", body, parent });
      setReplyingTo(null);
      reload();
    } catch (e) {
      toast(e.message, "error");
      throw e;
    }
  };
  const remove = async (id) => {
    try {
      await CommentApi.remove(id);
      reload();
    } catch (e) {
      toast(e.message, "error");
    }
  };

  return (
    <section className="comments" aria-label="Comments">
      <h2>
        <Icon name="message" size={20} /> {episode ? `Episode ${episode} comments` : "Comments"}
        {data ? <span className="muted"> {data.length}</span> : null}
      </h2>
      {user ? (
        <Form placeholder="Share your thoughts (no spoilers please)" onSubmit={(t) => post(t)} />
      ) : (
        <p className="c-login">
          <Link to="/login" state={{ from: location.pathname + location.search }}>Sign in</Link> to join the conversation.
        </p>
      )}
      {loading && <p className="muted">Loading comments...</p>}
      {error && <p className="form-error">Couldn't load comments. <button type="button" className="link-btn" onClick={reload}>Try again</button></p>}
      {!loading && !error && roots.length === 0 && <p className="muted">No comments yet. Start the discussion.</p>}
      <ul className="c-list">
        {roots.map((c) => (
          <Item
            key={c.id}
            c={c}
            replies={repliesOf[c.id]}
            canReply={!!user}
            replyingTo={replyingTo}
            setReplyingTo={setReplyingTo}
            onReply={(id, t) => post(t, id)}
            onDelete={remove}
          />
        ))}
      </ul>
    </section>
  );
}

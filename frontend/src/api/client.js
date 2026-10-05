const BASE = (import.meta.env.VITE_API_URL || "http://localhost:8000/api").replace(/\/$/, "");
const KEY = "anivexa.tokens";

function readTokens() {
  try {
    return JSON.parse(localStorage.getItem(KEY));
  } catch {
    return null;
  }
}

let tokens = readTokens();
export const getTokens = () => tokens;
export function setTokens(next) {
  tokens = next;
  if (next) localStorage.setItem(KEY, JSON.stringify(next));
  else localStorage.removeItem(KEY);
}

export class ApiError extends Error {
  constructor(status, data) {
    super(messageFrom(data, status));
    this.status = status;
    this.data = data;
  }
}

function messageFrom(data, status) {
  if (!data) return `Something went wrong (${status}).`;
  if (typeof data === "string") return data;
  if (data.detail) return String(data.detail);
  const first = Object.values(data)[0];
  return Array.isArray(first) ? String(first[0]) : String(first);
}

let refreshing = null;
function refresh() {
  if (!tokens?.refresh) return Promise.resolve(false);
  refreshing ||= fetch(`${BASE}/auth/refresh/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh: tokens.refresh }),
  })
    .then(async (res) => {
      if (!res.ok) return false;
      const data = await res.json();
      setTokens({ access: data.access, refresh: data.refresh || tokens.refresh });
      return true;
    })
    .catch(() => false)
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

export async function api(path, { method = "GET", body, signal, auth = true } = {}) {
  const send = () =>
    fetch(`${BASE}${path}`, {
      method,
      signal,
      headers: {
        ...(body ? { "Content-Type": "application/json" } : {}),
        ...(auth && tokens?.access ? { Authorization: `Bearer ${tokens.access}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });

  let res = await send();
  if (res.status === 401 && auth && tokens?.refresh && (await refresh())) res = await send();
  if (res.status === 401 && auth && tokens) {
    setTokens(null);
    window.dispatchEvent(new Event("anivexa:logout"));
  }
  if (res.status === 204) return null;
  let data = null;
  try {
    data = await res.json();
  } catch {
    /* empty body */
  }
  if (!res.ok) throw new ApiError(res.status, data);
  return data;
}

const qs = (params) => {
  const clean = Object.fromEntries(
    Object.entries(params || {}).filter(([, v]) => v !== undefined && v !== null && v !== "")
  );
  return new URLSearchParams(clean).toString();
};

export const Anime = {
  home: (signal) => api("/home/", { signal }),
  browse: (params, signal) => api(`/anime/browse/?${qs(params)}`, { signal }),
  suggest: (q, signal) => api(`/anime/suggest/?${qs({ q })}`, { signal }),
  top: (period, signal) => api(`/anime/top/?period=${period}`, { signal }),
  schedule: (start, end, signal) => api(`/anime/schedule/?start=${start}&end=${end}`, { signal }),
  genres: (signal) => api("/anime/genres/", { signal }),
  detail: (id, signal) => api(`/anime/${id}/`, { signal }),
};

export const Stream = {
  episodes: (id, signal) => api(`/streaming/episodes/${id}/`, { signal }),
  watch: (id, { provider, audio, ep }, signal) =>
    api(`/streaming/watch/${id}/?${qs({ provider, audio, ep })}`, { signal }),
};

export const Auth = {
  login: (identifier, password) => api("/auth/login/", { method: "POST", body: { identifier, password }, auth: false }),
  register: (body) => api("/auth/register/", { method: "POST", body, auth: false }),
  me: () => api("/auth/me/"),
  update: (body) => api("/auth/me/", { method: "PATCH", body }),
  changePassword: (body) => api("/auth/change-password/", { method: "POST", body }),
};

export const Lib = {
  status: (id) => api(`/library/status/${id}/`),
  watchlist: (status) => api(`/library/watchlist/${status ? `?status=${status}` : ""}`),
  setWatchlist: (body) => api("/library/watchlist/", { method: "POST", body }),
  removeWatchlist: (id) => api(`/library/watchlist/${id}/`, { method: "DELETE" }),
  favorites: () => api("/library/favorites/"),
  addFavorite: (body) => api("/library/favorites/", { method: "POST", body }),
  removeFavorite: (id) => api(`/library/favorites/${id}/`, { method: "DELETE" }),
  saveProgress: (body) => api("/library/progress/", { method: "POST", body }),
  progressFor: (id) => api(`/library/progress/${id}/`),
  continueList: () => api("/library/continue/"),
  history: () => api("/library/history/"),
  clearHistory: () => api("/library/history/", { method: "DELETE" }),
  removeHistory: (id) => api(`/library/history/${id}/`, { method: "DELETE" }),
  recordView: (anilist_id) => api("/library/view/", { method: "POST", body: { anilist_id }, auth: false }),
};

export const Comments = {
  list: (anilist_id, episode) => api(`/comments/?${qs({ anilist_id, episode })}`),
  recent: () => api("/comments/recent/"),
  create: (body) => api("/comments/", { method: "POST", body }),
  remove: (id) => api(`/comments/${id}/`, { method: "DELETE" }),
};

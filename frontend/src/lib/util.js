export const titleOf = (m) => m?.title?.english || m?.title?.romaji || m?.title?.native || "Untitled";
export const coverOf = (m) => m?.coverImage?.large || m?.coverImage?.extraLarge || "";
export const colorOf = (m) => m?.coverImage?.color || "#6b5bd6";

export const FORMAT_LABEL = {
  TV: "TV", TV_SHORT: "TV short", MOVIE: "Movie", SPECIAL: "Special", OVA: "OVA", ONA: "ONA", MUSIC: "Music",
};
export const STATUS_LABEL = {
  RELEASING: "Airing", FINISHED: "Finished", NOT_YET_RELEASED: "Upcoming", CANCELLED: "Cancelled", HIATUS: "On hiatus",
};
export const LIST_STATUS = {
  watching: "Watching", plan: "Plan to watch", completed: "Completed", on_hold: "On hold", dropped: "Dropped",
};
export const SORT_OPTIONS = [
  ["POPULARITY_DESC", "Most popular"],
  ["TRENDING_DESC", "Trending now"],
  ["SCORE_DESC", "Highest rated"],
  ["FAVOURITES_DESC", "Most favorited"],
  ["START_DATE_DESC", "Newest"],
  ["UPDATED_AT_DESC", "Recently updated"],
  ["TITLE_ROMAJI", "Title A to Z"],
];

export const scoreOf = (m) => (m?.averageScore ? (m.averageScore / 10).toFixed(1) : null);

/** Episodes that are actually out (airing shows report the next one). */
export function releasedEpisodes(m) {
  const next = m?.nextAiringEpisode?.episode;
  if (next) return Math.max(0, next - 1);
  return m?.episodes || null;
}

export function cleanDesc(text) {
  return (text || "").replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, "").trim();
}

export function timeAgo(iso) {
  const sec = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  const units = [["y", 31536000], ["mo", 2592000], ["d", 86400], ["h", 3600], ["m", 60]];
  for (const [label, size] of units) if (sec >= size) return `${Math.floor(sec / size)}${label} ago`;
  return "just now";
}

export function countdown(seconds) {
  if (seconds <= 0) return "now";
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d) return `${d}d ${h}h`;
  if (h) return `${h}h ${m}m`;
  return `${m}m`;
}

export function formatClock(sec) {
  if (!Number.isFinite(sec)) return "0:00";
  const s = Math.floor(sec % 60).toString().padStart(2, "0");
  const m = Math.floor(sec / 60) % 60;
  const h = Math.floor(sec / 3600);
  return h ? `${h}:${String(m).padStart(2, "0")}:${s}` : `${m}:${s}`;
}

export function seasonLabel(m) {
  if (!m?.season || !m?.seasonYear) return m?.seasonYear ? String(m.seasonYear) : "";
  return `${m.season[0]}${m.season.slice(1).toLowerCase()} ${m.seasonYear}`;
}

export function fuzzyDate(d) {
  if (!d?.year) return "?";
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return [d.month ? months[d.month - 1] : null, d.day, d.year].filter(Boolean).join(" ");
}

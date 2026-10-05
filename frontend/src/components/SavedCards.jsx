import AnimeCard from "./AnimeCard";
import { timeAgo } from "../lib/util";

/** Saved rows only store a title and cover, so rebuild a card-shaped object from them. */
export const fromSaved = (item) => ({
  id: item.anilist_id,
  title: { english: item.title },
  coverImage: { large: item.cover },
  format: item.format || null,
  episodes: item.total_episodes ?? item.episodes ?? null,
  status: "FINISHED",
});

export function nextTarget(row) {
  const finished = row.completed && row.total_episodes && row.episode < row.total_episodes;
  return finished || (row.completed && !row.total_episodes) ? row.episode + 1 : row.episode;
}

export function ContinueCard({ row }) {
  const ep = nextTarget(row);
  const fraction = row.completed ? 0 : row.duration ? row.position / row.duration : 0;
  return (
    <AnimeCard
      media={fromSaved(row)}
      to={`/watch/${row.anilist_id}?ep=${ep}&audio=${row.audio || "sub"}`}
      sub={`${ep === row.episode ? "Resume" : "Up next"}: episode ${ep}${row.updated_at ? `  ${timeAgo(row.updated_at)}` : ""}`}
      progress={fraction}
    />
  );
}

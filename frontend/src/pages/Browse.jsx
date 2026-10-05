import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Anime } from "../api/client";
import AnimeCard, { CardSkeletons } from "../components/AnimeCard";
import Icon from "../components/Icon";
import Pagination from "../components/Pagination";
import { useAsync, usePageTitle } from "../hooks/useAsync";
import { GENRES, TYPES } from "../lib/constants";
import { SORT_OPTIONS, STATUS_LABEL } from "../lib/util";

const SEASONS = [["WINTER", "Winter"], ["SPRING", "Spring"], ["SUMMER", "Summer"], ["FALL", "Fall"]];
const YEARS = Array.from({ length: new Date().getFullYear() + 2 - 1989 }, (_, i) => new Date().getFullYear() + 1 - i);

export default function Browse() {
  const [params, setParams] = useSearchParams();
  const get = (k) => params.get(k) || "";
  const selectedGenres = get("genre").split(",").filter(Boolean);
  const [q, setQ] = useState(get("q"));
  useEffect(() => setQ(get("q")), [params.get("q")]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = (patch) => {
    const next = new URLSearchParams(params);
    Object.entries(patch).forEach(([k, v]) => (v === "" || v == null ? next.delete(k) : next.set(k, v)));
    if (!("page" in patch)) next.delete("page");
    setParams(next);
  };

  const query = params.toString();
  const { data, loading, error, reload } = useAsync((s) => Anime.browse(Object.fromEntries(params), s), [query]);

  const typeLabel = TYPES.find(([k]) => k === get("format"))?.[1];
  const heading = get("q")
    ? `Results for "${get("q")}"`
    : selectedGenres.length
    ? selectedGenres.join(", ")
    : typeLabel || (get("status") ? `${STATUS_LABEL[get("status")]} anime` : "Browse anime");
  usePageTitle(heading);

  const toggleGenre = (g) => {
    const list = selectedGenres.includes(g) ? selectedGenres.filter((x) => x !== g) : [...selectedGenres, g];
    set({ genre: list.join(",") });
  };
  const hasFilters = ["q", "genre", "format", "status", "season", "year", "sort"].some((k) => get(k));
  const page = Number(get("page")) || 1;

  return (
    <div className="page">
      <header className="page-head">
        <h1>{heading}</h1>
        {data?.page?.total ? <p className="muted">{data.page.total.toLocaleString()} titles</p> : null}
      </header>

      <form className="filters" onSubmit={(e) => { e.preventDefault(); set({ q: q.trim() }); }}>
        <div className="field field-search">
          <Icon name="search" size={16} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by title" aria-label="Search by title" />
        </div>
        <select value={get("format")} onChange={(e) => set({ format: e.target.value })} aria-label="Type">
          <option value="">Any type</option>
          {TYPES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
        <select value={get("status")} onChange={(e) => set({ status: e.target.value })} aria-label="Status">
          <option value="">Any status</option>
          {Object.entries(STATUS_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
        <select value={get("season")} onChange={(e) => set({ season: e.target.value })} aria-label="Season">
          <option value="">Any season</option>
          {SEASONS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
        <select value={get("year")} onChange={(e) => set({ year: e.target.value })} aria-label="Year">
          <option value="">Any year</option>
          {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
        <select value={get("sort")} onChange={(e) => set({ sort: e.target.value })} aria-label="Sort by">
          <option value="">{get("q") ? "Best match" : "Most popular"}</option>
          {SORT_OPTIONS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
        {hasFilters && (
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setQ(""); setParams(new URLSearchParams()); }}>
            Clear filters
          </button>
        )}
      </form>

      <div className="chips" role="group" aria-label="Genres">
        {GENRES.map((g) => (
          <button key={g} type="button" className={`chip-btn ${selectedGenres.includes(g) ? "is-on" : ""}`} onClick={() => toggleGenre(g)} aria-pressed={selectedGenres.includes(g)}>
            {g}
          </button>
        ))}
      </div>

      {error && (
        <div className="notice notice-error">
          <p>{error.message}</p>
          <button type="button" className="btn btn-primary btn-sm" onClick={reload}>Try again</button>
        </div>
      )}
      <div className="grid grid-wide">
        {loading && <CardSkeletons n={24} />}
        {data?.results?.map((m) => <AnimeCard key={m.id} media={m} />)}
      </div>
      {data && data.results.length === 0 && (
        <div className="empty">
          <h2>No anime match those filters</h2>
          <p className="muted">Try removing a genre or widening the year.</p>
        </div>
      )}
      <Pagination
        page={page}
        last={data?.page?.lastPage}
        onChange={(p) => { set({ page: p }); window.scrollTo({ top: 0, behavior: "smooth" }); }}
      />
    </div>
  );
}

import { Anime } from "../api/client";
import AnimeCard, { CardSkeletons } from "../components/AnimeCard";
import Hero from "../components/Hero";
import RecentComments from "../components/RecentComments";
import { ContinueCard } from "../components/SavedCards";
import { Row, Section } from "../components/Section";
import Top10 from "../components/Top10";
import { useAuth } from "../context/AuthContext";
import { useAsync, usePageTitle } from "../hooks/useAsync";
import { continueList } from "../lib/progress";

const GRIDS = [
  ["airing", "Top airing", "/browse?status=RELEASING&sort=POPULARITY_DESC"],
  ["popular", "Most popular", "/browse?sort=POPULARITY_DESC"],
  ["favourites", "Most favorited", "/browse?sort=FAVOURITES_DESC"],
  ["completed", "Just completed", "/browse?status=FINISHED&sort=END_DATE_DESC"],
  ["recent", "Newly added", "/browse?sort=ID_DESC"],
  ["movies", "Popular movies", "/browse?format=MOVIE"],
];

export default function Home() {
  usePageTitle();
  const { user } = useAuth();
  const { data, loading, error, reload } = useAsync((s) => Anime.home(s), []);
  const cont = useAsync(() => continueList(user), [user?.id]);

  return (
    <>
      {loading ? <div className="hero hero-skel skel" aria-hidden="true" /> : data?.spotlight?.length ? <Hero items={data.spotlight} /> : null}

      <div className="page home-grid">
        <div className="home-main">
          {error && (
            <div className="notice notice-error">
              <p>We couldn't load the catalog: {error.message}</p>
              <button type="button" className="btn btn-primary btn-sm" onClick={reload}>Try again</button>
            </div>
          )}

          {cont.data?.length > 0 && (
            <Row title="Continue watching">
              {cont.data.map((row) => <ContinueCard key={row.anilist_id} row={row} />)}
            </Row>
          )}

          <Row title="Trending now" to="/browse?sort=TRENDING_DESC">
            {loading ? <CardSkeletons n={10} /> : data?.trending?.map((m) => <AnimeCard key={m.id} media={m} />)}
          </Row>

          {GRIDS.map(([key, title, to]) => (
            <Section key={key} title={title} to={to}>
              <div className="grid">
                {loading ? <CardSkeletons n={6} /> : data?.[key]?.slice(0, 12).map((m) => <AnimeCard key={m.id} media={m} />)}
              </div>
            </Section>
          ))}
        </div>

        <div className="home-side">
          <Top10 />
          <RecentComments />
        </div>
      </div>
    </>
  );
}

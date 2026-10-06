import { Link } from "react-router-dom";
import Logo from "./Logo";

export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="footer-in">
        <Logo />
        <nav aria-label="Footer">
          <Link to="/">Home</Link>
          <Link to="/browse?status=RELEASING&sort=POPULARITY_DESC">Airing</Link>
          <Link to="/browse?status=FINISHED&sort=SCORE_DESC">Completed</Link>
          <Link to="/browse?format=MOVIE">Movies</Link>
          <Link to="/schedule">Schedule</Link>
        </nav>
        <p>
          Aniraga does not store any files on its servers. All video is provided by third-party sources, and the
          catalog comes from AniList.
        </p>
      </div>
    </footer>
  );
}

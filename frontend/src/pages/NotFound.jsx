import { Link } from "react-router-dom";
import { usePageTitle } from "../hooks/useAsync";

export default function NotFound() {
  usePageTitle("Page not found");
  return (
    <div className="page empty">
      <h1>That page doesn't exist</h1>
      <p className="muted">The link may be old or mistyped.</p>
      <div className="row-gap">
        <Link to="/" className="btn btn-primary">Go home</Link>
        <Link to="/browse" className="btn btn-ghost">Browse anime</Link>
      </div>
    </div>
  );
}

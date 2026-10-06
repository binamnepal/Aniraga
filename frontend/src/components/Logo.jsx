import { Link } from "react-router-dom";

export default function Logo() {
  return (
    <Link to="/" className="logo" aria-label="Aniraga home">
      <svg width="30" height="30" viewBox="0 0 32 32" aria-hidden="true">
        <defs>
          <linearGradient id="lg" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#ff5f93" />
            <stop offset="1" stopColor="#ffb84d" />
          </linearGradient>
        </defs>
        <rect width="32" height="32" rx="9" fill="url(#lg)" />
        <path d="M12 9v14l12-7z" fill="#14141f" />
      </svg>
      <span>Aniraga</span>
    </Link>
  );
}

const PATHS = {
  play: <path d="M8 5v14l11-7z" fill="currentColor" stroke="none" />,
  info: (<><circle cx="12" cy="12" r="9" /><path d="M12 11v6M12 7.5h.01" /></>),
  search: (<><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></>),
  bookmark: <path d="M6 3h12v18l-6-4-6 4z" />,
  heart: <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" />,
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  close: <path d="M6 6l12 12M18 6 6 18" />,
  chevL: <path d="m15 5-7 7 7 7" />,
  chevR: <path d="m9 5 7 7-7 7" />,
  chevD: <path d="m6 9 6 6 6-6" />,
  star: <path d="M12 3l2.8 6 6.7.8-5 4.5 1.4 6.7L12 17.6 6.1 21l1.4-6.7-5-4.5 6.7-.8z" />,
  calendar: (<><rect x="4" y="5" width="16" height="15" rx="2" /><path d="M4 10h16M8 3v4M16 3v4" /></>),
  user: (<><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 3.6-6 8-6s8 2 8 6" /></>),
  next: (<><path d="M5 5l10 7-10 7z" fill="currentColor" /><path d="M19 5v14" /></>),
  prev: (<><path d="M19 5 9 12l10 7z" fill="currentColor" /><path d="M5 5v14" /></>),
  clock: (<><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>),
  check: <path d="m5 12 5 5 9-10" />,
  plus: <path d="M12 5v14M5 12h14" />,
  logout: <path d="M10 4H5v16h5M15 8l4 4-4 4M19 12H9" />,
  trash: <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" />,
  message: <path d="M4 5h16v11H9l-5 4z" />,
  bulb: <path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3 11c.7.6 1 1.3 1 2h4c0-.7.3-1.4 1-2a6 6 0 0 0-3-11z" />,
  expand: <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />,
  compress: <path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" />,
  grid: (<><rect x="4" y="4" width="7" height="7" rx="1" /><rect x="13" y="4" width="7" height="7" rx="1" /><rect x="4" y="13" width="7" height="7" rx="1" /><rect x="13" y="13" width="7" height="7" rx="1" /></>),
  list: <path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01" />,
  alert: (<><path d="M12 3 2 20h20z" /><path d="M12 10v4M12 17h.01" /></>),
};

export default function Icon({ name, size = 20, fill, ...rest }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={fill || "none"}
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {PATHS[name]}
    </svg>
  );
}

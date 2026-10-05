import Icon from "./Icon";

export default function Pagination({ page, last, onChange }) {
  if (!last || last < 2) return null;
  const pages = new Set([1, last, page - 1, page, page + 1]);
  if (page <= 3) [2, 3, 4].forEach((p) => pages.add(p));
  if (page >= last - 2) [last - 1, last - 2, last - 3].forEach((p) => pages.add(p));
  const list = [...pages].filter((p) => p >= 1 && p <= last).sort((a, b) => a - b);

  const items = [];
  list.forEach((p, i) => {
    if (i && p - list[i - 1] > 1) items.push(<span key={`gap${p}`} className="pg-gap">...</span>);
    items.push(
      <button key={p} type="button" className={p === page ? "is-on" : ""} onClick={() => onChange(p)} aria-current={p === page ? "page" : undefined}>
        {p}
      </button>
    );
  });

  return (
    <nav className="pager" aria-label="Pages">
      <button type="button" disabled={page <= 1} onClick={() => onChange(page - 1)} aria-label="Previous page">
        <Icon name="chevL" size={16} />
      </button>
      {items}
      <button type="button" disabled={page >= last} onClick={() => onChange(page + 1)} aria-label="Next page">
        <Icon name="chevR" size={16} />
      </button>
    </nav>
  );
}

import { useEffect, useState } from "react";

/** Runs `fn(signal)` whenever deps change; aborts stale requests. */
export function useAsync(fn, deps) {
  const [state, setState] = useState({ data: null, error: null, loading: true });
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const ctrl = new AbortController();
    setState({ data: null, error: null, loading: true });
    Promise.resolve(fn(ctrl.signal))
      .then((data) => {
        if (!ctrl.signal.aborted) setState({ data, error: null, loading: false });
      })
      .catch((error) => {
        if (ctrl.signal.aborted || error?.name === "AbortError") return;
        setState({ data: null, error, loading: false });
      });
    return () => ctrl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);

  return { ...state, reload: () => setTick((t) => t + 1) };
}

export function usePageTitle(title) {
  useEffect(() => {
    document.title = title ? `${title} - Aniraga` : "Aniraga - watch anime online";
  }, [title]);
}

import { useEffect, useState } from "react";
import { Stream } from "../api/client";
import { useAsync } from "./useAsync";

/**
 * Episodes for one anime. The backend answers as soon as its fast sources reply and
 * flags the result `complete: false`; we quietly re-ask until the slower sources have joined.
 */
export function useEpisodes(id) {
  const first = useAsync((s) => Stream.episodes(id, s), [id]);
  const [later, setLater] = useState(null);

  useEffect(() => setLater(null), [id]);

  useEffect(() => {
    if (!first.data || first.data.complete !== false) return undefined;
    let tries = 0;
    let stopped = false;
    const timer = setInterval(async () => {
      tries += 1;
      try {
        const next = await Stream.episodes(id);
        if (stopped) return;
        setLater(next);
        if (next.complete !== false) clearInterval(timer);
      } catch {
        /* keep what we have */
      }
      if (tries >= 15) clearInterval(timer);
    }, 6000);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [first.data, id]);

  return { ...first, data: later || first.data };
}

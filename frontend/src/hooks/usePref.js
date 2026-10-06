import { useEffect, useState } from "react";

/** A boolean/string preference remembered in localStorage. */
export function usePref(key, initial) {
  const [value, setValue] = useState(() => {
    try {
      const raw = localStorage.getItem(`aniraga.${key}`);
      return raw === null ? initial : JSON.parse(raw);
    } catch {
      return initial;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(`aniraga.${key}`, JSON.stringify(value));
    } catch {
      /* private mode */
    }
  }, [key, value]);
  return [value, setValue];
}

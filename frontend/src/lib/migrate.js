// One-time move of data saved under the old "anivexa." prefix to "aniraga.",
// so existing visitors keep their login, progress and preferences after the rename.
try {
  for (const key of Object.keys(localStorage)) {
    if (!key.startsWith("anivexa.")) continue;
    const next = "aniraga." + key.slice("anivexa.".length);
    if (localStorage.getItem(next) === null) localStorage.setItem(next, localStorage.getItem(key));
    localStorage.removeItem(key);
  }
} catch {
  /* storage unavailable (private mode) - nothing to migrate */
}

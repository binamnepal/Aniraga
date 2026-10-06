import { Lib } from "../api/client";

const LS = "aniraga.progress";

function readLocal() {
  try {
    return JSON.parse(localStorage.getItem(LS) || "{}");
  } catch {
    return {};
  }
}

function writeLocal(all) {
  const rows = Object.entries(all).sort((a, b) => (b[1].updated_at || "").localeCompare(a[1].updated_at || ""));
  localStorage.setItem(LS, JSON.stringify(Object.fromEntries(rows.slice(0, 200))));
}

const byRecent = (rows) => [...rows].sort((a, b) => (b.updated_at || "").localeCompare(a.updated_at || ""));

/** Signed-in viewers sync to the server; guests keep progress in this browser. */
export async function saveProgress(user, payload) {
  if (user) {
    try {
      await Lib.saveProgress(payload);
    } catch {
      /* progress is best-effort */
    }
    return;
  }
  const all = readLocal();
  all[`${payload.anilist_id}:${payload.episode}`] = { ...payload, updated_at: new Date().toISOString() };
  writeLocal(all);
}

export async function animeProgress(user, id) {
  if (user) return Lib.progressFor(id).catch(() => []);
  return Object.values(readLocal()).filter((r) => r.anilist_id === Number(id));
}

export async function continueList(user) {
  if (user) return Lib.continueList().catch(() => []);
  const seen = new Set();
  return byRecent(Object.values(readLocal()))
    .filter((r) => (seen.has(r.anilist_id) ? false : seen.add(r.anilist_id)))
    .slice(0, 20);
}

export async function historyList(user) {
  if (user) return Lib.history().catch(() => []);
  return byRecent(Object.values(readLocal())).slice(0, 100);
}

export async function clearHistory(user) {
  if (user) await Lib.clearHistory();
  else localStorage.removeItem(LS);
}

export async function syncGuestProgress() {
  const rows = Object.values(readLocal()).slice(0, 50);
  if (!rows.length) return;
  await Promise.all(rows.map((row) => Lib.saveProgress(row).catch(() => null)));
  localStorage.removeItem(LS);
}

import type { LibraryItem } from "./api";

export const titleOf = (item: LibraryItem) => item.details?.title || item.parsedTitle;

export const yearOf = (item: LibraryItem) => {
  const y = item.details?.releaseDate?.slice(0, 4);
  return y ? Number(y) : item.parsedYear;
};

export const ratingOf = (item: LibraryItem) =>
  item.details && item.details.voteCount > 0 ? item.details.voteAverage : null;

export function formatRuntime(minutes: number | null | undefined) {
  if (!minutes) return null;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h ? `${h} godz. ${m} min` : `${m} min`;
}

export function formatSize(bytes: number) {
  const gb = bytes / 1024 ** 3;
  return gb >= 1 ? `${gb.toFixed(1)} GB` : `${(bytes / 1024 ** 2).toFixed(0)} MB`;
}

export const formatRating = (r: number) => r.toFixed(1);

/** Postęp oglądania 0–1, gdy jest zapamiętana pozycja. */
export const progressOf = (item: LibraryItem) =>
  item.resumeMs && item.durationMs ? Math.min(item.resumeMs / item.durationMs, 1) : null;

/** 754000 -> "12:34", 5025000 -> "1:23:45" */
export function formatTimestamp(ms: number) {
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = String(total % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${s}` : `${m}:${s}`;
}

/** Ile zostało do końca, np. "Zostało 52 min". */
export function formatRemaining(item: LibraryItem) {
  if (!item.resumeMs || !item.durationMs) return null;
  const min = Math.max(1, Math.round((item.durationMs - item.resumeMs) / 60000));
  return `Zostało ${formatRuntime(min)}`;
}

export function pluralFilms(n: number) {
  if (n === 1) return "film";
  const last = n % 10;
  const lastTwo = n % 100;
  return last >= 2 && last <= 4 && (lastTwo < 12 || lastTwo > 14) ? "filmy" : "filmów";
}

/** Dopasowanie wyszukiwania: tytuł, tytuł oryginalny, nazwa folderu, reżyser, obsada. */
export function matchesQuery(item: LibraryItem, query: string) {
  const q = query.trim().toLocaleLowerCase("pl");
  if (!q) return true;
  const d = item.details;
  return [item.parsedTitle, d?.title, d?.originalTitle, d?.director, ...(d?.cast.map((c) => c.name) ?? [])].some(
    (s) => s?.toLocaleLowerCase("pl").includes(q),
  );
}

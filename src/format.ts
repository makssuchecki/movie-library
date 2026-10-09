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

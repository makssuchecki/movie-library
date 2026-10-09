import { useMemo, useState } from "react";
import type { LibraryItem } from "../api";
import { pluralFilms, ratingOf, titleOf, yearOf } from "../format";
import { MovieCard } from "./MovieCard";

type Sort = "title" | "year" | "rating" | "added";

interface Props {
  items: LibraryItem[];
  heading: string;
  onOpen: (item: LibraryItem) => void;
  onPlay: (item: LibraryItem) => void;
}

const sorters: Record<Sort, (a: LibraryItem, b: LibraryItem) => number> = {
  title: (a, b) => titleOf(a).localeCompare(titleOf(b), "pl"),
  year: (a, b) => (yearOf(b) ?? 0) - (yearOf(a) ?? 0),
  rating: (a, b) => (ratingOf(b) ?? -1) - (ratingOf(a) ?? -1),
  added: (a, b) => b.addedAt - a.addedAt,
};

const selectClass =
  "rounded-md border border-line bg-surface px-2.5 py-1.5 text-sm outline-none focus:border-accent/60";

export function LibraryGrid({ items, heading, onOpen, onPlay }: Props) {
  const [sort, setSort] = useState<Sort>("title");
  const [genre, setGenre] = useState("");
  const [unwatchedOnly, setUnwatchedOnly] = useState(false);

  const genres = useMemo(
    () => [...new Set(items.flatMap((i) => i.details?.genres ?? []))].sort((a, b) => a.localeCompare(b, "pl")),
    [items],
  );

  const visible = useMemo(
    () =>
      items
        .filter((i) => !genre || i.details?.genres.includes(genre))
        .filter((i) => !unwatchedOnly || !i.watched)
        .sort(sorters[sort]),
    [items, genre, unwatchedOnly, sort],
  );

  return (
    <section className="px-4 pt-24 pb-16 sm:px-8 lg:px-12">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{heading}</h1>
          <p className="mt-1 text-sm text-muted">
            {visible.length} {pluralFilms(visible.length)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm text-fg/80 hover:text-fg">
            <input
              type="checkbox"
              checked={unwatchedOnly}
              onChange={(e) => setUnwatchedOnly(e.target.checked)}
              className="accent-[var(--color-accent)]"
            />
            Tylko nieobejrzane
          </label>
          <select value={genre} onChange={(e) => setGenre(e.target.value)} className={selectClass}>
            <option value="">Wszystkie gatunki</option>
            {genres.map((g) => (
              <option key={g}>{g}</option>
            ))}
          </select>
          <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} className={selectClass}>
            <option value="title">Tytuł A–Z</option>
            <option value="year">Najnowsze</option>
            <option value="rating">Najwyżej oceniane</option>
            <option value="added">Ostatnio dodane</option>
          </select>
        </div>
      </div>

      {visible.length === 0 ? (
        <p className="py-24 text-center text-muted">Nic nie znaleziono.</p>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(130px,1fr))] gap-x-4 gap-y-6 sm:grid-cols-[repeat(auto-fill,minmax(160px,1fr))]">
          {visible.map((item) => (
            <MovieCard key={item.folderPath} item={item} onOpen={onOpen} onPlay={onPlay} />
          ))}
        </div>
      )}
    </section>
  );
}

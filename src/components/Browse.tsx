import { useMemo, useState } from "react";
import type { LibraryItem } from "../api";
import { ratingOf } from "../format";
import { Hero } from "./Hero";
import { MovieRow } from "./MovieRow";

interface Props {
  items: LibraryItem[];
  onOpen: (item: LibraryItem) => void;
  onPlay: (item: LibraryItem) => void;
  onRemoveFromHistory: (item: LibraryItem) => void;
}

const MIN_GENRE_ROW = 2;

export function Browse({ items, onOpen, onPlay, onRemoveFromHistory }: Props) {
  // Losowy film na banerze — wybierany raz na sesję, preferuje nieobejrzane z tłem.
  const [seed] = useState(() => Math.random());
  const featured = useMemo(() => {
    const withBackdrop = items.filter((i) => i.details?.backdropPath);
    const pool = withBackdrop.filter((i) => !i.watched).length ? withBackdrop.filter((i) => !i.watched) : withBackdrop;
    return pool.length ? pool[Math.floor(seed * pool.length)] : null;
  }, [items, seed]);

  const rows = useMemo(() => {
    const matched = items.filter((i) => i.details);
    const byGenre = new Map<string, LibraryItem[]>();
    for (const item of matched) {
      for (const g of item.details!.genres) byGenre.set(g, [...(byGenre.get(g) ?? []), item]);
    }
    const genreRows = [...byGenre.entries()]
      .filter(([, list]) => list.length >= MIN_GENRE_ROW)
      .sort((a, b) => b[1].length - a[1].length)
      .map(([genre, list]) => ({ title: genre, items: list }));

    return [
      {
        title: "Ostatnio odtwarzane",
        items: items.filter((i) => i.lastPlayed).sort((a, b) => b.lastPlayed! - a.lastPlayed!).slice(0, 20),
        removable: true,
      },
      { title: "Ostatnio dodane", items: [...items].sort((a, b) => b.addedAt - a.addedAt).slice(0, 20) },
      { title: "Nieobejrzane", items: items.filter((i) => !i.watched) },
      {
        title: "Najwyżej oceniane",
        items: matched.filter((i) => ratingOf(i) != null).sort((a, b) => ratingOf(b)! - ratingOf(a)!).slice(0, 20),
      },
      ...genreRows,
      { title: "Nierozpoznane", items: items.filter((i) => i.matchStatus === "unmatched") },
    ];
  }, [items]);

  return (
    <div className="pb-16">
      {featured ? <Hero item={featured} onOpen={onOpen} onPlay={onPlay} /> : <div className="h-24" />}
      <div className={`relative space-y-8 ${featured ? "-mt-10 sm:-mt-16" : ""}`}>
        {rows.map((row) => (
          <MovieRow
            key={row.title}
            title={row.title}
            items={row.items}
            onOpen={onOpen}
            onPlay={onPlay}
            onRemove={"removable" in row ? onRemoveFromHistory : undefined}
            removeLabel="Usuń z ostatnio odtwarzanych"
          />
        ))}
      </div>
    </div>
  );
}

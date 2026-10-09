import { Check, Play } from "lucide-react";
import type { LibraryItem } from "../api";
import { ratingOf, titleOf, yearOf } from "../format";
import { Poster } from "./Poster";
import { Rating } from "./Rating";

interface Props {
  item: LibraryItem;
  onOpen: (item: LibraryItem) => void;
  onPlay: (item: LibraryItem) => void;
  className?: string;
}

export function MovieCard({ item, onOpen, onPlay, className = "" }: Props) {
  return (
    <div className={`group relative ${className}`}>
      <button
        type="button"
        onClick={() => onOpen(item)}
        className="relative block aspect-[2/3] w-full overflow-hidden rounded-lg bg-surface ring-1 ring-white/5 transition duration-300 ease-out group-hover:-translate-y-1 group-hover:shadow-2xl group-hover:shadow-black/60 group-hover:ring-white/20"
      >
        <Poster item={item} className="transition duration-500 group-hover:scale-105" />

        <div className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-black/90 via-black/30 to-transparent p-3 text-left opacity-0 transition duration-300 group-hover:opacity-100">
          <Rating value={ratingOf(item)} className="text-sm" />
          {item.details && item.details.genres.length > 0 && (
            <span className="mt-1 line-clamp-1 text-xs text-white/70">
              {item.details.genres.slice(0, 2).join(" · ")}
            </span>
          )}
        </div>

        {item.watched && (
          <span
            title="Obejrzany"
            className="absolute top-2 right-2 grid size-6 place-items-center rounded-full bg-black/70 text-accent backdrop-blur"
          >
            <Check className="size-3.5" strokeWidth={3} />
          </span>
        )}
        {item.matchStatus === "unmatched" && (
          <span className="absolute top-2 left-2 rounded bg-red-500/80 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide uppercase">
            Brak danych
          </span>
        )}
      </button>

      <button
        type="button"
        title="Odtwórz"
        onClick={() => onPlay(item)}
        className="absolute top-[calc(50%-2.75rem)] left-1/2 grid size-12 -translate-x-1/2 scale-90 place-items-center rounded-full bg-white/95 text-black opacity-0 shadow-lg transition duration-300 group-hover:scale-100 group-hover:opacity-100 hover:bg-accent"
      >
        <Play className="ml-0.5 size-5 fill-current" />
      </button>

      <div className="mt-2 px-0.5">
        <p className="truncate text-sm font-medium text-fg/90">{titleOf(item)}</p>
        <p className="text-xs text-muted">{yearOf(item) ?? "—"}</p>
      </div>
    </div>
  );
}

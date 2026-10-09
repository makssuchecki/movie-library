import { useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { LibraryItem } from "../api";
import { MovieCard } from "./MovieCard";

interface Props {
  title: string;
  items: LibraryItem[];
  onOpen: (item: LibraryItem) => void;
  onPlay: (item: LibraryItem) => void;
}

export function MovieRow({ title, items, onOpen, onPlay }: Props) {
  const scroller = useRef<HTMLDivElement>(null);
  if (items.length === 0) return null;

  const scroll = (dir: 1 | -1) => {
    const el = scroller.current;
    if (el) el.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: "smooth" });
  };

  return (
    <section className="group/row relative">
      <h2 className="mb-3 px-4 text-lg font-semibold tracking-tight sm:px-8 lg:px-12">{title}</h2>
      <div
        ref={scroller}
        className="no-scrollbar flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 pt-2 pb-4 sm:scroll-px-8 sm:gap-4 sm:px-8 lg:scroll-px-12 lg:px-12"
      >
        {items.map((item) => (
          <MovieCard
            key={item.folderPath}
            item={item}
            onOpen={onOpen}
            onPlay={onPlay}
            className="w-32 shrink-0 snap-start sm:w-40 lg:w-44 2xl:w-52"
          />
        ))}
      </div>
      {(["left", "right"] as const).map((side) => (
        <button
          key={side}
          type="button"
          aria-label={side === "left" ? "Przewiń w lewo" : "Przewiń w prawo"}
          onClick={() => scroll(side === "left" ? -1 : 1)}
          className={`absolute top-1/2 hidden h-[45%] w-10 -translate-y-1/2 place-items-center bg-bg/70 opacity-0 backdrop-blur transition group-hover/row:opacity-100 hover:bg-bg/90 md:grid ${
            side === "left" ? "left-0 rounded-r-lg" : "right-0 rounded-l-lg"
          }`}
        >
          {side === "left" ? <ChevronLeft className="size-6" /> : <ChevronRight className="size-6" />}
        </button>
      ))}
    </section>
  );
}

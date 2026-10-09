import { Info, Play } from "lucide-react";
import { motion } from "motion/react";
import { localImage, type LibraryItem } from "../api";
import { formatRuntime, ratingOf, titleOf, yearOf } from "../format";
import { Rating } from "./Rating";

interface Props {
  item: LibraryItem;
  onOpen: (item: LibraryItem) => void;
  onPlay: (item: LibraryItem) => void;
}

export function Hero({ item, onOpen, onPlay }: Props) {
  const d = item.details;
  const backdrop = localImage(d?.backdropPath);
  const meta = [yearOf(item), formatRuntime(d?.runtime), d?.genres.slice(0, 3).join(", ")].filter(Boolean);

  return (
    <section className="relative h-[72vh] min-h-[420px] max-h-[760px] w-full overflow-hidden">
      {backdrop && (
        <motion.img
          key={backdrop}
          src={backdrop}
          alt=""
          draggable={false}
          initial={{ opacity: 0, scale: 1.04 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1.2, ease: "easeOut" }}
          className="absolute inset-0 h-full w-full object-cover object-top"
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-r from-bg via-bg/60 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-t from-bg via-transparent to-bg/30" />

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.2 }}
        className="absolute inset-x-0 bottom-20 px-4 sm:bottom-28 sm:px-8 lg:px-12"
      >
        <div className="max-w-2xl">
          <h1 className="text-4xl font-bold tracking-tight text-balance drop-shadow-lg sm:text-5xl lg:text-6xl">
            {titleOf(item)}
          </h1>
          <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-white/80">
            <Rating value={ratingOf(item)} className="text-base text-white" />
            {meta.map((m, i) => (
              <span key={i} className="flex items-center gap-3">
                <span className="text-white/30">•</span>
                {m}
              </span>
            ))}
          </div>
          {d?.overview && (
            <p className="mt-4 line-clamp-3 max-w-xl text-sm leading-relaxed text-white/80 sm:text-base">
              {d.overview}
            </p>
          )}
          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => onPlay(item)}
              className="flex items-center gap-2 rounded-md bg-white px-6 py-2.5 font-semibold text-black transition hover:bg-white/85"
            >
              <Play className="size-5 fill-current" /> Odtwórz
            </button>
            <button
              type="button"
              onClick={() => onOpen(item)}
              className="flex items-center gap-2 rounded-md bg-white/15 px-6 py-2.5 font-semibold backdrop-blur transition hover:bg-white/25"
            >
              <Info className="size-5" /> Szczegóły
            </button>
          </div>
        </div>
      </motion.div>
    </section>
  );
}

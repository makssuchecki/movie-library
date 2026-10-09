import { useEffect, useState } from "react";
import { Check, Clapperboard, FolderOpen, Play, Search, Shuffle, Trash, TriangleAlert, X } from "lucide-react";
import { openUrl, revealItemInDir } from "@tauri-apps/plugin-opener";
import { localImage, type LibraryItem } from "../api";
import { formatRuntime, formatSize, ratingOf, titleOf, yearOf } from "../format";
import { Modal } from "./Modal";
import { Poster } from "./Poster";
import { Rating } from "./Rating";

interface Props {
  item: LibraryItem;
  onClose: () => void;
  onPlay: (item: LibraryItem) => void;
  onToggleWatched: (item: LibraryItem) => void;
  onFixMatch: (item: LibraryItem) => void;
  /** Ustawione, gdy film został wylosowany — pokazuje przycisk „Losuj inny”. */
  onReroll?: () => void;
  onDelete: (item: LibraryItem, permanent: boolean) => Promise<void>;
}

export function MovieModal({ item, onClose, onPlay, onToggleWatched, onFixMatch, onReroll, onDelete }: Props) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [permanent, setPermanent] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Nowy film w oknie (np. po „Losuj inny”) — schowaj potwierdzenie usunięcia.
  useEffect(() => {
    setConfirmDelete(false);
    setPermanent(false);
  }, [item.folderPath]);

  const d = item.details;
  const backdrop = localImage(d?.backdropPath);
  const meta = [yearOf(item), formatRuntime(d?.runtime)].filter(Boolean);

  return (
    <Modal onClose={onClose}>
      <div className="relative aspect-[21/9] max-h-[440px] w-full bg-surface-2">
        {backdrop && <img src={backdrop} alt="" className="h-full w-full object-cover" draggable={false} />}
        <div className="absolute inset-0 bg-gradient-to-t from-surface via-surface/40 to-transparent" />
        <button
          type="button"
          onClick={onClose}
          aria-label="Zamknij"
          className="absolute top-4 right-4 grid size-9 place-items-center rounded-full bg-black/60 backdrop-blur transition hover:bg-black/80"
        >
          <X className="size-5" />
        </button>
      </div>

      <div className="relative -mt-24 grid gap-6 px-5 pb-6 sm:-mt-32 sm:grid-cols-[180px_1fr] sm:px-8 sm:pb-8">
        <div className="mx-auto hidden aspect-[2/3] w-[180px] overflow-hidden rounded-xl shadow-2xl ring-1 ring-white/10 sm:block">
          <Poster item={item} />
        </div>

        <div className="min-w-0 sm:pt-16">
          <h2 className="text-3xl font-bold tracking-tight text-balance sm:text-4xl">{titleOf(item)}</h2>
          {d && d.originalTitle && d.originalTitle !== d.title && (
            <p className="mt-1 text-sm text-muted">{d.originalTitle}</p>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-fg/80">
            <Rating value={ratingOf(item)} className="text-base" />
            {d && d.voteCount > 0 && <span className="text-xs text-muted">({d.voteCount.toLocaleString("pl-PL")} głosów)</span>}
            {meta.map((m, i) => (
              <span key={i} className="flex items-center gap-3">
                <span className="text-white/25">•</span>
                {m}
              </span>
            ))}
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => onPlay(item)}
              className="flex items-center gap-2 rounded-md bg-white px-5 py-2 font-semibold text-black transition hover:bg-white/85"
            >
              <Play className="size-4 fill-current" /> Odtwórz
            </button>
            <button
              type="button"
              onClick={() => onToggleWatched(item)}
              className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition ${
                item.watched ? "bg-accent/15 text-accent hover:bg-accent/25" : "bg-white/10 hover:bg-white/15"
              }`}
            >
              <Check className="size-4" /> {item.watched ? "Obejrzany" : "Oznacz jako obejrzany"}
            </button>
            {d?.trailerKey && (
              <button
                type="button"
                onClick={() => openUrl(`https://www.youtube.com/watch?v=${d.trailerKey}`)}
                className="flex items-center gap-2 rounded-md bg-white/10 px-4 py-2 text-sm font-medium transition hover:bg-white/15"
              >
                <Clapperboard className="size-4" /> Zwiastun
              </button>
            )}
            {onReroll && (
              <button
                type="button"
                onClick={onReroll}
                className="flex items-center gap-2 rounded-md bg-white/10 px-4 py-2 text-sm font-medium transition hover:bg-white/15"
              >
                <Shuffle className="size-4" /> Losuj inny
              </button>
            )}
          </div>

          {d?.tagline && <p className="mt-6 text-sm text-fg/60 italic">„{d.tagline}”</p>}
          {d ? (
            <p className="selectable mt-3 max-w-3xl leading-relaxed text-fg/85">
              {d.overview || "Brak opisu."}
            </p>
          ) : (
            <div className="mt-6 rounded-lg border border-dashed border-line p-4 text-sm text-muted">
              Nie znaleziono tego filmu w TMDB na podstawie nazwy folderu „{item.folderName}”.
              <button
                type="button"
                onClick={() => onFixMatch(item)}
                className="ml-1 font-medium text-accent hover:underline"
              >
                Dopasuj ręcznie
              </button>
            </div>
          )}

          {d && (
            <dl className="mt-6 grid gap-x-6 gap-y-3 text-sm sm:grid-cols-[auto_1fr]">
              {d.director && (
                <>
                  <dt className="text-muted">Reżyseria</dt>
                  <dd>{d.director}</dd>
                </>
              )}
              {d.genres.length > 0 && (
                <>
                  <dt className="text-muted">Gatunki</dt>
                  <dd>{d.genres.join(", ")}</dd>
                </>
              )}
            </dl>
          )}
        </div>
      </div>

      {d && d.cast.length > 0 && (
        <div className="border-t border-line/60 px-5 py-6 sm:px-8">
          <h3 className="mb-4 text-sm font-semibold tracking-wide text-muted uppercase">Obsada</h3>
          <div className="no-scrollbar flex gap-4 overflow-x-auto pb-1">
            {d.cast.map((c) => (
              <div key={c.name + c.character} className="w-24 shrink-0 text-center">
                <div className="mx-auto size-20 overflow-hidden rounded-full bg-surface-2 ring-1 ring-white/10">
                  {c.profileUrl ? (
                    <img src={c.profileUrl} alt={c.name} loading="lazy" className="h-full w-full object-cover" />
                  ) : (
                    <div className="grid h-full w-full place-items-center text-lg font-semibold text-muted">
                      {c.name.charAt(0)}
                    </div>
                  )}
                </div>
                <p className="mt-2 line-clamp-2 text-xs font-medium">{c.name}</p>
                {c.character && <p className="line-clamp-2 text-[11px] text-muted">{c.character}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-line/60 bg-black/20 px-5 py-4 text-xs text-muted sm:px-8">
        <span className="selectable min-w-0 flex-1 truncate" title={item.filePath}>
          {item.filePath} · {formatSize(item.fileSize)}
        </span>
        <button
          type="button"
          onClick={() => revealItemInDir(item.filePath)}
          className="flex items-center gap-1.5 transition hover:text-fg"
        >
          <FolderOpen className="size-3.5" /> Pokaż w folderze
        </button>
        <button
          type="button"
          onClick={() => onFixMatch(item)}
          className="flex items-center gap-1.5 transition hover:text-fg"
        >
          <Search className="size-3.5" /> Popraw dopasowanie
        </button>
        <button
          type="button"
          onClick={() => setConfirmDelete(true)}
          className="flex items-center gap-1.5 transition hover:text-red-400"
        >
          <Trash className="size-3.5" /> Usuń z dysku
        </button>
      </div>

      {confirmDelete && (
        <div
          ref={(el) => el?.scrollIntoView({ behavior: "smooth", block: "nearest" })}
          className="border-t border-red-500/30 bg-red-950/40 px-5 py-5 sm:px-8"
        >
          <div className="flex gap-3">
            <TriangleAlert className="mt-0.5 size-5 shrink-0 text-red-400" />
            <div className="min-w-0 flex-1">
              <p className="font-medium">
                Usunąć „{titleOf(item)}” z dysku? ({formatSize(item.fileSize)})
              </p>
              <p className="mt-1 text-sm text-fg/70">
                {permanent
                  ? "Cały folder filmu zostanie trwale usunięty. Tej operacji nie można cofnąć."
                  : "Cały folder filmu zostanie przeniesiony do Kosza. Miejsce zwolni się po opróżnieniu Kosza."}
              </p>
              <label className="mt-3 flex w-fit cursor-pointer items-center gap-2 text-sm text-fg/80">
                <input
                  type="checkbox"
                  checked={permanent}
                  onChange={(e) => setPermanent(e.target.checked)}
                  className="accent-red-500"
                />
                Usuń trwale (z pominięciem Kosza)
              </label>
              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  disabled={deleting}
                  onClick={async () => {
                    setDeleting(true);
                    try {
                      await onDelete(item, permanent);
                    } finally {
                      setDeleting(false);
                    }
                  }}
                  className="rounded-md bg-red-600 px-4 py-2 text-sm font-semibold transition hover:bg-red-500 disabled:opacity-60"
                >
                  {deleting ? "Usuwanie…" : permanent ? "Usuń trwale" : "Przenieś do Kosza"}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDelete(false)}
                  className="rounded-md px-4 py-2 text-sm text-fg/70 hover:text-fg"
                >
                  Anuluj
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}

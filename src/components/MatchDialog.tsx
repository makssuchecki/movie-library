import { useEffect, useState, type FormEvent } from "react";
import { Film, LoaderCircle, Search, X } from "lucide-react";
import { api, type LibraryItem, type SearchCandidate } from "../api";
import { Modal } from "./Modal";

interface Props {
  item: LibraryItem;
  onClose: () => void;
  onMatched: () => void;
  onError: (message: string) => void;
}

export function MatchDialog({ item, onClose, onMatched, onError }: Props) {
  const [query, setQuery] = useState(item.parsedTitle);
  const [year, setYear] = useState(item.parsedYear?.toString() ?? "");
  const [results, setResults] = useState<SearchCandidate[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState<number | null>(null);

  const search = async (e?: FormEvent) => {
    e?.preventDefault();
    if (!query.trim()) return;
    setSearching(true);
    try {
      setResults(await api.searchTmdb(query.trim(), year ? Number(year) : null));
    } catch (err) {
      onError(String(err));
    } finally {
      setSearching(false);
    }
  };

  useEffect(() => {
    search();
  }, []);

  const choose = async (c: SearchCandidate) => {
    setSaving(c.tmdbId);
    try {
      await api.setMatch(item.folderPath, c.tmdbId);
      onMatched();
    } catch (err) {
      onError(String(err));
      setSaving(null);
    }
  };

  return (
    <Modal onClose={onClose} className="max-w-2xl">
      <div className="flex items-center justify-between border-b border-line/60 px-6 py-4">
        <div className="min-w-0">
          <h2 className="font-semibold">Dopasuj film</h2>
          <p className="truncate text-xs text-muted">{item.folderName}</p>
        </div>
        <button type="button" onClick={onClose} aria-label="Zamknij" className="text-muted hover:text-fg">
          <X className="size-5" />
        </button>
      </div>

      <form onSubmit={search} className="flex gap-2 px-6 pt-5">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="TytuĹ‚"
          autoFocus
          className="min-w-0 flex-1 rounded-md border border-line bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent/60"
        />
        <input
          value={year}
          onChange={(e) => setYear(e.target.value.replace(/\D/g, "").slice(0, 4))}
          placeholder="Rok"
          inputMode="numeric"
          className="w-20 rounded-md border border-line bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent/60"
        />
        <button
          type="submit"
          className="grid w-10 place-items-center rounded-md bg-white/10 transition hover:bg-white/15"
          aria-label="Szukaj"
        >
          {searching ? <LoaderCircle className="size-4 animate-spin" /> : <Search className="size-4" />}
        </button>
      </form>

      <ul className="max-h-[60vh] space-y-1 overflow-y-auto px-3 py-4">
        {results?.length === 0 && <li className="px-3 py-6 text-center text-sm text-muted">Brak wynikĂłw.</li>}
        {results?.map((c) => (
          <li key={c.tmdbId}>
            <button
              type="button"
              disabled={saving !== null}
              onClick={() => choose(c)}
              className="flex w-full gap-4 rounded-lg p-3 text-left transition hover:bg-white/5 disabled:opacity-60"
            >
              <div className="aspect-[2/3] w-14 shrink-0 overflow-hidden rounded bg-surface-2">
                {c.posterUrl ? (
                  <img src={c.posterUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
                ) : (
                  <div className="grid h-full place-items-center">
                    <Film className="size-5 text-muted" />
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-medium">
                  {c.title} <span className="font-normal text-muted">{c.year ? `(${c.year})` : ""}</span>
                </p>
                {c.originalTitle !== c.title && <p className="text-xs text-muted">{c.originalTitle}</p>}
                <p className="mt-1 line-clamp-2 text-xs text-fg/60">{c.overview}</p>
              </div>
              {saving === c.tmdbId && <LoaderCircle className="size-4 shrink-0 animate-spin self-center" />}
            </button>
          </li>
        ))}
      </ul>
    </Modal>
  );
}

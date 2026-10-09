import { useEffect, useState } from "react";
import { RefreshCw, Search, Settings, Shuffle, X } from "lucide-react";

export type View = "browse" | "all";

interface Props {
  view: View;
  onViewChange: (view: View) => void;
  query: string;
  onQueryChange: (q: string) => void;
  busy: boolean;
  onRefresh: () => void;
  onRandom: () => void;
  onOpenSettings: () => void;
  showNav: boolean;
}

const tabs: { id: View; label: string }[] = [
  { id: "browse", label: "Przeglądaj" },
  { id: "all", label: "Wszystkie" },
];

export function Header({
  view,
  onViewChange,
  query,
  onQueryChange,
  busy,
  onRefresh,
  onRandom,
  onOpenSettings,
  showNav,
}: Props) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-40 transition-colors duration-300 ${
        scrolled ? "bg-bg/85 shadow-lg shadow-black/30 backdrop-blur-md" : "bg-gradient-to-b from-black/70 to-transparent"
      }`}
    >
      <div className="flex h-16 items-center gap-4 px-4 sm:gap-8 sm:px-8 lg:px-12">
        <span className="text-xl font-bold tracking-tight">
          Kino<span className="text-accent">teka</span>
        </span>

        {showNav && (
          <nav className="flex gap-1 text-sm">
            {tabs.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  onQueryChange("");
                  onViewChange(t.id);
                }}
                className={`rounded-md px-3 py-1.5 transition ${
                  view === t.id && !query ? "font-semibold text-fg" : "text-fg/60 hover:text-fg"
                }`}
              >
                {t.label}
              </button>
            ))}
          </nav>
        )}

        <div className="ml-auto flex items-center gap-1 sm:gap-2">
          {showNav && (
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
              <input
                value={query}
                onChange={(e) => onQueryChange(e.target.value)}
                placeholder="Szukaj tytułu, aktora…"
                className="w-36 rounded-full border border-white/10 bg-black/40 py-1.5 pr-8 pl-9 text-sm backdrop-blur transition-[width,border-color] outline-none placeholder:text-muted focus:w-52 focus:border-white/30 sm:w-56 sm:focus:w-72"
              />
              {query && (
                <button
                  type="button"
                  aria-label="Wyczyść"
                  onClick={() => onQueryChange("")}
                  className="absolute top-1/2 right-2.5 -translate-y-1/2 text-muted hover:text-fg"
                >
                  <X className="size-4" />
                </button>
              )}
            </div>
          )}
          {showNav && (
            <button
              type="button"
              title="Wylosuj film"
              onClick={onRandom}
              className="flex h-9 items-center gap-2 rounded-full px-2.5 text-sm text-fg/70 transition hover:bg-white/10 hover:text-fg sm:px-3"
            >
              <Shuffle className="size-[18px]" />
              <span className="hidden sm:inline">Losuj</span>
            </button>
          )}
          {showNav && (
            <button
              type="button"
              title="Odśwież bibliotekę"
              onClick={onRefresh}
              disabled={busy}
              className="grid size-9 place-items-center rounded-full text-fg/70 transition hover:bg-white/10 hover:text-fg disabled:opacity-50"
            >
              <RefreshCw className={`size-[18px] ${busy ? "animate-spin" : ""}`} />
            </button>
          )}
          <button
            type="button"
            title="Ustawienia"
            onClick={onOpenSettings}
            className="grid size-9 place-items-center rounded-full text-fg/70 transition hover:bg-white/10 hover:text-fg"
          >
            <Settings className="size-[18px]" />
          </button>
        </div>
      </div>
    </header>
  );
}

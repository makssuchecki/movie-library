import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { open } from "@tauri-apps/plugin-dialog";
import { AnimatePresence } from "motion/react";
import { FolderOpen } from "lucide-react";
import { api, type LibraryItem, type Settings, type SyncProgress } from "./api";
import { formatSize, matchesQuery, titleOf } from "./format";
import { Browse } from "./components/Browse";
import { Header, type View } from "./components/Header";
import { LibraryGrid } from "./components/LibraryGrid";
import { MatchDialog } from "./components/MatchDialog";
import { MovieModal } from "./components/MovieModal";
import { SettingsDialog } from "./components/SettingsDialog";
import { StatusLayer, type Toast } from "./components/StatusLayer";

export default function App() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [view, setView] = useState<View>("browse");
  const [query, setQuery] = useState("");
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [matchPath, setMatchPath] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [busy, setBusy] = useState<"scan" | "sync" | null>(null);
  const [progress, setProgress] = useState<SyncProgress | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  const started = useRef(false);

  const showToast = useCallback((message: string, kind: Toast["kind"] = "info") => {
    const id = Date.now();
    setToast({ id, message, kind });
    setTimeout(() => setToast((t) => (t?.id === id ? null : t)), kind === "error" ? 6000 : 3000);
  }, []);

  const reload = useCallback(async () => {
    setItems(await api.getLibrary());
    setLoaded(true);
  }, []);

  const refresh = useCallback(
    async (retryUnmatched = false) => {
      try {
        setBusy("scan");
        await api.scanLibrary();
        await reload();
        setBusy("sync");
        const summary = await api.syncMetadata(retryUnmatched);
        await reload();
        if (summary.failed) showToast(`Nie udało się pobrać danych dla ${summary.failed} poz.`, "error");
      } catch (err) {
        showToast(String(err), "error");
      } finally {
        setBusy(null);
        setProgress(null);
      }
    },
    [reload, showToast],
  );

  useEffect(() => {
    const unlisten = listen<SyncProgress>("sync-progress", (e) => setProgress(e.payload));
    return () => {
      unlisten.then((f) => f());
    };
  }, []);

  // Śledzenie MPC-HC zapisało postęp lub oznaczyło film jako obejrzany.
  useEffect(() => {
    const unlisten = listen("library-changed", () => {
      reload().catch(() => {});
    });
    return () => {
      unlisten.then((f) => f());
    };
  }, [reload]);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    (async () => {
      try {
        const s = await api.getSettings();
        setSettings(s);
        if (s.libraryPath) {
          await reload(); // najpierw pokaż cache, potem skanuj w tle
          await refresh();
        }
      } catch (err) {
        showToast(String(err), "error");
      }
    })();
  }, [reload, refresh, showToast]);

  const selected = useMemo(() => items.find((i) => i.folderPath === selectedPath) ?? null, [items, selectedPath]);
  const matchItem = useMemo(() => items.find((i) => i.folderPath === matchPath) ?? null, [items, matchPath]);
  const searchResults = useMemo(() => items.filter((i) => matchesQuery(i, query)), [items, query]);

  const [randomMode, setRandomMode] = useState(false);

  const openItem = useCallback((item: LibraryItem) => {
    setRandomMode(false);
    setSelectedPath(item.folderPath);
  }, []);

  // Losuje spośród nieobejrzanych (gdy wszystkie obejrzane — z całej biblioteki), bez powtórzenia bieżącego.
  const pickRandom = useCallback(() => {
    const unwatched = items.filter((i) => !i.watched);
    const pool = (unwatched.length ? unwatched : items).filter(
      (i, _, all) => all.length === 1 || i.folderPath !== selectedPath,
    );
    if (!pool.length) return;
    setRandomMode(true);
    setSelectedPath(pool[Math.floor(Math.random() * pool.length)].folderPath);
  }, [items, selectedPath]);

  const play = useCallback(
    async (item: LibraryItem, fromStart = false) => {
      try {
        await api.playMovie(item.folderPath, fromStart);
        showToast(`Odtwarzanie: ${titleOf(item)}`);
        await reload();
      } catch (err) {
        showToast(String(err), "error");
      }
    },
    [reload, showToast],
  );

  const toggleWatched = useCallback(
    async (item: LibraryItem) => {
      try {
        await api.setWatched(item.folderPath, !item.watched);
        await reload();
      } catch (err) {
        showToast(String(err), "error");
      }
    },
    [reload, showToast],
  );

  const removeFromHistory = useCallback(
    async (item: LibraryItem) => {
      try {
        await api.clearHistory(item.folderPath);
        await reload();
      } catch (err) {
        showToast(String(err), "error");
      }
    },
    [reload, showToast],
  );

  const deleteMovie = useCallback(
    async (item: LibraryItem, permanent: boolean) => {
      try {
        const freed = await api.deleteMovie(item.folderPath, permanent);
        setSelectedPath(null);
        setRandomMode(false);
        await reload();
        showToast(
          permanent
            ? `Usunięto „${titleOf(item)}” — zwolniono ${formatSize(freed)}`
            : `Przeniesiono „${titleOf(item)}” do Kosza (${formatSize(freed)})`,
        );
      } catch (err) {
        showToast(String(err), "error");
      }
    },
    [reload, showToast],
  );

  const pickLibrary = async () => {
    if (!settings) return;
    const dir = await open({ directory: true });
    if (typeof dir !== "string") return;
    const saved = await api.saveSettings({ ...settings, libraryPath: dir, apiKey: null });
    setSettings(saved);
    await refresh();
  };

  const hasLibrary = !!settings?.libraryPath;

  return (
    <div className="min-h-screen">
      <Header
        view={view}
        onViewChange={setView}
        query={query}
        onQueryChange={setQuery}
        busy={busy !== null}
        onRefresh={() => refresh(true)}
        onRandom={pickRandom}
        onOpenSettings={() => setSettingsOpen(true)}
        showNav={hasLibrary}
      />

      <main>
        {settings && !hasLibrary && (
          <div className="grid min-h-screen place-items-center px-6">
            <div className="max-w-md text-center">
              <h1 className="text-3xl font-bold tracking-tight">Witaj w Kinotece</h1>
              <p className="mt-3 text-muted">
                Wskaż folder, w którym trzymasz filmy w podfolderach „Tytuł (rok)”. Informacje o filmach zostaną
                pobrane z TMDB.
              </p>
              <button
                type="button"
                onClick={pickLibrary}
                className="mt-8 inline-flex items-center gap-2 rounded-md bg-white px-6 py-3 font-semibold text-black transition hover:bg-white/85"
              >
                <FolderOpen className="size-5" /> Wybierz folder z filmami
              </button>
            </div>
          </div>
        )}

        {hasLibrary && loaded && items.length === 0 && !busy && (
          <div className="grid min-h-screen place-items-center px-6 text-center text-muted">
            <div>
              <p>Nie znaleziono filmów w folderze</p>
              <p className="mt-1 font-mono text-sm text-fg/70">{settings!.libraryPath}</p>
            </div>
          </div>
        )}

        {hasLibrary && items.length > 0 &&
          (query ? (
            <LibraryGrid items={searchResults} heading={`Wyniki dla „${query}”`} onOpen={openItem} onPlay={play} />
          ) : view === "browse" ? (
            <Browse items={items} onOpen={openItem} onPlay={play} onRemoveFromHistory={removeFromHistory} />
          ) : (
            <LibraryGrid items={items} heading="Wszystkie filmy" onOpen={openItem} onPlay={play} />
          ))}
      </main>

      <AnimatePresence>
        {selected && !matchItem && (
          <MovieModal
            key="movie"
            item={selected}
            onClose={() => {
              setSelectedPath(null);
              setRandomMode(false);
            }}
            onPlay={play}
            onToggleWatched={toggleWatched}
            onFixMatch={(item) => setMatchPath(item.folderPath)}
            onReroll={randomMode ? pickRandom : undefined}
            onDelete={deleteMovie}
          />
        )}
        {matchItem && (
          <MatchDialog
            key="match"
            item={matchItem}
            onClose={() => setMatchPath(null)}
            onError={(m) => showToast(m, "error")}
            onMatched={async () => {
              setMatchPath(null);
              await reload();
              showToast("Zaktualizowano dopasowanie");
            }}
          />
        )}
        {settingsOpen && settings && (
          <SettingsDialog
            key="settings"
            settings={settings}
            onClose={() => setSettingsOpen(false)}
            onError={(m) => showToast(m, "error")}
            onSettingsChange={setSettings}
            onSaved={(saved, needsRefresh) => {
              setSettings(saved);
              setSettingsOpen(false);
              showToast("Zapisano ustawienia");
              if (needsRefresh && saved.libraryPath) refresh(true);
            }}
          />
        )}
      </AnimatePresence>

      <StatusLayer busy={busy} progress={progress} toast={toast} />
    </div>
  );
}

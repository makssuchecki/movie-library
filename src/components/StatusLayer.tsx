import { AnimatePresence, motion } from "motion/react";
import { LoaderCircle } from "lucide-react";
import type { SyncProgress } from "../api";

export interface Toast {
  id: number;
  message: string;
  kind: "info" | "error";
}

interface Props {
  busy: "scan" | "sync" | null;
  progress: SyncProgress | null;
  toast: Toast | null;
}

/** Wskaźnik synchronizacji (prawy dolny róg) i powiadomienia (dół, środek). */
export function StatusLayer({ busy, progress, toast }: Props) {
  const showProgress = busy === "scan" || (busy === "sync" && progress && progress.total > 0);
  const pct = progress && progress.total ? (progress.done / progress.total) * 100 : 0;

  return (
    <>
      <AnimatePresence>
        {showProgress && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            className="fixed right-4 bottom-4 z-50 w-72 overflow-hidden rounded-xl bg-surface-2/95 shadow-2xl ring-1 ring-white/10 backdrop-blur"
          >
            <div className="flex items-center gap-3 px-4 py-3 text-sm">
              <LoaderCircle className="size-4 shrink-0 animate-spin text-accent" />
              <div className="min-w-0">
                <p className="font-medium">
                  {busy === "scan" ? "Skanowanie folderu…" : `Pobieranie informacji ${progress!.done}/${progress!.total}`}
                </p>
                {busy === "sync" && progress?.current && (
                  <p className="truncate text-xs text-muted">{progress.current}</p>
                )}
              </div>
            </div>
            {busy === "sync" && (
              <div className="h-0.5 bg-white/5">
                <div className="h-full bg-accent transition-[width] duration-300" style={{ width: `${pct}%` }} />
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {toast && (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, y: 16, x: "-50%" }}
            animate={{ opacity: 1, y: 0, x: "-50%" }}
            exit={{ opacity: 0, y: 16, x: "-50%" }}
            className={`fixed bottom-6 left-1/2 z-[60] max-w-[min(90vw,32rem)] rounded-lg px-4 py-2.5 text-sm shadow-2xl ring-1 backdrop-blur ${
              toast.kind === "error" ? "bg-red-950/90 text-red-100 ring-red-500/30" : "bg-surface-2/95 ring-white/10"
            }`}
          >
            {toast.message}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

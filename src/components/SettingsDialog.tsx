import { useState, type FormEvent, type ReactNode } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { openUrl } from "@tauri-apps/plugin-opener";
import { Folder, X } from "lucide-react";
import { api, type Settings } from "../api";
import { Modal } from "./Modal";

interface Props {
  settings: Settings;
  onClose: () => void;
  onSaved: (settings: Settings, needsRefresh: boolean) => void;
  onError: (message: string) => void;
}

const inputClass =
  "min-w-0 flex-1 rounded-md border border-line bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent/60";

function Field({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium">{label}</span>
      {children}
      {hint && <span className="mt-1.5 block text-xs text-muted">{hint}</span>}
    </label>
  );
}

export function SettingsDialog({ settings, onClose, onSaved, onError }: Props) {
  const [libraryPath, setLibraryPath] = useState(settings.libraryPath ?? "");
  const [mpcPath, setMpcPath] = useState(settings.mpcPath ?? "");
  const [language, setLanguage] = useState(settings.language);
  const [apiKey, setApiKey] = useState("");
  const [saving, setSaving] = useState(false);

  const pickLibrary = async () => {
    const dir = await open({ directory: true, defaultPath: libraryPath || undefined });
    if (typeof dir === "string") setLibraryPath(dir);
  };

  const pickMpc = async () => {
    const file = await open({ filters: [{ name: "Program", extensions: ["exe"] }] });
    if (typeof file === "string") setMpcPath(file);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const saved = await api.saveSettings({
        libraryPath: libraryPath.trim() || null,
        mpcPath: mpcPath.trim() || null,
        language,
        apiKey: apiKey.trim() ? apiKey.trim() : null,
      });
      const needsRefresh =
        saved.libraryPath !== settings.libraryPath || saved.language !== settings.language || !!apiKey.trim();
      onSaved(saved, needsRefresh);
    } catch (err) {
      onError(String(err));
      setSaving(false);
    }
  };

  const clearCustomKey = async () => {
    try {
      const saved = await api.saveSettings({ libraryPath: settings.libraryPath, mpcPath: settings.mpcPath, language: settings.language, apiKey: "" });
      onSaved(saved, false);
    } catch (err) {
      onError(String(err));
    }
  };

  const keyStatus = {
    custom: "Używany jest własny klucz z ustawień.",
    builtin: "Używany jest klucz z pliku .env (wbudowany przy kompilacji).",
    none: "Brak klucza — metadane nie będą pobierane.",
  }[settings.apiKeySource];

  return (
    <Modal onClose={onClose} className="max-w-xl">
      <form onSubmit={submit}>
        <div className="flex items-center justify-between border-b border-line/60 px-6 py-4">
          <h2 className="font-semibold">Ustawienia</h2>
          <button type="button" onClick={onClose} aria-label="Zamknij" className="text-muted hover:text-fg">
            <X className="size-5" />
          </button>
        </div>

        <div className="space-y-5 px-6 py-6">
          <Field label="Folder z filmami" hint="Podfoldery w formacie „Tytuł (rok)” z plikiem filmu w środku.">
            <div className="flex gap-2">
              <input value={libraryPath} onChange={(e) => setLibraryPath(e.target.value)} placeholder="np. D:\Filmy" className={inputClass} />
              <button type="button" onClick={pickLibrary} className="flex items-center gap-1.5 rounded-md bg-white/10 px-3 text-sm hover:bg-white/15">
                <Folder className="size-4" /> Wybierz
              </button>
            </div>
          </Field>

          <Field
            label="Media Player Classic"
            hint={
              settings.detectedMpcPath
                ? `Wykryto automatycznie: ${settings.detectedMpcPath}. Zostaw puste, aby go używać.`
                : "Nie wykryto MPC-HC — wskaż plik mpc-hc64.exe lub mpc-hc.exe."
            }
          >
            <div className="flex gap-2">
              <input
                value={mpcPath}
                onChange={(e) => setMpcPath(e.target.value)}
                placeholder={settings.detectedMpcPath ?? "C:\\Program Files\\MPC-HC\\mpc-hc64.exe"}
                className={inputClass}
              />
              <button type="button" onClick={pickMpc} className="flex items-center gap-1.5 rounded-md bg-white/10 px-3 text-sm hover:bg-white/15">
                <Folder className="size-4" /> Wybierz
              </button>
            </div>
          </Field>

          <Field label="Język opisów">
            <select value={language} onChange={(e) => setLanguage(e.target.value)} className={`${inputClass} w-full`}>
              <option value="pl-PL">Polski</option>
              <option value="en-US">English</option>
            </select>
          </Field>

          <Field
            label="Klucz API TMDB"
            hint={
              <>
                {keyStatus}{" "}
                {settings.apiKeySource === "custom" && (
                  <button type="button" onClick={clearCustomKey} className="text-accent hover:underline">
                    Usuń własny klucz
                  </button>
                )}
              </>
            }
          >
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Wklej, aby nadpisać"
              autoComplete="off"
              className={`${inputClass} w-full`}
            />
          </Field>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-line/60 bg-black/20 px-6 py-4">
          <p className="max-w-xs text-[11px] leading-snug text-muted">
            Dane o filmach:{" "}
            <button type="button" onClick={() => openUrl("https://www.themoviedb.org")} className="font-semibold text-[#01b4e4] hover:underline">
              TMDB
            </button>
            . This product uses the TMDB API but is not endorsed or certified by TMDB.
          </p>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="rounded-md px-4 py-2 text-sm text-muted hover:text-fg">
              Anuluj
            </button>
            <button type="submit" disabled={saving} className="rounded-md bg-white px-5 py-2 text-sm font-semibold text-black hover:bg-white/85 disabled:opacity-60">
              Zapisz
            </button>
          </div>
        </div>
      </form>
    </Modal>
  );
}

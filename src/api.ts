import { convertFileSrc, invoke } from "@tauri-apps/api/core";

export interface CastMember {
  name: string;
  character: string | null;
  profileUrl: string | null;
}

export interface MovieDetails {
  tmdbId: number;
  title: string;
  originalTitle: string;
  overview: string;
  tagline: string | null;
  releaseDate: string | null;
  runtime: number | null;
  voteAverage: number;
  voteCount: number;
  genres: string[];
  director: string | null;
  cast: CastMember[];
  trailerKey: string | null;
  posterPath: string | null;
  backdropPath: string | null;
}

export type MatchStatus = "pending" | "matched" | "manual" | "unmatched";

export interface LibraryItem {
  folderPath: string;
  folderName: string;
  filePath: string;
  fileSize: number;
  parsedTitle: string;
  parsedYear: number | null;
  matchStatus: MatchStatus;
  addedAt: number;
  watched: boolean;
  lastPlayed: number | null;
  details: MovieDetails | null;
}

export interface Settings {
  libraryPath: string | null;
  mpcPath: string | null;
  detectedMpcPath: string | null;
  language: string;
  apiKeySource: "custom" | "builtin" | "none";
}

export interface SettingsInput {
  libraryPath: string | null;
  mpcPath: string | null;
  language: string;
  /** undefined/null = bez zmian, "" = usuń własny klucz */
  apiKey?: string | null;
}

export interface SearchCandidate {
  tmdbId: number;
  title: string;
  originalTitle: string;
  year: number | null;
  overview: string;
  posterUrl: string | null;
}

export interface ScanSummary {
  total: number;
  added: number;
  removed: number;
}

export interface SyncSummary {
  updated: number;
  unmatched: number;
  failed: number;
}

export interface SyncProgress {
  done: number;
  total: number;
  current: string;
}

export const api = {
  getSettings: () => invoke<Settings>("get_settings"),
  saveSettings: (input: SettingsInput) => invoke<Settings>("save_settings", { input }),
  scanLibrary: () => invoke<ScanSummary>("scan_library"),
  syncMetadata: (retryUnmatched = false) => invoke<SyncSummary>("sync_metadata", { retryUnmatched }),
  getLibrary: () => invoke<LibraryItem[]>("get_library"),
  searchTmdb: (query: string, year: number | null) =>
    invoke<SearchCandidate[]>("search_tmdb", { query, year }),
  setMatch: (folderPath: string, tmdbId: number) => invoke<void>("set_match", { folderPath, tmdbId }),
  playMovie: (folderPath: string) => invoke<void>("play_movie", { folderPath }),
  setWatched: (folderPath: string, watched: boolean) => invoke<void>("set_watched", { folderPath, watched }),
};

/** Lokalny plik obrazu (cache) -> URL możliwy do użycia w <img>. */
export const localImage = (path: string | null | undefined) => (path ? convertFileSrc(path) : null);

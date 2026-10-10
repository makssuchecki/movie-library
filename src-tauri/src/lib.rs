mod db;
mod models;
mod player;
mod scanner;
mod tmdb;
mod tracker;

use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Mutex, MutexGuard};

use rusqlite::Connection;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, Manager, State};

use models::{LibraryItem, SearchCandidate};
use tmdb::{Tmdb, TmdbError};

const DEFAULT_LANGUAGE: &str = "pl-PL";
const BUILTIN_API_KEY: Option<&str> = option_env!("TMDB_API_KEY");

struct AppState {
    db: Mutex<Connection>,
    images_dir: PathBuf,
    http: reqwest::Client,
    syncing: AtomicBool,
    tracking: AtomicBool,
}

impl AppState {
    fn db(&self) -> MutexGuard<'_, Connection> {
        self.db.lock().unwrap_or_else(|poisoned| poisoned.into_inner())
    }

    fn language(&self) -> String {
        db::get_setting(&self.db(), "language").unwrap_or_else(|| DEFAULT_LANGUAGE.into())
    }

    /// Wskazuje obraz w bieżącym folderze cache po nazwie pliku — zapisana ścieżka
    /// może pochodzić ze starej lokalizacji danych (np. po zmianie identyfikatora aplikacji).
    fn resolve_image(&self, stored: Option<String>) -> Option<String> {
        let name = Path::new(stored.as_deref()?).file_name()?;
        let path = self.images_dir.join(name);
        path.exists().then(|| path.to_string_lossy().into_owned())
    }

    fn tmdb(&self) -> Result<Tmdb, String> {
        let key = db::get_setting(&self.db(), "tmdb_api_key")
            .or_else(|| BUILTIN_API_KEY.map(str::to_owned))
            .filter(|k| !k.trim().is_empty())
            .ok_or("Brak klucza API TMDB — dodaj go w ustawieniach")?;
        Ok(Tmdb::new(self.http.clone(), key, self.language()))
    }
}

fn err(e: impl std::fmt::Display) -> String {
    e.to_string()
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct SettingsDto {
    library_path: Option<String>,
    mpc_path: Option<String>,
    detected_mpc_path: Option<String>,
    language: String,
    api_key_source: &'static str,
    /// "enabled" | "exposed" (włączony, ale dostępny z sieci) | "disabled" | "unavailable"
    /// — interfejs WWW MPC-HC do śledzenia postępu.
    mpc_tracking: &'static str,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct SettingsInput {
    library_path: Option<String>,
    mpc_path: Option<String>,
    language: String,
    /// `None` — bez zmian, pusty napis — usuń własny klucz.
    api_key: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ScanSummary {
    total: usize,
    added: usize,
    removed: usize,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct SyncProgress {
    done: usize,
    total: usize,
    current: String,
}

#[derive(Default, Serialize)]
#[serde(rename_all = "camelCase")]
struct SyncSummary {
    updated: usize,
    unmatched: usize,
    failed: usize,
}

#[tauri::command]
fn get_settings(state: State<'_, AppState>) -> SettingsDto {
    let conn = state.db();
    let api_key_source = if db::get_setting(&conn, "tmdb_api_key").is_some() {
        "custom"
    } else if BUILTIN_API_KEY.is_some_and(|k| !k.is_empty()) {
        "builtin"
    } else {
        "none"
    };
    SettingsDto {
        library_path: db::get_setting(&conn, "library_path"),
        mpc_path: db::get_setting(&conn, "mpc_path"),
        detected_mpc_path: player::detect_mpc(),
        language: db::get_setting(&conn, "language").unwrap_or_else(|| DEFAULT_LANGUAGE.into()),
        api_key_source,
        mpc_tracking: match player::web_interface() {
            Some(w) if w.enabled && w.localhost_only => "enabled",
            Some(w) if w.enabled => "exposed",
            Some(_) => "disabled",
            None => "unavailable",
        },
    }
}

#[tauri::command]
fn enable_mpc_tracking(state: State<'_, AppState>) -> Result<SettingsDto, String> {
    player::enable_web_interface()?;
    Ok(get_settings(state))
}

#[tauri::command]
fn save_settings(state: State<'_, AppState>, input: SettingsInput) -> Result<SettingsDto, String> {
    {
        let conn = state.db();
        db::set_setting(&conn, "library_path", input.library_path.as_deref()).map_err(err)?;
        db::set_setting(&conn, "mpc_path", input.mpc_path.as_deref()).map_err(err)?;
        db::set_setting(&conn, "language", Some(&input.language)).map_err(err)?;
        if let Some(key) = input.api_key.as_deref() {
            db::set_setting(&conn, "tmdb_api_key", Some(key)).map_err(err)?;
        }
    }
    Ok(get_settings(state))
}

#[tauri::command]
async fn scan_library(state: State<'_, AppState>) -> Result<ScanSummary, String> {
    let root = db::get_setting(&state.db(), "library_path").ok_or("Nie wybrano folderu z filmami")?;
    let scanned = scanner::scan(Path::new(&root))?;
    let (added, removed) = db::sync_scanned(&mut state.db(), &scanned).map_err(err)?;
    Ok(ScanSummary { total: scanned.len(), added, removed })
}

#[tauri::command]
async fn sync_metadata(
    app: AppHandle,
    state: State<'_, AppState>,
    retry_unmatched: bool,
) -> Result<SyncSummary, String> {
    if state.syncing.swap(true, Ordering::SeqCst) {
        return Err("Synchronizacja już trwa".into());
    }
    let result = run_sync(&app, &state, retry_unmatched).await;
    state.syncing.store(false, Ordering::SeqCst);
    result
}

async fn run_sync(app: &AppHandle, state: &AppState, retry_unmatched: bool) -> Result<SyncSummary, String> {
    let tmdb = state.tmdb()?;
    let jobs = db::pending_sync(&state.db(), tmdb.language(), retry_unmatched).map_err(err)?;
    let total = jobs.len();
    let mut summary = SyncSummary::default();

    for (done, job) in jobs.iter().enumerate() {
        let _ = app.emit("sync-progress", SyncProgress { done, total, current: job.title.clone() });
        match sync_one(state, &tmdb, job).await {
            Ok(true) => summary.updated += 1,
            Ok(false) => summary.unmatched += 1,
            Err(TmdbError::Unauthorized) => return Err(TmdbError::Unauthorized.to_string()),
            Err(e) => {
                eprintln!("[sync] {}: {e}", job.folder_path);
                summary.failed += 1;
            }
        }
    }
    let _ = app.emit("sync-progress", SyncProgress { done: total, total, current: String::new() });
    Ok(summary)
}

/// Zwraca `false`, gdy filmu nie udało się znaleźć w TMDB.
async fn sync_one(state: &AppState, tmdb: &Tmdb, job: &db::SyncJob) -> Result<bool, TmdbError> {
    let (id, newly_matched) = match job.tmdb_id {
        Some(id) => (id, false),
        None => match tmdb.find_best(&job.title, job.year).await? {
            Some(id) => (id, true),
            None => {
                db::mark_unmatched(&state.db(), &job.folder_path)?;
                return Ok(false);
            }
        },
    };
    let details = tmdb.details(id, &state.images_dir).await?;
    let conn = state.db();
    db::save_details(&conn, tmdb.language(), &details)?;
    if newly_matched {
        db::set_match(&conn, &job.folder_path, id, "matched")?;
    }
    Ok(true)
}

#[tauri::command]
fn get_library(state: State<'_, AppState>) -> Result<Vec<LibraryItem>, String> {
    let language = state.language();
    let mut items = db::list_items(&state.db(), &language).map_err(err)?;
    for details in items.iter_mut().filter_map(|i| i.details.as_mut()) {
        details.poster_path = state.resolve_image(details.poster_path.take());
        details.backdrop_path = state.resolve_image(details.backdrop_path.take());
    }
    Ok(items)
}

#[tauri::command]
async fn search_tmdb(
    state: State<'_, AppState>,
    query: String,
    year: Option<i32>,
) -> Result<Vec<SearchCandidate>, String> {
    state.tmdb()?.search(&query, year).await.map_err(err)
}

#[tauri::command]
async fn set_match(state: State<'_, AppState>, folder_path: String, tmdb_id: i64) -> Result<(), String> {
    let tmdb = state.tmdb()?;
    let details = tmdb.details(tmdb_id, &state.images_dir).await.map_err(err)?;
    let conn = state.db();
    db::save_details(&conn, tmdb.language(), &details).map_err(err)?;
    db::set_match(&conn, &folder_path, tmdb_id, "manual").map_err(err)
}

/// Odtwarza film w MPC-HC — od zapisanej pozycji, chyba że `from_start`.
#[tauri::command]
fn play_movie(app: AppHandle, state: State<'_, AppState>, folder_path: String, from_start: bool) -> Result<(), String> {
    let conn = state.db();
    let file = db::file_path(&conn, &folder_path)
        .map_err(err)?
        .ok_or("Nie znaleziono filmu w bibliotece")?;
    let player = db::get_setting(&conn, "mpc_path")
        .filter(|p| Path::new(p).exists())
        .or_else(player::detect_mpc)
        .ok_or("Nie znaleziono Media Player Classic — wskaż plik mpc-hc w ustawieniach")?;
    let start_ms = if from_start {
        db::clear_resume(&conn, &folder_path).map_err(err)?;
        None
    } else {
        db::resume_position(&conn, &folder_path).map_err(err)?
    };
    player::play(&player, &file, start_ms)?;
    db::touch_played(&conn, &folder_path).map_err(err)?;

    if let Some(web) = player::web_interface().filter(|w| w.enabled) {
        tracker::ensure_running(&app, web.port);
    }
    Ok(())
}

#[tauri::command]
fn clear_history(state: State<'_, AppState>, folder_path: String) -> Result<(), String> {
    db::clear_history(&state.db(), &folder_path).map_err(err)
}

#[tauri::command]
fn set_watched(state: State<'_, AppState>, folder_path: String, watched: bool) -> Result<(), String> {
    db::set_watched(&state.db(), &folder_path, watched).map_err(err)
}

fn dir_size(path: &Path) -> u64 {
    std::fs::read_dir(path)
        .into_iter()
        .flatten()
        .flatten()
        .map(|e| match e.metadata() {
            Ok(m) if m.is_dir() => dir_size(&e.path()),
            Ok(m) => m.len(),
            Err(_) => 0,
        })
        .sum()
}

/// Usuwa folder filmu z dysku (domyślnie do Kosza). Zwraca liczbę usuniętych bajtów.
/// Dozwolone są wyłącznie foldery z biblioteki będące bezpośrednimi podfolderami folderu z filmami.
#[tauri::command]
async fn delete_movie(state: State<'_, AppState>, folder_path: String, permanent: bool) -> Result<u64, String> {
    let root = {
        let conn = state.db();
        db::file_path(&conn, &folder_path).map_err(err)?.ok_or("Nie znaleziono filmu w bibliotece")?;
        db::get_setting(&conn, "library_path").ok_or("Nie wybrano folderu z filmami")?
    };
    let folder = std::fs::canonicalize(&folder_path).map_err(|e| format!("Folder nie istnieje: {e}"))?;
    let root = std::fs::canonicalize(&root).map_err(err)?;
    if folder.parent() != Some(root.as_path()) {
        return Err("Odmowa: folder nie leży bezpośrednio w folderze z filmami".into());
    }

    let size = dir_size(&folder);
    if permanent {
        std::fs::remove_dir_all(&folder).map_err(|e| format!("Nie udało się usunąć folderu: {e}"))?;
    } else {
        trash::delete(&folder).map_err(|e| format!("Nie udało się przenieść do Kosza: {e}"))?;
    }
    db::delete_movie(&state.db(), &folder_path).map_err(err)?;
    Ok(size)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let data_dir = app.path().app_data_dir()?;
            let images_dir = data_dir.join("images");
            std::fs::create_dir_all(&images_dir)?;
            let conn = db::open(&data_dir.join("library.db"))?;
            app.manage(AppState {
                db: Mutex::new(conn),
                images_dir,
                http: reqwest::Client::builder().user_agent("Kinoteka/0.1").build()?,
                syncing: AtomicBool::new(false),
                tracking: AtomicBool::new(false),
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_settings,
            save_settings,
            scan_library,
            sync_metadata,
            get_library,
            search_tmdb,
            set_match,
            play_movie,
            set_watched,
            delete_movie,
            clear_history,
            enable_mpc_tracking,
        ])
        .run(tauri::generate_context!())
        .expect("błąd podczas uruchamiania aplikacji");
}

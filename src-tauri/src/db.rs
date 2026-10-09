use std::collections::HashSet;
use std::path::Path;
use std::time::{SystemTime, UNIX_EPOCH};

use rusqlite::{params, Connection, OptionalExtension};

use crate::models::{LibraryItem, MovieDetails};
use crate::scanner::ScannedMovie;

const SCHEMA: &str = "
PRAGMA journal_mode = WAL;
CREATE TABLE IF NOT EXISTS settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS movies (
    folder_path  TEXT PRIMARY KEY,
    folder_name  TEXT NOT NULL,
    file_path    TEXT NOT NULL,
    file_size    INTEGER NOT NULL,
    parsed_title TEXT NOT NULL,
    parsed_year  INTEGER,
    tmdb_id      INTEGER,
    match_status TEXT NOT NULL DEFAULT 'pending', -- pending | matched | manual | unmatched
    added_at     INTEGER NOT NULL,
    watched      INTEGER NOT NULL DEFAULT 0,
    last_played  INTEGER
);
CREATE TABLE IF NOT EXISTS tmdb_details (
    tmdb_id    INTEGER NOT NULL,
    language   TEXT NOT NULL,
    data       TEXT NOT NULL,
    fetched_at INTEGER NOT NULL,
    PRIMARY KEY (tmdb_id, language)
);
";

pub struct SyncJob {
    pub folder_path: String,
    pub title: String,
    pub year: Option<i32>,
    pub tmdb_id: Option<i64>,
}

fn now() -> i64 {
    SystemTime::now().duration_since(UNIX_EPOCH).map_or(0, |d| d.as_secs() as i64)
}

pub fn open(path: &Path) -> rusqlite::Result<Connection> {
    let conn = Connection::open(path)?;
    conn.execute_batch(SCHEMA)?;
    Ok(conn)
}

pub fn get_setting(conn: &Connection, key: &str) -> Option<String> {
    conn.query_row("SELECT value FROM settings WHERE key = ?1", [key], |r| r.get(0))
        .optional()
        .ok()
        .flatten()
}

/// Zapisuje ustawienie; pusta wartość lub `None` usuwa je.
pub fn set_setting(conn: &Connection, key: &str, value: Option<&str>) -> rusqlite::Result<()> {
    match value.map(str::trim).filter(|v| !v.is_empty()) {
        Some(v) => conn.execute(
            "INSERT INTO settings (key, value) VALUES (?1, ?2)
             ON CONFLICT(key) DO UPDATE SET value = excluded.value",
            params![key, v],
        ),
        None => conn.execute("DELETE FROM settings WHERE key = ?1", [key]),
    }
    .map(|_| ())
}

/// Synchronizuje tabelę `movies` z wynikiem skanowania. Zwraca (dodane, usunięte).
pub fn sync_scanned(conn: &mut Connection, scanned: &[ScannedMovie]) -> rusqlite::Result<(usize, usize)> {
    let tx = conn.transaction()?;
    let existing: HashSet<String> = {
        let mut stmt = tx.prepare("SELECT folder_path FROM movies")?;
        let rows = stmt.query_map([], |r| r.get(0))?;
        rows.collect::<Result<_, _>>()?
    };

    let mut added = 0;
    for m in scanned {
        if existing.contains(&m.folder_path) {
            tx.execute(
                "UPDATE movies SET file_path = ?2, file_size = ?3 WHERE folder_path = ?1",
                params![m.folder_path, m.file_path, m.file_size as i64],
            )?;
        } else {
            tx.execute(
                "INSERT INTO movies (folder_path, folder_name, file_path, file_size, parsed_title, parsed_year, added_at)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
                params![m.folder_path, m.folder_name, m.file_path, m.file_size as i64, m.title, m.year, m.added_at],
            )?;
            added += 1;
        }
    }

    let scanned_paths: HashSet<&str> = scanned.iter().map(|m| m.folder_path.as_str()).collect();
    let mut removed = 0;
    for path in existing.iter().filter(|p| !scanned_paths.contains(p.as_str())) {
        tx.execute("DELETE FROM movies WHERE folder_path = ?1", [path])?;
        removed += 1;
    }

    tx.commit()?;
    Ok((added, removed))
}

/// Filmy bez dopasowania lub bez metadanych w danym języku.
pub fn pending_sync(conn: &Connection, language: &str, retry_unmatched: bool) -> rusqlite::Result<Vec<SyncJob>> {
    let mut stmt = conn.prepare(
        "SELECT m.folder_path, m.parsed_title, m.parsed_year, m.tmdb_id
         FROM movies m
         LEFT JOIN tmdb_details d ON d.tmdb_id = m.tmdb_id AND d.language = ?1
         WHERE m.match_status = 'pending'
            OR (?2 AND m.match_status = 'unmatched')
            OR (m.tmdb_id IS NOT NULL AND d.tmdb_id IS NULL)
         ORDER BY m.parsed_title",
    )?;
    let rows = stmt.query_map(params![language, retry_unmatched], |r| {
        Ok(SyncJob { folder_path: r.get(0)?, title: r.get(1)?, year: r.get(2)?, tmdb_id: r.get(3)? })
    })?;
    rows.collect()
}

pub fn save_details(conn: &Connection, language: &str, details: &MovieDetails) -> rusqlite::Result<()> {
    let json = serde_json::to_string(details).expect("MovieDetails serializuje się zawsze");
    conn.execute(
        "INSERT OR REPLACE INTO tmdb_details (tmdb_id, language, data, fetched_at) VALUES (?1, ?2, ?3, ?4)",
        params![details.tmdb_id, language, json, now()],
    )?;
    Ok(())
}

pub fn set_match(conn: &Connection, folder_path: &str, tmdb_id: i64, status: &str) -> rusqlite::Result<()> {
    conn.execute(
        "UPDATE movies SET tmdb_id = ?2, match_status = ?3 WHERE folder_path = ?1",
        params![folder_path, tmdb_id, status],
    )?;
    Ok(())
}

pub fn mark_unmatched(conn: &Connection, folder_path: &str) -> rusqlite::Result<()> {
    conn.execute(
        "UPDATE movies SET tmdb_id = NULL, match_status = 'unmatched' WHERE folder_path = ?1",
        [folder_path],
    )?;
    Ok(())
}

pub fn set_watched(conn: &Connection, folder_path: &str, watched: bool) -> rusqlite::Result<()> {
    conn.execute("UPDATE movies SET watched = ?2 WHERE folder_path = ?1", params![folder_path, watched])?;
    Ok(())
}

pub fn touch_played(conn: &Connection, folder_path: &str) -> rusqlite::Result<()> {
    conn.execute("UPDATE movies SET last_played = ?2 WHERE folder_path = ?1", params![folder_path, now()])?;
    Ok(())
}

pub fn file_path(conn: &Connection, folder_path: &str) -> rusqlite::Result<Option<String>> {
    conn.query_row("SELECT file_path FROM movies WHERE folder_path = ?1", [folder_path], |r| r.get(0))
        .optional()
}

pub fn list_items(conn: &Connection, language: &str) -> rusqlite::Result<Vec<LibraryItem>> {
    let mut stmt = conn.prepare(
        "SELECT m.folder_path, m.folder_name, m.file_path, m.file_size, m.parsed_title, m.parsed_year,
                m.match_status, m.added_at, m.watched, m.last_played, d.data
         FROM movies m
         LEFT JOIN tmdb_details d ON d.tmdb_id = m.tmdb_id AND d.language = ?1
         ORDER BY m.parsed_title COLLATE NOCASE",
    )?;
    let rows = stmt.query_map([language], |r| {
        let data: Option<String> = r.get(10)?;
        Ok(LibraryItem {
            folder_path: r.get(0)?,
            folder_name: r.get(1)?,
            file_path: r.get(2)?,
            file_size: r.get(3)?,
            parsed_title: r.get(4)?,
            parsed_year: r.get(5)?,
            match_status: r.get(6)?,
            added_at: r.get(7)?,
            watched: r.get(8)?,
            last_played: r.get(9)?,
            details: data.and_then(|d| serde_json::from_str(&d).ok()),
        })
    })?;
    rows.collect()
}

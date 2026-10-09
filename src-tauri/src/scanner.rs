use std::fs;
use std::path::Path;
use std::sync::LazyLock;
use std::time::UNIX_EPOCH;

use regex::Regex;

static FOLDER_RE: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"^(?P<title>.+?)\s*\((?P<year>\d{4})\)\s*$").unwrap());

const VIDEO_EXTENSIONS: &[&str] = &[
    "mkv", "mp4", "avi", "m4v", "mov", "ts", "m2ts", "webm", "wmv", "mpg", "mpeg",
];
const SKIP_WORDS: &[&str] = &["sample", "trailer", "featurette", "extras"];

#[derive(Debug)]
pub struct ScannedMovie {
    pub folder_path: String,
    pub folder_name: String,
    pub file_path: String,
    pub file_size: u64,
    pub title: String,
    pub year: Option<i32>,
    /// Czas utworzenia pliku (sekundy od epoki) — używany do sortowania "Ostatnio dodane".
    pub added_at: i64,
}

/// Rozbija nazwę folderu w konwencji "Tytuł (rok)". Inne nazwy zwraca jako tytuł bez roku.
pub fn parse_folder_name(name: &str) -> (String, Option<i32>) {
    match FOLDER_RE.captures(name) {
        Some(caps) => (caps["title"].trim().to_string(), caps["year"].parse().ok()),
        None => (name.replace(['.', '_'], " ").trim().to_string(), None),
    }
}

fn is_video(path: &Path) -> bool {
    let ext = path.extension().and_then(|e| e.to_str()).map(str::to_ascii_lowercase);
    let stem = path.file_stem().and_then(|s| s.to_str()).unwrap_or_default().to_ascii_lowercase();
    matches!(ext, Some(e) if VIDEO_EXTENSIONS.contains(&e.as_str()))
        && !SKIP_WORDS.iter().any(|w| stem.contains(w))
}

/// Skanuje bezpośrednie podfoldery `root`; w każdym wybiera największy plik wideo.
pub fn scan(root: &Path) -> Result<Vec<ScannedMovie>, String> {
    let entries = fs::read_dir(root)
        .map_err(|e| format!("Nie można odczytać folderu {}: {e}", root.display()))?;

    let mut movies = Vec::new();
    for entry in entries.flatten() {
        let folder = entry.path();
        if !folder.is_dir() {
            continue;
        }
        let Ok(files) = fs::read_dir(&folder) else { continue };

        let best = files
            .flatten()
            .filter(|f| f.path().is_file() && is_video(&f.path()))
            .filter_map(|f| f.metadata().ok().map(|m| (f.path(), m)))
            .max_by_key(|(_, m)| m.len());

        let Some((file, meta)) = best else { continue };
        let folder_name = entry.file_name().to_string_lossy().into_owned();
        let (title, year) = parse_folder_name(&folder_name);
        let added_at = meta
            .created()
            .or_else(|_| meta.modified())
            .ok()
            .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
            .map_or(0, |d| d.as_secs() as i64);

        movies.push(ScannedMovie {
            folder_path: folder.to_string_lossy().into_owned(),
            folder_name,
            file_path: file.to_string_lossy().into_owned(),
            file_size: meta.len(),
            title,
            year,
            added_at,
        });
    }
    Ok(movies)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_convention() {
        assert_eq!(parse_folder_name("Dune (2021)"), ("Dune".into(), Some(2021)));
        assert_eq!(
            parse_folder_name("Blade Runner 2049 (2017)"),
            ("Blade Runner 2049".into(), Some(2017))
        );
        assert_eq!(
            parse_folder_name("Mission: Impossible (1996) "),
            ("Mission: Impossible".into(), Some(1996))
        );
    }

    #[test]
    fn falls_back_without_year() {
        assert_eq!(parse_folder_name("The.Matrix"), ("The Matrix".into(), None));
    }

    #[test]
    fn detects_video_files() {
        assert!(is_video(Path::new("Dune.MKV")));
        assert!(!is_video(Path::new("dune-sample.mkv")));
        assert!(!is_video(Path::new("Dune.srt")));
    }
}

//! Śledzenie postępu odtwarzania przez interfejs WWW MPC-HC (`/variables.html`).
//! Działa w tle, dopóki MPC-HC jest uruchomiony; zapisuje pozycję co kilka sekund.

use std::sync::atomic::Ordering;
use std::time::Duration;

use tauri::{AppHandle, Emitter, Manager};

use crate::{db, AppState};

const POLL_INTERVAL: Duration = Duration::from_secs(5);
/// Ile nieudanych odczytów z rzędu kończy śledzenie: przed pierwszym połączeniem
/// (MPC-HC dopiero startuje) i po nim (MPC-HC zamknięty).
const MISSES_BEFORE_START: u32 = 12;
const MISSES_AFTER_START: u32 = 3;

#[derive(Debug, PartialEq)]
pub struct PlayerStatus {
    pub file_path: String,
    /// -1 brak pliku, 0 zatrzymany, 1 pauza, 2 odtwarzanie
    pub state: i32,
    pub position_ms: i64,
    pub duration_ms: i64,
}

fn field<'a>(html: &'a str, id: &str) -> Option<&'a str> {
    let marker = format!("id=\"{id}\">");
    let start = html.find(&marker)? + marker.len();
    let end = start + html[start..].find("</p>")?;
    Some(html[start..end].trim())
}

fn unescape(s: &str) -> String {
    s.replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&quot;", "\"")
        .replace("&#39;", "'")
        .replace("&amp;", "&")
}

pub fn parse_variables(html: &str) -> Option<PlayerStatus> {
    Some(PlayerStatus {
        file_path: unescape(field(html, "filepath")?),
        state: field(html, "state")?.parse().ok()?,
        position_ms: field(html, "position")?.parse().ok()?,
        duration_ms: field(html, "duration")?.parse().ok()?,
    })
}

async fn fetch_status(client: &reqwest::Client, url: &str) -> Option<PlayerStatus> {
    let resp = client.get(url).timeout(Duration::from_secs(2)).send().await.ok()?;
    parse_variables(&resp.text().await.ok()?)
}

/// Uruchamia śledzenie, jeśli jeszcze nie działa.
pub fn ensure_running(app: &AppHandle, port: u16) {
    let state = app.state::<AppState>();
    if state.tracking.swap(true, Ordering::SeqCst) {
        return;
    }
    let app = app.clone();
    tauri::async_runtime::spawn(async move {
        run(&app, port).await;
        app.state::<AppState>().tracking.store(false, Ordering::SeqCst);
    });
}

async fn run(app: &AppHandle, port: u16) {
    let state = app.state::<AppState>();
    let url = format!("http://127.0.0.1:{port}/variables.html");
    let (mut connected, mut misses) = (false, 0);

    loop {
        tokio::time::sleep(POLL_INTERVAL).await;
        let Some(status) = fetch_status(&state.http, &url).await else {
            misses += 1;
            let limit = if connected { MISSES_AFTER_START } else { MISSES_BEFORE_START };
            if misses >= limit {
                break;
            }
            continue;
        };
        connected = true;
        misses = 0;

        if status.state < 1 || status.file_path.is_empty() {
            continue;
        }
        let changed = db::record_progress(&state.db(), &status.file_path, status.position_ms, status.duration_ms);
        if matches!(changed, Ok(true)) {
            let _ = app.emit("library-changed", ());
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const SAMPLE: &str = r#"
        <p id="file">Dune.mkv</p>
        <p id="filepatharg">D%3a%5cFilmy%5cDune.mkv</p>
        <p id="filepath">D:\Filmy\Dune &amp; Co (2021)\Dune.mkv</p>
        <p id="state">2</p>
        <p id="statestring">Playing</p>
        <p id="position">754000</p>
        <p id="positionstring">00:12:34</p>
        <p id="duration">9300000</p>
    "#;

    #[test]
    fn parses_variables_page() {
        assert_eq!(
            parse_variables(SAMPLE),
            Some(PlayerStatus {
                file_path: r"D:\Filmy\Dune & Co (2021)\Dune.mkv".into(),
                state: 2,
                position_ms: 754_000,
                duration_ms: 9_300_000,
            })
        );
    }

    #[test]
    fn rejects_unrelated_page() {
        assert_eq!(parse_variables("<html>nic</html>"), None);
    }
}

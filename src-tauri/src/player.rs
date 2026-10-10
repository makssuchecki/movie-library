use std::path::Path;
use std::process::Command;

/// Szuka MPC-HC: najpierw w rejestrze (instalator zapisuje ExePath), potem w typowych lokalizacjach.
pub fn detect_mpc() -> Option<String> {
    from_registry().or_else(|| {
        let roots = [std::env::var("ProgramFiles").ok(), std::env::var("ProgramFiles(x86)").ok()];
        let relative = [
            r"MPC-HC\mpc-hc64.exe",
            r"MPC-HC\mpc-hc.exe",
            r"K-Lite Codec Pack\MPC-HC64\mpc-hc64.exe",
            r"K-Lite Codec Pack\MPC-HC\mpc-hc.exe",
        ];
        roots
            .iter()
            .flatten()
            .flat_map(|root| relative.iter().map(move |rel| Path::new(root).join(rel)))
            .find(|p| p.exists())
            .map(|p| p.to_string_lossy().into_owned())
    })
}

#[cfg(windows)]
fn from_registry() -> Option<String> {
    use winreg::enums::HKEY_CURRENT_USER;
    use winreg::RegKey;

    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    ["Software\\MPC-HC\\MPC-HC", "Software\\MPC-HC\\MPC-HC64"]
        .iter()
        .filter_map(|sub| hkcu.open_subkey(sub).ok())
        .filter_map(|key| key.get_value::<String, _>("ExePath").ok())
        .find(|p| Path::new(p).exists())
}

#[cfg(not(windows))]
fn from_registry() -> Option<String> {
    None
}

/// Uruchamia film; `start_ms` przekazywane jest jako `/start` (wznowienie od pozycji).
pub fn play(player: &str, file: &str, start_ms: Option<i64>) -> Result<(), String> {
    if !Path::new(file).exists() {
        return Err(format!("Plik nie istnieje: {file}"));
    }
    let mut cmd = Command::new(player);
    cmd.arg(file);
    if let Some(ms) = start_ms.filter(|ms| *ms > 0) {
        cmd.args(["/start", &ms.to_string()]);
    }
    cmd.spawn()
        .map(|_| ())
        .map_err(|e| format!("Nie udało się uruchomić odtwarzacza: {e}"))
}

const SETTINGS_KEY: &str = r"Software\MPC-HC\MPC-HC\Settings";
const DEFAULT_WEB_PORT: u16 = 13579;

/// Stan interfejsu WWW MPC-HC, potrzebnego do śledzenia postępu.
pub struct WebInterface {
    pub enabled: bool,
    pub localhost_only: bool,
    pub port: u16,
}

#[cfg(windows)]
pub fn web_interface() -> Option<WebInterface> {
    use winreg::enums::HKEY_CURRENT_USER;
    use winreg::RegKey;

    let key = RegKey::predef(HKEY_CURRENT_USER).open_subkey(SETTINGS_KEY).ok()?;
    let dword = |name: &str| key.get_value::<u32, _>(name).ok();
    Some(WebInterface {
        enabled: dword("EnableWebServer") == Some(1),
        localhost_only: dword("WebServerLocalhostOnly") == Some(1),
        port: dword("WebServerPort").and_then(|p| u16::try_from(p).ok()).unwrap_or(DEFAULT_WEB_PORT),
    })
}

#[cfg(not(windows))]
pub fn web_interface() -> Option<WebInterface> {
    None
}

/// Włącza interfejs WWW MPC-HC, dostępny wyłącznie z tego komputera.
#[cfg(windows)]
pub fn enable_web_interface() -> Result<(), String> {
    use winreg::enums::HKEY_CURRENT_USER;
    use winreg::RegKey;

    // MPC-HC zapisuje swoje ustawienia przy zamykaniu — zmiana w trakcie działania zostałaby nadpisana.
    if is_running() {
        return Err("Zamknij Media Player Classic i spróbuj ponownie".into());
    }
    let (key, _) = RegKey::predef(HKEY_CURRENT_USER)
        .create_subkey(SETTINGS_KEY)
        .map_err(|e| format!("Brak dostępu do ustawień MPC-HC: {e}"))?;
    for name in ["EnableWebServer", "WebServerLocalhostOnly"] {
        key.set_value(name, &1u32).map_err(|e| format!("Nie udało się zapisać ustawień MPC-HC: {e}"))?;
    }
    Ok(())
}

#[cfg(not(windows))]
pub fn enable_web_interface() -> Result<(), String> {
    Err("Dostępne tylko w systemie Windows".into())
}

#[cfg(windows)]
fn is_running() -> bool {
    use std::os::windows::process::CommandExt;
    const CREATE_NO_WINDOW: u32 = 0x0800_0000;

    Command::new("tasklist")
        .args(["/FI", "IMAGENAME eq mpc-hc*", "/NH"])
        .creation_flags(CREATE_NO_WINDOW)
        .output()
        .map(|o| String::from_utf8_lossy(&o.stdout).to_ascii_lowercase().contains("mpc-hc"))
        .unwrap_or(false)
}

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

pub fn play(player: &str, file: &str) -> Result<(), String> {
    if !Path::new(file).exists() {
        return Err(format!("Plik nie istnieje: {file}"));
    }
    Command::new(player)
        .arg(file)
        .spawn()
        .map(|_| ())
        .map_err(|e| format!("Nie udało się uruchomić odtwarzacza: {e}"))
}

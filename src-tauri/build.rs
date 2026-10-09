fn main() {
    // Wbudowuje klucz TMDB z ../.env w binarkę (aplikacja do użytku osobistego).
    // Klucz można nadpisać w ustawieniach aplikacji.
    println!("cargo:rerun-if-changed=../.env");
    if let Ok(content) = std::fs::read_to_string("../.env") {
        for line in content.lines() {
            if let Some((key, value)) = line.trim().split_once('=') {
                if key.trim() == "TMDB_API" {
                    let value = value.trim().trim_matches('"').trim_matches('\'');
                    println!("cargo:rustc-env=TMDB_API_KEY={value}");
                }
            }
        }
    }
    tauri_build::build()
}

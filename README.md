# Kinoteka

Desktopowa biblioteka filmów w stylu Netflix dla Windows. Skanuje folder z filmami, pobiera opisy, oceny, plakaty i obsadę z [TMDB](https://www.themoviedb.org) i uruchamia filmy w Media Player Classic (MPC-HC).

**Stack:** Tauri 2 (Rust) · React 19 + TypeScript · Tailwind CSS 4 · Motion · SQLite

## Wymagania

- Windows 10/11 z WebView2
- Node.js 20+
- Rust (stable, MSVC) + Visual Studio Build Tools z workloadem „C++”
- Media Player Classic – Home Cinema
- Klucz API TMDB (darmowy: themoviedb.org → Ustawienia → API)

## Konfiguracja

Utwórz plik `.env` w katalogu głównym (jest w `.gitignore`):

```
TMDB_API=twój_klucz_v3
```

Klucz jest wbudowywany w aplikację podczas kompilacji. Można go też nadpisać w ustawieniach aplikacji.

## Uruchomienie

```powershell
npm install
npm run tauri dev      # tryb deweloperski
npm run tauri build    # instalator w src-tauri/target/release/bundle
```

## Struktura folderu z filmami

```
Filmy/
├── Dune (2021)/
│   └── Dune.2021.2160p.mkv
└── The Matrix (1999)/
    └── matrix.mp4
```

W każdym podfolderze wybierany jest największy plik wideo. Pliki z `sample`/`trailer` w nazwie są pomijane. Błędne dopasowania poprawisz w szczegółach filmu przyciskiem „Popraw dopasowanie”.

## Dane aplikacji

Baza `library.db` i cache obrazów: `%APPDATA%\com.makss.kinoteka\`.

---

This product uses the TMDB API but is not endorsed or certified by TMDB.

## AI 
Aplikacja stworzona z pomocą Claude Code
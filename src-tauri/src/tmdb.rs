use std::fmt;
use std::path::Path;

use reqwest::StatusCode;
use serde::de::DeserializeOwned;
use serde::Deserialize;

use crate::models::{CastMember, MovieDetails, SearchCandidate};

const API_BASE: &str = "https://api.themoviedb.org/3";
const IMG_BASE: &str = "https://image.tmdb.org/t/p";
const CAST_LIMIT: usize = 12;

#[derive(Debug)]
pub enum TmdbError {
    Unauthorized,
    Other(String),
}

impl fmt::Display for TmdbError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            TmdbError::Unauthorized => write!(f, "Nieprawidłowy klucz API TMDB"),
            TmdbError::Other(msg) => write!(f, "Błąd TMDB: {msg}"),
        }
    }
}

impl From<reqwest::Error> for TmdbError {
    fn from(e: reqwest::Error) -> Self {
        TmdbError::Other(e.to_string())
    }
}

impl From<rusqlite::Error> for TmdbError {
    fn from(e: rusqlite::Error) -> Self {
        TmdbError::Other(format!("baza danych: {e}"))
    }
}

#[derive(Deserialize)]
struct SearchResponse {
    #[serde(default)]
    results: Vec<RawSearchResult>,
}

#[derive(Deserialize)]
struct RawSearchResult {
    id: i64,
    #[serde(default)]
    title: String,
    #[serde(default)]
    original_title: String,
    release_date: Option<String>,
    #[serde(default)]
    overview: String,
    poster_path: Option<String>,
}

#[derive(Deserialize)]
struct Named {
    name: String,
}

#[derive(Deserialize)]
struct RawDetails {
    id: i64,
    #[serde(default)]
    title: String,
    #[serde(default)]
    original_title: String,
    overview: Option<String>,
    tagline: Option<String>,
    release_date: Option<String>,
    runtime: Option<i64>,
    #[serde(default)]
    vote_average: f64,
    #[serde(default)]
    vote_count: i64,
    #[serde(default)]
    genres: Vec<Named>,
    poster_path: Option<String>,
    backdrop_path: Option<String>,
    credits: Option<Credits>,
    videos: Option<Videos>,
}

#[derive(Deserialize)]
struct Credits {
    #[serde(default)]
    cast: Vec<RawCast>,
    #[serde(default)]
    crew: Vec<RawCrew>,
}

#[derive(Deserialize)]
struct RawCast {
    name: String,
    character: Option<String>,
    profile_path: Option<String>,
}

#[derive(Deserialize)]
struct RawCrew {
    name: String,
    job: String,
}

#[derive(Deserialize)]
struct Videos {
    #[serde(default)]
    results: Vec<RawVideo>,
}

#[derive(Deserialize)]
struct RawVideo {
    key: String,
    site: String,
    #[serde(rename = "type")]
    kind: String,
    #[serde(default)]
    official: bool,
    iso_639_1: Option<String>,
}

fn year_of(date: &Option<String>) -> Option<i32> {
    date.as_deref().and_then(|d| d.get(..4)).and_then(|y| y.parse().ok())
}

fn non_empty(s: Option<String>) -> Option<String> {
    s.filter(|s| !s.trim().is_empty())
}

pub struct Tmdb {
    client: reqwest::Client,
    key: String,
    language: String,
}

impl Tmdb {
    pub fn new(client: reqwest::Client, key: String, language: String) -> Self {
        Self { client, key, language }
    }

    pub fn language(&self) -> &str {
        &self.language
    }

    fn lang_code(&self) -> &str {
        self.language.split('-').next().unwrap_or("en")
    }

    async fn get<T: DeserializeOwned>(&self, path: &str, query: &[(&str, String)]) -> Result<T, TmdbError> {
        let mut req = self.client.get(format!("{API_BASE}{path}")).query(query);
        // Klucz v3 (32 znaki) idzie w query, token v4 (JWT) w nagłówku.
        req = if self.key.len() > 40 {
            req.bearer_auth(&self.key)
        } else {
            req.query(&[("api_key", self.key.as_str())])
        };
        let resp = req.send().await?;
        match resp.status() {
            StatusCode::UNAUTHORIZED => Err(TmdbError::Unauthorized),
            s if !s.is_success() => Err(TmdbError::Other(format!("HTTP {s}"))),
            _ => Ok(resp.json::<T>().await?),
        }
    }

    async fn search_raw(&self, query: &str, year: Option<i32>) -> Result<Vec<RawSearchResult>, TmdbError> {
        let mut params = vec![
            ("query", query.to_string()),
            ("language", self.language.clone()),
            ("include_adult", "false".to_string()),
        ];
        if let Some(y) = year {
            params.push(("year", y.to_string()));
        }
        Ok(self.get::<SearchResponse>("/search/movie", &params).await?.results)
    }

    pub async fn search(&self, query: &str, year: Option<i32>) -> Result<Vec<SearchCandidate>, TmdbError> {
        let results = self.search_raw(query, year).await?;
        Ok(results
            .into_iter()
            .map(|r| SearchCandidate {
                tmdb_id: r.id,
                year: year_of(&r.release_date),
                title: r.title,
                original_title: r.original_title,
                overview: r.overview,
                poster_url: r.poster_path.map(|p| format!("{IMG_BASE}/w185{p}")),
            })
            .collect())
    }

    /// Wyszukuje najlepsze dopasowanie: preferuje zgodny rok premiery, potem ±1 rok, potem pierwszy wynik.
    pub async fn find_best(&self, title: &str, year: Option<i32>) -> Result<Option<i64>, TmdbError> {
        let mut results = self.search_raw(title, year).await?;
        if results.is_empty() && year.is_some() {
            results = self.search_raw(title, None).await?;
        }
        if let Some(y) = year {
            let by_year = |tolerance: i32| {
                results.iter().find(|r| year_of(&r.release_date).is_some_and(|ry| (ry - y).abs() <= tolerance))
            };
            if let Some(r) = by_year(0).or_else(|| by_year(1)) {
                return Ok(Some(r.id));
            }
        }
        Ok(results.first().map(|r| r.id))
    }

    /// Pobiera szczegóły filmu i zapisuje plakat oraz tło w `images_dir`.
    pub async fn details(&self, id: i64, images_dir: &Path) -> Result<MovieDetails, TmdbError> {
        let path = format!("/movie/{id}");
        let raw: RawDetails = self
            .get(
                &path,
                &[
                    ("language", self.language.clone()),
                    ("append_to_response", "credits,videos".into()),
                    ("include_video_language", format!("{},en,null", self.lang_code())),
                ],
            )
            .await?;

        let mut overview = raw.overview.unwrap_or_default();
        let mut tagline = non_empty(raw.tagline);
        if overview.trim().is_empty() && self.lang_code() != "en" {
            if let Ok(en) = self.get::<RawDetails>(&path, &[("language", "en-US".into())]).await {
                overview = en.overview.unwrap_or_default();
                tagline = tagline.or(non_empty(en.tagline));
            }
        }

        let (cast, director) = match raw.credits {
            Some(c) => (
                c.cast
                    .into_iter()
                    .take(CAST_LIMIT)
                    .map(|p| CastMember {
                        name: p.name,
                        character: non_empty(p.character),
                        profile_url: p.profile_path.map(|pp| format!("{IMG_BASE}/w185{pp}")),
                    })
                    .collect(),
                c.crew.into_iter().find(|p| p.job == "Director").map(|p| p.name),
            ),
            None => (Vec::new(), None),
        };

        let trailer_key = raw.videos.and_then(|v| {
            let lang = self.lang_code();
            let mut candidates: Vec<RawVideo> =
                v.results.into_iter().filter(|v| v.site == "YouTube" && (v.kind == "Trailer" || v.kind == "Teaser")).collect();
            // Kolejność: zwiastun przed teaserem, język UI, oficjalne.
            candidates.sort_by_key(|v| {
                (v.kind != "Trailer", v.iso_639_1.as_deref() != Some(lang), !v.official)
            });
            candidates.into_iter().next().map(|v| v.key)
        });

        let poster_path = match &raw.poster_path {
            Some(p) => self.download_image(p, "w500", images_dir).await,
            None => None,
        };
        let backdrop_path = match &raw.backdrop_path {
            Some(p) => self.download_image(p, "w1280", images_dir).await,
            None => None,
        };

        Ok(MovieDetails {
            tmdb_id: raw.id,
            title: raw.title,
            original_title: raw.original_title,
            overview,
            tagline,
            release_date: non_empty(raw.release_date),
            runtime: raw.runtime.filter(|r| *r > 0),
            vote_average: raw.vote_average,
            vote_count: raw.vote_count,
            genres: raw.genres.into_iter().map(|g| g.name).collect(),
            director,
            cast,
            trailer_key,
            poster_path,
            backdrop_path,
        })
    }

    async fn download_image(&self, tmdb_path: &str, size: &str, dir: &Path) -> Option<String> {
        let dest = dir.join(format!("{size}_{}", tmdb_path.trim_start_matches('/')));
        if !dest.exists() {
            let bytes = self
                .client
                .get(format!("{IMG_BASE}/{size}{tmdb_path}"))
                .send()
                .await
                .and_then(|r| r.error_for_status())
                .ok()?
                .bytes()
                .await
                .ok()?;
            std::fs::write(&dest, &bytes).ok()?;
        }
        Some(dest.to_string_lossy().into_owned())
    }
}

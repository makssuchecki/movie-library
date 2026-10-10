use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CastMember {
    pub name: String,
    pub character: Option<String>,
    pub profile_url: Option<String>,
}

/// Znormalizowane metadane filmu z TMDB, przechowywane w cache jako JSON.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MovieDetails {
    pub tmdb_id: i64,
    pub title: String,
    pub original_title: String,
    pub overview: String,
    pub tagline: Option<String>,
    pub release_date: Option<String>,
    pub runtime: Option<i64>,
    pub vote_average: f64,
    pub vote_count: i64,
    pub genres: Vec<String>,
    pub director: Option<String>,
    pub cast: Vec<CastMember>,
    pub trailer_key: Option<String>,
    /// Lokalne ścieżki do pobranych obrazów.
    pub poster_path: Option<String>,
    pub backdrop_path: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LibraryItem {
    pub folder_path: String,
    pub folder_name: String,
    pub file_path: String,
    pub file_size: i64,
    pub parsed_title: String,
    pub parsed_year: Option<i32>,
    pub match_status: String,
    pub added_at: i64,
    pub watched: bool,
    pub last_played: Option<i64>,
    /// Pozycja wznowienia i długość filmu (ms) odczytane z MPC-HC.
    pub resume_ms: Option<i64>,
    pub duration_ms: Option<i64>,
    pub details: Option<MovieDetails>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchCandidate {
    pub tmdb_id: i64,
    pub title: String,
    pub original_title: String,
    pub year: Option<i32>,
    pub overview: String,
    pub poster_url: Option<String>,
}

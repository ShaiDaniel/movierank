export interface Provider {
  name: string;
  logo: string;
}

export interface CastMember {
  name: string;
  character: string;
  photo: string | null;
}

export interface Play {
  at: string;
  /** Logged later from memory (before tracking started, or on a bulk-logging day), so the date isn't real. */
  backfilled: boolean;
  /** TV: episodes watched that day. */
  episodes?: number;
}

export interface TvInfo {
  status: string;
  network: string | null;
  seasons: { n: number; episodes: number; airDate: string | null }[];
  /** Regular episodes aired so far, and how many of them were watched. */
  aired: number;
  seen: number;
  perSeason: Record<string, number>;
  lastAirDate: string | null;
  nextAirDate: string | null;
}

/** One entry of data/movies.json (or data/shows.json for TV), produced by scripts/enrich-tmdb.mjs. */
export interface Movie {
  key: string;
  /** Set for TV shows; movies have none. */
  kind?: 'tv';
  tv?: TvInfo;
  ids: { trakt?: number; tmdb: number | null; imdb: string | null; slug?: string };
  plays: Play[];
  year: number;
  title: string;
  originalTitle?: string | null;
  releaseDate?: string | null;
  runtime?: number | null;
  genres: string[];
  overview?: string;
  tagline?: string | null;
  poster?: string | null;
  backdrop?: string | null;
  language?: string;
  collection?: string | null;
  tmdbRating?: number | null;
  /** From IMDb's daily ratings dataset. */
  imdbRating?: number;
  imdbVotes?: number;
  tmdbVotes?: number;
  popularity?: number;
  certification?: string | null;
  directors: string[];
  writers: string[];
  composers: string[];
  cinematographers: string[];
  cast: CastMember[];
  trailer?: string | null;
  providers?: { link: string; stream: Provider[]; rent: Provider[]; buy: Provider[] } | null;
}

export type VerdictId = 'must' | 'should' | 'may' | 'neutral' | 'maynot' | 'shouldnot' | 'mustnot';

export type ScoreId =
  | 'fun'
  | 'epic'
  | 'story'
  | 'acting'
  | 'visuals'
  | 'audio'
  | 'rewatch'
  | 'holdsUp'
  // TV only
  | 'consistency'
  | 'ending'
  | 'binge';

export type Progress = 'finished' | 'caughtup' | 'watching' | 'dropped';

export interface Rating {
  verdict?: VerdictId;
  scores?: Partial<Record<ScoreId, number>>;
  /** One-liner shown on cards. */
  note?: string;
  /** Free-form thoughts shown on the movie page. */
  review?: string;
  /** The watch date in Trakt may not be when it was really watched. */
  dateUncertain?: boolean;
  /** TV: a one-line note per season, keyed by season number. */
  seasons?: Record<string, string>;
  /** TV: overrides the progress worked out from the episodes watched. */
  progress?: Progress;
  updatedAt?: string;
}

export type Ratings = Record<string, Rating>;

export type Priority = 'high' | 'medium' | 'low';

/** One entry of data/watchlist.json, keyed by TMDB id. */
export interface WatchlistEntry {
  addedAt: string;
  source: 'trakt' | 'site';
  title?: string;
  year?: number | null;
  priority?: Priority;
  /** Why it's on the list, or who recommended it. */
  why?: string;
  /** Kept as a tombstone so a Trakt sync doesn't add it back. */
  removed?: boolean;
  updatedAt?: string;
}

export type Watchlist = Record<string, WatchlistEntry>;

/** A TMDB search result when adding to the watchlist. */
export interface SearchResult {
  tmdb: number;
  title: string;
  year: number | null;
  poster: string | null;
  overview: string;
}

/** Watches logged on the site (data/watches.json), keyed by TMDB id; merged with Trakt plays for display. */
export interface LoggedWatch {
  title?: string;
  year?: number | null;
  plays: Play[];
  updatedAt?: string;
}

export type Watches = Record<string, LoggedWatch>;

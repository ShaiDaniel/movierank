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
  /** Logged from memory before tracking started, so the date isn't real. */
  backfilled: boolean;
}

/** One entry of data/movies.json, produced by scripts/enrich-tmdb.mjs. */
export interface Movie {
  key: string;
  ids: { trakt: number; tmdb: number | null; imdb: string | null; slug: string };
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

export type ScoreId = 'fun' | 'epic' | 'story' | 'acting' | 'visuals' | 'audio' | 'rewatch' | 'holdsUp';

export interface Rating {
  verdict?: VerdictId;
  scores?: Partial<Record<ScoreId, number>>;
  /** One-liner shown on cards. */
  note?: string;
  /** Free-form thoughts shown on the movie page. */
  review?: string;
  /** The watch date in Trakt may not be when it was really watched. */
  dateUncertain?: boolean;
  updatedAt?: string;
}

export type Ratings = Record<string, Rating>;

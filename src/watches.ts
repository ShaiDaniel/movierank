import type { Movie, Play, Watches } from './types';

const DAY_MS = 24 * 60 * 60 * 1000;

/** A site-logged play within a day of a Trakt play is the same watch logged twice. */
function isDuplicate(play: Play, traktPlays: Play[]) {
  const t = Date.parse(play.at);
  return traktPlays.some((p) => (play.backfilled && p.backfilled) || Math.abs(Date.parse(p.at) - t) <= DAY_MS);
}

/**
 * The Watched list: Trakt movies (data/movies.json) plus watches logged on the site.
 * Logged movies Trakt doesn't know come from data/logged-movies.json.
 */
export function mergeWatched(trakt: Movie[], logged: Movie[], watches: Watches): Movie[] {
  const byKey = new Map(trakt.map((m) => [m.key, m]));
  const result = trakt.map((m) => {
    const extra = (watches[m.key]?.plays ?? []).filter((p) => !isDuplicate(p, m.plays));
    return extra.length ? { ...m, plays: sortPlays([...m.plays, ...extra]) } : m;
  });
  for (const [key, w] of Object.entries(watches)) {
    if (byKey.has(key) || !w.plays.length) continue;
    const movie = logged.find((m) => m.key === key);
    if (movie) result.push({ ...movie, plays: sortPlays(w.plays) });
  }
  return result;
}

const sortPlays = (plays: Play[]) => [...plays].sort((a, b) => b.at.localeCompare(a.at));

/** For "a long time ago": like Trakt's backfills, dated at release so sorting stays sensible. */
export function backfilledPlay(movie: Pick<Movie, 'releaseDate' | 'year'>): Play {
  const date = movie.releaseDate ?? `${movie.year ?? 1970}-01-01`;
  return { at: new Date(`${date}T12:00:00Z`).toISOString(), backfilled: true };
}

export function playOn(date: string): Play {
  return { at: new Date(`${date}T20:00:00`).toISOString(), backfilled: false };
}

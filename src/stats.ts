// Metrics for the Stats page. Pure functions over the Watched list, ratings and watchlist.
import { VERDICTS } from './config';
import { averageScore } from './filters';
import type { Movie, Ratings, ScoreId, Watchlist } from './types';

export interface PersonStat {
  name: string;
  count: number;
  /** Average of "my average" over this person's rated movies. */
  avg: number | null;
  rated: number;
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

export function computeStats(movies: Movie[], ratings: Ratings, watchlist: Watchlist, watchlistCount: number) {
  const myAvg = (m: Movie) => averageScore(ratings[m.key]);
  const realPlays = movies.flatMap((m) => m.plays.filter((p) => !p.backfilled).map((p) => ({ movie: m, at: new Date(p.at) })));
  const allPlays = movies.reduce((n, m) => n + m.plays.length, 0);

  // --- Activity
  const minutes = movies.reduce((n, m) => n + (m.runtime ?? 0) * m.plays.length, 0);
  const years = new Map<number, number>();
  for (const p of realPlays) years.set(p.at.getFullYear(), (years.get(p.at.getFullYear()) ?? 0) + 1);
  const firstYear = Math.min(...years.keys());
  const lastYear = new Date().getFullYear();
  const perYear = Array.from({ length: lastYear - firstYear + 1 }, (_, i) => {
    const year = firstYear + i;
    return { label: String(year), value: years.get(year) ?? 0 };
  });
  const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const perWeekday = weekdays.map((label, day) => ({ label, value: realPlays.filter((p) => p.at.getDay() === day).length }));
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const perMonth = months.map((label, month) => ({ label, value: realPlays.filter((p) => p.at.getMonth() === month).length }));
  const trackedYears = (Date.now() - Date.parse('2017-08-23')) / (365.25 * 24 * 3600 * 1000);

  // --- Taste
  const rated = movies.filter((m) => ratings[m.key]?.verdict);
  const scored = movies.filter((m) => myAvg(m) !== null);
  const verdicts = VERDICTS.map((v) => ({ ...v, count: rated.filter((m) => ratings[m.key].verdict === v.id).length }));
  const scoreAverages = (['fun', 'epic', 'story', 'acting', 'visuals', 'audio', 'rewatch', 'holdsUp'] as ScoreId[]).map((id) => {
    const values = movies.map((m) => ratings[m.key]?.scores?.[id]).filter((v): v is number => v !== undefined);
    return { id, avg: mean(values), n: values.length };
  });

  const genreCount = new Map<string, Movie[]>();
  for (const m of movies) for (const g of m.genres) genreCount.set(g, [...(genreCount.get(g) ?? []), m]);
  const genres = [...genreCount].map(([genre, ms]) => {
    const avgs = ms.map(myAvg).filter((v): v is number => v !== null);
    return { genre, count: ms.length, avg: mean(avgs), rated: avgs.length };
  });

  const decadeOf = (m: Movie) => Math.floor(m.year / 10) * 10;
  const decadeKeys = [...new Set(movies.map(decadeOf))].sort();
  const decades = decadeKeys.map((d) => {
    const ms = movies.filter((m) => decadeOf(m) === d);
    const holds = ms.map((m) => ratings[m.key]?.scores?.holdsUp).filter((v): v is number => v !== undefined);
    return { decade: d, count: ms.length, holdsUp: mean(holds), holdsUpN: holds.length };
  });

  // --- People
  const people = (names: (m: Movie) => string[]): PersonStat[] => {
    const map = new Map<string, Movie[]>();
    for (const m of movies) for (const n of new Set(names(m))) map.set(n, [...(map.get(n) ?? []), m]);
    return [...map].map(([name, ms]) => {
      const avgs = ms.map(myAvg).filter((v): v is number => v !== null);
      return { name, count: ms.length, avg: mean(avgs), rated: avgs.length };
    });
  };
  const directors = people((m) => m.directors);
  // Top-billed cast only, so cameo-heavy actors don't dominate.
  const actors = people((m) => m.cast.slice(0, 6).map((c) => c.name));

  // --- Me vs. IMDb
  const pairs = scored
    .filter((m) => m.imdbRating !== undefined)
    .map((m) => ({ movie: m, me: myAvg(m)!, imdb: m.imdbRating!, diff: myAvg(m)! - m.imdbRating! }));
  const meanMe = mean(pairs.map((p) => p.me));
  const meanImdb = mean(pairs.map((p) => p.imdb));
  let correlation: number | null = null;
  if (pairs.length >= 3 && meanMe !== null && meanImdb !== null) {
    const cov = pairs.reduce((s, p) => s + (p.me - meanMe) * (p.imdb - meanImdb), 0);
    const vx = pairs.reduce((s, p) => s + (p.me - meanMe) ** 2, 0);
    const vy = pairs.reduce((s, p) => s + (p.imdb - meanImdb) ** 2, 0);
    correlation = vx && vy ? cov / Math.sqrt(vx * vy) : null;
  }
  // My scores run on a different baseline than IMDb's (an average of 8 categories sits lower),
  // so "I like it more/less" is measured against my usual gap, not the raw difference.
  const gap = meanMe !== null && meanImdb !== null ? meanMe - meanImdb : 0;
  const relative = pairs.map((p) => ({ ...p, diff: p.diff - gap }));
  const withinOne = relative.length ? relative.filter((p) => Math.abs(p.diff) <= 1).length / relative.length : null;
  const byDiff = [...relative].sort((a, b) => b.diff - a.diff);

  // --- Progress
  const withThoughts = movies.filter((m) => ratings[m.key]?.review?.trim() || ratings[m.key]?.note?.trim()).length;
  const sinceYearAgo = movies.filter((m) => m.plays.some((p) => !p.backfilled && Date.now() - Date.parse(p.at) < 365 * 864e5));
  const highPriority = Object.values(watchlist).filter((e) => !e.removed && e.priority === 'high').length;

  return {
    activity: {
      movies: movies.length,
      plays: allPlays,
      hours: Math.round(minutes / 60),
      rewatched: movies.filter((m) => m.plays.length > 1).length,
      perYearAvg: realPlays.length / trackedYears,
      beforeTracking: movies.filter((m) => m.plays.every((p) => p.backfilled)).length,
      perYear,
      perWeekday,
      perMonth,
    },
    taste: { rated: rated.length, scored: scored.length, verdicts, scoreAverages, genres, decades },
    people: { directors, actors },
    crowd: { pairs, meanMe, meanImdb, gap, correlation, withinOne, over: byDiff.slice(0, 5), under: byDiff.slice(-5).reverse() },
    progress: {
      total: movies.length,
      ranked: rated.length,
      scored: scored.length,
      withThoughts,
      lastYear: sinceYearAgo.length,
      lastYearRanked: sinceYearAgo.filter((m) => ratings[m.key]?.verdict).length,
      watchlist: watchlistCount,
      highPriority,
    },
  };
}

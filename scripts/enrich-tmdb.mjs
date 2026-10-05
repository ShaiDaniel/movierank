// Adds TMDB metadata (poster, genres, crew, cast, trailer, Israeli streaming providers)
// and IMDb ratings, and writes the site's catalogs:
//   data/movies.json            — watched movies (from data/trakt-movies.json)
//   data/watchlist-movies.json  — movies on the watchlist (from data/watchlist.json)
//
// Usage: npm run enrich [-- --refresh]
// Responses are cached in data/tmdb-cache/; --refresh re-fetches everything
// (useful to update streaming availability).

import { dataFile, readJsonFile, writeJsonAtomic } from './store.mjs';
import { refreshImdbRatings, withImdbRating } from './imdb.mjs';
import { catalogEntry, findShowByTvdb, loadDetails, loadShowDetails } from './tmdb.mjs';

const CONCURRENCY = 8;
const refresh = process.argv.includes('--refresh');
const token = process.env.TMDB_TOKEN;

try {
  await refreshImdbRatings();
} catch (e) {
  console.warn(`IMDb ratings not updated (${e.message}); using the cached copy if there is one.`);
}

async function enrich(items, label) {
  const failed = [];
  let done = 0;
  const queue = [...items];
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      for (let m; (m = queue.shift()); ) {
        if (m.ids.tmdb) {
          try {
            m.tmdb = await loadDetails(token, m.ids.tmdb, refresh);
          } catch (e) {
            failed.push(`${m.title}: ${e.message}`);
          }
        }
        if (++done % 100 === 0) console.log(`  ${label} ${done}/${items.length}`);
      }
    }),
  );
  if (failed.length) console.log(`Failed (${failed.length}):\n  ${failed.join('\n  ')}`);
  return items.map((m) => withImdbRating(catalogEntry(m, m.tmdb)));
}

const watched = readJsonFile(dataFile('trakt-movies.json'), []);
const movies = await enrich(watched, 'watched');
writeJsonAtomic(dataFile('movies.json'), movies, { sortKeys: false, indent: 0 });
console.log(`Wrote ${movies.length} movies to data/movies.json`);

// Removed entries stay in watchlist.json (so a Trakt sync won't re-add them) but need no metadata.
const watchlist = readJsonFile(dataFile('watchlist.json'), {});
const listed = Object.keys(watchlist)
  .filter((key) => !watchlist[key].removed)
  .map((key) => ({ key, title: watchlist[key].title ?? key, ids: { tmdb: Number(key), imdb: null } }));
const watchlistMovies = await enrich(listed, 'watchlist');
writeJsonAtomic(dataFile('watchlist-movies.json'), watchlistMovies, { sortKeys: false, indent: 0 });
console.log(`Wrote ${watchlistMovies.length} movies to data/watchlist-movies.json`);

// Watches logged on the site for movies Trakt doesn't have.
const traktKeys = new Set(watched.map((m) => m.key));
const watches = readJsonFile(dataFile('watches.json'), {});
const loggedOnly = Object.keys(watches)
  .filter((key) => !traktKeys.has(key))
  .map((key) => ({ key, title: watches[key].title ?? key, ids: { tmdb: Number(key), imdb: null } }));
const loggedMovies = await enrich(loggedOnly, 'logged');
writeJsonAtomic(dataFile('logged-movies.json'), loggedMovies, { sortKeys: false, indent: 0 });
console.log(`Wrote ${loggedMovies.length} movies to data/logged-movies.json`);

// --- TV shows (data/trakt-shows.json → data/shows.json) ---------------------------
const localDay = (iso) => new Date(iso).toLocaleDateString('en-CA', { timeZone: 'Asia/Jerusalem' });
const traktShows = readJsonFile(dataFile('trakt-shows.json'), []);
const shows = [];
const showFailures = [];
for (const s of traktShows) {
  try {
    const tmdbId = s.ids.tmdb ?? (await findShowByTvdb(token, s.ids.tvdb));
    if (!tmdbId) throw new Error('not found on TMDB');
    const t = await loadShowDetails(token, tmdbId, refresh);

    // Unique regular episodes seen, per season (specials are season 0).
    const seenKeys = new Set(s.episodes.filter((e) => e.s > 0).map((e) => `${e.s}x${e.e}`));
    const perSeason = {};
    for (const k of seenKeys) {
      const season = Number(k.split('x')[0]);
      perSeason[season] = (perSeason[season] ?? 0) + 1;
    }
    // One "play" per day watched: the day's latest episode, real only if any of them is.
    const days = new Map();
    for (const e of s.episodes) {
      const day = localDay(e.at);
      const d = days.get(day) ?? { at: e.at, backfilled: true, episodes: 0 };
      if (e.at > d.at) d.at = e.at;
      d.backfilled = d.backfilled && e.backfilled;
      d.episodes++;
      days.set(day, d);
    }
    const plays = [...days.values()].sort((a, b) => b.at.localeCompare(a.at));

    const key = `tv-${tmdbId}`;
    const entry = withImdbRating(catalogEntry({ key, title: s.title, year: s.year, ids: { ...s.ids, tmdb: tmdbId } }, t));
    shows.push({ ...entry, kind: 'tv', plays, tv: { ...t.tv, seen: seenKeys.size, perSeason } });
  } catch (e) {
    showFailures.push(`${s.title}: ${e.message}`);
  }
}
writeJsonAtomic(dataFile('shows.json'), shows, { sortKeys: false, indent: 0 });
console.log(`Wrote ${shows.length} shows to data/shows.json`);
if (showFailures.length) console.log(`Shows failed (${showFailures.length}):\n  ${showFailures.join('\n  ')}`);

// Adds TMDB metadata (poster, genres, crew, cast, trailer, Israeli streaming providers)
// and writes the site's catalogs:
//   data/movies.json            — watched movies (from data/trakt-movies.json)
//   data/watchlist-movies.json  — movies on the watchlist (from data/watchlist.json)
//
// Usage: npm run enrich [-- --refresh]
// Responses are cached in data/tmdb-cache/; --refresh re-fetches everything
// (useful to update streaming availability).

import { dataFile, readJsonFile, writeJsonAtomic } from './store.mjs';
import { catalogEntry, loadDetails } from './tmdb.mjs';

const CONCURRENCY = 8;
const refresh = process.argv.includes('--refresh');
const token = process.env.TMDB_TOKEN;

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
  return items.map((m) => catalogEntry(m, m.tmdb));
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

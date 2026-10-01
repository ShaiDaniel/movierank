import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import type { IncomingMessage } from 'node:http';
// MOVIERANK_DATA (read in store.mjs) lets tests run against a scratch copy instead of the real data.
import { dataFile, readJsonFile, setEntry, writeJsonAtomic } from './scripts/store.mjs';
import { withImdbRating } from './scripts/imdb.mjs';
import { catalogEntry, loadDetails, searchMovies } from './scripts/tmdb.mjs';

/** Data files the site loads, with what to serve when one doesn't exist yet. */
const PUBLIC_DATA: Record<string, unknown> = {
  movies: [],
  ratings: {},
  watchlist: {},
  'watchlist-movies': [],
  watches: {},
  'logged-movies': [],
};
/** Files the admin UI may edit, one entry at a time. */
const EDITABLE = new Set(['ratings', 'watchlist', 'watches']);

function readBody(req: IncomingMessage) {
  return new Promise<string>((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

/**
 * Serves the data/*.json files to the app. In dev it also lets the admin UI edit
 * ratings and the watchlist (data/ratings.json, data/watchlist.json are the source
 * of truth until we move to Supabase) and search TMDB. The production build ships
 * the data files as static assets and has no admin endpoints.
 */
function dataPlugin(tmdbToken: string | undefined): Plugin {
  return {
    name: 'movierank-data',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url ?? '/', 'http://localhost');
        const json = (status: number, body?: unknown) => {
          res.statusCode = status;
          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Cache-Control', 'no-store');
          res.end(body === undefined ? undefined : JSON.stringify(body));
        };

        try {
          const file = url.pathname.match(/\/data\/([\w-]+)\.json$/);
          if (req.method === 'GET' && file && file[1] in PUBLIC_DATA) {
            return json(200, readJsonFile(dataFile(`${file[1]}.json`), PUBLIC_DATA[file[1]]));
          }

          const edit = url.pathname.match(/^\/__admin\/(\w+)\/([\w-]+)$/);
          if (edit && EDITABLE.has(edit[1]) && (req.method === 'PUT' || req.method === 'DELETE')) {
            const value = req.method === 'PUT' ? JSON.parse(await readBody(req)) : null;
            setEntry(edit[1], edit[2], value);
            return json(204);
          }

          if (req.method === 'GET' && url.pathname === '/__admin/tmdb/search') {
            return json(200, await searchMovies(tmdbToken, url.searchParams.get('q') ?? ''));
          }

          // Fetches TMDB details for a movie being added and stores it in the watchlist catalog,
          // or with ?catalog=logged in the catalog of logged watches.
          const add = url.pathname.match(/^\/__admin\/tmdb\/movie\/(\d+)$/);
          if (req.method === 'POST' && add) {
            const key = add[1];
            const catalogFile = dataFile(url.searchParams.get('catalog') === 'logged' ? 'logged-movies.json' : 'watchlist-movies.json');
            const catalog: { key: string }[] = readJsonFile(catalogFile, []);
            let entry = catalog.find((m) => m.key === key);
            if (!entry) {
              entry = withImdbRating(
                catalogEntry({ key, title: key, year: null, ids: { tmdb: Number(key), imdb: null } }, await loadDetails(tmdbToken, key)),
              );
              writeJsonAtomic(catalogFile, [...catalog, entry], { sortKeys: false, indent: 0 });
            }
            return json(200, entry);
          }
        } catch (e) {
          console.error('[movierank]', req.method, url.pathname, e);
          return json(500, { error: String(e) });
        }
        next();
      });
    },
    generateBundle() {
      for (const [name, fallback] of Object.entries(PUBLIC_DATA)) {
        this.emitFile({
          type: 'asset',
          fileName: `data/${name}.json`,
          source: JSON.stringify(readJsonFile(dataFile(`${name}.json`), fallback)),
        });
      }
    },
  };
}

export default defineConfig(({ mode }) => ({
  base: './',
  plugins: [react(), dataPlugin(loadEnv(mode, process.cwd(), '').TMDB_TOKEN)],
}));

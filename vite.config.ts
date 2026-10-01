import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs';
import path from 'node:path';

// MOVIERANK_DATA lets tests run against a scratch copy instead of the real ratings.
const DATA_DIR = path.resolve(process.env.MOVIERANK_DATA ?? path.join(import.meta.dirname, 'data'));
const RATINGS = path.join(DATA_DIR, 'ratings.json');
const HISTORY = path.join(DATA_DIR, 'ratings-history.jsonl');

function readJson(file: string, fallback: string) {
  return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : fallback;
}

/**
 * Serves data/movies.json and data/ratings.json to the app, and in dev lets the
 * admin UI write ratings back to data/ratings.json (the source of truth until
 * we move to Supabase). The production build ships both files as static assets.
 */
function dataPlugin(): Plugin {
  return {
    name: 'movierank-data',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = (req.url ?? '').split('?')[0];

        const file = url.match(/\/data\/(movies|ratings)\.json$/);
        if (req.method === 'GET' && file) {
          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Cache-Control', 'no-store');
          res.end(readJson(path.join(DATA_DIR, `${file[1]}.json`), file[1] === 'movies' ? '[]' : '{}'));
          return;
        }

        const rating = url.match(/^\/__admin\/ratings\/([\w-]+)$/);
        if (rating && (req.method === 'PUT' || req.method === 'DELETE')) {
          let body = '';
          req.on('data', (chunk) => (body += chunk));
          req.on('end', () => {
            try {
              const value = req.method === 'PUT' ? JSON.parse(body) : null;
              // Append-only history first: every change ever made can be replayed
              // with `npm run ratings:rebuild`, even if ratings.json is lost.
              fs.appendFileSync(HISTORY, JSON.stringify({ at: new Date().toISOString(), key: rating[1], rating: value }) + '\n');

              const all = JSON.parse(readJson(RATINGS, '{}'));
              if (value) all[rating[1]] = value;
              else delete all[rating[1]];
              const sorted = Object.fromEntries(Object.entries(all).sort(([a], [b]) => a.localeCompare(b)));
              // Write to a temp file and rename, so a crash mid-write can't leave a half-written file.
              fs.writeFileSync(`${RATINGS}.tmp`, JSON.stringify(sorted, null, 1) + '\n');
              fs.renameSync(`${RATINGS}.tmp`, RATINGS);
              res.statusCode = 204;
            } catch (e) {
              console.error('[ratings] save failed', e);
              res.statusCode = 500;
            }
            res.end();
          });
          return;
        }

        next();
      });
    },
    generateBundle() {
      for (const name of ['movies', 'ratings']) {
        this.emitFile({
          type: 'asset',
          fileName: `data/${name}.json`,
          source: readJson(path.join(DATA_DIR, `${name}.json`), name === 'movies' ? '[]' : '{}'),
        });
      }
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [react(), dataPlugin()],
});

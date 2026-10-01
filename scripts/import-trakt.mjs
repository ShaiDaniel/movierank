// Reads a Trakt export zip and writes data/trakt-movies.json:
// one entry per movie with every play (watch) and whether its date is a backfill.
//
// Usage: npm run import:trakt [-- path/to/trakt-export.zip]
// Without a path, the newest trakt-export-*.zip in the project root is used.

import fs from 'node:fs';
import path from 'node:path';
import { unzipSync, strFromU8 } from 'fflate';

const ROOT = path.resolve(import.meta.dirname, '..');
const OUT = path.join(ROOT, 'data', 'trakt-movies.json');

// Plays before this date are backfills: either the release date Trakt filled in,
// or the "just now" bulk add of remembered movies on 2017-08-21/22.
export const TRACKING_START = '2017-08-23';

function findZip() {
  const arg = process.argv[2];
  if (arg) return path.resolve(arg);
  const zips = fs
    .readdirSync(ROOT)
    .filter((f) => /^trakt-export.*\.zip$/i.test(f))
    .map((f) => path.join(ROOT, f))
    .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
  if (!zips.length) throw new Error('No trakt-export-*.zip found in project root');
  return zips[0];
}

const zipPath = findZip();
const files = unzipSync(fs.readFileSync(zipPath));
const history = Object.keys(files)
  .filter((name) => /watched-history-\d+\.json$/.test(name))
  .flatMap((name) => JSON.parse(strFromU8(files[name])));

const byKey = new Map();
for (const item of history) {
  if (item.type !== 'movie') continue;
  const m = item.movie;
  const key = m.ids.tmdb ? String(m.ids.tmdb) : `trakt-${m.ids.trakt}`;
  let entry = byKey.get(key);
  if (!entry) {
    entry = {
      key,
      title: m.title,
      year: m.year,
      ids: { trakt: m.ids.trakt, tmdb: m.ids.tmdb ?? null, imdb: m.ids.imdb ?? null, slug: m.ids.slug },
      plays: [],
    };
    byKey.set(key, entry);
  }
  entry.plays.push({ id: item.id, at: item.watched_at, backfilled: item.watched_at < TRACKING_START });
}

const movies = [...byKey.values()];
for (const m of movies) m.plays.sort((a, b) => b.at.localeCompare(a.at));
movies.sort((a, b) => b.plays[0].at.localeCompare(a.plays[0].at));

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(movies, null, 1) + '\n');

const plays = movies.reduce((n, m) => n + m.plays.length, 0);
const backfilled = movies.filter((m) => m.plays.every((p) => p.backfilled)).length;
const noTmdb = movies.filter((m) => !m.ids.tmdb);
console.log(`Imported ${movies.length} movies (${plays} plays) from ${path.basename(zipPath)}`);
console.log(`  ${backfilled} watched only before tracking started (${TRACKING_START})`);
if (noTmdb.length) console.log(`  ${noTmdb.length} without TMDB id: ${noTmdb.map((m) => m.title).join(', ')}`);

// Safe reads/writes for the user's data files (ratings, watchlist), shared by the
// dev server (vite.config.ts) and the sync scripts.

import fs from 'node:fs';
import path from 'node:path';

export const DATA_DIR = path.resolve(
  process.env.MOVIERANK_DATA ?? path.join(import.meta.dirname, '..', 'data'),
);

export const dataFile = (name) => path.join(DATA_DIR, name);

export function readJsonFile(file, fallback) {
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : fallback;
}

/** Writes via a temp file + rename, so a crash mid-write can't leave a half-written file. */
export function writeJsonAtomic(file, value, { sortKeys = true, indent = 1 } = {}) {
  const out =
    sortKeys && value && !Array.isArray(value)
      ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)))
      : value;
  fs.writeFileSync(`${file}.tmp`, JSON.stringify(out, null, indent) + '\n');
  fs.renameSync(`${file}.tmp`, file);
}

/** Append-only log; `npm run ratings:rebuild` replays these. */
export function appendHistory(collection, key, value, extra = {}) {
  fs.appendFileSync(
    dataFile(`${collection}-history.jsonl`),
    JSON.stringify({ at: new Date().toISOString(), key, [collection === 'ratings' ? 'rating' : 'entry']: value, ...extra }) + '\n',
  );
}

/** Sets (or deletes, when value is null) one entry of a keyed data file, with history. */
export function setEntry(collection, key, value, extra) {
  appendHistory(collection, key, value, extra);
  const file = dataFile(`${collection}.json`);
  const all = readJsonFile(file, {});
  if (value) all[key] = value;
  else delete all[key];
  writeJsonAtomic(file, all);
}

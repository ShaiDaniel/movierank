// IMDb ratings from IMDb's free daily dataset (personal, non-commercial use):
// https://developer.imdb.com/non-commercial-datasets/
// The ~9 MB file is cached in data/imdb-cache/ and re-downloaded when older than a day.

import fs from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { dataFile } from './store.mjs';

const URL = 'https://datasets.imdbws.com/title.ratings.tsv.gz';
const CACHE = dataFile('imdb-cache');
const FILE = `${CACHE}/title.ratings.tsv.gz`;
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

let ratings = null;

/** Downloads the dataset if the cached copy is missing or stale. */
export async function refreshImdbRatings() {
  if (fs.existsSync(FILE) && Date.now() - fs.statSync(FILE).mtimeMs < MAX_AGE_MS) return;
  const res = await fetch(URL);
  if (!res.ok) throw new Error(`IMDb dataset download failed (${res.status})`);
  fs.mkdirSync(CACHE, { recursive: true });
  fs.writeFileSync(`${FILE}.tmp`, Buffer.from(await res.arrayBuffer()));
  fs.renameSync(`${FILE}.tmp`, FILE);
  ratings = null;
}

/** Map of IMDb id (tt…) to { rating, votes }, or an empty map if never downloaded. */
export function imdbRatings() {
  if (ratings) return ratings;
  ratings = new Map();
  if (!fs.existsSync(FILE)) return ratings;
  const lines = gunzipSync(fs.readFileSync(FILE)).toString('utf8').split('\n');
  for (let i = 1; i < lines.length; i++) {
    const [id, rating, votes] = lines[i].split('\t');
    if (id) ratings.set(id, { rating: Number(rating), votes: Number(votes) });
  }
  return ratings;
}

/** Adds imdbRating / imdbVotes to a catalog entry when IMDb has it. */
export function withImdbRating(entry) {
  const r = entry.ids?.imdb ? imdbRatings().get(entry.ids.imdb) : undefined;
  return r ? { ...entry, imdbRating: r.rating, imdbVotes: r.votes } : entry;
}

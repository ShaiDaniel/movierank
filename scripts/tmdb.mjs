// TMDB access for the sync scripts and the dev server, with an on-disk cache.

import fs from 'node:fs';
import { dataFile } from './store.mjs';
import { DETAILS_QUERY, tmdbFetch, trim } from '../shared/tmdb-core.mjs';

export { catalogEntry, searchMovies, tmdbFetch } from '../shared/tmdb-core.mjs';

const CACHE = dataFile('tmdb-cache');

/** Trimmed TMDB details for one movie, from data/tmdb-cache unless refresh is set. */
export async function loadDetails(token, tmdbId, refresh = false) {
  const file = `${CACHE}/${tmdbId}.json`;
  if (!refresh && fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf8'));
  const t = trim(await tmdbFetch(token, `/movie/${tmdbId}${DETAILS_QUERY}`));
  fs.mkdirSync(CACHE, { recursive: true });
  fs.writeFileSync(file, JSON.stringify(t));
  return t;
}

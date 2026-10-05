// TMDB access for the sync scripts and the dev server, with an on-disk cache.

import fs from 'node:fs';
import { dataFile } from './store.mjs';
import { DETAILS_QUERY, TV_DETAILS_QUERY, tmdbFetch, trim, trimShow } from '../shared/tmdb-core.mjs';

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

/** Trimmed TMDB details for a TV show, cached as data/tmdb-cache/tv-<id>.json. */
export async function loadShowDetails(token, tmdbId, refresh = false) {
  const file = `${CACHE}/tv-${tmdbId}.json`;
  if (!refresh && fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf8'));
  const t = trimShow(await tmdbFetch(token, `/tv/${tmdbId}${TV_DETAILS_QUERY}`));
  fs.mkdirSync(CACHE, { recursive: true });
  fs.writeFileSync(file, JSON.stringify(t));
  return t;
}

/** TMDB id of a show known only by its TVDB id (TV Time uses TVDB ids). */
export async function findShowByTvdb(token, tvdbId) {
  const d = await tmdbFetch(token, `/find/${tvdbId}?external_source=tvdb_id`);
  return d.tv_results?.[0]?.id ?? null;
}

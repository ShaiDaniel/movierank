// TV shows: reads episode watches from the Trakt export (and shows only TV Time has, from
// its GDPR export) and writes data/trakt-shows.json: one entry per show with every
// episode watch and whether its date is real.
//
// Usage: npm run import:shows   (also part of npm run sync)
// Uses the newest trakt-export-*.zip and, if present, tv-time*.zip in the project root.

import fs from 'node:fs';
import path from 'node:path';
import { strFromU8, unzipSync } from 'fflate';
import { dataFile, writeJsonAtomic } from './store.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const TRACKING_START = '2017-08-23';
// Episodes logged in one day beyond this are a catch-up session, not real watching
// (e.g. 955 episodes logged on 2018-02-12). Higher than for movies: binges are real.
const BULK_DAY = 25;
const localDay = (iso) => new Date(iso).toLocaleDateString('en-CA', { timeZone: 'Asia/Jerusalem' });

const newest = (pattern) =>
  fs
    .readdirSync(ROOT)
    .filter((f) => pattern.test(f))
    .map((f) => path.join(ROOT, f))
    .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs)[0];

/** Minimal CSV parser (quoted fields, commas and newlines inside quotes). */
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') (field += '"'), i++;
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') row.push(field), (field = '');
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field), rows.push(row), (row = []), (field = '');
    } else field += c;
  }
  if (field || row.length) row.push(field), rows.push(row);
  const [header, ...body] = rows;
  return body.filter((r) => r.length > 1).map((r) => Object.fromEntries(header.map((h, i) => [h, r[i] ?? ''])));
}

const shows = new Map();
const showFor = (key, init) => {
  if (!shows.has(key)) shows.set(key, { ...init, episodes: [] });
  return shows.get(key);
};

// --- Trakt
const traktZip = newest(/^trakt-export.*\.zip$/i);
if (!traktZip) throw new Error('No trakt-export-*.zip found in project root');
const trakt = unzipSync(fs.readFileSync(traktZip));
const history = Object.keys(trakt)
  .filter((n) => /watched-history-\d+\.json$/.test(n))
  .flatMap((n) => JSON.parse(strFromU8(trakt[n])));
const traktTvdb = new Set();
for (const item of history) {
  if (item.type !== 'episode') continue;
  const s = item.show;
  traktTvdb.add(String(s.ids.tvdb));
  const show = showFor(`tv-${s.ids.tmdb}`, {
    key: `tv-${s.ids.tmdb}`,
    title: s.title,
    year: s.year,
    ids: { trakt: s.ids.trakt, tmdb: s.ids.tmdb, imdb: s.ids.imdb ?? null, tvdb: s.ids.tvdb ?? null, slug: s.ids.slug },
  });
  show.episodes.push({ s: item.episode.season, e: item.episode.number, at: item.watched_at });
}

// --- TV Time: only shows Trakt doesn't have (Trakt already holds an import of TV Time).
let tvTimeOnly = 0;
const tvTimeZip = newest(/^tv-time.*\.zip$/i);
if (tvTimeZip) {
  const tt = unzipSync(fs.readFileSync(tvTimeZip));
  const file = Object.keys(tt).find((n) => /tracking-prod-records-v2\.csv$/.test(n));
  for (const r of file ? parseCsv(strFromU8(tt[file])) : []) {
    if (!r.key.startsWith('watch-episode') || !r.series_name || traktTvdb.has(r.s_id)) continue;
    // TV Time ids are TVDB ids; the enrich step finds the TMDB show for them.
    const show = showFor(`tvdb-${r.s_id}`, { key: null, title: r.series_name, year: null, ids: { tvdb: Number(r.s_id), tmdb: null, imdb: null } });
    show.episodes.push({ s: Number(r.season_number || r.s_no), e: Number(r.episode_number || r.ep_no), at: `${r.created_at.replace(' ', 'T')}.000Z` });
    tvTimeOnly++;
  }
}

// --- Real dates vs. backfills
const all = [...shows.values()];
const perDay = new Map();
for (const s of all) for (const ep of s.episodes) perDay.set(localDay(ep.at), (perDay.get(localDay(ep.at)) ?? 0) + 1);
for (const s of all) {
  for (const ep of s.episodes) ep.backfilled = ep.at < TRACKING_START || perDay.get(localDay(ep.at)) >= BULK_DAY;
  s.episodes.sort((a, b) => b.at.localeCompare(a.at));
}
all.sort((a, b) => b.episodes[0].at.localeCompare(a.episodes[0].at));

writeJsonAtomic(dataFile('trakt-shows.json'), all, { sortKeys: false, indent: 0 });
const eps = all.reduce((n, s) => n + s.episodes.length, 0);
const real = all.reduce((n, s) => n + s.episodes.filter((e) => !e.backfilled).length, 0);
console.log(`Imported ${all.length} shows (${eps} episode watches, ${real} with a real date) from ${path.basename(traktZip)}`);
if (tvTimeZip) console.log(`  ${tvTimeOnly} episode watches from TV Time for shows Trakt doesn't have`);

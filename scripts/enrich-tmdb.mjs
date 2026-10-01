// Adds TMDB metadata (poster, genres, crew, cast, trailer, Israeli streaming providers)
// to data/trakt-movies.json and writes the site's catalog, data/movies.json.
//
// Usage: npm run enrich [-- --refresh]
// Responses are cached in data/tmdb-cache/; --refresh re-fetches everything
// (useful to update streaming availability).

import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const CACHE = path.join(ROOT, 'data', 'tmdb-cache');
const IN = path.join(ROOT, 'data', 'trakt-movies.json');
const OUT = path.join(ROOT, 'data', 'movies.json');
const REGION = 'IL';
const CONCURRENCY = 8;
const refresh = process.argv.includes('--refresh');

const token = process.env.TMDB_TOKEN;
if (!token) {
  console.error('TMDB_TOKEN missing. Copy .env.example to .env and set it.');
  process.exit(1);
}

async function tmdb(url, attempt = 1) {
  const res = await fetch(`https://api.themoviedb.org/3${url}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  });
  if (res.status === 429 && attempt < 5) {
    await new Promise((r) => setTimeout(r, 1000 * attempt));
    return tmdb(url, attempt + 1);
  }
  if (!res.ok) throw new Error(`TMDB ${res.status} for ${url}`);
  return res.json();
}

function pickTrailer(videos) {
  const yt = (videos?.results ?? []).filter((v) => v.site === 'YouTube');
  const score = (v) => (v.type === 'Trailer' ? 2 : v.type === 'Teaser' ? 1 : 0) + (v.official ? 0.5 : 0);
  const best = yt.filter((v) => score(v) >= 1).sort((a, b) => score(b) - score(a))[0];
  return best?.key ?? null;
}

function pickCertification(releaseDates) {
  for (const country of [REGION, 'US']) {
    const r = releaseDates?.results?.find((x) => x.iso_3166_1 === country);
    const cert = r?.release_dates?.find((d) => d.certification)?.certification;
    if (cert) return cert;
  }
  return null;
}

// Keep only what the site needs, so the cache and catalog stay small.
function trim(d) {
  const crew = d.credits?.crew ?? [];
  const names = (jobs) => [...new Set(crew.filter((c) => jobs.includes(c.job)).map((c) => c.name))];
  const providers = d['watch/providers']?.results?.[REGION];
  const prov = (list) => (list ?? []).map((p) => ({ name: p.provider_name, logo: p.logo_path }));
  return {
    title: d.title,
    originalTitle: d.original_title !== d.title ? d.original_title : null,
    releaseDate: d.release_date || null,
    runtime: d.runtime || null,
    genres: d.genres.map((g) => g.name),
    overview: d.overview,
    tagline: d.tagline || null,
    poster: d.poster_path,
    backdrop: d.backdrop_path,
    language: d.original_language,
    collection: d.belongs_to_collection?.name ?? null,
    tmdbRating: d.vote_average ? Math.round(d.vote_average * 10) / 10 : null,
    tmdbVotes: d.vote_count,
    popularity: d.popularity,
    certification: pickCertification(d.release_dates),
    directors: names(['Director']),
    writers: names(['Screenplay', 'Writer', 'Story', 'Novel']),
    composers: names(['Original Music Composer', 'Music']),
    cinematographers: names(['Director of Photography']),
    cast: (d.credits?.cast ?? []).slice(0, 15).map((c) => ({ name: c.name, character: c.character, photo: c.profile_path })),
    trailer: pickTrailer(d.videos),
    providers: providers
      ? { link: providers.link, stream: prov(providers.flatrate), rent: prov(providers.rent), buy: prov(providers.buy) }
      : null,
  };
}

async function load(tmdbId) {
  const file = path.join(CACHE, `${tmdbId}.json`);
  if (!refresh && fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf8'));
  const d = await tmdb(`/movie/${tmdbId}?append_to_response=credits,videos,release_dates,watch/providers`);
  const t = trim(d);
  fs.writeFileSync(file, JSON.stringify(t));
  return t;
}

fs.mkdirSync(CACHE, { recursive: true });
const movies = JSON.parse(fs.readFileSync(IN, 'utf8'));
const failed = [];
let done = 0;

const queue = [...movies];
await Promise.all(
  Array.from({ length: CONCURRENCY }, async () => {
    for (let m; (m = queue.shift()); ) {
      if (m.ids.tmdb) {
        try {
          m.tmdb = await load(m.ids.tmdb);
        } catch (e) {
          failed.push(`${m.title}: ${e.message}`);
        }
      }
      if (++done % 100 === 0) console.log(`  ${done}/${movies.length}`);
    }
  }),
);

const catalog = movies.map(({ key, title, year, ids, plays, tmdb: t }) => ({
  key,
  ids,
  plays: plays.map(({ at, backfilled }) => ({ at, backfilled })),
  year,
  ...(t ?? { title, genres: [], cast: [], directors: [], writers: [], composers: [], cinematographers: [] }),
  title: t?.title ?? title,
}));

fs.writeFileSync(OUT, JSON.stringify(catalog) + '\n');
console.log(`Wrote ${catalog.length} movies to data/movies.json`);
if (failed.length) console.log(`Failed (${failed.length}):\n  ${failed.join('\n  ')}`);

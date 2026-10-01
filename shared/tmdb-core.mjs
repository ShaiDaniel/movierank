// TMDB logic with no Node dependencies, shared by the sync scripts, the dev server
// and the browser (when editing on the public site).

const REGION = 'IL';

export async function tmdbFetch(token, url, attempt = 1) {
  if (!token) throw new Error('TMDB_TOKEN missing. Copy .env.example to .env and set it.');
  const res = await fetch(`https://api.themoviedb.org/3${url}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  });
  if (res.status === 429 && attempt < 5) {
    await new Promise((r) => setTimeout(r, 1000 * attempt));
    return tmdbFetch(token, url, attempt + 1);
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
export function trim(d) {
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
    // Needed for movies added from a TMDB search, which have no Trakt record.
    imdb: d.imdb_id || null,
  };
}

export const DETAILS_QUERY = '?append_to_response=credits,videos,release_dates,watch/providers';

export async function searchMovies(token, query) {
  const d = await tmdbFetch(token, `/search/movie?query=${encodeURIComponent(query)}&include_adult=false`);
  return d.results.slice(0, 12).map((m) => ({
    tmdb: m.id,
    title: m.title,
    year: m.release_date ? Number(m.release_date.slice(0, 4)) : null,
    poster: m.poster_path,
    overview: m.overview,
  }));
}

/** A site catalog entry (see Movie in src/types.ts). */
export function catalogEntry({ key, title, year, ids, plays = [] }, t) {
  const { imdb, ...details } = t ?? {};
  return {
    key,
    ids: { ...ids, imdb: ids.imdb ?? imdb ?? null },
    plays: plays.map(({ at, backfilled }) => ({ at, backfilled })),
    year: year ?? (t?.releaseDate ? Number(t.releaseDate.slice(0, 4)) : null),
    ...(t ? details : { title, genres: [], cast: [], directors: [], writers: [], composers: [], cinematographers: [] }),
    title: t?.title ?? title,
  };
}

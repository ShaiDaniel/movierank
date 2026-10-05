import { SCORES, VERDICTS } from './config';
import { progressOf } from './progress';
import type { Movie, Progress, Rating, ScoreId, VerdictId, Watchlist } from './types';

export type VerdictFilter = VerdictId | 'unrated';

/**
 * The verdict a movie is filtered under. 'unrated' means nothing at all yet; a movie with
 * scores but no verdict is neither (it isn't "not ranked", it's just missing the verdict).
 */
export const verdictOf = (r: Rating | undefined): VerdictFilter | null =>
  r?.verdict ?? (Object.keys(r?.scores ?? {}).length ? null : 'unrated');

/** People are encoded as "<role>:<name>" so they fit in the URL. */
export const PERSON_ROLES = {
  d: { label: 'Director', field: 'directors' },
  a: { label: 'Actor', field: 'cast' },
  w: { label: 'Writer', field: 'writers' },
  c: { label: 'Composer', field: 'composers' },
  p: { label: 'Cinematographer', field: 'cinematographers' },
} as const;
export type PersonRole = keyof typeof PERSON_ROLES;

export type SortKey =
  | 'rec'
  | 'watched'
  | 'newest'
  | 'oldest'
  | 'title'
  | 'tmdb'
  | 'imdb'
  | 'runtime'
  | 'added'
  | `score:${ScoreId}`;

export const SORTS: { id: SortKey; label: string }[] = [
  { id: 'rec', label: 'Recommendation' },
  { id: 'watched', label: 'Recently watched' },
  { id: 'newest', label: 'Newest release' },
  { id: 'oldest', label: 'Oldest release' },
  { id: 'title', label: 'Title' },
  { id: 'imdb', label: 'IMDb rating' },
  { id: 'tmdb', label: 'TMDB rating' },
  { id: 'runtime', label: 'Shortest' },
  ...SCORES.map((s) => ({ id: `score:${s.id}` as SortKey, label: `${s.label} score` })),
];

/** On the watchlist tab, 'rec' means priority order. */
export const WATCHLIST_SORTS: { id: SortKey; label: string }[] = [
  { id: 'rec', label: 'Priority' },
  { id: 'added', label: 'Recently added' },
  ...SORTS.filter((s) => ['newest', 'oldest', 'title', 'imdb', 'tmdb', 'runtime'].includes(s.id)),
];

export interface Filters {
  q: string;
  verdicts: VerdictFilter[];
  min: Partial<Record<ScoreId, number>>;
  genres: string[];
  people: string[];
  yearFrom: number | null;
  yearTo: number | null;
  /** 'any', 'before' (no real watch date) or a year like '2021'. */
  watched: string;
  stream: string[];
  /** TV: finished / caught up / watching / dropped. */
  progress: Progress[];
  /** Sagas: "u:<universe id>" or "c:<TMDB collection name>"; a movie matches any of them. */
  sagas: string[];
  sort: SortKey;
}

export const DEFAULT_FILTERS: Filters = {
  q: '',
  verdicts: [],
  min: {},
  genres: [],
  people: [],
  yearFrom: null,
  yearTo: null,
  watched: 'any',
  stream: [],
  progress: [],
  sagas: [],
  sort: 'rec',
};


const list = (v: string | null) => (v ? v.split('|').filter(Boolean) : []);
const num = (v: string | null) => (v && !Number.isNaN(Number(v)) ? Number(v) : null);

export function parseFilters(search: string): Filters {
  const p = new URLSearchParams(search);
  const min: Filters['min'] = {};
  for (const part of list(p.get('min'))) {
    const [id, value] = part.split(':');
    if (SCORES.some((s) => s.id === id) && Number(value) > 0) min[id as ScoreId] = Number(value);
  }
  const sort = p.get('sort') as SortKey | null;
  return {
    q: p.get('q') ?? '',
    verdicts: list(p.get('v')).filter((v): v is VerdictFilter => v === 'unrated' || VERDICTS.some((x) => x.id === v)),
    min,
    genres: list(p.get('g')),
    people: list(p.get('p')).filter((x) => x[1] === ':' && x[0] in PERSON_ROLES),
    yearFrom: num(p.get('from')),
    yearTo: num(p.get('to')),
    watched: p.get('w') ?? 'any',
    stream: list(p.get('s')),
    sagas: list(p.get('sg')).filter((x) => /^[uc]:/.test(x)),
    progress: list(p.get('pr')).filter((x): x is Progress => ['finished', 'caughtup', 'watching', 'dropped'].includes(x)),
    sort: sort && [...SORTS, ...WATCHLIST_SORTS].some((s) => s.id === sort) ? sort : 'rec',
  };
}

export function serializeFilters(f: Filters): URLSearchParams {
  const p = new URLSearchParams();
  if (f.q) p.set('q', f.q);
  if (f.verdicts.length) p.set('v', f.verdicts.join('|'));
  const min = Object.entries(f.min).filter(([, v]) => v);
  if (min.length) p.set('min', min.map(([k, v]) => `${k}:${v}`).join('|'));
  if (f.genres.length) p.set('g', f.genres.join('|'));
  if (f.people.length) p.set('p', f.people.join('|'));
  if (f.yearFrom) p.set('from', String(f.yearFrom));
  if (f.yearTo) p.set('to', String(f.yearTo));
  if (f.watched !== 'any') p.set('w', f.watched);
  if (f.stream.length) p.set('s', f.stream.join('|'));
  if (f.progress.length) p.set('pr', f.progress.join('|'));
  if (f.sagas.length) p.set('sg', f.sagas.join('|'));
  if (f.sort !== 'rec') p.set('sort', f.sort);
  return p;
}

export function activeFilterCount(f: Filters) {
  return (
    (f.q ? 1 : 0) +
    f.verdicts.length +
    Object.values(f.min).filter(Boolean).length +
    f.genres.length +
    f.people.length +
    (f.yearFrom ? 1 : 0) +
    (f.yearTo ? 1 : 0) +
    (f.watched !== 'any' ? 1 : 0) +
    f.stream.length +
    f.progress.length +
    f.sagas.length
  );
}

export function personNames(m: Movie, role: PersonRole): string[] {
  return role === 'a' ? m.cast.map((c) => c.name) : m[PERSON_ROLES[role].field];
}

/** Matches TRACKING_START in scripts/import-trakt.mjs. */
export const TRACKING_START = '2017-08-23';

export const lastWatched = (m: Movie) => m.plays[0]?.at ?? '';

/** "c:Harry Potter Collection" → that TMDB collection; "u:mcu" → that universe. */
export const inSaga = (m: Movie, code: string) =>
  code.startsWith('u:') ? Boolean(m.universes?.includes(code.slice(2))) : m.collection === code.slice(2);

export const sagaName = (code: string, universeName: Record<string, string>) =>
  code.startsWith('u:') ? (universeName[code.slice(2)] ?? code.slice(2)) : code.slice(2).replace(/ Collection$/, '');
export const onlyBackfilled = (m: Movie) => m.plays.every((p) => p.backfilled);

// Unrated sits between neutral and the negative verdicts, so "Recommendation"
// shows the good stuff first and the warnings last.
const VERDICT_RANK: Record<VerdictFilter, number> = {
  must: 0, should: 1, may: 2, neutral: 3, unrated: 4, maynot: 5, shouldnot: 6, mustnot: 7,
};

/**
 * Scores left out of the average, because they describe the experience rather than the movie:
 * how well it aged, and whether it rewards rewatching (a great twist movie only works once).
 */
const NOT_AVERAGED: ScoreId[] = ['holdsUp', 'rewatch'];

export function averageScore(r: Rating | undefined) {
  const values = Object.entries(r?.scores ?? {})
    .filter(([id]) => !NOT_AVERAGED.includes(id as ScoreId))
    .map(([, v]) => v)
    .filter((v): v is number => typeof v === 'number');
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
}

const normalize = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();

/** Pass the watchlist when filtering the watchlist tab (for its sorts and searching "why"). */
export function applyFilters(movies: Movie[], ratings: Record<string, Rating>, f: Filters, watchlist?: Watchlist): Movie[] {
  const q = normalize(f.q.trim());
  const minEntries = Object.entries(f.min).filter(([, v]) => v) as [ScoreId, number][];

  const result = movies.filter((m) => {
    const r = ratings[m.key];
    if (f.verdicts.length) {
      const v = verdictOf(r);
      if (!v || !f.verdicts.includes(v)) return false;
    }
    for (const [id, min] of minEntries) if ((r?.scores?.[id] ?? 0) < min) return false;
    if (f.genres.length && !f.genres.every((g) => m.genres.includes(g))) return false;
    for (const code of f.people) {
      if (!personNames(m, code[0] as PersonRole).includes(code.slice(2))) return false;
    }
    if (f.yearFrom && m.year < f.yearFrom) return false;
    if (f.yearTo && m.year > f.yearTo) return false;
    if (f.watched === 'before' && !onlyBackfilled(m)) return false;
    if (/^\d{4}$/.test(f.watched) && !m.plays.some((p) => !p.backfilled && p.at.startsWith(f.watched))) return false;
    if (f.stream.length && !f.stream.some((s) => m.providers?.stream.some((p) => p.name === s))) return false;
    if (f.sagas.length && !f.sagas.some((code) => inSaga(m, code))) return false;
    if (f.progress.length) {
      const p = progressOf(m, r);
      if (!p || !f.progress.includes(p.state)) return false;
    }
    if (q) {
      const haystack = [m.title, m.originalTitle ?? '', m.collection ?? '', r?.note ?? '', r?.review ?? '', watchlist?.[m.key]?.why ?? '', ...m.directors, ...m.cast.map((c) => c.name)];
      if (!haystack.some((h) => normalize(h).includes(q))) return false;
    }
    return true;
  });

  const cmp = watchlist && f.sort === 'rec' ? byPriority(watchlist) : comparator(f.sort, ratings, watchlist);
  return result.sort((a, b) => cmp(a, b) || a.title.localeCompare(b.title));
}

const PRIORITY_RANK = { high: 0, medium: 1, unset: 2, low: 3 };

function byPriority(watchlist: Watchlist) {
  const rank = (m: Movie) => PRIORITY_RANK[watchlist[m.key]?.priority ?? 'unset'];
  return (a: Movie, b: Movie) =>
    rank(a) - rank(b) || (watchlist[b.key]?.addedAt ?? '').localeCompare(watchlist[a.key]?.addedAt ?? '');
}

function comparator(sort: SortKey, ratings: Record<string, Rating>, watchlist?: Watchlist): (a: Movie, b: Movie) => number {
  if (sort.startsWith('score:')) {
    const id = sort.slice(6) as ScoreId;
    return (a, b) => (ratings[b.key]?.scores?.[id] ?? -1) - (ratings[a.key]?.scores?.[id] ?? -1);
  }
  switch (sort) {
    case 'added':
      return (a, b) => (watchlist?.[b.key]?.addedAt ?? '').localeCompare(watchlist?.[a.key]?.addedAt ?? '');
    case 'watched':
      return (a, b) => lastWatched(b).localeCompare(lastWatched(a));
    case 'newest':
      return (a, b) => (b.releaseDate ?? String(b.year)).localeCompare(a.releaseDate ?? String(a.year));
    case 'oldest':
      return (a, b) => (a.releaseDate ?? String(a.year)).localeCompare(b.releaseDate ?? String(b.year));
    case 'title':
      return () => 0;
    case 'imdb':
      return (a, b) => (b.imdbRating ?? 0) - (a.imdbRating ?? 0) || (b.imdbVotes ?? 0) - (a.imdbVotes ?? 0);
    case 'tmdb':
      return (a, b) => (b.tmdbRating ?? 0) - (a.tmdbRating ?? 0);
    case 'runtime':
      return (a, b) => (a.runtime ?? 999) - (b.runtime ?? 999);
    default:
      return (a, b) => {
        const ra = ratings[a.key];
        const rb = ratings[b.key];
        return (
          VERDICT_RANK[ra?.verdict ?? 'unrated'] - VERDICT_RANK[rb?.verdict ?? 'unrated'] ||
          (averageScore(rb) ?? 0) - (averageScore(ra) ?? 0) ||
          (b.tmdbRating ?? 0) - (a.tmdbRating ?? 0)
        );
      };
  }
}

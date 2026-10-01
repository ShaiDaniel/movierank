import { SCORES, VERDICTS } from './config';
import type { Movie, Rating, ScoreId, VerdictId } from './types';

export type VerdictFilter = VerdictId | 'unrated';

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
  | 'runtime'
  | `score:${ScoreId}`;

export const SORTS: { id: SortKey; label: string }[] = [
  { id: 'rec', label: 'Recommendation' },
  { id: 'watched', label: 'Recently watched' },
  { id: 'newest', label: 'Newest release' },
  { id: 'oldest', label: 'Oldest release' },
  { id: 'title', label: 'Title' },
  { id: 'tmdb', label: 'TMDB rating' },
  { id: 'runtime', label: 'Shortest' },
  ...SCORES.map((s) => ({ id: `score:${s.id}` as SortKey, label: `${s.label} score` })),
];

export interface Filters {
  q: string;
  verdicts: VerdictFilter[];
  min: Partial<Record<ScoreId, number>>;
  genres: string[];
  people: string[];
  yearFrom: number | null;
  yearTo: number | null;
  /** 'any', 'before' (before tracking) or a year like '2021'. */
  watched: string;
  stream: string[];
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
  sort: 'rec',
};

export interface Preset {
  label: string;
  filters: Partial<Filters>;
}

export const PRESETS: Preset[] = [
  { label: 'Everything', filters: {} },
  { label: 'Must watch', filters: { verdicts: ['must'] } },
  { label: 'Worth your time', filters: { verdicts: ['must', 'should', 'may'] } },
  { label: 'Epic', filters: { min: { epic: 8 }, sort: 'score:epic' } },
  { label: 'Pure fun', filters: { min: { fun: 8 }, sort: 'score:fun' } },
  { label: 'Classics that hold up', filters: { yearTo: 1999, min: { holdsUp: 8 } } },
  { label: 'Avoid', filters: { verdicts: ['shouldnot', 'mustnot'] } },
];

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
    sort: sort && SORTS.some((s) => s.id === sort) ? sort : 'rec',
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
    f.stream.length
  );
}

export function personNames(m: Movie, role: PersonRole): string[] {
  return role === 'a' ? m.cast.map((c) => c.name) : m[PERSON_ROLES[role].field];
}

export const lastWatched = (m: Movie) => m.plays[0]?.at ?? '';
export const onlyBackfilled = (m: Movie) => m.plays.every((p) => p.backfilled);

// Unrated sits between neutral and the negative verdicts, so "Recommendation"
// shows the good stuff first and the warnings last.
const VERDICT_RANK: Record<VerdictFilter, number> = {
  must: 0, should: 1, may: 2, neutral: 3, unrated: 4, maynot: 5, shouldnot: 6, mustnot: 7,
};

export function averageScore(r: Rating | undefined) {
  const values = Object.values(r?.scores ?? {}).filter((v): v is number => typeof v === 'number');
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
}

const normalize = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();

export function applyFilters(movies: Movie[], ratings: Record<string, Rating>, f: Filters): Movie[] {
  const q = normalize(f.q.trim());
  const minEntries = Object.entries(f.min).filter(([, v]) => v) as [ScoreId, number][];

  const result = movies.filter((m) => {
    const r = ratings[m.key];
    if (f.verdicts.length && !f.verdicts.includes(r?.verdict ?? 'unrated')) return false;
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
    if (q) {
      const haystack = [m.title, m.originalTitle ?? '', m.collection ?? '', r?.note ?? '', r?.review ?? '', ...m.directors, ...m.cast.map((c) => c.name)];
      if (!haystack.some((h) => normalize(h).includes(q))) return false;
    }
    return true;
  });

  const cmp = comparator(f.sort, ratings);
  return result.sort((a, b) => cmp(a, b) || a.title.localeCompare(b.title));
}

function comparator(sort: SortKey, ratings: Record<string, Rating>): (a: Movie, b: Movie) => number {
  if (sort.startsWith('score:')) {
    const id = sort.slice(6) as ScoreId;
    return (a, b) => (ratings[b.key]?.scores?.[id] ?? -1) - (ratings[a.key]?.scores?.[id] ?? -1);
  }
  switch (sort) {
    case 'watched':
      return (a, b) => lastWatched(b).localeCompare(lastWatched(a));
    case 'newest':
      return (a, b) => (b.releaseDate ?? String(b.year)).localeCompare(a.releaseDate ?? String(a.year));
    case 'oldest':
      return (a, b) => (a.releaseDate ?? String(a.year)).localeCompare(b.releaseDate ?? String(b.year));
    case 'title':
      return () => 0;
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

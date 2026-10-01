// All data access goes through here, so moving to Supabase later only means
// replacing the load/save functions.
import type { Movie, Rating, Ratings, SearchResult, Watchlist, WatchlistEntry } from './types';

const BASE = import.meta.env.BASE_URL;

/** Editing is only available when running locally with `npm run dev`. */
export const ADMIN = import.meta.env.DEV;

type Collection = 'ratings' | 'watchlist';

async function getJson<T>(name: string): Promise<T> {
  const res = await fetch(`${BASE}data/${name}.json`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Could not load ${name} (${res.status})`);
  return res.json();
}

export const loadCatalog = () => getJson<Movie[]>('movies');
export const loadWatchlistMovies = () => getJson<Movie[]>('watchlist-movies');
export const loadRatings = async () => withUnsaved('ratings', await getJson<Ratings>('ratings'));
export const loadWatchlist = async () => withUnsaved('watchlist', await getJson<Watchlist>('watchlist'));

export function isEmptyRating(r: Rating | undefined) {
  return !r || (!r.verdict && !r.note?.trim() && !r.review?.trim() && !r.dateUncertain && !Object.keys(r.scores ?? {}).length);
}

// --- Saving -----------------------------------------------------------------
// Every edit goes to localStorage first and stays there until the dev server
// confirms it wrote the data file, so a stopped server can't lose work.

const UNSAVED_KEY = 'movierank:unsaved';
export type SaveStatus = { state: 'saved' | 'saving' | 'failed'; pending: number };

/** Keyed "<collection>/<key>"; null means delete. */
const unsaved: Record<string, unknown> = readUnsaved();
const timers = new Map<string, ReturnType<typeof setTimeout>>();
const listeners = new Set<(s: SaveStatus) => void>();
let failed = false;
let retryTimer: ReturnType<typeof setTimeout> | undefined;

function readUnsaved(): Record<string, unknown> {
  try {
    const stored: Record<string, unknown> = JSON.parse(localStorage.getItem(UNSAVED_KEY) ?? '{}');
    // Entries saved before the watchlist existed have no collection prefix.
    return Object.fromEntries(Object.entries(stored).map(([k, v]) => [k.includes('/') ? k : `ratings/${k}`, v]));
  } catch {
    return {};
  }
}

function persistUnsaved() {
  try {
    localStorage.setItem(UNSAVED_KEY, JSON.stringify(unsaved));
  } catch {
    // Storage unavailable: the server write is still attempted.
  }
}

/** Edits that never reached the server win over what's on disk. */
function withUnsaved<T extends Record<string, unknown>>(collection: Collection, loaded: T): T {
  for (const [id, value] of Object.entries(unsaved)) {
    const [c, key] = id.split('/');
    if (c !== collection) continue;
    if (value) (loaded as Record<string, unknown>)[key] = value;
    else delete loaded[key];
  }
  if (Object.keys(unsaved).length) retrySoon();
  return loaded;
}

function status(): SaveStatus {
  const pending = Object.keys(unsaved).length;
  return { state: !pending ? 'saved' : failed ? 'failed' : 'saving', pending };
}

function notify() {
  const s = status();
  listeners.forEach((l) => l(s));
}

export function onSaveStatus(listener: (s: SaveStatus) => void) {
  listeners.add(listener);
  listener(status());
  return () => void listeners.delete(listener);
}

async function flush(id: string) {
  if (!(id in unsaved)) return;
  const value = unsaved[id];
  try {
    const res = await fetch(`/__admin/${id.split('/').map(encodeURIComponent).join('/')}`, {
      method: value ? 'PUT' : 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: value ? JSON.stringify(value) : undefined,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    // Only clear it if nothing newer was queued while the request was in flight.
    if (unsaved[id] === value) {
      delete unsaved[id];
      persistUnsaved();
    }
    failed = false;
  } catch (e) {
    console.error('Saving failed', id, e);
    failed = true;
    retrySoon();
  }
  notify();
}

function retrySoon() {
  clearTimeout(retryTimer);
  retryTimer = setTimeout(() => Object.keys(unsaved).forEach(flush), 5000);
}

/** Debounced per entry, so clicking through scores doesn't flood the dev server. */
function save(collection: Collection, key: string, value: unknown) {
  const id = `${collection}/${key}`;
  unsaved[id] = value;
  persistUnsaved();
  notify();
  clearTimeout(timers.get(id));
  timers.set(
    id,
    setTimeout(() => {
      timers.delete(id);
      flush(id);
    }, 400),
  );
}

export const saveRating = (key: string, rating: Rating | undefined) =>
  save('ratings', key, isEmptyRating(rating) ? null : rating);

export const saveWatchlistEntry = (key: string, entry: WatchlistEntry) => save('watchlist', key, entry);

// --- Adding to the watchlist (dev server only) --------------------------------

export async function searchTmdb(query: string): Promise<SearchResult[]> {
  const res = await fetch(`/__admin/tmdb/search?q=${encodeURIComponent(query)}`);
  if (!res.ok) throw new Error(`Search failed (${res.status})`);
  return res.json();
}

/** Fetches full details for a movie and adds it to the watchlist catalog on disk. */
export async function fetchWatchlistMovie(tmdbId: number): Promise<Movie> {
  const res = await fetch(`/__admin/tmdb/movie/${tmdbId}`, { method: 'POST' });
  if (!res.ok) throw new Error(`Could not load movie details (${res.status})`);
  return res.json();
}

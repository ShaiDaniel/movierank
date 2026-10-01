// All data access goes through here. Edits are saved one of two ways:
//  - 'local':  the dev server (npm run dev) writes data/*.json on this PC;
//  - 'github': on the public site, after unlocking with the passphrase, edits are
//              committed straight to the GitHub repo (batched), which redeploys the site.
import { buildDataFiles, FILES } from '../shared/data-files.mjs';
import { githubClient } from '../shared/github.mjs';
import { catalogEntry, DETAILS_QUERY, searchMovies, tmdbFetch, trim } from '../shared/tmdb-core.mjs';
import { decryptVault } from '../shared/vault.mjs';
import type { Movie, Rating, Ratings, SearchResult, Watchlist, WatchlistEntry } from './types';

const BASE = import.meta.env.BASE_URL;

export type EditMode = 'local' | 'github' | null;
let mode: EditMode = import.meta.env.DEV ? 'local' : null;
let github: ReturnType<typeof githubClient> | null = null;
let tmdbToken: string | null = null;

export const editMode = () => mode;

type Collection = 'ratings' | 'watchlist' | 'watchlist-movies';

async function getJson<T>(name: string): Promise<T> {
  const res = await fetch(`${BASE}data/${name}.json`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Could not load ${name} (${res.status})`);
  return res.json();
}

export interface SiteData {
  movies: Movie[];
  ratings: Ratings;
  watchlistMovies: Movie[];
  watchlist: Watchlist;
}

/** Everything the site shows. When editing on GitHub, user data comes from the repo head (the deploy may lag). */
export async function loadAll(): Promise<SiteData> {
  const fromRepo = async <T,>(name: keyof typeof FILES, fallback: T): Promise<T> => {
    try {
      const text = await github!.readText(FILES[name]);
      return text ? JSON.parse(text) : fallback;
    } catch (e) {
      // E.g. an expired token: show the published data and say why saving won't work.
      console.error('Reading from GitHub failed', e);
      failure = "Couldn't read from GitHub — the token may have expired. Run npm run edit:setup again.";
      notify();
      return getJson<T>(name === 'watchlistMovies' ? 'watchlist-movies' : name);
    }
  };
  const [movies, ratings, watchlistMovies, watchlist] = await Promise.all([
    getJson<Movie[]>('movies'),
    mode === 'github' ? fromRepo<Ratings>('ratings', {}) : getJson<Ratings>('ratings'),
    mode === 'github' ? fromRepo<Movie[]>('watchlistMovies', []) : getJson<Movie[]>('watchlist-movies'),
    mode === 'github' ? fromRepo<Watchlist>('watchlist', {}) : getJson<Watchlist>('watchlist'),
  ]);
  return {
    movies,
    ratings: withUnsaved('ratings', ratings),
    watchlist: withUnsaved('watchlist', watchlist),
    watchlistMovies: [
      ...watchlistMovies,
      ...pendingOf<Movie>('watchlist-movies')
        .filter(([key, m]) => m && !watchlistMovies.some((w) => w.key === key))
        .map(([, m]) => m as Movie),
    ],
  };
}

export function isEmptyRating(r: Rating | undefined) {
  return !r || (!r.verdict && !r.note?.trim() && !r.review?.trim() && !r.dateUncertain && !Object.keys(r.scores ?? {}).length);
}

// --- Unlocking (public site) ---------------------------------------------------

const CREDS_KEY = 'movierank:creds';
interface Creds {
  github: string;
  tmdb: string;
  repo: string;
  branch: string;
}

function activate(creds: Creds) {
  github = githubClient({ token: creds.github, repo: creds.repo, branch: creds.branch });
  tmdbToken = creds.tmdb;
  mode = 'github';
}

/** Decrypts public/vault.json with the passphrase. Throws 'wrong-passphrase' if it doesn't match. */
export async function unlock(passphrase: string, remember: boolean) {
  const res = await fetch(`${BASE}vault.json`, { cache: 'no-store' });
  if (!res.ok) throw new Error('Editing is not set up yet (run npm run edit:setup).');
  let creds: Creds;
  try {
    creds = await decryptVault(await res.json(), passphrase);
  } catch {
    throw new Error('wrong-passphrase');
  }
  activate(creds);
  try {
    if (remember) localStorage.setItem(CREDS_KEY, JSON.stringify(creds));
  } catch {
    // Not remembered; unlocking still works for this visit.
  }
}

/** Unlocks without asking, if this device was remembered. */
export function autoUnlock(): boolean {
  if (mode) return false;
  try {
    const stored = localStorage.getItem(CREDS_KEY);
    if (!stored) return false;
    activate(JSON.parse(stored));
    return true;
  } catch {
    return false;
  }
}

export function lock() {
  try {
    localStorage.removeItem(CREDS_KEY);
  } catch {
    // Nothing stored.
  }
  github = null;
  tmdbToken = null;
  mode = null;
}

// --- Saving -----------------------------------------------------------------
// Every edit goes to localStorage first and stays there until the dev server (local)
// or GitHub (public site) confirms it, so nothing is lost if saving fails.

const UNSAVED_KEY = 'movierank:unsaved';
export type SaveStatus = { state: 'saved' | 'saving' | 'failed'; pending: number; message?: string };

/** Keyed "<collection>/<key>"; null means delete. */
const unsaved: Record<string, unknown> = readUnsaved();
const timers = new Map<string, ReturnType<typeof setTimeout>>();
const listeners = new Set<(s: SaveStatus) => void>();
let failure: string | null = null;
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
    // Storage unavailable: the save is still attempted.
  }
}

function pendingOf<T>(collection: Collection): [string, T | null][] {
  return Object.entries(unsaved)
    .filter(([id]) => id.startsWith(`${collection}/`))
    .map(([id, value]) => [id.slice(collection.length + 1), value as T | null]);
}

/** Edits that were never confirmed win over what was loaded. */
function withUnsaved<T extends Record<string, unknown>>(collection: Collection, loaded: T): T {
  for (const [key, value] of pendingOf(collection)) {
    if (value) (loaded as Record<string, unknown>)[key] = value;
    else delete loaded[key];
  }
  if (Object.keys(unsaved).length) scheduleRetry();
  return loaded;
}

function status(): SaveStatus {
  const pending = Object.keys(unsaved).length;
  return { state: !pending ? 'saved' : failure ? 'failed' : 'saving', pending, message: failure ?? undefined };
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

function scheduleRetry() {
  clearTimeout(retryTimer);
  retryTimer = setTimeout(() => (mode === 'github' ? flushGithub() : Object.keys(unsaved).forEach(flushLocal)), mode === 'github' ? 30000 : 5000);
}

/** Local mode: one request per entry to the dev server. */
async function flushLocal(id: string) {
  if (!(id in unsaved) || mode !== 'local' || id.startsWith('watchlist-movies/')) return;
  const value = unsaved[id];
  try {
    const res = await fetch(`/__admin/${id.split('/').map(encodeURIComponent).join('/')}`, {
      method: value ? 'PUT' : 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: value ? JSON.stringify(value) : undefined,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    confirmSaved({ [id]: value });
  } catch (e) {
    console.error('Saving failed', id, e);
    failure = "The dev server isn't reachable.";
    scheduleRetry();
  }
  notify();
}

// GitHub mode: changes are batched into one commit, sent after a short pause in editing
// (each commit redeploys the site, so one per rating would be wasteful).
const GITHUB_QUIET_MS = 8000;
let githubTimer: ReturnType<typeof setTimeout> | undefined;
let committing = false;

async function flushGithub() {
  if (mode !== 'github' || !github || committing) return;
  const snapshot = { ...unsaved };
  const ids = Object.keys(snapshot);
  if (!ids.length) return;
  const changes = {
    ratings: {} as Record<string, unknown>,
    watchlist: {} as Record<string, unknown>,
    watchlistMovies: [] as unknown[],
  };
  for (const [id, value] of Object.entries(snapshot)) {
    const [collection, key] = id.split('/');
    if (collection === 'ratings') changes.ratings[key] = value;
    else if (collection === 'watchlist') changes.watchlist[key] = value;
    else if (collection === 'watchlist-movies' && value) changes.watchlistMovies.push(value);
  }
  committing = true;
  notify();
  try {
    await github.commitFiles((read: (path: string) => Promise<string | null>) => buildDataFiles(read, changes), `Edit from site: ${ids.length} change${ids.length === 1 ? '' : 's'}`);
    confirmSaved(snapshot);
  } catch (e) {
    console.error('Saving to GitHub failed', e);
    const code = (e as { status?: number }).status;
    failure =
      code === 401 || code === 403
        ? 'GitHub refused the save — the token may have expired. Run npm run edit:setup again.'
        : "Couldn't save to GitHub (offline?). Retrying.";
    scheduleRetry();
  } finally {
    committing = false;
    notify();
    // Edits made while committing go in the next batch.
    if (Object.keys(unsaved).length && !failure) scheduleGithub();
  }
}

function scheduleGithub() {
  clearTimeout(githubTimer);
  githubTimer = setTimeout(flushGithub, GITHUB_QUIET_MS);
}

/** Sends pending GitHub edits now instead of waiting for the pause. */
export const saveNow = () => {
  clearTimeout(githubTimer);
  return flushGithub();
};

/** Clears confirmed entries, unless a newer edit was queued meanwhile. */
function confirmSaved(saved: Record<string, unknown>) {
  for (const [id, value] of Object.entries(saved)) if (unsaved[id] === value) delete unsaved[id];
  persistUnsaved();
  failure = null;
}

function save(collection: Collection, key: string, value: unknown) {
  const id = `${collection}/${key}`;
  unsaved[id] = value;
  persistUnsaved();
  notify();
  if (mode === 'github') return scheduleGithub();
  // Local: debounced per entry, so clicking through scores doesn't flood the dev server.
  clearTimeout(timers.get(id));
  timers.set(
    id,
    setTimeout(() => {
      timers.delete(id);
      flushLocal(id);
    }, 400),
  );
}

export const saveRating = (key: string, rating: Rating | undefined) =>
  save('ratings', key, isEmptyRating(rating) ? null : rating);

export const saveWatchlistEntry = (key: string, entry: WatchlistEntry) => save('watchlist', key, entry);

// Try to get pending edits out before the tab closes (they're in localStorage regardless).
if (typeof window !== 'undefined') {
  window.addEventListener('visibilitychange', () => document.visibilityState === 'hidden' && saveNow());
}

// --- Adding to the watchlist ---------------------------------------------------

export async function searchTmdb(query: string): Promise<SearchResult[]> {
  if (mode === 'github') return searchMovies(tmdbToken, query);
  const res = await fetch(`/__admin/tmdb/search?q=${encodeURIComponent(query)}`);
  if (!res.ok) throw new Error(`Search failed (${res.status})`);
  return res.json();
}

/** Full details for a movie being added; also queues it for the watchlist catalog. */
export async function fetchWatchlistMovie(tmdbId: number): Promise<Movie> {
  if (mode === 'github') {
    const details = trim(await tmdbFetch(tmdbToken, `/movie/${tmdbId}${DETAILS_QUERY}`));
    const key = String(tmdbId);
    // The IMDb rating is filled in by the next `npm run sync`.
    const movie: Movie = catalogEntry({ key, title: key, year: null, ids: { tmdb: tmdbId, imdb: null } }, details);
    save('watchlist-movies', key, movie);
    return movie;
  }
  const res = await fetch(`/__admin/tmdb/movie/${tmdbId}`, { method: 'POST' });
  if (!res.ok) throw new Error(`Could not load movie details (${res.status})`);
  return res.json();
}

// All data access goes through here, so moving ratings to Supabase later
// only means replacing loadRatings/saveRating.
import type { Movie, Rating, Ratings } from './types';

const BASE = import.meta.env.BASE_URL;

/** Editing is only available when running locally with `npm run dev`. */
export const ADMIN = import.meta.env.DEV;

export async function loadCatalog(): Promise<Movie[]> {
  const res = await fetch(`${BASE}data/movies.json`);
  if (!res.ok) throw new Error(`Could not load movies (${res.status})`);
  return res.json();
}

export async function loadRatings(): Promise<Ratings> {
  const res = await fetch(`${BASE}data/ratings.json`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Could not load ratings (${res.status})`);
  const ratings: Ratings = await res.json();
  // Edits that never reached the server win over what's on disk.
  for (const [key, rating] of Object.entries(unsaved)) {
    if (rating) ratings[key] = rating;
    else delete ratings[key];
  }
  if (Object.keys(unsaved).length) retrySoon();
  return ratings;
}

export function isEmptyRating(r: Rating | undefined) {
  return !r || (!r.verdict && !r.note?.trim() && !r.review?.trim() && !r.dateUncertain && !Object.keys(r.scores ?? {}).length);
}

// --- Saving -----------------------------------------------------------------
// Every edit goes to localStorage first and stays there until the dev server
// confirms it wrote data/ratings.json, so a stopped server can't lose work.

const UNSAVED_KEY = 'movierank:unsaved';
export type SaveStatus = { state: 'saved' | 'saving' | 'failed'; pending: number };

const unsaved: Record<string, Rating | null> = readUnsaved();
const timers = new Map<string, ReturnType<typeof setTimeout>>();
const listeners = new Set<(s: SaveStatus) => void>();
let failed = false;
let retryTimer: ReturnType<typeof setTimeout> | undefined;

function readUnsaved(): Record<string, Rating | null> {
  try {
    return JSON.parse(localStorage.getItem(UNSAVED_KEY) ?? '{}');
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

async function flush(key: string) {
  if (!(key in unsaved)) return;
  const rating = unsaved[key];
  try {
    const res = await fetch(`/__admin/ratings/${encodeURIComponent(key)}`, {
      method: rating ? 'PUT' : 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: rating ? JSON.stringify(rating) : undefined,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    // Only clear it if nothing newer was queued while the request was in flight.
    if (unsaved[key] === rating) {
      delete unsaved[key];
      persistUnsaved();
    }
    failed = false;
  } catch (e) {
    console.error('Saving rating failed', e);
    failed = true;
    retrySoon();
  }
  notify();
}

function retrySoon() {
  clearTimeout(retryTimer);
  retryTimer = setTimeout(() => Object.keys(unsaved).forEach(flush), 5000);
}

/** Debounced per movie, so clicking through scores doesn't flood the dev server. */
export function saveRating(key: string, rating: Rating | undefined) {
  unsaved[key] = isEmptyRating(rating) ? null : rating!;
  persistUnsaved();
  notify();
  clearTimeout(timers.get(key));
  timers.set(
    key,
    setTimeout(() => {
      timers.delete(key);
      flush(key);
    }, 400),
  );
}

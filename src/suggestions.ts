// Co-worker suggestions: Google sign-in (Firebase Auth) and a public Firestore collection.
// Firebase is loaded only when configured, and lazily, so the main site stays light.
import type { User } from 'firebase/auth';
import { FIREBASE_CONFIG, OWNER_EMAIL, TMDB_PUBLIC_KEY } from './firebase-config';
import type { SearchResult } from './types';

export const suggestionsEnabled = Boolean(FIREBASE_CONFIG.apiKey && FIREBASE_CONFIG.projectId);
export const publicSearchEnabled = Boolean(TMDB_PUBLIC_KEY);

export type SuggestionStatus = 'pending' | 'accepted' | 'dismissed';

export interface Suggestion {
  id: string;
  tmdb: number;
  title: string;
  year: number | null;
  poster: string | null;
  note: string;
  userId: string;
  userName: string;
  userPhoto: string | null;
  createdAt: Date | null;
  status: SuggestionStatus;
  decidedAt?: Date | null;
}

export interface Viewer {
  uid: string;
  name: string;
  photo: string | null;
  email: string | null;
  isOwner: boolean;
}

async function services() {
  const [{ initializeApp, getApps }, auth, store] = await Promise.all([
    import('firebase/app'),
    import('firebase/auth'),
    import('firebase/firestore/lite'),
  ]);
  const app = getApps()[0] ?? initializeApp(FIREBASE_CONFIG);
  return { auth, store, authInstance: auth.getAuth(app), db: store.getFirestore(app) };
}

const toViewer = (u: User): Viewer => ({
  uid: u.uid,
  name: u.displayName ?? u.email ?? 'Someone',
  photo: u.photoURL,
  email: u.email,
  isOwner: Boolean(u.email && u.emailVerified && u.email.toLowerCase() === OWNER_EMAIL.toLowerCase()),
});

/** Calls back with the signed-in viewer (or null) now and on every change. */
export async function watchViewer(callback: (v: Viewer | null) => void) {
  if (!suggestionsEnabled) return () => {};
  const { auth, authInstance } = await services();
  return auth.onAuthStateChanged(authInstance, (u) => callback(u ? toViewer(u) : null));
}

export async function signIn() {
  const { auth, authInstance } = await services();
  await auth.signInWithPopup(authInstance, new auth.GoogleAuthProvider());
}

export async function signOut() {
  const { auth, authInstance } = await services();
  await auth.signOut(authInstance);
}

export async function loadSuggestions(): Promise<Suggestion[]> {
  if (!suggestionsEnabled) return [];
  const { store, db } = await services();
  const snap = await store.getDocs(store.query(store.collection(db, 'suggestions'), store.orderBy('createdAt', 'desc')));
  return snap.docs.map((d) => {
    const x = d.data();
    return {
      id: d.id,
      tmdb: x.tmdb,
      title: x.title,
      year: x.year ?? null,
      poster: x.poster ?? null,
      note: x.note ?? '',
      userId: x.userId,
      userName: x.userName,
      userPhoto: x.userPhoto ?? null,
      createdAt: x.createdAt?.toDate?.() ?? null,
      status: x.status,
      decidedAt: x.decidedAt?.toDate?.() ?? null,
    };
  });
}

export async function addSuggestion(movie: SearchResult, note: string) {
  const { store, authInstance, db } = await services();
  const u = authInstance.currentUser;
  if (!u) throw new Error('Sign in first.');
  await store.addDoc(store.collection(db, 'suggestions'), {
    tmdb: movie.tmdb,
    title: movie.title,
    year: movie.year,
    poster: movie.poster,
    note: note.trim().slice(0, 500),
    userId: u.uid,
    userName: (u.displayName ?? u.email ?? 'Someone').slice(0, 100),
    userPhoto: u.photoURL,
    createdAt: store.serverTimestamp(),
    status: 'pending',
  });
}

export async function setSuggestionStatus(id: string, status: SuggestionStatus) {
  const { store, db } = await services();
  await store.updateDoc(store.doc(db, 'suggestions', id), { status, decidedAt: store.serverTimestamp() });
}

export async function deleteSuggestion(id: string) {
  const { store, db } = await services();
  await store.deleteDoc(store.doc(db, 'suggestions', id));
}

/** Movie search for visitors, with the public read-only TMDB key. */
export async function searchTmdbPublic(query: string): Promise<SearchResult[]> {
  const res = await fetch(
    `https://api.themoviedb.org/3/search/movie?api_key=${TMDB_PUBLIC_KEY}&include_adult=false&query=${encodeURIComponent(query)}`,
  );
  if (!res.ok) throw new Error(`Search failed (${res.status})`);
  const d = await res.json();
  return d.results.slice(0, 10).map((m: { id: number; title: string; release_date?: string; poster_path: string | null; overview: string }) => ({
    tmdb: m.id,
    title: m.title,
    year: m.release_date ? Number(m.release_date.slice(0, 4)) : null,
    poster: m.poster_path,
    overview: m.overview,
  }));
}

// Co-worker features: Google sign-in (Firebase Auth) plus Firestore for suggestions,
// rank challenges, comments on both, and each co-worker's private "My list".
// Firebase is loaded only when configured, and lazily, so the main site stays light.
import type { User } from 'firebase/auth';
import { FIREBASE_CONFIG, OWNER_EMAIL, TMDB_PUBLIC_KEY } from './firebase-config';
import type { SearchResult, VerdictId } from './types';

export const suggestionsEnabled = Boolean(FIREBASE_CONFIG.apiKey && FIREBASE_CONFIG.projectId);
export const publicSearchEnabled = Boolean(TMDB_PUBLIC_KEY);

export type SuggestionStatus = 'pending' | 'accepted' | 'dismissed';
/** 'watch': you haven't seen it, watch it. 'rewatch': a challenge to a verdict, watch it again. */
export type SuggestionKind = 'watch' | 'rewatch';

export interface Suggestion {
  id: string;
  kind: SuggestionKind;
  /** For challenges: the verdict the co-worker thinks it deserves. */
  proposedVerdict?: VerdictId;
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

const authorOf = (u: User) => ({
  userId: u.uid,
  userName: (u.displayName ?? u.email ?? 'Someone').slice(0, 100),
  userPhoto: u.photoURL,
});

async function signedInUser() {
  const s = await services();
  const u = s.authInstance.currentUser;
  if (!u) throw new Error('Sign in first.');
  return { ...s, u };
}

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

// --- Suggestions and challenges ------------------------------------------------------

export async function loadSuggestions(): Promise<Suggestion[]> {
  if (!suggestionsEnabled) return [];
  const { store, db } = await services();
  const snap = await store.getDocs(store.query(store.collection(db, 'suggestions'), store.orderBy('createdAt', 'desc')));
  return snap.docs.map((d) => {
    const x = d.data();
    return {
      id: d.id,
      kind: x.kind ?? 'watch',
      proposedVerdict: x.proposedVerdict,
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

export async function addSuggestion(
  movie: Pick<SearchResult, 'tmdb' | 'title' | 'year' | 'poster'>,
  note: string,
  kind: SuggestionKind = 'watch',
  proposedVerdict?: VerdictId,
) {
  const { store, db, u } = await signedInUser();
  await store.addDoc(store.collection(db, 'suggestions'), {
    kind,
    ...(proposedVerdict ? { proposedVerdict } : {}),
    tmdb: movie.tmdb,
    title: movie.title,
    year: movie.year,
    poster: movie.poster,
    note: note.trim().slice(0, 500),
    ...authorOf(u),
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

// --- Comments: threads on suggestions/challenges and debates on movies ----------------
// A thread is the document its comments hang under: "suggestions/<id>" or "movies/<key>".

export type Stance = 'agree' | 'disagree';

export interface Comment {
  id: string;
  thread: string;
  text: string;
  /** In a movie debate: agrees or disagrees with the owner's verdict. */
  stance?: Stance;
  /** Posted by the owner (checked by the security rules). */
  byOwner?: boolean;
  userId: string;
  userName: string;
  userPhoto: string | null;
  createdAt: Date | null;
}

export const suggestionThread = (id: string) => `suggestions/${id}`;
export const movieThread = (key: string) => `movies/${key}`;

/** All comments, grouped by thread, oldest first. */
export async function loadComments(): Promise<Record<string, Comment[]>> {
  if (!suggestionsEnabled) return {};
  const { store, db } = await services();
  // Sorted here rather than in the query, which would need a collection-group index.
  const snap = await store.getDocs(store.collectionGroup(db, 'comments'));
  const byThread: Record<string, Comment[]> = {};
  for (const d of snap.docs) {
    const x = d.data();
    const parent = d.ref.parent.parent!;
    const thread = `${parent.parent.id}/${parent.id}`;
    (byThread[thread] ??= []).push({
      id: d.id,
      thread,
      text: x.text,
      stance: x.stance,
      byOwner: Boolean(x.byOwner),
      userId: x.userId,
      userName: x.userName,
      userPhoto: x.userPhoto ?? null,
      createdAt: x.createdAt?.toDate?.() ?? null,
    });
  }
  for (const list of Object.values(byThread)) list.sort((a, b) => (a.createdAt?.getTime() ?? 0) - (b.createdAt?.getTime() ?? 0));
  return byThread;
}

export async function addComment(thread: string, text: string, stance?: Stance) {
  const { store, db, u } = await signedInUser();
  await store.addDoc(store.collection(db, thread, 'comments'), {
    text: text.trim().slice(0, 1000),
    ...(stance ? { stance } : {}),
    ...(toViewer(u).isOwner ? { byOwner: true } : {}),
    ...authorOf(u),
    createdAt: store.serverTimestamp(),
  });
}

export async function deleteComment(thread: string, commentId: string) {
  const { store, db } = await services();
  await store.deleteDoc(store.doc(db, thread, 'comments', commentId));
}

// --- My list (each co-worker's private list of movies from this site) --------------

export interface ListItem {
  key: string;
  title: string;
  addedAt: Date | null;
  /** Ticked off by the co-worker once they've watched it. */
  seen: boolean;
}

export async function loadMyList(uid: string): Promise<ListItem[]> {
  const { store, db } = await services();
  const snap = await store.getDocs(store.collection(db, 'lists', uid, 'items'));
  return snap.docs.map((d) => {
    const x = d.data();
    return { key: d.id, title: x.title, addedAt: x.addedAt?.toDate?.() ?? null, seen: Boolean(x.seen) };
  });
}

export async function addToMyList(uid: string, key: string, title: string) {
  const { store, db } = await services();
  await store.setDoc(store.doc(db, 'lists', uid, 'items', key), {
    title: title.slice(0, 300),
    addedAt: store.serverTimestamp(),
    seen: false,
  });
}

export async function setSeenOnMyList(uid: string, key: string, seen: boolean) {
  const { store, db } = await services();
  await store.updateDoc(store.doc(db, 'lists', uid, 'items', key), { seen });
}

export async function removeFromMyList(uid: string, key: string) {
  const { store, db } = await services();
  await store.deleteDoc(store.doc(db, 'lists', uid, 'items', key));
}

// --- Search ------------------------------------------------------------------------

/** Movie search for visitors, with the public read-only TMDB key. */
export async function searchTmdbPublic(query: string): Promise<SearchResult[]> {
  const res = await fetch(
    `https://api.themoviedb.org/3/search/movie?api_key=${TMDB_PUBLIC_KEY}&include_adult=false&query=${encodeURIComponent(query)}`,
  );
  if (!res.ok) throw new Error(`Search failed (${res.status})`);
  const d = await res.json();
  return d.results
    .slice(0, 10)
    .map((m: { id: number; title: string; release_date?: string; poster_path: string | null; overview: string }) => ({
      tmdb: m.id,
      title: m.title,
      year: m.release_date ? Number(m.release_date.slice(0, 4)) : null,
      poster: m.poster_path,
      overview: m.overview,
    }));
}

// --- Votes (one per signed-in user per suggestion or challenge) ---------------------

export interface Vote {
  userId: string;
  userName: string;
  value: 1 | -1;
}

/** All votes, grouped by suggestion id. */
export async function loadVotes(): Promise<Record<string, Vote[]>> {
  if (!suggestionsEnabled) return {};
  const { store, db } = await services();
  const snap = await store.getDocs(store.collectionGroup(db, 'votes'));
  const byParent: Record<string, Vote[]> = {};
  for (const d of snap.docs) {
    const x = d.data();
    (byParent[d.ref.parent.parent!.id] ??= []).push({ userId: d.id, userName: x.userName, value: x.value === -1 ? -1 : 1 });
  }
  return byParent;
}

/** Sets my vote; null removes it. The vote document id is the voter's uid, so there's one per person. */
export async function castVote(suggestionId: string, value: 1 | -1 | null) {
  const { store, db, u } = await signedInUser();
  const ref = store.doc(db, 'suggestions', suggestionId, 'votes', u.uid);
  if (value === null) await store.deleteDoc(ref);
  else await store.setDoc(ref, { value, userName: (u.displayName ?? u.email ?? 'Someone').slice(0, 100) });
}

// --- Owner credentials -------------------------------------------------------------
// The GitHub token the owner's edits are committed with. Stored in Firestore at
// owner/credentials, which the security rules let only the owner read or write.

export interface OwnerCreds {
  github: string;
  repo: string;
  branch: string;
}

export async function loadOwnerCreds(): Promise<OwnerCreds | null> {
  const { store, db } = await services();
  const snap = await store.getDoc(store.doc(db, 'owner', 'credentials'));
  return snap.exists() ? (snap.data() as OwnerCreds) : null;
}

export async function saveOwnerCreds(creds: OwnerCreds) {
  const { store, db } = await services();
  await store.setDoc(store.doc(db, 'owner', 'credentials'), creds);
}

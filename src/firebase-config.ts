// Public configuration for co-worker suggestions (Google sign-in + Firestore).
// These values identify the Firebase project and are meant to be public; access is
// enforced by the Firestore security rules in firestore.rules.

/** Paste the firebaseConfig object from Firebase console → Project settings → Your apps. Empty = suggestions off. */
export const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyATCOm53Hmek9Meny-nyuyuXQwt-7UIRms',
  authDomain: 'movierank-6eb00.firebaseapp.com',
  projectId: 'movierank-6eb00',
  storageBucket: 'movierank-6eb00.firebasestorage.app',
  messagingSenderId: '978007905142',
  appId: '1:978007905142:web:8e7703a6d2e38333f62057',
};

/** The Google account that may accept or dismiss suggestions (must match firestore.rules). */
export const OWNER_EMAIL = 'shai.daniel@gmail.com';

/** Read-only TMDB v3 API key, so visitors can search movies to suggest. Empty = search off. */
export const TMDB_PUBLIC_KEY = '';

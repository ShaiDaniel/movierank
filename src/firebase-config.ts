// Public configuration for co-worker suggestions (Google sign-in + Firestore).
// These values identify the Firebase project and are meant to be public; access is
// enforced by the Firestore security rules in firestore.rules.

/** Paste the firebaseConfig object from Firebase console → Project settings → Your apps. Empty = suggestions off. */
export const FIREBASE_CONFIG = {
  apiKey: '',
  authDomain: '',
  projectId: '',
  storageBucket: '',
  messagingSenderId: '',
  appId: '',
};

/** The Google account that may accept or dismiss suggestions (must match firestore.rules). */
export const OWNER_EMAIL = 'shai.daniel@gmail.com';

/** Read-only TMDB v3 API key, so visitors can search movies to suggest. Empty = search off. */
export const TMDB_PUBLIC_KEY = '';

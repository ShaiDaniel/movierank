// Encrypts the editing credentials (GitHub token, TMDB token) with a passphrase,
// so they can be published inside the static site and unlocked only by the owner.
// Uses Web Crypto, which exists in both Node 22 and browsers.
//
// PBKDF2-SHA256 with many iterations makes each passphrase guess slow, because the
// encrypted file is public and could be attacked offline; a long passphrase matters.

const ITERATIONS = 1_000_000;

const toB64 = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes)));
const fromB64 = (b64) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));

async function deriveKey(passphrase, salt, iterations) {
  const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(passphrase), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

export async function encryptVault(secrets, passphrase) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(passphrase, salt, ITERATIONS);
  const data = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(JSON.stringify(secrets)));
  return { v: 1, kdf: 'PBKDF2-SHA256', iterations: ITERATIONS, salt: toB64(salt), iv: toB64(iv), data: toB64(data) };
}

/** Throws if the passphrase is wrong (AES-GCM authentication fails). */
export async function decryptVault(vault, passphrase) {
  const key = await deriveKey(passphrase, fromB64(vault.salt), vault.iterations);
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromB64(vault.iv) }, key, fromB64(vault.data));
  return JSON.parse(new TextDecoder().decode(plain));
}

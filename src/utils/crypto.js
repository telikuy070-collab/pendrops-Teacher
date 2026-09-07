/**
 * Crypto utilities for client-side encryption and decryption of admin credentials.
 *
 * Uses AES‑256‑GCM for authenticated encryption with PBKDF2 (100,000 iterations)
 * to derive the key from the admin PIN. This is the same scheme used in the
 * legacy GitHub flow so existing admin credentials remain compatible.
 *
 * @module utils/crypto
 */

/** @constant {number} PBKDF2 iterations for key derivation */
const PBKDF2_ITERATIONS = 100_000;

/** @constant {string} Hash algorithm used in PBKDF2 */
const PBKDF2_HASH = 'SHA-256';

/** @constant {string} AES key length in bits */
const AES_KEY_LENGTH = 256;

/**
 * Convert an ArrayBuffer to a base64 string (binary‑safe).
 * @param {ArrayBuffer} buf
 * @returns {string}
 */
export function arrayBufferToBase64(buf) {
  const bytes = new Uint8Array(buf);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

/**
 * Convert a base64 string to an ArrayBuffer (binary‑safe).
 * @param {string} b64
 * @returns {ArrayBuffer}
 */
export function base64ToArrayBuffer(b64) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}

/**
 * Encrypt a plaintext secret using a PIN-derived key.
 *
 * Output format: `base64salt.base64iv.base64ciphertext`
 * @param {string} plaintext — the secret to encrypt (e.g. service role key)
 * @param {string} pin — the user‑supplied PIN
 * @returns {Promise<string>} encrypted blob string
 */
export async function encryptBlob(plaintext, pin) {
  const enc = new TextEncoder();

  // 1. Generate a random salt
  const salt = crypto.getRandomValues(new Uint8Array(16));

  // 2. Import PIN as a raw key for PBKDF2
  const pinKey = await crypto.subtle.importKey('raw', enc.encode(pin), 'PBKDF2', false, [
    'deriveKey',
  ]);

  // 3. Derive AES‑256‑GCM key
  const key = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: PBKDF2_HASH },
    pinKey,
    { name: 'AES-GCM', length: AES_KEY_LENGTH },
    false,
    ['encrypt']
  );

  // 4. Generate random IV
  const iv = crypto.getRandomValues(new Uint8Array(12));

  // 5. Encrypt
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(plaintext));

  // 6. Combine into blob string
  return `${arrayBufferToBase64(salt.buffer)}.${arrayBufferToBase64(iv.buffer)}.${arrayBufferToBase64(ct)}`;
}

/**
 * Decrypt a blob string using a PIN.
 *
 * Input format: `base64salt.base64iv.base64ciphertext`
 * @param {string} blob — the encrypted blob string
 * @param {string} pin — the user‑supplied PIN
 * @returns {Promise<string>} decrypted plaintext
 * @throws {Error} if the blob format is invalid or decryption fails
 */
export async function decryptBlob(blob, pin) {
  const parts = blob.split('.');
  if (parts.length !== 3) throw new Error('Битый blob — неверный формат');

  const salt = new Uint8Array(base64ToArrayBuffer(parts[0]));
  const iv = new Uint8Array(base64ToArrayBuffer(parts[1]));
  const ct = base64ToArrayBuffer(parts[2]);

  const enc = new TextEncoder();
  const km = await crypto.subtle.importKey('raw', enc.encode(pin), 'PBKDF2', false, ['deriveKey']);
  const key = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: PBKDF2_HASH },
    km,
    { name: 'AES-GCM', length: AES_KEY_LENGTH },
    false,
    ['decrypt']
  );

  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct);
  return new TextDecoder().decode(plain);
}

/**
 * Verifies an admin PIN using a constant‑time comparison to mitigate timing attacks.
 * @param {string} pin — user‑supplied PIN
 * @param {string} expected — the expected PIN value
 * @returns {boolean}
 */
export function verifyPin(pin, expected) {
  const enc = new TextEncoder();
  const a = enc.encode(pin);
  const b = enc.encode(expected);
  if (a.length !== b.length) return false;
  const buf = new Uint8Array(a.length);
  for (let i = 0; i < a.length; i++) buf[i] = a[i] ^ b[i];
  return buf.every((v) => v === 0);
}

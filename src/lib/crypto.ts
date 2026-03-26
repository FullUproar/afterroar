/* ------------------------------------------------------------------ */
/*  PII Encryption — AES-256-GCM for customer email and phone          */
/*  Application-level encryption at rest.                               */
/*                                                                      */
/*  Env var: PII_ENCRYPTION_KEY (64 hex chars = 32 bytes)              */
/*  If not set, encryption is disabled (plaintext passthrough).         */
/* ------------------------------------------------------------------ */

import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // GCM standard
const TAG_LENGTH = 16; // GCM auth tag

function getKey(): Buffer | null {
  const hex = process.env.PII_ENCRYPTION_KEY;
  if (!hex || hex.length !== 64) return null;
  return Buffer.from(hex, "hex");
}

/**
 * Encrypt a plaintext string. Returns base64-encoded ciphertext
 * with IV and auth tag prepended.
 * If no encryption key is configured, returns plaintext unchanged.
 */
export function encrypt(plaintext: string): string {
  const key = getKey();
  if (!key) return plaintext; // Graceful fallback

  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, "utf8", "base64");
  encrypted += cipher.final("base64");

  const tag = cipher.getAuthTag();

  // Format: base64(iv + tag + ciphertext)
  const combined = Buffer.concat([
    iv,
    tag,
    Buffer.from(encrypted, "base64"),
  ]);

  return `enc:${combined.toString("base64")}`;
}

/**
 * Decrypt a ciphertext string. Expects the format produced by encrypt().
 * If the string doesn't start with "enc:", assumes it's plaintext (for
 * backward compatibility with data encrypted before PII encryption was enabled).
 */
export function decrypt(ciphertext: string): string {
  if (!ciphertext.startsWith("enc:")) return ciphertext; // Plaintext passthrough

  const key = getKey();
  if (!key) return ciphertext; // No key, return as-is

  try {
    const combined = Buffer.from(ciphertext.slice(4), "base64");

    const iv = combined.subarray(0, IV_LENGTH);
    const tag = combined.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
    const encrypted = combined.subarray(IV_LENGTH + TAG_LENGTH);

    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);

    let decrypted = decipher.update(encrypted.toString("base64"), "base64", "utf8");
    decrypted += decipher.final("utf8");

    return decrypted;
  } catch {
    // If decryption fails (wrong key, corrupted data), return as-is
    return ciphertext;
  }
}

/**
 * Generate a deterministic hash for exact-match lookups on encrypted fields.
 * Uses HMAC-SHA256 so encrypted emails can still be searched by exact value.
 */
export function hashForLookup(value: string): string {
  const key = getKey();
  if (!key) return value.toLowerCase().trim();

  const { createHmac } = require("crypto");
  return createHmac("sha256", key)
    .update(value.toLowerCase().trim())
    .digest("hex");
}

/**
 * Check if PII encryption is enabled.
 */
export function isEncryptionEnabled(): boolean {
  return getKey() !== null;
}

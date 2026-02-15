/**
 * Token encryption/decryption helpers for OAuth tokens.
 * Uses AES-256-GCM with a server-side encryption key.
 * Key must be provided via EMAIL_TOKEN_ENCRYPTION_KEY env var (32-byte hex).
 */
import 'server-only';

import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const TAG_LENGTH = 16;

function getKey(): Buffer {
    const keyHex = process.env.EMAIL_TOKEN_ENCRYPTION_KEY;
    if (!keyHex || keyHex.length < 32) {
        throw new Error(
            'EMAIL_TOKEN_ENCRYPTION_KEY is not set or too short. Must be at least 32 hex characters (16 bytes).',
        );
    }
    // Use first 32 hex chars = 16 bytes, pad to 32 bytes for AES-256
    return Buffer.from(keyHex.slice(0, 64).padEnd(64, '0'), 'hex');
}

/**
 * Encrypt a plaintext string.
 * Returns base64-encoded string: iv + tag + ciphertext.
 */
export function encryptToken(plaintext: string): string {
    const key = getKey();
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, key, iv);

    let encrypted = cipher.update(plaintext, 'utf8');
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    const tag = cipher.getAuthTag();

    // Concatenate: iv (16) + tag (16) + ciphertext
    const result = Buffer.concat([iv, tag, encrypted]);
    return result.toString('base64');
}

/**
 * Decrypt a base64-encoded encrypted string.
 * Expects the format from encryptToken: iv + tag + ciphertext.
 */
export function decryptToken(encryptedBase64: string): string {
    const key = getKey();
    const data = Buffer.from(encryptedBase64, 'base64');

    const iv = data.subarray(0, IV_LENGTH);
    const tag = data.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
    const ciphertext = data.subarray(IV_LENGTH + TAG_LENGTH);

    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);

    let decrypted = decipher.update(ciphertext);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString('utf8');
}

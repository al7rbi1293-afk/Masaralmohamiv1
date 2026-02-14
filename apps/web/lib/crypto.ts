import 'server-only';

import crypto from 'crypto';
import { getIntegrationEncryptionKey } from '@/lib/env';

type EncryptedPayload = {
  v: 1;
  data: string; // base64url(iv|tag|ciphertext)
};

const VERSION = 1 as const;
const IV_BYTES = 12;
const TAG_BYTES = 16;

function deriveKey(secret: string) {
  // Normalize arbitrary-length input into a 32-byte key.
  return crypto.createHash('sha256').update(secret, 'utf8').digest();
}

export function encryptJson(value: unknown): string {
  const secret = getIntegrationEncryptionKey();
  const key = deriveKey(secret);
  const iv = crypto.randomBytes(IV_BYTES);

  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const plaintext = Buffer.from(JSON.stringify(value ?? {}), 'utf8');
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();

  const packed = Buffer.concat([iv, tag, ciphertext]).toString('base64url');
  const payload: EncryptedPayload = { v: VERSION, data: packed };

  return JSON.stringify(payload);
}

export function decryptJson<T = any>(encoded: string): T {
  const secret = getIntegrationEncryptionKey();
  const key = deriveKey(secret);

  let payload: EncryptedPayload;
  try {
    payload = JSON.parse(encoded) as EncryptedPayload;
  } catch {
    throw new Error('بيانات التكامل غير صالحة.');
  }

  if (!payload || payload.v !== VERSION || typeof payload.data !== 'string') {
    throw new Error('بيانات التكامل غير صالحة.');
  }

  const raw = Buffer.from(payload.data, 'base64url');
  if (raw.length <= IV_BYTES + TAG_BYTES) {
    throw new Error('بيانات التكامل غير صالحة.');
  }

  const iv = raw.subarray(0, IV_BYTES);
  const tag = raw.subarray(IV_BYTES, IV_BYTES + TAG_BYTES);
  const ciphertext = raw.subarray(IV_BYTES + TAG_BYTES);

  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);

  let plaintext: Buffer;
  try {
    plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  } catch {
    throw new Error('تعذر فك تشفير بيانات التكامل.');
  }

  try {
    return JSON.parse(plaintext.toString('utf8')) as T;
  } catch {
    throw new Error('بيانات التكامل غير صالحة.');
  }
}


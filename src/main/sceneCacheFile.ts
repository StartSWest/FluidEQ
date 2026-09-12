import { randomUUID } from 'crypto';
import { safeStorage } from 'electron';
import fs from 'fs';
import path from 'path';
import { secureEncryptionAvailable } from './encryptedJsonStore';

/**
 * At-rest protection for playback copies, not DRM or a replacement for signatures.
 * The OS protects the key; there is no shared decryption secret in the app.
 * Windows DPAPI cannot protect against another process under the same OS user,
 * or extraction from the renderer's memory. Studio source projects stay editable.
 */
const FORMAT = 'fluideq-scene-cache';
const VERSION = 1;
// Allows the largest signed pack plus base64/encryption overhead, before parsing.
const MAX_FILE_BYTES = 32 * 1024 * 1024;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export const writeSceneCache = (
  file: string,
  scope: string,
  value: unknown,
): void => {
  if (!secureEncryptionAvailable()) {
    throw new Error('Secure scene storage is unavailable.');
  }
  const clear = JSON.stringify({ scope, value });
  if (Buffer.byteLength(clear, 'utf8') > MAX_FILE_BYTES) {
    throw new Error('Scene cache is too large.');
  }
  const encrypted = safeStorage.encryptString(clear);
  // Never replace a legacy/offline copy with bytes we cannot decrypt ourselves.
  if (safeStorage.decryptString(encrypted) !== clear) {
    throw new Error('Scene encryption could not be verified.');
  }
  const stored = JSON.stringify({
    format: FORMAT,
    version: VERSION,
    encrypted: encrypted.toString('base64'),
  });
  if (Buffer.byteLength(stored, 'utf8') > MAX_FILE_BYTES) {
    throw new Error('Scene cache is too large.');
  }
  fs.mkdirSync(path.dirname(file), { recursive: true });
  if (fs.existsSync(file) && !fs.lstatSync(file).isFile()) {
    throw new Error('Scene cache target is not a regular file.');
  }
  const temporary = `${file}.${randomUUID()}.tmp`;
  try {
    // A unique, exclusive temporary file contains ciphertext from its first byte.
    fs.writeFileSync(temporary, stored, {
      encoding: 'utf8',
      mode: 0o600,
      flag: 'wx',
    });
    fs.renameSync(temporary, file);
  } finally {
    fs.rmSync(temporary, { force: true });
  }
};

/**
 * Validate after decrypting, on every read. A legacy copy is only returned after
 * a successful encrypted replacement. Locked keys/corruption never delete the
 * last offline copy, and never enable a plaintext fallback.
 */
export const readSceneCache = <T>(
  file: string,
  scope: string,
  decode: (value: unknown) => T | undefined,
): T | undefined => {
  try {
    if (!secureEncryptionAvailable()) {
      return undefined;
    }
    const stat = fs.lstatSync(file);
    if (!stat.isFile() || stat.size > MAX_FILE_BYTES) {
      return undefined;
    }
    const stored: unknown = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (!isRecord(stored)) {
      return undefined;
    }
    if ('format' in stored || 'encrypted' in stored) {
      if (
        stored.format !== FORMAT ||
        stored.version !== VERSION ||
        typeof stored.encrypted !== 'string' ||
        Object.keys(stored).length !== 3
      ) {
        return undefined;
      }
      const clear: unknown = JSON.parse(
        safeStorage.decryptString(Buffer.from(stored.encrypted, 'base64')),
      );
      if (!isRecord(clear) || clear.scope !== scope) {
        return undefined;
      }
      return decode(clear.value);
    }
    const decoded = decode(stored);
    if (decoded === undefined) {
      return undefined;
    }
    writeSceneCache(file, scope, stored);
    return decoded;
  } catch {
    return undefined;
  }
};

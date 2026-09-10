import fs from 'fs';
import path from 'path';
import { safeStorage } from 'electron';

/**
 * One JSON value, kept with the operating system's credential cipher.
 *
 * The file holds a single opaque base64 ciphertext and a version. On Windows
 * Electron delegates the cipher to DPAPI, macOS uses the Keychain, and Linux
 * uses the configured secret store. This is the arrangement `remoteAudioCredentials`
 * arrived at for LAN pairing material; the account and the entitlement each
 * needed the same thing, and three copies of the same sixty lines is three
 * places for the atomic write or the backend check to quietly diverge.
 *
 * Decrypted content is not trusted content. Every read goes through the guard
 * the caller supplies, so a file written by a different build — or edited by
 * hand — reads as absent rather than as a value with fields missing.
 */

interface IStoredEnvelope {
  encrypted: string;
  version: number;
}

export interface IEncryptedJsonStore<T> {
  /** Whether this platform can keep a value safely at all. */
  available(): boolean;
  clear(): void;
  read(): T | undefined;
  write(value: T): void;
}

/**
 * Linux's `basic_text` backend is refused.
 *
 * It is not encryption — it is a fixed key compiled into Chromium, so a file
 * written through it is plaintext to anybody who knows that. Where it is the
 * only backend available, callers offer nothing rather than a store that lies
 * about where the value went.
 */
export const secureEncryptionAvailable = (): boolean =>
  safeStorage.isEncryptionAvailable() &&
  (process.platform !== 'linux' ||
    safeStorage.getSelectedStorageBackend() !== 'basic_text');

export const createEncryptedJsonStore = <T>(
  userDataDir: string,
  fileName: string,
  guard: (value: unknown) => value is T,
  version = 1,
): IEncryptedJsonStore<T> => {
  const filePath = path.join(userDataDir, fileName);

  return {
    available: secureEncryptionAvailable,

    clear: () => {
      [filePath, `${filePath}.tmp`].forEach((target) => {
        try {
          fs.rmSync(target, { force: true });
        } catch {
          // A missing or locked file is equivalent to absent.
        }
      });
    },

    read: () => {
      try {
        if (!secureEncryptionAvailable()) {
          return undefined;
        }
        const stored = JSON.parse(
          fs.readFileSync(filePath, 'utf8'),
        ) as Partial<IStoredEnvelope>;
        if (
          stored.version !== version ||
          typeof stored.encrypted !== 'string'
        ) {
          return undefined;
        }
        const decrypted: unknown = JSON.parse(
          safeStorage.decryptString(Buffer.from(stored.encrypted, 'base64')),
        );
        return guard(decrypted) ? decrypted : undefined;
      } catch {
        // Unreadable, undecryptable, or not ours. Absent is the safe reading
        // of all three.
        return undefined;
      }
    },

    write: (value) => {
      if (!secureEncryptionAvailable()) {
        throw new Error('Secure credential storage is unavailable.');
      }
      const stored: IStoredEnvelope = {
        encrypted: safeStorage
          .encryptString(JSON.stringify(value))
          .toString('base64'),
        version,
      };
      // Written beside the target and renamed over it, so a crash mid-write
      // leaves the previous value intact rather than half of the new one.
      const temporaryPath = `${filePath}.tmp`;
      fs.mkdirSync(userDataDir, { recursive: true });
      try {
        fs.writeFileSync(temporaryPath, JSON.stringify(stored), {
          encoding: 'utf8',
          mode: 0o600,
        });
        fs.renameSync(temporaryPath, filePath);
      } catch (error) {
        try {
          fs.rmSync(temporaryPath, { force: true });
        } catch {
          // Preserve the original persistence error if cleanup also fails.
        }
        throw error;
      }
    },
  };
};

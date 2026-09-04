/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License version 3 or later.
*/

import fs from 'fs';
import path from 'path';
import { safeStorage } from 'electron';
import type { TLanSavedRole } from '../common/remoteAudio';

const FILE_NAME = 'remote-audio-lan.json';

export type TLanCredentials =
  | { role: 'listener'; port: number; secret: string }
  | { role: 'sender'; code: string };

interface IStoredCredentials {
  encrypted: string;
  version: 1;
}

export interface IRemoteAudioCredentialStore {
  clear(): void;
  read(): TLanCredentials | undefined;
  role(): TLanSavedRole | undefined;
  write(credentials: TLanCredentials): void;
}

const isCredentials = (value: unknown): value is TLanCredentials => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const candidate = value as Partial<TLanCredentials> & {
    code?: unknown;
    port?: unknown;
    secret?: unknown;
  };
  if (candidate.role === 'sender') {
    return (
      typeof candidate.code === 'string' &&
      candidate.code.startsWith('FLUIDEQ-LAN-2.') &&
      candidate.code.length <= 1_024
    );
  }
  return (
    candidate.role === 'listener' &&
    Number.isInteger(candidate.port) &&
    (candidate.port as number) >= 1 &&
    (candidate.port as number) <= 65_535 &&
    typeof candidate.secret === 'string' &&
    candidate.secret.length >= 40 &&
    candidate.secret.length <= 64
  );
};

const secureEncryptionAvailable = (): boolean =>
  safeStorage.isEncryptionAvailable() &&
  (process.platform !== 'linux' ||
    safeStorage.getSelectedStorageBackend() !== 'basic_text');

/**
 * Store LAN pairing material with the operating system's credential cipher.
 *
 * The JSON file contains one opaque base64 ciphertext. The pairing secret and
 * code never reach disk in plaintext; on Windows Electron delegates this to
 * DPAPI, while macOS uses Keychain and Linux uses the configured secret store.
 */
export const createRemoteAudioCredentialStore = (
  userDataDir: string,
): IRemoteAudioCredentialStore => {
  const filePath = path.join(userDataDir, FILE_NAME);

  const read = (): TLanCredentials | undefined => {
    try {
      if (!secureEncryptionAvailable()) {
        return undefined;
      }
      const stored = JSON.parse(
        fs.readFileSync(filePath, 'utf8'),
      ) as Partial<IStoredCredentials>;
      if (stored.version !== 1 || typeof stored.encrypted !== 'string') {
        return undefined;
      }
      const clear = safeStorage.decryptString(
        Buffer.from(stored.encrypted, 'base64'),
      );
      const credentials: unknown = JSON.parse(clear);
      return isCredentials(credentials) ? credentials : undefined;
    } catch {
      return undefined;
    }
  };

  return {
    clear: () => {
      try {
        fs.rmSync(filePath, { force: true });
      } catch {
        // A missing or already-locked preferences file is equivalent to clear.
      }
    },
    read,
    role: () => read()?.role,
    write: (credentials) => {
      if (!secureEncryptionAvailable()) {
        throw new Error('Secure credential storage is unavailable.');
      }
      const encrypted = safeStorage
        .encryptString(JSON.stringify(credentials))
        .toString('base64');
      const stored: IStoredCredentials = { encrypted, version: 1 };
      fs.mkdirSync(userDataDir, { recursive: true });
      fs.writeFileSync(filePath, JSON.stringify(stored), {
        encoding: 'utf8',
        mode: 0o600,
      });
    },
  };
};

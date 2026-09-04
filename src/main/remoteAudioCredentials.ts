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
export type TLanListenerCredentials = Extract<
  TLanCredentials,
  { role: 'listener' }
>;
export type TLanSenderCredentials = Extract<
  TLanCredentials,
  { role: 'sender' }
>;

interface ICredentialState {
  activeRole: TLanSavedRole;
  listener?: TLanListenerCredentials;
  sender?: TLanSenderCredentials;
}

interface IStoredCredentials {
  encrypted: string;
  version: 1 | 2;
}

export interface IRemoteAudioCredentialStore {
  activate(role: TLanSavedRole): boolean;
  clear(): void;
  read(): TLanCredentials | undefined;
  readListener(): TLanListenerCredentials | undefined;
  readSender(): TLanSenderCredentials | undefined;
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

const isCredentialState = (value: unknown): value is ICredentialState => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const candidate = value as Partial<ICredentialState>;
  const listenerValid =
    candidate.listener === undefined ||
    (candidate.listener.role === 'listener' &&
      isCredentials(candidate.listener));
  const senderValid =
    candidate.sender === undefined ||
    (candidate.sender.role === 'sender' && isCredentials(candidate.sender));
  const activeValid =
    (candidate.activeRole === 'listener' &&
      candidate.listener?.role === 'listener') ||
    (candidate.activeRole === 'sender' && candidate.sender?.role === 'sender');
  return listenerValid && senderValid && activeValid;
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

  const readState = (): ICredentialState | undefined => {
    try {
      if (!secureEncryptionAvailable()) {
        return undefined;
      }
      const stored = JSON.parse(
        fs.readFileSync(filePath, 'utf8'),
      ) as Partial<IStoredCredentials>;
      if (
        (stored.version !== 1 && stored.version !== 2) ||
        typeof stored.encrypted !== 'string'
      ) {
        return undefined;
      }
      const clear = safeStorage.decryptString(
        Buffer.from(stored.encrypted, 'base64'),
      );
      const decrypted: unknown = JSON.parse(clear);
      if (stored.version === 2) {
        return isCredentialState(decrypted) ? decrypted : undefined;
      }
      if (!isCredentials(decrypted)) {
        return undefined;
      }
      return decrypted.role === 'listener'
        ? { activeRole: 'listener', listener: decrypted }
        : { activeRole: 'sender', sender: decrypted };
    } catch {
      return undefined;
    }
  };

  const persist = (state: ICredentialState) => {
    if (!secureEncryptionAvailable()) {
      throw new Error('Secure credential storage is unavailable.');
    }
    const encrypted = safeStorage
      .encryptString(JSON.stringify(state))
      .toString('base64');
    const stored: IStoredCredentials = { encrypted, version: 2 };
    fs.mkdirSync(userDataDir, { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(stored), {
      encoding: 'utf8',
      mode: 0o600,
    });
  };

  const read = (): TLanCredentials | undefined => {
    const state = readState();
    return state?.activeRole === 'listener' ? state.listener : state?.sender;
  };

  return {
    activate: (role) => {
      const state = readState();
      if (!state || !state[role]) {
        return false;
      }
      persist({ ...state, activeRole: role });
      return true;
    },
    clear: () => {
      try {
        fs.rmSync(filePath, { force: true });
      } catch {
        // A missing or already-locked preferences file is equivalent to clear.
      }
    },
    read,
    readListener: () => readState()?.listener,
    readSender: () => readState()?.sender,
    role: () => read()?.role,
    write: (credentials) => {
      const state = readState();
      persist(
        credentials.role === 'listener'
          ? { ...state, activeRole: 'listener', listener: credentials }
          : { ...state, activeRole: 'sender', sender: credentials },
      );
    },
  };
};

/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License version 3 or later.
*/

import fs from 'fs';
import path from 'path';
import { safeStorage } from 'electron';
import {
  isAudioGroupLink,
  type IAudioGroupLink,
} from '../common/remoteAudioGroup';

const FILE_NAME = 'remote-audio-lan.json';
const CODE_PREFIX = 'FLUIDEQ-LAN-2.';
/** As many computers as anybody links; the list is bounded all the same. */
const MAX_JOINS = 32;
const MAX_REVOKED = 64;

export interface ILanIdentity {
  port: number;
  secret: string;
}

/**
 * What Share Audio keeps between launches: this computer's own code (its
 * identity, the same for every computer it links with), the codes pasted
 * here (each one a computer this one goes back to), and the computers
 * unlinked here, which are refused if they come back on their own.
 */
export interface ILanState {
  identity?: ILanIdentity;
  joins: string[];
  revoked: string[];
  groupLinks?: IAudioGroupLink[];
}

interface IStoredCredentials {
  encrypted: string;
  version: 1 | 2 | 3 | 4;
}

export interface IRemoteAudioCredentialStore {
  read(): ILanState;
  writeIdentity(identity: ILanIdentity): void;
  /** Adds a pasted code, replacing one for the same computer. */
  addJoin(code: string, sameComputer: (saved: string) => boolean): void;
  removeJoin(matches: (saved: string) => boolean): void;
  saveGroupLink(link: IAudioGroupLink): void;
  removeGroupLink(computerId: string): void;
  revoke(computerId: string): void;
  unrevoke(computerId: string): void;
  clear(): void;
}

const isCode = (value: unknown): value is string =>
  typeof value === 'string' &&
  value.startsWith(CODE_PREFIX) &&
  value.length <= 1_024;

const isIdentity = (value: unknown): value is ILanIdentity => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const { port, secret } = value as Partial<ILanIdentity>;
  return (
    typeof port === 'number' &&
    Number.isInteger(port) &&
    port >= 1 &&
    port <= 65_535 &&
    typeof secret === 'string' &&
    secret.length >= 40 &&
    secret.length <= 64
  );
};

const record = (value: unknown): Record<string, unknown> | undefined =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;

/**
 * Every version this file has had, read into today's shape. Before all to
 * all a computer held one listener identity and at most one code it had
 * pasted; both carry over, so an upgrade keeps every link it had.
 */
export const readStoredState = (
  version: number,
  decrypted: unknown,
): ILanState | undefined => {
  const value = record(decrypted);
  if (!value) {
    return undefined;
  }
  if (version === 4) {
    const joins = Array.isArray(value.joins) ? value.joins.filter(isCode) : [];
    const revoked = Array.isArray(value.revoked)
      ? value.revoked.filter(
          (id): id is string => typeof id === 'string' && id.length <= 64,
        )
      : [];
    return {
      ...(isIdentity(value.identity) ? { identity: value.identity } : {}),
      joins: joins.slice(0, MAX_JOINS),
      revoked: revoked.slice(0, MAX_REVOKED),
      ...(Array.isArray(value.groupLinks)
        ? {
            groupLinks: value.groupLinks
              .filter(isAudioGroupLink)
              .slice(0, MAX_JOINS),
          }
        : {}),
    };
  }
  if (version === 1) {
    if (value.role === 'listener' && isIdentity(value)) {
      return {
        identity: { port: value.port, secret: value.secret },
        joins: [],
        revoked: [],
      };
    }
    return value.role === 'sender' && isCode(value.code)
      ? { joins: [value.code], revoked: [] }
      : undefined;
  }
  const listener = record(value.listener);
  const sender = record(value.sender);
  return {
    ...(listener && isIdentity(listener)
      ? { identity: { port: listener.port, secret: listener.secret } }
      : {}),
    joins: sender && isCode(sender.code) ? [sender.code] : [],
    revoked: [],
  };
};

const secureEncryptionAvailable = (): boolean =>
  safeStorage.isEncryptionAvailable() &&
  (process.platform !== 'linux' ||
    safeStorage.getSelectedStorageBackend() !== 'basic_text');

/**
 * Store LAN pairing material with the operating system's credential cipher.
 *
 * The JSON file contains one opaque base64 ciphertext. The pairing secrets
 * and codes never reach disk in plaintext; on Windows Electron delegates this
 * to DPAPI, while macOS uses Keychain and Linux uses the configured secret
 * store.
 */
export const createRemoteAudioCredentialStore = (
  userDataDir: string,
): IRemoteAudioCredentialStore => {
  const filePath = path.join(userDataDir, FILE_NAME);

  const read = (): ILanState => {
    const empty: ILanState = { joins: [], revoked: [] };
    let contents: string;
    try {
      contents = fs.readFileSync(filePath, 'utf8');
    } catch (error) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === 'ENOENT'
      ) {
        return empty;
      }
      throw new Error(
        'Saved Share Audio pairings could not be read; they have been preserved.',
      );
    }
    // A temporarily locked Keychain/keyring, unreadable file or newer schema
    // is not a new installation. Returning an empty state here let the next
    // write replace the existing identity and every paired computer.
    if (!secureEncryptionAvailable()) {
      throw new Error(
        'Secure credential storage is unavailable; saved Share Audio pairings have been preserved.',
      );
    }
    try {
      const stored = JSON.parse(contents) as Partial<IStoredCredentials>;
      if (
        typeof stored.version !== 'number' ||
        ![1, 2, 3, 4].includes(stored.version) ||
        typeof stored.encrypted !== 'string'
      ) {
        throw new Error('Unsupported saved pairing format.');
      }
      const clear = safeStorage.decryptString(
        Buffer.from(stored.encrypted, 'base64'),
      );
      const state = readStoredState(stored.version, JSON.parse(clear));
      if (!state) {
        throw new Error('Invalid saved pairing state.');
      }
      return state;
    } catch {
      // Do not include decryption/JSON errors: those can contain plaintext
      // pairing material. The original ciphertext remains untouched.
      throw new Error(
        'Saved Share Audio pairings could not be unlocked; they have been preserved.',
      );
    }
  };

  const persist = (state: ILanState) => {
    if (!secureEncryptionAvailable()) {
      throw new Error('Secure credential storage is unavailable.');
    }
    const encrypted = safeStorage
      .encryptString(JSON.stringify(state))
      .toString('base64');
    const stored: IStoredCredentials = { encrypted, version: 4 };
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
  };

  const update = (change: (state: ILanState) => ILanState) =>
    persist(change(read()));

  return {
    read,
    saveGroupLink: (link) =>
      update((state) => ({
        ...state,
        groupLinks: [
          ...(state.groupLinks ?? []).filter(
            (saved) => saved.computerId !== link.computerId,
          ),
          link,
        ].slice(-MAX_JOINS),
      })),
    removeGroupLink: (computerId) =>
      update((state) => ({
        ...state,
        groupLinks: (state.groupLinks ?? []).filter(
          (saved) => saved.computerId !== computerId,
        ),
      })),
    writeIdentity: (identity) => update((state) => ({ ...state, identity })),
    addJoin: (code, sameComputer) =>
      update((state) => ({
        ...state,
        joins: [
          ...state.joins.filter((saved) => !sameComputer(saved)),
          code,
        ].slice(-MAX_JOINS),
      })),
    removeJoin: (matches) =>
      update((state) => ({
        ...state,
        joins: state.joins.filter((saved) => !matches(saved)),
      })),
    revoke: (computerId) =>
      update((state) => ({
        ...state,
        revoked: [
          ...state.revoked.filter((id) => id !== computerId),
          computerId,
        ].slice(-MAX_REVOKED),
      })),
    unrevoke: (computerId) => {
      const state = read();
      if (state.revoked.includes(computerId)) {
        persist({
          ...state,
          revoked: state.revoked.filter((id) => id !== computerId),
        });
      }
    },
    clear: () => {
      [filePath, `${filePath}.tmp`].forEach((target) => {
        try {
          fs.rmSync(target, { force: true });
        } catch {
          // A missing or locked preferences file is equivalent to clear.
        }
      });
    },
  };
};

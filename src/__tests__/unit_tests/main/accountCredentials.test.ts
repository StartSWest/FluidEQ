/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later

@jest-environment node
*/

import fs from 'fs';
import os from 'os';
import path from 'path';

let mockEncryptionAvailable = true;
let mockBackend = 'gnome_libsecret';

jest.mock('electron', () => ({
  safeStorage: {
    isEncryptionAvailable: () => mockEncryptionAvailable,
    getSelectedStorageBackend: () => mockBackend,
    encryptString: (value: string) =>
      Buffer.from(value, 'utf8').map((byte) => (byte + 165) % 256),
    decryptString: (value: Buffer) =>
      Buffer.from(Buffer.from(value).map((byte) => (byte + 91) % 256)).toString(
        'utf8',
      ),
  },
}));

// eslint-disable-next-line import/first
import { createAccountCredentialStore } from '../../../main/accountCredentials';

const RECORD = {
  refreshToken: 'a-refresh-token-worth-money'.repeat(2),
  identity: { id: 'user-1', email: 'someone@example.com', name: 'Someone' },
};

describe('the stored account session', () => {
  let directory: string;

  beforeEach(() => {
    mockEncryptionAvailable = true;
    mockBackend = 'gnome_libsecret';
    directory = fs.mkdtempSync(path.join(os.tmpdir(), 'fluideq-account-'));
  });

  afterEach(() => {
    fs.rmSync(directory, { force: true, recursive: true });
  });

  const filePath = () => path.join(directory, 'account.json');

  it('round-trips without writing the refresh token in plaintext', () => {
    const store = createAccountCredentialStore(directory);
    store.write(RECORD);

    expect(fs.readFileSync(filePath(), 'utf8')).not.toContain(
      RECORD.refreshToken,
    );
    expect(store.read()).toEqual(RECORD);
  });

  it('leaves no temporary file behind', () => {
    const store = createAccountCredentialStore(directory);
    store.write(RECORD);
    expect(fs.existsSync(`${filePath()}.tmp`)).toBe(false);
  });

  it('forgets everything on clear', () => {
    const store = createAccountCredentialStore(directory);
    store.write(RECORD);
    store.clear();
    expect(store.read()).toBeUndefined();
    expect(fs.existsSync(filePath())).toBe(false);
  });

  it('reads nothing when there was never anything', () => {
    expect(createAccountCredentialStore(directory).read()).toBeUndefined();
  });

  /**
   * `basic_text` is not encryption — it is a fixed key compiled into Chromium,
   * so a file written through it is plaintext to anybody who knows that. A
   * credential that reaches somebody's Google account is not going in it.
   */
  it('refuses to run on the Linux plaintext backend', () => {
    const realPlatform = process.platform;
    Object.defineProperty(process, 'platform', { value: 'linux' });
    mockBackend = 'basic_text';
    try {
      const store = createAccountCredentialStore(directory);
      expect(store.available()).toBe(false);
      expect(() => store.write(RECORD)).toThrow();
      expect(store.read()).toBeUndefined();
    } finally {
      Object.defineProperty(process, 'platform', { value: realPlatform });
    }
  });

  it('refuses to run where the platform offers no cipher at all', () => {
    mockEncryptionAvailable = false;
    const store = createAccountCredentialStore(directory);
    expect(store.available()).toBe(false);
    expect(() => store.write(RECORD)).toThrow();
  });

  it.each([
    ['not JSON at all', 'this is not json'],
    ['the wrong version', '{"encrypted":"AAAA","version":9}'],
    ['no ciphertext', '{"version":1}'],
    ['an empty object', '{}'],
  ])('treats %s on disk as signed out', (_label, contents) => {
    fs.writeFileSync(filePath(), contents, 'utf8');
    expect(createAccountCredentialStore(directory).read()).toBeUndefined();
  });

  /**
   * Decrypted content is not trusted content. A file written by a different
   * build, or edited by hand, must read as signed out rather than as a session
   * with fields missing.
   */
  it.each([
    ['no identity', { refreshToken: 'token-that-is-long-enough' }],
    ['no refresh token', { identity: { id: 'user-1' } }],
    [
      'an identity with no id',
      { refreshToken: 'token-that-is-long-enough', identity: { name: 'x' } },
    ],
    [
      'a non-string email',
      {
        refreshToken: 'token-that-is-long-enough',
        identity: { id: 'user-1', email: 42 },
      },
    ],
    ['an empty refresh token', { refreshToken: '', identity: { id: 'u' } }],
  ])('treats a decrypted record with %s as signed out', (_label, record) => {
    const store = createAccountCredentialStore(directory);
    // Written through the same cipher the store uses, so this exercises the
    // shape guard rather than the decryption failing.
    store.write(RECORD);
    // `Buffer.prototype.map` answers a Uint8Array, so it is wrapped again
    // before asking for base64 — the same shape the mocked cipher produces.
    const encrypted = Buffer.from(
      Buffer.from(JSON.stringify(record), 'utf8').map(
        (byte) => (byte + 165) % 256,
      ),
    ).toString('base64');
    fs.writeFileSync(
      filePath(),
      JSON.stringify({ encrypted, version: 1 }),
      'utf8',
    );

    expect(createAccountCredentialStore(directory).read()).toBeUndefined();
  });

  it('keeps an identity that carries only an id', () => {
    const store = createAccountCredentialStore(directory);
    const minimal = { refreshToken: 'r'.repeat(30), identity: { id: 'u-1' } };
    store.write(minimal);
    expect(store.read()).toEqual(minimal);
  });
});

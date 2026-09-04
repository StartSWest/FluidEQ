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

jest.mock('electron', () => ({
  safeStorage: {
    isEncryptionAvailable: () => mockEncryptionAvailable,
    getSelectedStorageBackend: () => 'gnome_libsecret',
    encryptString: (value: string) =>
      Buffer.from(value, 'utf8').map((byte) => (byte + 165) % 256),
    decryptString: (value: Buffer) =>
      Buffer.from(Buffer.from(value).map((byte) => (byte + 91) % 256)).toString(
        'utf8',
      ),
  },
}));

// eslint-disable-next-line import/first
import { createRemoteAudioCredentialStore } from '../../../main/remoteAudioCredentials';

describe('secure LAN audio reconnect credentials', () => {
  let directory: string;

  beforeEach(() => {
    mockEncryptionAvailable = true;
    directory = fs.mkdtempSync(path.join(os.tmpdir(), 'fluideq-lan-audio-'));
  });

  afterEach(() => {
    fs.rmSync(directory, { force: true, recursive: true });
  });

  it('restores both roles without writing their secret in plaintext', () => {
    const store = createRemoteAudioCredentialStore(directory);
    const secret = 'private-pairing-secret'.repeat(2);
    store.write({ port: 49_100, role: 'listener', secret });

    const stored = fs.readFileSync(
      path.join(directory, 'remote-audio-lan.json'),
      'utf8',
    );
    expect(stored).not.toContain(secret);
    expect(store.role()).toBe('listener');
    expect(store.read()).toEqual({ port: 49_100, role: 'listener', secret });

    const code = `FLUIDEQ-LAN-2.${'a'.repeat(80)}`;
    store.write({ code, role: 'sender' });
    expect(store.role()).toBe('sender');
    expect(store.read()).toEqual({ code, role: 'sender' });
    expect(store.readListener()).toEqual({
      port: 49_100,
      role: 'listener',
      secret,
    });
    expect(store.readSender()).toEqual({ code, role: 'sender' });

    expect(store.activate('listener')).toBe(true);
    expect(store.role()).toBe('listener');
    expect(store.readSender()).toEqual({ code, role: 'sender' });
  });

  it('migrates a version-one sender without losing it', () => {
    const code = `FLUIDEQ-LAN-2.${'m'.repeat(80)}`;
    const encrypted = Buffer.from(
      Buffer.from(JSON.stringify({ code, role: 'sender' }), 'utf8').map(
        (byte) => (byte + 165) % 256,
      ),
    ).toString('base64');
    fs.writeFileSync(
      path.join(directory, 'remote-audio-lan.json'),
      JSON.stringify({ encrypted, version: 1 }),
    );
    const store = createRemoteAudioCredentialStore(directory);

    expect(store.readSender()).toEqual({ code, role: 'sender' });
    store.write({ port: 49_100, role: 'listener', secret: 's'.repeat(43) });
    expect(store.readSender()).toEqual({ code, role: 'sender' });
  });

  it('forgets a saved session only when explicitly cleared', () => {
    const store = createRemoteAudioCredentialStore(directory);
    store.write({
      code: `FLUIDEQ-LAN-2.${'b'.repeat(80)}`,
      role: 'sender',
    });
    store.clear();

    expect(store.read()).toBeUndefined();
    expect(fs.existsSync(path.join(directory, 'remote-audio-lan.json'))).toBe(
      false,
    );
  });

  it('refuses to persist pairing material without OS encryption', () => {
    mockEncryptionAvailable = false;
    const store = createRemoteAudioCredentialStore(directory);

    expect(store.read()).toBeUndefined();
    expect(() =>
      store.write({ port: 49_100, role: 'listener', secret: 'x'.repeat(43) }),
    ).toThrow('Secure credential storage is unavailable.');
  });
});

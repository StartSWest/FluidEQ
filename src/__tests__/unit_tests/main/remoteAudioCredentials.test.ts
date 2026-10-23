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

const writeStored = (directory: string, version: number, state: unknown) => {
  const encrypted = Buffer.from(
    Buffer.from(JSON.stringify(state), 'utf8').map(
      (byte) => (byte + 165) % 256,
    ),
  ).toString('base64');
  fs.writeFileSync(
    path.join(directory, 'remote-audio-lan.json'),
    JSON.stringify({ encrypted, version }),
  );
};

describe('secure LAN audio reconnect credentials', () => {
  let directory: string;
  const identity = { port: 49_100, secret: 's'.repeat(43) };
  const codeA = `FLUIDEQ-LAN-2.${'a'.repeat(80)}`;
  const codeB = `FLUIDEQ-LAN-2.${'b'.repeat(80)}`;

  beforeEach(() => {
    mockEncryptionAvailable = true;
    directory = fs.mkdtempSync(path.join(os.tmpdir(), 'fluideq-lan-audio-'));
  });

  afterEach(() => {
    fs.rmSync(directory, { force: true, recursive: true });
  });

  it('keeps this computer’s code and every pasted one, none in plaintext', () => {
    const store = createRemoteAudioCredentialStore(directory);
    store.writeIdentity(identity);
    store.addJoin(codeA, () => false);
    store.addJoin(codeB, () => false);

    const stored = fs.readFileSync(
      path.join(directory, 'remote-audio-lan.json'),
      'utf8',
    );
    expect(stored).not.toContain(identity.secret);
    expect(stored).not.toContain(codeA);
    expect(createRemoteAudioCredentialStore(directory).read()).toEqual({
      identity,
      joins: [codeA, codeB],
      revoked: [],
    });
    expect(
      fs.existsSync(path.join(directory, 'remote-audio-lan.json.tmp')),
    ).toBe(false);
  });

  it('replaces a code for the same computer and forgets one without the rest', () => {
    const store = createRemoteAudioCredentialStore(directory);
    store.addJoin(codeA, () => false);
    store.addJoin(codeB, () => false);
    const newerA = `${codeA}x`;
    store.addJoin(newerA, (saved) => saved === codeA);
    expect(store.read().joins).toEqual([codeB, newerA]);

    store.removeJoin((saved) => saved === codeB);
    expect(store.read().joins).toEqual([newerA]);
  });

  it('remembers an unlinked computer until it is let back in', () => {
    const store = createRemoteAudioCredentialStore(directory);
    store.revoke('computer-1');
    store.revoke('computer-2');
    expect(store.read().revoked).toEqual(['computer-1', 'computer-2']);

    store.unrevoke('computer-1');
    expect(store.read().revoked).toEqual(['computer-2']);
  });

  it('carries a 2.x listener and its pasted code over, so an upgrade keeps both links', () => {
    writeStored(directory, 3, {
      activeRole: 'sender',
      listener: { role: 'listener', ...identity },
      sender: { role: 'sender', code: codeA },
    });

    expect(createRemoteAudioCredentialStore(directory).read()).toEqual({
      identity,
      joins: [codeA],
      revoked: [],
    });
  });

  it('migrates a version-one sender without losing it', () => {
    writeStored(directory, 1, { code: codeA, role: 'sender' });
    const store = createRemoteAudioCredentialStore(directory);

    expect(store.read().joins).toEqual([codeA]);
    store.writeIdentity(identity);
    expect(store.read()).toEqual({ identity, joins: [codeA], revoked: [] });
  });

  it('forgets everything only when explicitly cleared', () => {
    const store = createRemoteAudioCredentialStore(directory);
    store.addJoin(codeA, () => false);
    fs.writeFileSync(path.join(directory, 'remote-audio-lan.json.tmp'), 'old');
    store.clear();

    expect(store.read()).toEqual({ joins: [], revoked: [] });
    expect(fs.existsSync(path.join(directory, 'remote-audio-lan.json'))).toBe(
      false,
    );
    expect(
      fs.existsSync(path.join(directory, 'remote-audio-lan.json.tmp')),
    ).toBe(false);
  });

  it('refuses to persist pairing material without OS encryption', () => {
    mockEncryptionAvailable = false;
    const store = createRemoteAudioCredentialStore(directory);

    expect(store.read()).toEqual({ joins: [], revoked: [] });
    expect(() => store.writeIdentity(identity)).toThrow(
      'Secure credential storage is unavailable.',
    );
  });
});

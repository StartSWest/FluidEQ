/** @jest-environment node */
/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * A Mac release's feed is signed on the Mac, from the login Keychain, and the
 * signature it writes is one the Mac updater's own reader accepts. Each
 * refusal sits beside the signing that works.
 */

import { generateKeyPairSync } from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { parseMacFeed } from '../../../main/macSelfUpdate';
import { verifyUpdateFeedSignature } from '../../../main/updateFeedSignature';
import {
  createMacFeedKey,
  importMacFeedKey,
  readMacFeedKey,
  type IMacKeychain,
} from '../../../../.erb/scripts/mac-feed-key';
import { signMacFeed } from '../../../../.erb/scripts/sign-mac-feed';

const pair = () => {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  return {
    publicKey: publicKey
      .export({ format: 'der', type: 'spki' })
      .toString('base64'),
    privateKey: privateKey
      .export({ format: 'der', type: 'pkcs8' })
      .toString('base64'),
  };
};

const trusted = pair();
const KEYS = { 'test-key': trusted.publicKey };

const memoryKeychain = (
  secret?: string,
): IMacKeychain & { secret?: string } => {
  const keychain: IMacKeychain & { secret?: string } = {
    secret,
    write: (value) => {
      keychain.secret = value;
    },
    read: () => keychain.secret,
  };
  return keychain;
};

const FEED = [
  'version: 2.3.0',
  'files:',
  '  - url: FluidEQ-2.3.0-arm64-mac.zip',
  '    sha512: zipsha',
  '    size: 10',
  '  - url: FluidEQ-2.3.0-arm64.dmg',
  '    sha512: dmgsha',
  '    size: 9',
  'path: FluidEQ-2.3.0-arm64-mac.zip',
  'sha512: zipsha',
  '',
].join('\n');

let feedPath: string;
beforeEach(() => {
  feedPath = path.join(
    fs.mkdtempSync(path.join(os.tmpdir(), 'mac-feed-')),
    'latest-mac.yml',
  );
  fs.writeFileSync(feedPath, FEED);
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
  jest.spyOn(console, 'log').mockImplementation(() => undefined);
});
afterEach(() => jest.restoreAllMocks());

it('signs latest-mac.yml so the Mac updater trusts it', () => {
  const keychain = memoryKeychain(`test-key:${trusted.privateKey}`);
  expect(signMacFeed({ feedPath, keychain, keys: KEYS })).toBe(true);
  const info = parseMacFeed(fs.readFileSync(feedPath, 'utf8'));
  expect(verifyUpdateFeedSignature(info, KEYS)).toEqual({ valid: true });
});

it('leaves the feed unsigned, and fails, with no key on this Mac', () => {
  expect(
    signMacFeed({ feedPath, keychain: memoryKeychain(), keys: KEYS }),
  ).toBe(false);
  expect(
    verifyUpdateFeedSignature(
      parseMacFeed(fs.readFileSync(feedPath, 'utf8')),
      KEYS,
    ).valid,
  ).toBe(false);
});

it('refuses to sign with a key the app does not trust', () => {
  const stranger = pair();
  const keychain = memoryKeychain(`test-key:${stranger.privateKey}`);
  expect(signMacFeed({ feedPath, keychain, keys: KEYS })).toBe(false);
  expect(fs.readFileSync(feedPath, 'utf8')).toBe(FEED);
});

it('reads back what it stored, as key id and key', () => {
  const keychain = memoryKeychain();
  keychain.write(`test-key:${trusted.privateKey}`);
  expect(readMacFeedKey(keychain)).toEqual({
    keyId: 'test-key',
    privateKey: trusted.privateKey,
  });
  expect(readMacFeedKey(memoryKeychain('no colon here'))).toBeUndefined();
});

it('stores nothing from a clipboard that holds no trusted key', () => {
  const keychain = memoryKeychain();
  expect(() => importMacFeedKey('not a key', keychain)).toThrow(
    'does not hold one update feed key',
  );
  expect(() => importMacFeedKey(pair().privateKey, keychain)).toThrow(
    'not one this app trusts',
  );
  expect(keychain.secret).toBeUndefined();
});

describe('making the Mac’s own key', () => {
  const MARKER = '  // mac-feed-key: new keys go above this line';
  const keysFile = () => {
    const file = path.join(path.dirname(feedPath), 'macFeedKeys.ts');
    fs.writeFileSync(
      file,
      `export const MAC_OWN_FEED_KEYS = {\n${MARKER}\n};\n`,
    );
    return file;
  };

  it('keeps the private half in the Keychain and pins the public half, and they sign a feed the updater trusts', () => {
    const keychain = memoryKeychain();
    const file = keysFile();
    const keyId = createMacFeedKey({
      keychain,
      keysFile: file,
      today: new Date('2026-10-30T00:00:00Z'),
    });

    expect(keyId).toBe('fluideq-mac-feed-2026-10-30');
    const pinned = new RegExp(`'${keyId}':\\s*'([A-Za-z0-9+/=]+)'`).exec(
      fs.readFileSync(file, 'utf8'),
    );
    expect(pinned).not.toBeNull();
    expect(fs.readFileSync(file, 'utf8')).toContain(MARKER);
    const keys = { [keyId]: pinned?.[1] ?? '' };
    expect(signMacFeed({ feedPath, keychain, keys })).toBe(true);
    expect(
      verifyUpdateFeedSignature(
        parseMacFeed(fs.readFileSync(feedPath, 'utf8')),
        keys,
      ),
    ).toEqual({ valid: true });
  });

  it('refuses to make a second key on a Mac that holds one', () => {
    const file = keysFile();
    const before = fs.readFileSync(file, 'utf8');
    expect(() =>
      createMacFeedKey({
        keychain: memoryKeychain(`test-key:${trusted.privateKey}`),
        keysFile: file,
      }),
    ).toThrow('already holds');
    expect(fs.readFileSync(file, 'utf8')).toBe(before);
  });
});

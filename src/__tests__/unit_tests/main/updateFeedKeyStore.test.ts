/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later

@jest-environment node
*/

import fs from 'fs';
import os from 'os';
import path from 'path';
import { generateKeyPairSync } from 'crypto';
import {
  envHoldsFeedKey,
  signReleaseFeed,
} from '../../../../.erb/scripts/sign-update-feed';
import {
  CLIPBOARD_PREFIX,
  importPastedKey,
  readPastedKey,
  signsForTrustedKey,
  trustedKeyIdOf,
} from '../../../../.erb/scripts/update-feed-key';
import {
  createFeedKeyStore,
  type IFeedKeyCipher,
} from '../../../../.erb/scripts/update-feed-key-store';

/** Stands in for DPAPI: reversible, and never the plain text. */
const cipher: IFeedKeyCipher = {
  protect: (plain) => Buffer.from(plain).reverse().toString('base64'),
  unprotect: (sealed) =>
    Buffer.from(Buffer.from(sealed, 'base64').reverse()).toString('utf8'),
};

const makePair = () => {
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

describe('the update feed key, kept out of the project', () => {
  let dir: string;
  let filePath: string;
  const pair = makePair();
  const trusted = { 'fluideq-feed-test': pair.publicKey };

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'feed-key-'));
    filePath = path.join(dir, 'update-feed-key.json');
  });
  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('keeps the key sealed on disk and reads it back', () => {
    const store = createFeedKeyStore({ filePath, cipher });
    expect(store.read()).toBeUndefined();
    store.write({ keyId: 'fluideq-feed-test', privateKey: pair.privateKey });
    expect(fs.readFileSync(filePath, 'utf8')).not.toContain(pair.privateKey);
    expect(store.read()).toEqual({
      keyId: 'fluideq-feed-test',
      privateKey: pair.privateKey,
    });
  });

  it('refuses a write that does not read back as written', () => {
    const lossy: IFeedKeyCipher = {
      ...cipher,
      unprotect: () => 'something else',
    };
    expect(() =>
      createFeedKeyStore({ filePath, cipher: lossy }).write({
        keyId: 'fluideq-feed-test',
        privateKey: pair.privateKey,
      }),
    ).toThrow(/did not read back/);
  });

  it('finds the key in what was pasted, and nothing in anything else', () => {
    expect(
      readPastedKey(`${CLIPBOARD_PREFIX} fluideq-feed-test ${pair.privateKey}`),
    ).toBe(pair.privateKey);
    expect(
      readPastedKey(
        `FLUIDEQ_UPDATE_FEED_KEY_ID=fluideq-feed-test\r\nFLUIDEQ_UPDATE_FEED_KEY=${pair.privateKey}`,
      ),
    ).toBe(pair.privateKey);
    expect(readPastedKey(`  ${pair.privateKey}\n`)).toBe(pair.privateKey);
    expect(readPastedKey('hello')).toBeUndefined();
    expect(
      readPastedKey(`${pair.privateKey}\n${makePair().privateKey}`),
    ).toBeUndefined();
  });

  it('brings in only a key the app trusts, and never replaces a different one', () => {
    const store = createFeedKeyStore({ filePath, cipher });
    expect(trustedKeyIdOf(pair.privateKey, trusted)).toBe('fluideq-feed-test');
    expect(
      importPastedKey(makePair().privateKey, store, trusted),
    ).toMatchObject({ ok: false });
    expect(store.exists()).toBe(false);

    expect(importPastedKey(pair.privateKey, store, trusted)).toEqual({
      ok: true,
      keyId: 'fluideq-feed-test',
    });
    const read = store.read();
    expect(read && signsForTrustedKey(read, trusted)).toBe(true);

    const other = makePair();
    expect(
      importPastedKey(other.privateKey, store, {
        ...trusted,
        'fluideq-feed-other': other.publicKey,
      }),
    ).toMatchObject({ ok: false });
    expect(store.read()?.privateKey).toBe(pair.privateKey);
  });

  describe('signing a release', () => {
    const feed = [
      'version: 1.7.0',
      'files:',
      '  - url: FluidEQ-Setup-1.7.0.exe',
      '    sha512: AAAA',
      'sha512: AAAA',
      '',
    ].join('\n');
    let feedPath: string;
    let envPath: string;
    beforeEach(() => {
      feedPath = path.join(dir, 'latest.yml');
      envPath = path.join(dir, '.env');
      fs.writeFileSync(feedPath, feed);
      fs.writeFileSync(envPath, 'FLUIDEQ_SUPABASE_URL=https://x\n');
      jest.spyOn(console, 'error').mockImplementation(() => {});
      jest.spyOn(console, 'log').mockImplementation(() => {});
    });
    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('signs with the sealed key', () => {
      const store = createFeedKeyStore({ filePath, cipher });
      store.write({ keyId: 'fluideq-feed-test', privateKey: pair.privateKey });
      expect(signReleaseFeed({ feedPath, store, envPath, keys: trusted })).toBe(
        true,
      );
      expect(fs.readFileSync(feedPath, 'utf8')).toContain(
        'fluideqFeedKeyId: fluideq-feed-test',
      );
    });

    // The mistake this closes: the key in `.env`, in plain text, wherever the
    // project folder goes.
    it('refuses to sign while .env holds the key in plain text', () => {
      const store = createFeedKeyStore({ filePath, cipher });
      store.write({ keyId: 'fluideq-feed-test', privateKey: pair.privateKey });
      fs.appendFileSync(
        envPath,
        `FLUIDEQ_UPDATE_FEED_KEY=${pair.privateKey}\n`,
      );
      expect(envHoldsFeedKey(fs.readFileSync(envPath, 'utf8'))).toBe(true);
      expect(envHoldsFeedKey('FLUIDEQ_UPDATE_FEED_KEY_ID=x\n')).toBe(false);
      expect(signReleaseFeed({ feedPath, store, envPath, keys: trusted })).toBe(
        false,
      );
      expect(fs.readFileSync(feedPath, 'utf8')).toBe(feed);
    });

    it('refuses to call a release finished without a trusted key', () => {
      const previousCi = process.env.CI;
      delete process.env.CI;
      try {
        const empty = createFeedKeyStore({ filePath, cipher });
        expect(
          signReleaseFeed({ feedPath, store: empty, envPath, keys: trusted }),
        ).toBe(false);
        empty.write({
          keyId: 'fluideq-feed-other',
          privateKey: pair.privateKey,
        });
        expect(
          signReleaseFeed({ feedPath, store: empty, envPath, keys: trusted }),
        ).toBe(false);
      } finally {
        if (previousCi !== undefined) {
          process.env.CI = previousCi;
        }
      }
    });
  });
});

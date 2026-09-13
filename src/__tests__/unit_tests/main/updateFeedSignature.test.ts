/** @jest-environment node */
/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The update feed's signature, from both ends: what the package script
 * appends to `latest.yml`, and what the app accepts as electron-updater hands
 * that file over. A release signed by the maker's key installs; the same
 * feed with another installer's SHA-512, another version, another key or no
 * signature does not — and a build that trusts no key yet accepts what it
 * always did, so no installed copy is stranded.
 */

import { generateKeyPairSync } from 'crypto';
import {
  FEED_KEY_FIELD,
  FEED_SIGNATURE_FIELD,
  verifyUpdateFeedSignature,
} from '../../../main/updateFeedSignature';
import { readFeed, signFeed } from '../../../../.erb/scripts/sign-update-feed';

const pair = () => {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  return {
    publicBase64: publicKey
      .export({ format: 'der', type: 'spki' })
      .toString('base64'),
    privateBase64: privateKey
      .export({ format: 'der', type: 'pkcs8' })
      .toString('base64'),
  };
};

const SHA = 'n1CRZx5QbYs1rJ0k0PwNfEQnJ7G1c3tq5m4Q8pZ9f2yX0bLkW7Ue5hT3r6Vd8Ai==';
const FEED = `version: 2.4.0
files:
  - url: FluidEQ-Setup-2.4.0.exe
    sha512: ${SHA}
    size: 104857600
path: FluidEQ-Setup-2.4.0.exe
sha512: ${SHA}
releaseDate: '2026-09-13T20:00:00.000Z'
`;

/** latest.yml as electron-updater parses it, for the fields read here. */
const parsed = (yaml: string) => {
  const line = (key: string) =>
    yaml.match(new RegExp(`^${key}: (.+)$`, 'm'))?.[1];
  const { version, sha512s } = readFeed(yaml);
  return {
    version,
    files: [{ url: 'FluidEQ-Setup-2.4.0.exe', sha512: sha512s[0] }],
    sha512: sha512s[1],
    [FEED_KEY_FIELD]: line(FEED_KEY_FIELD),
    [FEED_SIGNATURE_FIELD]: line(FEED_SIGNATURE_FIELD),
  };
};

describe('the update feed signature', () => {
  const maker = pair();
  const keys = { 'fluideq-feed-test': maker.publicBase64 };
  const signed = signFeed(FEED, 'fluideq-feed-test', maker.privateBase64);

  it('accepts a feed signed by the maker, and keeps what electron-builder wrote', () => {
    expect(verifyUpdateFeedSignature(parsed(signed), keys)).toEqual({
      valid: true,
    });
    expect(signed.startsWith(FEED)).toBe(true);
    // Signing again replaces the signature rather than adding a second one.
    const twice = signFeed(signed, 'fluideq-feed-test', maker.privateBase64);
    expect(twice.split(`${FEED_SIGNATURE_FIELD}:`)).toHaveLength(2);
  });

  it('refuses the same signature over another installer or another version', () => {
    const otherInstaller = { ...parsed(signed), sha512: 'b'.repeat(88) };
    expect(verifyUpdateFeedSignature(otherInstaller, keys).valid).toBe(false);
    const otherVersion = { ...parsed(signed), version: '9.9.9' };
    expect(verifyUpdateFeedSignature(otherVersion, keys).valid).toBe(false);
  });

  it('refuses a feed signed with a key it does not trust, or not signed', () => {
    const stranger = pair();
    const forged = signFeed(FEED, 'fluideq-feed-test', stranger.privateBase64);
    expect(verifyUpdateFeedSignature(parsed(forged), keys).valid).toBe(false);
    const unknownId = signFeed(FEED, 'someone-else', stranger.privateBase64);
    expect(verifyUpdateFeedSignature(parsed(unknownId), keys)).toMatchObject({
      valid: false,
      reason: expect.stringContaining('unknown key'),
    });
    expect(verifyUpdateFeedSignature(parsed(FEED), keys)).toMatchObject({
      valid: false,
      reason: 'the update feed is not signed',
    });
  });

  it('accepts anything while the build trusts no key, as builds before it did', () => {
    expect(verifyUpdateFeedSignature(parsed(FEED), {})).toEqual({
      valid: true,
    });
  });
});

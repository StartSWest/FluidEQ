/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { createPublicKey, verify } from 'crypto';

/**
 * The update feed's own signature: what stands between a stolen GitHub
 * account and every FluidEQ on every machine.
 *
 * An unsigned build takes its updates from the public repository's releases,
 * and the only check on the installer was that Windows calls it unsigned —
 * which any installer anybody builds is. Whoever can publish a release there
 * (the account, a token with release rights, a compromised asset) could have
 * shipped their own code to everyone, installed unattended on a mandatory
 * update. electron-updater already refuses an installer whose SHA-512 is not
 * the one `latest.yml` names; this signs that file's version and SHA-512s
 * with a key that lives only on the maker's machine (`.env`), and refuses a
 * feed it does not verify.
 *
 * `UPDATE_FEED_KEYS` is empty until the maker generates the pair with
 * `pnpm update-feed-keys`, and a build with no key accepts what it accepted
 * before, so no installed copy is stranded. From the first build that carries
 * a key, every release must be signed: `sign-update-feed.ts` refuses to
 * finish a package that cannot sign its feed.
 */

/** Key id to its public key, SPKI DER in base64. Written by `pnpm update-feed-keys`. */
export const UPDATE_FEED_KEYS: Readonly<Record<string, string>> = {};

/** The fields `sign-update-feed.ts` adds to `latest.yml`. */
export const FEED_SIGNATURE_FIELD = 'fluideqFeedSignature';
export const FEED_KEY_FIELD = 'fluideqFeedKeyId';

/**
 * What is signed: the version, and every SHA-512 the feed names, sorted, so
 * the order electron-builder happens to write them in does not matter.
 */
export const updateFeedMessage = (
  version: string,
  sha512s: readonly string[],
): string =>
  ['fluideq-update-feed:1', version, ...[...new Set(sha512s)].sort()].join(
    '\n',
  );

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

/** Every SHA-512 an update's info names: its files', and its own. */
export const feedSha512s = (info: Record<string, unknown>): string[] => {
  const files = Array.isArray(info.files) ? info.files : [];
  return [
    ...files.map((file) =>
      isRecord(file) && typeof file.sha512 === 'string' ? file.sha512 : '',
    ),
    typeof info.sha512 === 'string' ? info.sha512 : '',
  ].filter(Boolean);
};

export interface IFeedVerification {
  valid: boolean;
  reason?: string;
}

/** Whether the update `info` electron-updater parsed from `latest.yml` is signed by a key this build trusts. */
export const verifyUpdateFeedSignature = (
  info: unknown,
  keys: Readonly<Record<string, string>> = UPDATE_FEED_KEYS,
): IFeedVerification => {
  if (Object.keys(keys).length === 0) {
    return { valid: true };
  }
  if (!isRecord(info) || typeof info.version !== 'string') {
    return { valid: false, reason: 'the update feed has no version' };
  }
  const keyId = info[FEED_KEY_FIELD];
  const signature = info[FEED_SIGNATURE_FIELD];
  if (typeof keyId !== 'string' || typeof signature !== 'string') {
    return { valid: false, reason: 'the update feed is not signed' };
  }
  const publicKey = Object.prototype.hasOwnProperty.call(keys, keyId)
    ? keys[keyId]
    : undefined;
  if (!publicKey) {
    return {
      valid: false,
      reason: `the update feed is signed by an unknown key "${keyId}"`,
    };
  }
  const sha512s = feedSha512s(info);
  if (sha512s.length === 0) {
    return { valid: false, reason: 'the update feed names no installer' };
  }
  try {
    const trusted = verify(
      null,
      Buffer.from(updateFeedMessage(info.version, sha512s)),
      createPublicKey({
        key: Buffer.from(publicKey, 'base64'),
        format: 'der',
        type: 'spki',
      }),
      Buffer.from(signature, 'base64'),
    );
    return trusted
      ? { valid: true }
      : { valid: false, reason: 'the update feed signature does not verify' };
  } catch (error) {
    return {
      valid: false,
      reason: `the update feed signature could not be checked: ${(error as Error).message}`,
    };
  }
};

/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import { createHash, randomBytes } from 'node:crypto';

/**
 * Proof Key for Code Exchange (RFC 7636): the secret that makes the code
 * Google's sign-in sends back worth nothing to anyone but this app.
 *
 * The code comes back to a port on this computer that any program here could
 * also be listening for, or could send a request to. The server only trades
 * it for a session when the same request carries the verifier, which never
 * leaves this process — the browser sees only its hash.
 */
export interface IPkcePair {
  /** 43 characters of the URL-safe alphabet, from 32 random bytes. */
  verifier: string;
  /** The verifier's SHA-256, URL-safe base64 without padding (S256). */
  challenge: string;
}

const base64Url = (bytes: Buffer) =>
  bytes
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

export const challengeOf = (verifier: string): string =>
  base64Url(createHash('sha256').update(verifier).digest());

export const createPkcePair = (): IPkcePair => {
  const verifier = base64Url(randomBytes(32));
  return { verifier, challenge: challengeOf(verifier) };
};

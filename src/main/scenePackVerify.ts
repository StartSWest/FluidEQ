import { createPublicKey, verify, type KeyObject } from 'crypto';
import type { IScenePackEnvelope } from '../common/scenePacks';

/**
 * Whether a pack was signed by us.
 *
 * Ed25519 through Node's own `crypto`: no dependency, sixty-four-byte
 * signatures, and a verify that costs tens of microseconds — cheap enough to
 * run on every read of the cache rather than only on download, which is what
 * makes the cache a convenience instead of a trust boundary.
 *
 * The public keys are compiled in. They are public by nature; the private half
 * lives in an environment variable beside the code-signing credentials and has
 * never been in either repository. Keyed by id so rotation is additive: a new
 * key is added here, packs are re-signed at leisure, and the old key comes out
 * only once nothing in the wild still carries its signature.
 */

/** SPKI DER, base64. */
const TRUSTED_PUBLIC_KEYS: Readonly<Record<string, string>> = {
  'fluideq-2026-09':
    'MCowBQYDK2VwAyEAZrJ48cFCZlwi0Jqdais3uKRGhXC7IdEtNXmFeRrdocs=',
};

const keyCache = new Map<string, KeyObject>();

const trustedKey = (keyId: string): KeyObject | undefined => {
  const cached = keyCache.get(keyId);
  if (cached) {
    return cached;
  }
  const encoded = TRUSTED_PUBLIC_KEYS[keyId];
  if (!encoded) {
    return undefined;
  }
  const key = createPublicKey({
    key: Buffer.from(encoded, 'base64'),
    format: 'der',
    type: 'spki',
  });
  keyCache.set(keyId, key);
  return key;
};

/**
 * The payload as text, if and only if the signature over its bytes verifies.
 *
 * The signature covers the literal payload bytes, so they are decoded, checked,
 * and only then turned into a string for the parser. Nothing about the JSON
 * inside is looked at here — that is the parser's job, and it runs on bytes
 * that are already known to be ours.
 */
export const verifyScenePackEnvelope = (
  envelope: IScenePackEnvelope,
): string | undefined => {
  const key = trustedKey(envelope.keyId);
  if (!key) {
    return undefined;
  }
  const payload = Buffer.from(envelope.payload, 'base64');
  const signature = Buffer.from(envelope.signature, 'base64');
  if (signature.byteLength !== 64) {
    return undefined;
  }
  try {
    // `null` is how Node spells Ed25519's built-in hash: the algorithm signs
    // the message directly rather than a digest of it.
    return verify(null, payload, key, signature)
      ? payload.toString('utf8')
      : undefined;
  } catch {
    return undefined;
  }
};

/** For a test that generates its own keypair and needs the app to trust it. */
export const trustScenePackKeyForTesting = (keyId: string, key: KeyObject) => {
  keyCache.set(keyId, key);
};

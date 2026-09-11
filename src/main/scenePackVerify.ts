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
 *
 * TWO TRUST CLASSES, TWO LISTS. The official key signs the Plus looks; the
 * member key signs scenes members made and shared, after the server checked
 * them. Each envelope is verified against its own list only, so a member's
 * file can never pass for an official look however it is crafted — the
 * `keyId` inside it could name the official key and it would simply not be
 * found in the member list.
 */

/** SPKI DER, base64. */
const OFFICIAL_KEYS: Readonly<Record<string, string>> = {
  'fluideq-2026-09':
    'MCowBQYDK2VwAyEAZrJ48cFCZlwi0Jqdais3uKRGhXC7IdEtNXmFeRrdocs=',
};

/** SPKI DER, base64. The key `sign-member-scene` signs with. */
const MEMBER_KEYS: Readonly<Record<string, string>> = {
  'fluideq-member-2026-09':
    'MCowBQYDK2VwAyEAhAmQ5JPnpB0kf50iMyuhCO4WiqiFpd5Amo/3iwJEmCQ=',
};

const createVerifier = (keys: Readonly<Record<string, string>>) => {
  const cache = new Map<string, KeyObject>();

  const trustedKey = (keyId: string): KeyObject | undefined => {
    const cached = cache.get(keyId);
    if (cached) {
      return cached;
    }
    const encoded = keys[keyId];
    if (!encoded) {
      return undefined;
    }
    const key = createPublicKey({
      key: Buffer.from(encoded, 'base64'),
      format: 'der',
      type: 'spki',
    });
    cache.set(keyId, key);
    return key;
  };

  /**
   * The payload as text, if and only if the signature over its bytes
   * verifies. The signature covers the literal payload bytes, so they are
   * decoded, checked, and only then turned into a string for the parser.
   */
  const verifyEnvelope = (envelope: IScenePackEnvelope): string | undefined => {
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

  return {
    verifyEnvelope,
    trustForTesting: (keyId: string, key: KeyObject) => {
      cache.set(keyId, key);
    },
  };
};

const official = createVerifier(OFFICIAL_KEYS);
const member = createVerifier(MEMBER_KEYS);

/** A Plus look's payload, verified against the official key only. */
export const verifyScenePackEnvelope = official.verifyEnvelope;

/** A shared member scene's payload, verified against the member key only. */
export const verifyMemberSceneEnvelope = member.verifyEnvelope;

/** For a test that generates its own keypair and needs the app to trust it. */
export const trustScenePackKeyForTesting = official.trustForTesting;

/** The same, for the member trust class. */
export const trustMemberSceneKeyForTesting = member.trustForTesting;

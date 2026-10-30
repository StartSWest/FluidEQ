/**
 * The update feed's private key on the Mac that builds the Mac release.
 *
 *   pnpm mac-feed-key new      make the Mac's own key: the private half into
 *                              this account's login Keychain, the public half
 *                              into src/main/macFeedKeys.ts, which every Mac
 *                              build then trusts
 *   pnpm mac-feed-key import   a key from the clipboard into the Keychain (a
 *                              second Mac, or a restore); the clipboard is
 *                              cleared afterwards
 *   pnpm mac-feed-key copy     the key onto the clipboard, to keep a copy
 *   pnpm mac-feed-key check    whether this Mac can sign a release
 *
 * The Mac's key is its own: Windows and Linux sign with another, which no
 * Mac copy trusts. It is kept by the system for this account and never in
 * the project, and reaches `security` on standard input (its `-i` mode),
 * never on a command line, where any process can read it. Nothing here
 * prints the key.
 */

import { execFileSync } from 'child_process';
import { generateKeyPairSync } from 'crypto';
import fs from 'fs';
import path from 'path';
import MAC_OWN_FEED_KEYS from '../../src/main/macFeedKeys';
import type { IStoredFeedKey } from './update-feed-key-store';
import {
  readPastedKey,
  signsForTrustedKey,
  trustedKeyIdOf,
} from './update-feed-key';

export const KEYCHAIN_SERVICE = 'fluideq-update-feed-key';
const KEYCHAIN_ACCOUNT = 'release';

export interface IMacKeychain {
  write(secret: string): void;
  /** The stored secret, or undefined when there is none. */
  read(): string | undefined;
}

export const loginKeychain: IMacKeychain = {
  write: (secret) => {
    execFileSync('/usr/bin/security', ['-i'], {
      input: `add-generic-password -U -a ${KEYCHAIN_ACCOUNT} -s ${KEYCHAIN_SERVICE} -l ${KEYCHAIN_SERVICE} -w ${secret}\n`,
      stdio: ['pipe', 'ignore', 'pipe'],
    });
  },
  read: () => {
    try {
      return execFileSync(
        '/usr/bin/security',
        [
          'find-generic-password',
          '-a',
          KEYCHAIN_ACCOUNT,
          '-s',
          KEYCHAIN_SERVICE,
          '-w',
        ],
        { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] },
      ).trim();
    } catch {
      // `security` exits 44 when the item is not there.
      return undefined;
    }
  },
};

/** The Keychain holds `<key id>:<private key>`, both base64-safe, so no quoting. */
export const readMacFeedKey = (
  keychain: IMacKeychain = loginKeychain,
): IStoredFeedKey | undefined => {
  const secret = keychain.read();
  const colon = secret?.indexOf(':') ?? -1;
  if (!secret || colon <= 0) {
    return undefined;
  }
  return { keyId: secret.slice(0, colon), privateKey: secret.slice(colon + 1) };
};

/** Stores a pasted key, refusing any this app does not trust. */
export const importMacFeedKey = (
  pasted: string,
  keychain: IMacKeychain = loginKeychain,
): string => {
  const privateKey = readPastedKey(pasted);
  if (!privateKey) {
    throw new Error('The clipboard does not hold one update feed key.');
  }
  const keyId = trustedKeyIdOf(privateKey, MAC_OWN_FEED_KEYS);
  if (!keyId) {
    throw new Error('That key is not one this app trusts; nothing was stored.');
  }
  keychain.write(`${keyId}:${privateKey}`);
  return keyId;
};

const KEYS_FILE = path.join(__dirname, '../../src/main/macFeedKeys.ts');
const KEYS_MARKER = '  // mac-feed-key: new keys go above this line';

/**
 * Makes the Mac's own update feed key. Refuses when this Mac already holds
 * one: a second would be a key no copy built before it trusts. The public
 * half is pinned through a file written beside the keys file and renamed
 * over it, so nothing ever reads half of it.
 */
export const createMacFeedKey = ({
  keychain = loginKeychain,
  keysFile = KEYS_FILE,
  today = new Date(),
}: {
  keychain?: IMacKeychain;
  keysFile?: string;
  today?: Date;
} = {}): string => {
  if (keychain.read()) {
    throw new Error('This Mac already holds an update feed key.');
  }
  const source = fs.readFileSync(keysFile, 'utf8');
  if (!source.includes(KEYS_MARKER)) {
    throw new Error(`${keysFile} has no place for a new key.`);
  }
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  const keyId = `fluideq-mac-feed-${today.toISOString().slice(0, 10)}`;
  const publicDer = publicKey
    .export({ format: 'der', type: 'spki' })
    .toString('base64');
  const privateDer = privateKey
    .export({ format: 'der', type: 'pkcs8' })
    .toString('base64');
  keychain.write(`${keyId}:${privateDer}`);
  const temporary = `${keysFile}.${process.pid}.tmp`;
  fs.writeFileSync(
    temporary,
    source.replace(
      KEYS_MARKER,
      `  '${keyId}':\n    '${publicDer}',\n${KEYS_MARKER}`,
    ),
  );
  fs.renameSync(temporary, keysFile);
  return keyId;
};

if (require.main === module) {
  const command = process.argv[2];
  try {
    if (command === 'new') {
      const keyId = createMacFeedKey();
      console.log(
        `Made the Mac's update feed key "${keyId}": kept in the login Keychain, trusted by every Mac build from now on. Keep a copy: pnpm mac-feed-key copy`,
      );
    } else if (command === 'copy') {
      const key = readMacFeedKey();
      if (!key) {
        throw new Error('This Mac holds no update feed key.');
      }
      execFileSync('/usr/bin/pbcopy', {
        input: `${key.keyId}:${key.privateKey}`,
      });
      console.log(
        'The key is on the clipboard: paste it into your password manager, then copy something else.',
      );
    } else if (command === 'import') {
      const pasted = execFileSync('/usr/bin/pbpaste', { encoding: 'utf8' });
      const keyId = importMacFeedKey(pasted);
      execFileSync('/usr/bin/pbcopy', { input: '' });
      console.log(
        `Stored update feed key "${keyId}" in the login Keychain; the clipboard is cleared.`,
      );
    } else if (command === 'check') {
      const key = readMacFeedKey();
      if (!key || !signsForTrustedKey(key, MAC_OWN_FEED_KEYS)) {
        console.error(
          'This Mac cannot sign a release: run `pnpm mac-feed-key import` with the key from your password manager on the clipboard.',
        );
        process.exit(1);
      }
      console.log(`This Mac signs releases with "${key.keyId}".`);
    } else {
      console.error('Usage: pnpm mac-feed-key new | import | copy | check');
      process.exit(1);
    }
  } catch (error) {
    console.error((error as Error).message);
    process.exit(1);
  }
}

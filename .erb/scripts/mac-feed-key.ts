/**
 * The update feed's private key on the Mac that builds the Mac release.
 *
 *   pnpm mac-feed-key import   the key from the clipboard (pasted from the
 *                              password manager, as `pnpm update-feed-key
 *                              copy` put it there) into this account's login
 *                              Keychain; the clipboard is cleared afterwards
 *   pnpm mac-feed-key check    whether this Mac can sign a release
 *
 * The Mac's counterpart of Windows' DPAPI store (`update-feed-key-store.ts`)
 * and Linux's keyring: the same key, kept by the system for this account and
 * never in the project. It reaches `security` on standard input (its `-i`
 * mode), never on a command line, where any process can read it. Nothing here
 * prints the key.
 */

import { execFileSync } from 'child_process';
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
  const keyId = trustedKeyIdOf(privateKey);
  if (!keyId) {
    throw new Error('That key is not one this app trusts; nothing was stored.');
  }
  keychain.write(`${keyId}:${privateKey}`);
  return keyId;
};

if (require.main === module) {
  const command = process.argv[2];
  try {
    if (command === 'import') {
      const pasted = execFileSync('/usr/bin/pbpaste', { encoding: 'utf8' });
      const keyId = importMacFeedKey(pasted);
      execFileSync('/usr/bin/pbcopy', { input: '' });
      console.log(
        `Stored update feed key "${keyId}" in the login Keychain; the clipboard is cleared.`,
      );
    } else if (command === 'check') {
      const key = readMacFeedKey();
      if (!key || !signsForTrustedKey(key)) {
        console.error(
          'This Mac cannot sign a release: run `pnpm mac-feed-key import` with the key from your password manager on the clipboard.',
        );
        process.exit(1);
      }
      console.log(`This Mac signs releases with "${key.keyId}".`);
    } else {
      console.error('Usage: pnpm mac-feed-key import | check');
      process.exit(1);
    }
  } catch (error) {
    console.error((error as Error).message);
    process.exit(1);
  }
}

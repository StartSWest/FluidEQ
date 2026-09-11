import path from 'path';
import { createAccountVersions } from './accountVersions';

/**
 * Which version of the Plus terms each account on this computer has already
 * been told about.
 *
 * Kept per account, because what the notice is about — an agreement — belongs
 * to an account and not to a computer: somebody else signing in here has been
 * told nothing, and must be. Kept as the highest version, so putting one
 * notice away can never bring back an older one.
 */

const SEEN_FILE = 'plus-terms-notice.json';

const seenIn = (userDataDir: string) =>
  createAccountVersions(path.join(userDataDir, SEEN_FILE));

export const readTermsNoticeSeen = (
  userDataDir: string,
  accountId: string,
): number => seenIn(userDataDir).read(accountId);

export const writeTermsNoticeSeen = (
  userDataDir: string,
  accountId: string,
  version: number,
) => seenIn(userDataDir).write(accountId, version);

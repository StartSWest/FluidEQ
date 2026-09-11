import fs from 'fs';
import path from 'path';
import writeFileAtomically from '../atomicWrite';

/**
 * Which version of the Plus terms each account on this computer has already
 * been told about.
 *
 * Kept per account, because what the notice is about — an agreement — belongs
 * to an account and not to a computer: somebody else signing in here has been
 * told nothing, and must be. Kept as the highest version, so putting one
 * notice away can never bring back an older one.
 *
 * Only account ids and version numbers, which the server already knows and
 * which say nothing about the person, so the file is plain JSON rather than
 * one of the encrypted stores.
 */

const SEEN_FILE = 'plus-terms-notice.json';

/** More accounts than one computer ever signs into; a bound, not a feature. */
const MAX_ACCOUNTS = 64;
const MAX_ACCOUNT_ID = 128;

const readAll = (userDataDir: string): Map<string, number> => {
  const seen = new Map<string, number>();
  let parsed: unknown;
  try {
    parsed = JSON.parse(
      fs.readFileSync(path.join(userDataDir, SEEN_FILE), 'utf8'),
    );
  } catch {
    // Never written, or unreadable: nothing has been seen, which at worst
    // shows a notice once more.
    return seen;
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return seen;
  }
  Object.entries(parsed).forEach(([accountId, version]) => {
    if (
      accountId.length > 0 &&
      accountId.length <= MAX_ACCOUNT_ID &&
      typeof version === 'number' &&
      Number.isInteger(version) &&
      version > 0
    ) {
      seen.set(accountId, version);
    }
  });
  return seen;
};

export const readTermsNoticeSeen = (
  userDataDir: string,
  accountId: string,
): number => readAll(userDataDir).get(accountId) ?? 0;

export const writeTermsNoticeSeen = (
  userDataDir: string,
  accountId: string,
  version: number,
) => {
  const seen = readAll(userDataDir);
  if (
    accountId.length === 0 ||
    accountId.length > MAX_ACCOUNT_ID ||
    !Number.isInteger(version) ||
    version <= (seen.get(accountId) ?? 0)
  ) {
    return;
  }
  seen.delete(accountId);
  seen.set(accountId, version);
  // The oldest entries go first when the bound is reached: insertion order is
  // the order accounts last put a notice away.
  const kept = [...seen].slice(-MAX_ACCOUNTS);
  writeFileAtomically(
    path.join(userDataDir, SEEN_FILE),
    JSON.stringify(Object.fromEntries(kept)),
  );
};

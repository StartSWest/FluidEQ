import fs from 'fs';
import writeFileAtomically from '../atomicWrite';

/**
 * The highest version of something each account on this computer has
 * reached, kept in one small JSON file: `{ "<account id>": 5, ... }`.
 *
 * Per account, because what these record belongs to a person and not to the
 * computer — an agreement to the Plus terms, a notice about them having been
 * seen. One number for the whole computer let whoever signed in first answer
 * for everyone after them.
 *
 * Only ever raised: recording an older version after a newer one changes
 * nothing. Only account ids and version numbers, which the server already
 * knows and which say nothing about the person, so plain JSON rather than one
 * of the encrypted stores.
 */

export interface IAccountVersions {
  /** The highest version recorded for the account, or 0 for none. */
  read(accountId: string): number;
  /** Records `version` for the account, unless it already has one as high. */
  write(accountId: string, version: number): void;
}

/** More accounts than one computer ever signs into; a bound, not a feature. */
const MAX_ACCOUNTS = 64;
const MAX_ACCOUNT_ID = 128;

const isAccountId = (accountId: string) =>
  accountId.length > 0 && accountId.length <= MAX_ACCOUNT_ID;

const isVersion = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value > 0;

export const createAccountVersions = (filePath: string): IAccountVersions => {
  const readAll = (): Map<string, number> => {
    const versions = new Map<string, number>();
    let parsed: unknown;
    try {
      parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch {
      // Never written, or unreadable: nothing is recorded, which at worst
      // asks somebody once more.
      return versions;
    }
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      Array.isArray(parsed)
    ) {
      return versions;
    }
    Object.entries(parsed).forEach(([accountId, version]) => {
      if (isAccountId(accountId) && isVersion(version)) {
        versions.set(accountId, version);
      }
    });
    return versions;
  };

  return {
    read: (accountId) => readAll().get(accountId) ?? 0,
    write: (accountId, version) => {
      const versions = readAll();
      if (
        !isAccountId(accountId) ||
        !isVersion(version) ||
        version <= (versions.get(accountId) ?? 0)
      ) {
        return;
      }
      // Written last, so when the bound is reached the accounts that went
      // longest without writing are the ones forgotten.
      versions.delete(accountId);
      versions.set(accountId, version);
      writeFileAtomically(
        filePath,
        JSON.stringify(Object.fromEntries([...versions].slice(-MAX_ACCOUNTS))),
      );
    },
  };
};

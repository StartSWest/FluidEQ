/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import fs from 'fs';
import path from 'path';
import writeFileAtomically from '../atomicWrite';

/**
 * Which review news each account on this computer has already been told:
 * the scenes the admin was told were waiting, and the answers a maker was
 * told about (`common/sceneReviewNotice.ts` makes the keys).
 *
 * Per account, like the terms notice: somebody else signing in here has been
 * told nothing. Only ids the server already sent this account, so plain JSON
 * rather than one of the encrypted stores.
 */

const SEEN_FILE = 'scene-review-notice.json';

/** More accounts than one computer ever signs into; a bound, not a feature. */
const MAX_ACCOUNTS = 64;

/**
 * Keys kept per account. The queue holds at most 200 and a maker's list the
 * same; the newest are kept, so the bound can only ever re-tell something
 * old enough that the server no longer lists it.
 */
const MAX_KEYS = 400;

const MAX_KEY = 200;

const readAll = (filePath: string): Map<string, string[]> => {
  const all = new Map<string, string[]>();
  let parsed: unknown;
  try {
    parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    // Never written, or unreadable: nothing was seen, which at worst tells
    // somebody once more.
    return all;
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return all;
  }
  Object.entries(parsed).forEach(([accountId, keys]) => {
    if (
      accountId.length > 0 &&
      accountId.length <= 128 &&
      Array.isArray(keys)
    ) {
      all.set(
        accountId,
        keys.filter(
          (key): key is string =>
            typeof key === 'string' && key.length > 0 && key.length <= MAX_KEY,
        ),
      );
    }
  });
  return all;
};

export interface IReviewNoticeSeen {
  read(accountId: string): Set<string>;
  /** Adds `keys` to what the account has been told. */
  add(accountId: string, keys: readonly string[]): void;
}

export const createReviewNoticeSeen = (
  userDataDir: string,
): IReviewNoticeSeen => {
  const filePath = path.join(userDataDir, SEEN_FILE);
  return {
    read: (accountId) => new Set(readAll(filePath).get(accountId) ?? []),
    add: (accountId, keys) => {
      const all = readAll(filePath);
      const held = all.get(accountId) ?? [];
      const fresh = keys.filter(
        (key) => key.length > 0 && key.length <= MAX_KEY && !held.includes(key),
      );
      if (fresh.length === 0) {
        return;
      }
      // Written last, so the accounts that went longest without news are the
      // ones forgotten when the bound is reached.
      all.delete(accountId);
      all.set(accountId, [...held, ...fresh].slice(-MAX_KEYS));
      writeFileAtomically(
        filePath,
        JSON.stringify(Object.fromEntries([...all].slice(-MAX_ACCOUNTS))),
      );
    },
  };
};

import type { TranslationKey } from './i18n/en';

/**
 * Telling members that the Plus terms changed.
 *
 * The terms promise it — "If these terms change, the new version appears
 * here with its date, and the app tells you before it applies to you" — and
 * for the first four versions nothing kept that promise. A member
 * agreed to one version of the text and no other, so when the app carries a
 * newer one they are told, once, in a notice that sits beside the work rather
 * than in front of it: what changed since the version they agreed to, and the
 * way to the terms themselves.
 *
 * Once per account and version. Putting the notice away and opening the terms
 * from it both count as having been told; a later version is told afresh, and
 * nothing already told comes back.
 *
 * Pure, so a test can walk every combination without a server, a disk or a
 * window. The main process gathers the facts; see `ipc/plusTermsNotice.ts`.
 */

/**
 * What each version changed, as one sentence a member can take in at a
 * glance. Version 1 never reached a release and has nothing before it.
 *
 * Raising PLUS_TERMS_VERSION means adding its sentence here and to
 * `termsNotice.ts` in every language, and a test fails for a version that has
 * none: a notice with nothing to say about the change it announces is exactly
 * the notice this exists to replace.
 */
export const PLUS_TERMS_CHANGES: Readonly<Record<number, TranslationKey>> = {
  2: 'termsNotice.change.2',
  3: 'termsNotice.change.3',
  4: 'termsNotice.change.4',
  5: 'termsNotice.change.5',
};

export interface IPlusTermsNoticeFacts {
  /**
   * This build sells Plus, and so has terms to show. A build without a price
   * never shows them — the Account panel opens on its home page instead — so
   * a notice there would point at a page that does not open.
   */
  termsOffered: boolean;
  /** The signed-in account, or undefined when nobody is signed in. */
  accountId: string | undefined;
  /** Plus is on for that account: paid for, or within its offline grace. */
  member: boolean;
  /**
   * The newest version the server has on record as this account's agreement,
   * or undefined while that is not known — not asked yet, or not answered.
   * Zero is an answer: an account with no agreement on record at all, which
   * a membership paid for outside the app's checkout can be.
   */
  agreed: number | undefined;
  /** The newest version whose notice this account has already been shown. */
  seen: number;
  /** The version this build carries. */
  current: number;
}

export interface IPlusTermsNotice {
  /** The version it tells about: always the one the build carries. */
  version: number;
  /** The versions whose changes it names, newest first. */
  changes: number[];
}

/** Everything but the agreement: whether this account could be owed one. */
const couldBeOwed = ({
  termsOffered,
  accountId,
  member,
  seen,
  current,
}: IPlusTermsNoticeFacts) =>
  termsOffered && accountId !== undefined && member && seen < current;

/**
 * Whether the server is worth asking for this account's agreements.
 *
 * Only while the answer is missing and could still lead to a notice: an
 * account already told about this version, or one that is not a member, has
 * nothing a request could change.
 */
export const shouldAskAgreedTerms = (facts: IPlusTermsNoticeFacts): boolean =>
  couldBeOwed(facts) && facts.agreed === undefined;

/**
 * The versions a member who agreed to `agreed` has not been shown, newest
 * first.
 *
 * With nothing on record there is no older text to compare against, and a
 * history of every change since the first version would be noise: only the
 * newest is named, and the terms carry the rest.
 */
export const changedSince = (agreed: number, current: number): number[] => {
  const oldest = agreed > 0 ? agreed + 1 : current;
  const versions: number[] = [];
  for (let version = current; version >= oldest; version -= 1) {
    versions.push(version);
  }
  return versions;
};

/**
 * The notice this account is owed, or undefined for none.
 *
 * Never before the server has answered. The only other record of an
 * agreement, the one the Studio keeps on this computer, cannot say which
 * account agreed, and the server holds every agreement that record does:
 * export and publish both write it only after the server has recorded theirs.
 * So waiting costs a member who is offline the notice until they are back,
 * which is harmless, while guessing would tell somebody who agreed on another
 * computer about a change they already accepted — or, worse, let one account's
 * agreement on a shared computer stand in for another's.
 */
export const plusTermsNotice = (
  facts: IPlusTermsNoticeFacts,
): IPlusTermsNotice | undefined => {
  if (
    !couldBeOwed(facts) ||
    facts.agreed === undefined ||
    facts.agreed >= facts.current
  ) {
    return undefined;
  }
  return {
    version: facts.current,
    changes: changedSince(facts.agreed, facts.current),
  };
};

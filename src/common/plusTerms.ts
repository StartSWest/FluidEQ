/**
 * The FluidEQ Plus terms: which version is current, and the numbers the text
 * quotes.
 *
 * The words live in the `terms.*` dictionaries, all ten languages. The
 * numbers live here, next to the version, because each one is also enforced
 * somewhere — the offline grace by the entitlement check, the listening
 * window and the daily cap by the leaderboard's server — and a promise in the
 * terms that disagreed with the code keeping it would be the worst kind of
 * bug: one a person reads, relies on, and finds false.
 *
 * Changing what the terms say means raising the version. The server's
 * checkout refuses an agreement to an older one, so a person always pays
 * under the text they were shown.
 */

/**
 * 2: the minimum age went from 16 to 18. Version 1 never reached a release,
 * but an agreement on record has to name one text, not two.
 *
 * 3: scenes members make in the Studio — they stay the member's own, sharing
 * one by file lets other members play it, a like is points for its author.
 * Exporting a scene also records an agreement to this version, so nobody
 * shares under a text they were not shown.
 *
 * 4: Visualizers, the gallery — publishing a scene lets FluidEQ keep and
 * show it to Plus members until it is unpublished, and what the app sends
 * while browsing, adding and reporting there. Publishing records an agreement
 * to this version, and the server's publishing and checkout refuse an older
 * one; exporting a file still accepts 3, because nothing about it changed.
 *
 * 5: a yearly plan beside the monthly one — the price quotes both, and a
 * membership renews at the end of whichever period was paid for. Only the
 * checkout refuses an older version: publishing and exporting are unchanged
 * and keep accepting 4 and 3.
 */
export const PLUS_TERMS_VERSION = 5;

/** The day this version took effect, as a calendar date. */
export const PLUS_TERMS_EFFECTIVE = '2026-09-11';

/** Days after a charge within which it is refunded on request, in full. */
export const PLUS_REFUND_DAYS = 14;

/**
 * Days Plus keeps working without the server confirming the membership: a
 * fortnight away from the internet, or a studio machine that never sees it.
 */
export const PLUS_OFFLINE_GRACE_DAYS = 14;

/** Days after which a closed account and everything tied to it is gone. */
export const PLUS_ACCOUNT_DELETION_DAYS = 30;

/**
 * The youngest a person may be to create an account.
 *
 * Buy Me a Coffee, which takes the payment, requires every account holder to
 * be 18 or old enough to sign a binding contract. Sixteen here promised a
 * membership the payment side would not sell.
 */
export const PLUS_MINIMUM_AGE = 18;

/** A calendar date (`YYYY-MM-DD`) as a Date at noon UTC, so no zone moves it a day. */
export const termsEffectiveDate = (): Date =>
  new Date(`${PLUS_TERMS_EFFECTIVE}T12:00:00Z`);

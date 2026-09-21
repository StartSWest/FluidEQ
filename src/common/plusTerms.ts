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
 * membership renews at the end of whichever period was paid for. And a
 * published scene's picture, name, category and maker are shown to anyone
 * signed in, not only to Plus members, and it plays for them for a few
 * seconds on its page; only Plus members play it in full and add it. So
 * publishing refuses an older version too, as the checkout does. Exporting a
 * file is unchanged and keeps accepting 3. And Plus runs on up to five
 * computers at a time, with each computer's listening reported under a random
 * id and added into one day that cannot outrun the clock — still version 5,
 * because version 5 has not reached a release. So is the next change: the
 * community's channels are gone, so nothing about messages, mentions, reports
 * or blocks is sent or kept, the board scores listening and likes only, the
 * rules are about what a member publishes, and the Forum tab — which talks to
 * GitHub, not to this server — has its row in the table of what is sent.
 *
 * 6: the whole text checked against what the app and the server do on
 * 2026-09-14, and raised rather than amended because the server already held
 * an agreement to 5. What a free account can do (browse, see pictures and
 * details, try FluidEQ's free sample scenes — a member's scene no longer plays
 * without Plus), version notes, reports and takedowns with their 30-day pause
 * on sharing, sharing limits, the check that refuses copies of FluidEQ's own
 * scenes, looking inside those scenes in the Studio, gifts of Plus, what the
 * sign-in service itself records, the Forum's GitHub sign-in passing through
 * the server, the offline grace measured from the end of the paid period, and
 * every connection FluidEQ makes outside Plus. Still the first public edition:
 * nothing before it reached a release.
 *
 * 7: the same night the server began ranking an account only while it has
 * Plus (its days kept), and Report a problem gained a private email to the
 * maker. Raised again because the server already held an agreement to 6; still
 * the first public edition, and the first public revision moves with it.
 *
 * 8: the fourteen-day refund is withdrawn (Ivan, 2026-09-15). The terms now
 * say nothing about refunds rather than promising or refusing one: what a
 * payment can do is the merchant's own policy, and this is the first
 * published edition to take something away, so it is edition 2 and every
 * member who agreed to 7 is told.
 *
 * 9: a published scene is now held until a moderator approves it, and Plus
 * can arrive without a payment — a free trial an account can take once, and a
 * month earned by a scene that is approved. The review is the reason this is
 * edition 3 rather than an amendment: it takes something away that revision 8
 * gave, which was a scene appearing the moment it was published, so every
 * member who agreed to 8 is asked again. Both ways in are administrator
 * switches on the server, so the text says "when FluidEQ offers it" rather
 * than promising an offer that may answer "unavailable"; the trial has its
 * own conditions and its own version beside these (`plusTrial.ts`).
 */
/** Internal acceptance revision used by checkout, publishing and saved agreements.
 * Do not reset it: pre-release revisions may already be recorded by the server.
 *
 * Checkout and publishing only need it to reach a floor. The free trial needs
 * it to EQUAL the server's `plus_terms_version()`: an app ahead of the server
 * tells every eligible new account to update FluidEQ, on the newest build
 * there is. Raise both in the same release.
 */
export const PLUS_TERMS_VERSION = 9;

/** Published editions. Pre-release acceptance revisions are not editions. */
export const PLUS_TERMS_EDITION = 3;
export const PLUS_TERMS_FIRST_PUBLIC_REVISION = 7;

/** The day this version took effect, as a calendar date. */
export const PLUS_TERMS_EFFECTIVE = '2026-09-20';

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

/**
 * How many computers one account stays signed in on at once. Enforced by the
 * server's access-token hook (`plus_computers_hook`), which keeps the asking
 * session and the four used most recently.
 */
export const PLUS_MAX_COMPUTERS = 5;

/**
 * How long an account without Plus watches one of FluidEQ's free sample
 * scenes play, counted in frames actually drawn. A member's scene does not
 * play at all without Plus: the server refuses its file.
 */
export const PLUS_TASTE_SECONDS = 10;

/**
 * Exports and publishes together, per account per hour, refused attempts
 * included. The server's `member_share_refusal` counts them; keep in step.
 */
export const PLUS_SHARES_PER_HOUR = 30;

/** Scenes one account may have published at once, enforced by the server. */
export const PLUS_MAX_PUBLISHED_SCENES = 200;

/**
 * Days an account cannot export or publish after one of its scenes is taken
 * down, enforced by the server's `member_share_refusal`.
 */
export const PLUS_TAKEDOWN_PAUSE_DAYS = 30;

/** A calendar date (`YYYY-MM-DD`) as a Date at noon UTC, so no zone moves it a day. */
export const termsEffectiveDate = (): Date =>
  new Date(`${PLUS_TERMS_EFFECTIVE}T12:00:00Z`);

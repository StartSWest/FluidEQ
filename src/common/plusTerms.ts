/**
 * The FluidEQ Plus terms: which version is current, and the numbers the text
 * quotes.
 *
 * The words live in the `terms.*` dictionaries, every supported interface language. The
 * numbers live here, next to the version, because each one is also enforced
 * somewhere — the offline grace by the entitlement check, the scene-play
 * window and the daily cap by the server — and a promise in the
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
 *
 * Revision 9 was amended, not raised, before its first release (2.0.0,
 * prepared as 1.8.0; amended 2026-09-24): the Studio's AI link got its line
 * under Where else FluidEQ connects, and a maker's one kept project its
 * sentence under the membership. Neither 1.7.5 nor 1.8.0 shipped, and the
 * server's only agreement to 9 was
 * the maker's own admin account, so no member ever agreed to the text
 * without them. A raise would also have had to move the server's
 * `plus_terms_version()`, or the trial refuses every new account.
 *
 * Amended again for 2.0 (2026-09-28), on the same reading of the live
 * agreements: a scene can now carry 3D models, which export and publish send
 * and the Studio keeps, so the three lines listing what a scene is made of
 * name them; the Library's index joined what FluidEQ remembers on the
 * computer; and the month an approved scene earns is approved by FluidEQ's
 * maker, which is what the rules and the scene terms already said and what
 * the server allows — one administrator account, seeded by address, and no
 * moderator role. Naming a second reviewer changes who reads a member's
 * work, so that needs a raise rather than an amendment.
 *
 * And once more before 2.0 shipped (2026-09-30, still only the admin's own
 * agreement to 9, still no public release carrying it): the User guide's
 * first-steps video is the app's first connection to fluideq.com, so it has
 * its line under Where else FluidEQ connects. That line says the site keeps
 * no record of the request, which is only true while the site's /video/
 * location has its access log off, as /fonts/ and /img/ already do.
 */
/**
 * 10: the app sends how long each Plus scene is on a member's screen, one
 * number per scene per day, and which audio engine they chose, both only to
 * FluidEQ's maker (premium migrations 0047 and 0049); it asks whether new
 * scenes were announced; and adding one of FluidEQ's own scenes is kept like
 * any other add. Revision 9 promised "Nothing else about what is on screen is
 * kept", so this is a raise and edition 4: the app sends none of it until the
 * member has been shown this text (`toldOf` in `ipc/plusTermsNotice.ts`).
 * The server's `plus_terms_version()` moves to 10 in premium migration 0051,
 * deployed with the release that carries this. Amended before that release,
 * still revision 10: What's New plays short films from fluideq.com by itself
 * as a slide opens (`FeatureFilm`), said under Where else FluidEQ connects
 * and in this revision's notice.
 */
/**
 * 11: credits (premium 0055-0062). A scene is bought once for one credit, from
 * packs paid on Stripe, and kept for good; every scene can be watched for a
 * few seconds first; FluidEQ's maker can make some of FluidEQ's own scenes
 * free for everyone, and paid again; the Studio and publishing are every
 * account's, and a member's own scene plays outside the Studio only once it
 * is published — a draft plays on the Studio's stage, marked. Plus is
 * described as what it is until FluidEQ ends it. Edition 5: what a scene
 * costs and who may play it changed. Buying credits records an agreement to
 * this version (create-credit-checkout refuses an older one), and the
 * server's `plus_terms_version()` moves to 11 in premium migration 0062,
 * deployed with the release that carries this.
 *
 * Amended, not raised, before its first release (2026-10-21): the only
 * agreements to 11 on the server are FluidEQ's own test purchases. Credits
 * not spent are refunded within `CREDIT_REFUND_DAYS` of buying their pack, and
 * only those credits go back (Ivan, 2026-10-21; premium 0065 takes back the
 * share a partial refund pays for, where every refund used to take the whole
 * pack). And creators are paid for their scenes through Stripe (premium 0064):
 * a section quoting the creator terms the sign-up shows, word for word, with
 * the numbers below; what payouts send and keep; Stripe named as paying them.
 *
 * Amended again before its first release (2026-10-24): payouts are closed
 * (`CREATOR_PAYOUTS_OPEN`, premium 0070), because Stripe Connect cannot be
 * opened yet, so the document says nothing about paying creators and a sale
 * earns the creator a credit. The payout text is kept (`termsLayout(true)`);
 * opening payouts shows it, and is the revision after 12.
 */
/**
 * 12: a scene its maker unpublishes stays with everyone who got it, marked
 * unpublished, on every computer, from a copy FluidEQ keeps for them (Ivan,
 * 2026-11-12; premium 0103, live before this release because it only keeps
 * what revision 11 already promised). A scene FluidEQ's maker takes down or
 * deletes for breaking the terms, or one whose maker's account is deleted,
 * stops playing for everyone and gives every buyer their credit back, as the
 * kind of credit it was; its maker gives back what those buys earned, never
 * below zero (premium 0104, which moves the server's plus_terms_version() to
 * 12 and is deployed with the release that carries this). Revision 11 said a
 * takedown only stopped the scene opening, so this is a raise and edition 6.
 * Checkout's floor stays at 11: the change only ever gives a buyer back.
 */
/**
 * 13: how many computers run each audio engine, counted once a day as
 * anonymous totals (Ivan, 2026-11-13: "solo totales"; premium 0110). The app
 * sends one word — fluid, apo or none — at most once a day per computer, for
 * a signed-in account shown this text (`account/engineCount.ts` asks
 * `toldOf(13)`), and the server keeps one number per engine per day and
 * nothing that ties it to anybody. Revision 12 said "there is no tracking or
 * analytics", so this is a raise and edition 7; the sentence now names the
 * one count. The server's `plus_terms_version()` moves to 13 in premium 0110,
 * deployed with the release that carries this. Publishing's and checkout's
 * floors do not move: the change gives nobody anything to agree to again.
 */
/**
 * 14: a confirmed account's starter claim gives one credit, not three (Ivan,
 * 2026-11-24; premium 0119, and `STARTER_CREDITS` follows it). Accounts that
 * already claimed three keep them; only what a new account is given changes.
 * The terms quote the number (`terms.credits.p2`), and revision 13 promised
 * three, so this is a raise and edition 8, and every member is told. The
 * server's `plus_terms_version()` moves to 14 in premium 0120, deployed with
 * the release that carries this, after 0119. Publishing's and checkout's
 * floors do not move: nobody who already agreed loses anything they have.
 */
/**
 * 15: Plus is the scene subscription (Ivan, 2026-11-27: Plus starts now and
 * ships in 2.6; premium 0122). One Stripe subscription, monthly or yearly,
 * plays every scene in Scenes — FluidEQ's and members' — in FluidEQ and in
 * FluidWallpapers while it lasts, for one account; its prices are quoted
 * from the server and Stripe's page, never written here. Scenes got with
 * credits stay the account's for good; when Plus ends, every scene the
 * account had only through it stops at once and its downloaded copies are
 * deleted. A Plus member's first set, install or add of a member's scene
 * earns its maker half a credit, once. What it sends and keeps, renewal and
 * cancelling on Stripe's page, the offline grace, and what a refund or a
 * dispute does. The old membership of the same name — Buy Me a Coffee,
 * gifts, free trials, earned months, the move to credits — is gone from the
 * text, because nobody holds it ("No hay nadie con plus viejo"). Edition 9:
 * what may be bought, and what ends with it, changed.
 *
 * The English and Spanish are FluidWallpapers' revision 15 word for word,
 * which carried them first as an override of this file's 14; it vendors
 * these terms and drops its own copy once this lands. The other ten
 * languages are translated from them and from each language's own revision
 * 14, keeping its register (pt você, de Sie, fr vous) and its words for every
 * sentence the change does not touch.
 *
 * The server's `plus_terms_version()` is 15 from premium 0122, and its
 * subscription checkout refuses anything below 15; the credit checkout and
 * publishing keep their older floors.
 */
/** Internal acceptance revision used by checkout, publishing and saved agreements.
 * Do not reset it: pre-release revisions may already be recorded by the server.
 *
 * Checkout and publishing only need it to reach a floor: the server refuses
 * an agreement below its own floors and never one above them, so a build
 * carrying a newer revision than the server's `plus_terms_version()` still
 * buys and publishes. Raise the server's number with the release that
 * carries the text all the same, or its record names a text it has not
 * published.
 */
export const PLUS_TERMS_VERSION = 15;

/** Published editions. Pre-release acceptance revisions are not editions. */
export const PLUS_TERMS_EDITION = 9;
export const PLUS_TERMS_FIRST_PUBLIC_REVISION = 7;

/** The day this version took effect, as a calendar date. */
export const PLUS_TERMS_EFFECTIVE = '2026-11-27';

/**
 * Days Plus keeps working without the server confirming the subscription: a
 * fortnight away from the internet, or a studio machine that never sees it.
 */
export const PLUS_OFFLINE_GRACE_DAYS = 14;

/** Days after which a closed account and everything tied to it is gone. */
export const PLUS_ACCOUNT_DELETION_DAYS = 30;

/**
 * The youngest a person may be to create an account.
 *
 * Raised from 16 when Buy Me a Coffee took the old membership's payments and
 * required every account holder to be 18 or old enough to sign a binding
 * contract, and kept at 18 for the Plus subscription: lowering it would be a
 * change to the terms of its own, and nobody has asked for one.
 */
export const PLUS_MINIMUM_AGE = 18;

/**
 * How many computers one account stays signed in on at once. Enforced by the
 * server's access-token hook (`plus_computers_hook`), which keeps the asking
 * session and the four used most recently.
 */
export const PLUS_MAX_COMPUTERS = 5;

/**
 * How long any signed-in account watches a scene it does not own play on its
 * page, counted in frames actually drawn (premium 0056 serves every scene's
 * file for it).
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
 * A suspension's days (premium 0105): the account can ask for a refund of the
 * packs it paid for in this many days before it, until this many days after
 * it, and is deleted on that day by the server's own schedule. The server
 * holds the same number (`suspension_refundable`, `admin_suspend_account`).
 * A takedown's pause is no longer a fixed number: the admin chooses it.
 */
export const PLUS_SUSPENSION_DAYS = 15;

/**
 * Days after buying a pack in which its unspent credits are refunded on
 * request. Refunds are made by hand in Stripe; the server takes back only
 * the credits a partial refund pays for (premium 0065).
 */
export const CREDIT_REFUND_DAYS = 14;

/**
 * The creator terms as the terms page quotes them. What pays is the server's
 * `creator_terms()` (premium 0064), which the sign-up dialog reads live; keep
 * these in step with it, or the page promises a share nobody is paid.
 */
export const CREATOR_SHARE_PERCENT = 50;
export const CREATOR_HOLD_DAYS = 30;
export const CREATOR_MINIMUM_CENTS = 1000;
/** Days between payout runs (Ivan, 2026-10-21: "cada 15"). */
export const CREATOR_PAYOUT_EVERY_DAYS = 15;

/** A calendar date (`YYYY-MM-DD`) as a Date at noon UTC, so no zone moves it a day. */
export const termsEffectiveDate = (): Date =>
  new Date(`${PLUS_TERMS_EFFECTIVE}T12:00:00Z`);

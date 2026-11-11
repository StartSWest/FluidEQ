/* FluidEQ — GPL-3.0-or-later */

/**
 * The Signed Edition, as the window is told about it (premium 0104).
 *
 * Two separate facts. Which copy is running is decided when it was built: a
 * signed copy names its publisher in Windows and updates itself; the free
 * copy is the same app, unsigned. Whether the account owns the edition is the
 * server's answer, and a signed copy with an owning account signed in is an
 * activated one. Neither fact ever stops the app working: an un-activated
 * signed copy only gets no updates and says so.
 */

/** Whether the signed-in account owns the edition; `unknown` is a question that got no answer. */
export type TEditionAccount = 'owned' | 'not-owned' | 'signed-out' | 'unknown';

export interface ISignedEditionStatus {
  /** This build was signed and updates from the edition's own feed. */
  signedCopy: boolean;
  account: TEditionAccount;
  /** Paddle's reference for the account's purchase, for the support line. */
  order?: string;
  /**
   * The price to show, as the server words it ("$19"). A launch price that
   * changes without a release, so it is never a number in the app; absent
   * when the server could not be asked, and then no price is shown.
   */
  price?: string;
}

/** Asking for a code to be sent to the address paid with. */
export type TEditionLinkStart = 'sent' | 'limited' | 'signed-out' | 'failed';

/**
 * Typing the code back. `too-soon` is a purchase that moved to another
 * account less than six months ago; `no` covers every other refusal, the
 * server never saying which.
 */
export type TEditionLinkFinish =
  'linked' | 'no' | 'too-soon' | 'signed-out' | 'failed';

/** A link to the newest signed installer that works for a few minutes. */
export type TEditionDownload =
  | { ok: true; version: string; url: string }
  | { ok: false; reason: 'signed-out' | 'not-owned' | 'no-release' | 'failed' };

const ORDER = /^txn_[0-9a-z]{10,60}$/;

/** An order reference as the server sends it, or nothing. */
export const editionOrderOf = (value: unknown): string | undefined =>
  typeof value === 'string' && ORDER.test(value) ? value : undefined;

/** A price as the server words it: short, one line, nothing a page could mistake for markup. */
export const editionPriceOf = (value: unknown): string | undefined =>
  typeof value === 'string' && /^[^\s<>][^\n\r<>]{0,23}$/.test(value)
    ? value
    : undefined;

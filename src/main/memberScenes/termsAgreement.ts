import path from 'path';
import { createAccountVersions } from '../account/accountVersions';

/**
 * Which version of the Plus terms each account agreed to on this computer,
 * when it last shared a scene.
 *
 * Exporting a scene and publishing one both record the agreement on the
 * server with the signature; this is what lets the Studio skip the agreement
 * next time — and when it skips it, the app still tells the server the person
 * agreed. So it has to be about the person. It used to be one number for the
 * computer, and on a shared computer that let one account's agreement stand
 * in for another's: A agreed and exported, B signed in and exported without
 * ever being shown the terms, and the server recorded that B had agreed.
 *
 * Kept as the highest version each account agreed, so publishing under a
 * newer text never makes the next export ask about an older one.
 *
 * The old record, `member-scenes/terms.json` with a single `agreed`, is not
 * read: it cannot say who agreed, which is the same as nobody having agreed.
 * Every account is asked once more and its answer is kept here. The old file
 * is left where it is for an older build, which reads nothing else.
 */

const AGREED_FILE = path.join('member-scenes', 'terms-agreed.json');

const agreedIn = (userDataDir: string) =>
  createAccountVersions(path.join(userDataDir, AGREED_FILE));

/** The highest version `accountId` agreed to on this computer, or 0. */
export const readAgreedTerms = (
  userDataDir: string,
  accountId: string,
): number => agreedIn(userDataDir).read(accountId);

/** Called only once the server has recorded the agreement for this account. */
export const writeAgreedTerms = (
  userDataDir: string,
  accountId: string,
  version: number,
) => agreedIn(userDataDir).write(accountId, version);

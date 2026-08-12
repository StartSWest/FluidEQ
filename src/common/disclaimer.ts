/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

/**
 * GPL-3.0 sections 15 and 16, in words a person reads.
 *
 * Nothing here is a new term. The disclaimer of warranty and the limitation of
 * liability are already in `LICENSE`, in the header of every source file, on
 * the installer's licence page and in the About panel's licence section. What
 * was missing was a version of them that somebody would actually read, and a
 * record that it was put in front of them at all.
 *
 * WHAT THIS DELIBERATELY IS NOT
 *
 * It is not a terms of service, it is not an EULA, and it does not claim to be
 * enforceable everywhere. Consumer law in a number of countries limits what a
 * seller may disclaim no matter what a dialog says, so the text says so rather
 * than implying otherwise — a notice that overstates its own effect is worse
 * than one that does not exist, because it invites a user to believe they have
 * given up something they have not.
 *
 * WHY IT IS NOT TRANSLATED
 *
 * Same reason as the About panel it sits in, and the report-a-problem dialog
 * before it: every sentence is a legal statement, and a mistranslated legal
 * statement is worse than an English one because it still looks authoritative.
 * The mandatory-update modal *is* translated, because "this version has to be
 * updated" is an instruction rather than a statement of terms.
 */

import { PRODUCT_NAME, AUTHOR_NAME, LICENSE } from './branding';

/**
 * The wording's own version, bumped whenever the sentences below change.
 *
 * Acceptance is recorded against this rather than against the app version, so
 * a routine release does not re-prompt everyone and a change to what is being
 * agreed to does. Bump it for any change of meaning; a typo fix is a judgement
 * call and the cheap answer is to bump it anyway.
 */
export const DISCLAIMER_VERSION = 1;

/** The heading, used by both the About section and the first-run notice. */
export const DISCLAIMER_HEADING = 'No warranty, and no liability';

/**
 * The text itself, one string per paragraph.
 *
 * One array, two readers — the About panel and the acknowledgement — so that
 * what a user agreed to on first run and what they can go back and re-read are
 * the same sentences rather than two drafts that diverge.
 */
export const DISCLAIMER_PARAGRAPHS: readonly string[] = [
  `${PRODUCT_NAME} is provided as is, with no warranty of any kind. Nobody promises that it works, that it suits what you want it for, or that it will keep working. This is what sections 15 and 16 of the ${LICENSE.name} say, and it applies whether you were given this copy or paid for it.`,
  `${PRODUCT_NAME} changes how audio is processed on your computer, and it installs and drives Equalizer APO, a separate program that runs with administrator rights and sits in the Windows audio path. To the fullest extent the law allows, ${AUTHOR_NAME} is not liable for any damage arising from using it — to your hearing, to speakers, headphones or other equipment, to data or other software, or to anything else, including loss you could not have foreseen.`,
  `Sound can be loud, and equalisation can make it louder than the material was. Set your volume low before changing a setting, and turn it up afterwards.`,
  `Some countries do not allow a seller to exclude certain warranties or liabilities. Where that is the case, those rules apply and this notice does not take away rights the law gives you.`,
  `By using ${PRODUCT_NAME} you accept the above.`,
];

/** The button on the first-run notice. Stated as an act, not as a dismissal. */
export const DISCLAIMER_ACCEPT_LABEL = 'I understand and accept';

/** The way out for somebody who does not want to accept it. */
export const DISCLAIMER_DECLINE_LABEL = 'Quit';

/** Where the acknowledgement is written down. */
export const DISCLAIMER_ACCEPTED_KEY = 'fluideq.disclaimerAccepted';

/**
 * What was accepted, and when.
 *
 * A boolean would have been enough to stop the dialog reappearing and would be
 * worth nothing as evidence. The three fields together say which wording was
 * shown, which build showed it, and at what moment — which is the difference
 * between "the flag is set" and "this text was put in front of this person on
 * this date".
 */
export interface IDisclaimerAcceptance {
  /** The `DISCLAIMER_VERSION` that was on screen. */
  disclaimerVersion: number;
  /** The app version that displayed it, or an empty string if unknown. */
  appVersion: string;
  /** ISO 8601, UTC. */
  acceptedAt: string;
}

/**
 * Read a stored acknowledgement back, or `undefined` if there is not a valid one.
 *
 * Undefined for absent, unparseable, wrong-shaped and wrong-version records
 * alike. The bias runs the opposite way to the mandatory-update check on
 * purpose: there the failure that costs least is not blocking, here it is
 * showing the notice again. A user seeing it twice has lost ten seconds; a
 * user who never saw it has not been told.
 */
export const readAcceptance = (
  raw: string | null | undefined,
): IDisclaimerAcceptance | undefined => {
  if (typeof raw !== 'string' || raw.length === 0) {
    return undefined;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return undefined;
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return undefined;
  }
  const record = parsed as Partial<IDisclaimerAcceptance>;
  if (record.disclaimerVersion !== DISCLAIMER_VERSION) {
    return undefined;
  }
  if (typeof record.acceptedAt !== 'string' || record.acceptedAt.length === 0) {
    return undefined;
  }
  return {
    disclaimerVersion: DISCLAIMER_VERSION,
    appVersion: typeof record.appVersion === 'string' ? record.appVersion : '',
    acceptedAt: record.acceptedAt,
  };
};

/** The record to store, given the build showing it and the moment it happened. */
export const buildAcceptance = (
  appVersion: string,
  now: Date = new Date(),
): IDisclaimerAcceptance => ({
  disclaimerVersion: DISCLAIMER_VERSION,
  appVersion,
  acceptedAt: now.toISOString(),
});

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
 * GPL-3.0 sections 15 and 16, in words a person reads, in their own language.
 *
 * Nothing here is a new term. The disclaimer of warranty and the limitation of
 * liability are already in `LICENSE`, in the header of every source file, on
 * the installer's licence page and in the About panel's licence section. What
 * was missing was a version of them that somebody would actually read, and a
 * record that it was put in front of them at all.
 *
 * WHY THIS IS TRANSLATED WHEN THE REST OF THE ABOUT PANEL IS NOT
 *
 * The About panel's rule — untranslated, because every string in it is a legal
 * statement — is right about what is in that panel. A licence name, an
 * attribution, a copyright line and a trademark reservation are *identifiers*:
 * translating one changes what it names, and "GNU General Public License" is
 * the name of a thing in every country.
 *
 * This is a different kind of text. It is a notice a consumer has to read and
 * accept, and a term somebody could not read is a term that in much of the
 * world does not bind them — in the EU in particular, an unintelligible term
 * tends not to be enforceable against a consumer at all. English-only protects
 * less here, not more. So the disclaimer is translated and everything around it
 * in the About panel stays as it was.
 *
 * The licence's own name stays in English inside these sentences for the reason
 * above: it is the name of the document, not a description of it.
 *
 * WHAT THIS DELIBERATELY IS NOT
 *
 * It is not a terms of service, it is not an EULA, and it does not claim to be
 * enforceable everywhere. Consumer law in a number of countries limits what a
 * seller may disclaim no matter what a dialog says, so the text says so rather
 * than implying otherwise — a notice that overstates its own effect is worse
 * than one that does not exist, because it invites a user to believe they have
 * given up something they have not. `disclaimer.localLaw` is the sentence that
 * carries this, and it is the one paragraph that has to survive every
 * translation intact.
 */

import type { TranslationKey } from './i18n/en';

/**
 * The wording's own version, bumped whenever the sentences change.
 *
 * Acceptance is recorded against this rather than against the app version, so
 * a routine release does not re-prompt everyone and a change to what is being
 * agreed to does. Bump it for any change of meaning; a typo fix is a judgement
 * call and the cheap answer is to bump it anyway.
 *
 * 1 — English only.
 * 2 — translated into all ten shipped languages, with a clause naming the
 *     English text as the original. Different words in front of the user, so
 *     everybody who accepted version 1 is asked again.
 */
export const DISCLAIMER_VERSION = 2;

/** The heading, used by both the About section and the first-run notice. */
export const DISCLAIMER_HEADING_KEY: TranslationKey = 'disclaimer.heading';

/**
 * The notice itself, in the order it is read.
 *
 * One list, two readers — the About panel and the acknowledgement — so that
 * what a user agreed to on first run and what they can go back and re-read are
 * the same sentences rather than two drafts that diverge. Both render it
 * through the same `t`, so both are in the same language too: somebody who
 * accepted this in Spanish and later found it in English in the About panel
 * would be right to wonder which one they had agreed to.
 *
 * `disclaimer.liability` interpolates `{author}`, which is the one placeholder
 * in this text. It names the person disclaiming liability, and a fork that
 * renamed the program — which TRADEMARK.md asks a fork to do — must not be left
 * naming the wrong person in ten languages. `i18n.test.ts` checks that the
 * placeholder survives every translation.
 */
export const DISCLAIMER_PARAGRAPH_KEYS: readonly TranslationKey[] = [
  'disclaimer.asIs',
  'disclaimer.liability',
  'disclaimer.volume',
  'disclaimer.localLaw',
  'disclaimer.accepting',
];

/**
 * Which text is the original, said quietly at the end.
 *
 * Standard, and it protects in both directions: the reader gets a notice in a
 * language they can read, and a slip in one of ten translations cannot be read
 * as a different promise from the one that was made. Separate from the
 * paragraphs above because it is a note about the notice rather than part of
 * it, and it is set in the quieter style for the same reason.
 */
export const DISCLAIMER_LANGUAGE_KEY: TranslationKey = 'disclaimer.language';

/** The button on the first-run notice. Stated as an act, not as a dismissal. */
export const DISCLAIMER_ACCEPT_KEY: TranslationKey = 'disclaimer.accept';

/** The way out for somebody who does not want to accept it. */
export const DISCLAIMER_DECLINE_KEY: TranslationKey = 'disclaimer.decline';

/** Where the acknowledgement is written down. */
export const DISCLAIMER_ACCEPTED_KEY = 'fluideq.disclaimerAccepted';

/**
 * What was accepted, in which language, and when.
 *
 * A boolean would have been enough to stop the dialog reappearing and would be
 * worth nothing as evidence. These four fields say which wording was shown, in
 * which of the ten languages, by which build, and at what moment — which is the
 * difference between "the flag is set" and "this text was put in front of this
 * person on this date". The locale earns its place now that the text is
 * translated: without it the record no longer identifies the words that were
 * actually on screen.
 */
export interface IDisclaimerAcceptance {
  /** The `DISCLAIMER_VERSION` that was on screen. */
  disclaimerVersion: number;
  /** The interface language it was read in, or an empty string if unknown. */
  locale: string;
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
 * purpose: there the failure that costs least is not interrupting anyone, here
 * it is showing the notice again. A user seeing it twice has lost ten seconds;
 * a user who never saw it has not been told.
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
    locale: typeof record.locale === 'string' ? record.locale : '',
    appVersion: typeof record.appVersion === 'string' ? record.appVersion : '',
    acceptedAt: record.acceptedAt,
  };
};

/** The record to store: the build and language showing it, and the moment. */
export const buildAcceptance = (
  appVersion: string,
  locale: string,
  now: Date = new Date(),
): IDisclaimerAcceptance => ({
  disclaimerVersion: DISCLAIMER_VERSION,
  locale,
  appVersion,
  acceptedAt: now.toISOString(),
});

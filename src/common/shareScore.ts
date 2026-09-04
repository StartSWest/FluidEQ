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
 * Turning a score into something postable.
 *
 * Kept out of the component and free of the DOM so the awkward parts — what
 * each network will and will not accept in a URL, and how a score becomes a
 * sentence — can be tested without rendering anything.
 */

import { PRODUCT_NAME } from './branding';

export type ShareNetwork = 'x' | 'linkedin' | 'facebook';

export interface IShareNetwork {
  id: ShareNetwork;
  /** Shown on the button. A brand name, so never translated. */
  label: string;
}

/**
 * The networks offered, in the order they are shown.
 *
 * Three, deliberately. A row of a dozen icons is a decision to make rather
 * than an invitation to share, and anyone who wants somewhere else has the
 * copy button.
 */
export const SHARE_NETWORKS: IShareNetwork[] = [
  { id: 'x', label: 'X' },
  { id: 'linkedin', label: 'LinkedIn' },
  { id: 'facebook', label: 'Facebook' },
];

/**
 * The multiplier at which the run is at the ceiling.
 *
 * Named rather than written as a bare 10 in three places, because the card,
 * the text and the button that offers the share all have to agree about what
 * counts as euphoria — and if they ever disagree, someone posts a card saying
 * one thing under a sentence saying another.
 */
export const EUPHORIA_MULTIPLIER = 10;

/** Whether this run earned the full treatment. */
export const isEuphoricRun = (multiplier: number): boolean =>
  multiplier >= EUPHORIA_MULTIPLIER;

/** Filename for the saved card. */
export const getShareFileName = (score: number, euphoric = false): string =>
  `fluideq-${euphoric ? 'euphoria' : 'score'}-${Math.max(
    0,
    Math.floor(score),
  )}.png`;

/**
 * Who the post is being written for.
 *
 * `copy` is the clipboard button, which has no limit and no house style — it is
 * pasted wherever the reader is already writing.
 */
export type ShareAudience = ShareNetwork | 'copy';

/**
 * The run, in one clause.
 *
 * The score is the reason somebody pressed share; it is not the reason anybody
 * else stops scrolling. So it goes at the END of every version below, after the
 * app has been introduced — a person who has never heard of FluidEQ needs to
 * know what it is before a number from it means anything.
 *
 * The multiplier is only claimed once it has been reached, because "×1" reads
 * worse than saying nothing. Rainbow mode is named as what it is — a look the
 * game unlocks — rather than as the headline it used to be.
 */
const runClause = (
  score: number,
  multiplier: number,
  euphoric: boolean,
  compact = false,
) => {
  const points = Math.max(0, Math.floor(score));
  const peak = Math.max(1, Math.floor(multiplier));
  const top = Math.max(EUPHORIA_MULTIPLIER, peak);
  if (compact) {
    return euphoric
      ? `It hides a beat game: ×${top}, ${points} points, and the interface goes rainbow.`
      : `It hides a beat game: ${points} points at ×${peak}.`;
  }
  if (euphoric) {
    return `It also hides a beat game: I ran the streak to ×${top} for ${points} points and the whole interface went rainbow.`;
  }
  return `It also hides a beat game, where I just scored ${points} points at ×${peak}.`;
};

/**
 * What gets posted.
 *
 * The app leads, every time. This text is an advert that happens to carry a
 * score, not a score that happens to name an app: the reader is somebody who
 * has never opened FluidEQ, and what reaches them has to say what it is and
 * what it does before it says how well anyone played.
 *
 * One version per destination, because the three do not read the same. X counts
 * characters and shows the words in the post itself; LinkedIn is read at work
 * and strips prefilled text, so its version exists for the copy button beside
 * it; Facebook is neither. The claims are the README's, unshortened past the
 * point where they stay true.
 *
 * NO EM DASHES, in any of them. It is the single most recognisable tell of text
 * a machine wrote, and a post advertising this app cannot be the thing people
 * scroll past for that reason. Commas and full stops do the same work.
 *
 * The band count is not in here either. "Up to 128 bands" is a specification,
 * and a stranger reading a post has no way to know whether that is a lot; what
 * sells the app is that the tuning follows the device on its own.
 *
 * The address is NOT written into the words. Every path that uses this text
 * appends the URL after it, so a site named in the sentence came out as
 * "fluideq.com https://fluideq.com" in the composer.
 */
export const buildShareText = (
  score: number,
  multiplier: number,
  euphoric = isEuphoricRun(multiplier),
  audience: ShareAudience = 'copy',
): string => {
  const run = runClause(score, multiplier, euphoric);
  switch (audience) {
    // 280 characters including a link that counts as 23 whatever its length,
    // so this is the one version written to a budget: 247 at the longest score
    // and multiplier either sentence can carry. Everything that survives the
    // cut is a thing the app does.
    case 'x':
      return `${PRODUCT_NAME} is a free, open-source system-wide equaliser for Windows. Tune an output once and every app on it follows, with headphone correction, voicing curves and Smart EQ. ${runClause(
        score,
        multiplier,
        euphoric,
        true,
      )}`;
    case 'linkedin':
      return `${PRODUCT_NAME} is a free, open-source system-wide equaliser for Windows 10 and 11. Every setting belongs to the output it was made on, so the right tuning follows the right device with nothing to switch by hand: a published measurement for your exact headphones, curated voicing curves, and a Smart EQ built from a measurement of your own sound, all drawn over the live response. ${run}`;
    case 'facebook':
      return `If your headphones sound wrong in half the apps you use, this fixes it once. ${PRODUCT_NAME} is a free, open-source system-wide equaliser for Windows. Tune each output once, with a correction for your exact headphone model, voicing curves and a Smart EQ measured from your own sound, and it follows that device around by itself. ${run}`;
    default:
      return `${PRODUCT_NAME} is a free, open-source system-wide equaliser for Windows. Tune each output once, with headphone correction, voicing curves and a Smart EQ measured from your own sound, and the right tuning follows the right device by itself. ${run}`;
  }
};

/**
 * Where the share button sends them.
 *
 * None of these can carry the image. Every one of the three strips anything
 * but a link and its own preview, so the card has to be saved and attached by
 * hand — which is what the note beside the buttons says. What a URL CAN do is
 * open the composer with the words already in it, and that is the part worth
 * automating.
 */
export const getShareUrl = (
  network: ShareNetwork,
  text: string,
  url: string,
): string => {
  const encodedUrl = encodeURIComponent(url);
  switch (network) {
    case 'x':
      return `https://twitter.com/intent/tweet?text=${encodeURIComponent(
        text,
      )}&url=${encodedUrl}`;
    // LinkedIn dropped support for prefilled text on the share endpoint: it
    // now reads the link and nothing else. Passing the sentence anyway would
    // be writing something the user never sees, so this sends the link and
    // leaves the copy button to carry the words.
    case 'linkedin':
      return `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`;
    case 'facebook':
      return `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`;
    default:
      return url;
  }
};

/** Whether a network will actually show the text, so the UI can say so. */
export const carriesShareText = (network: ShareNetwork): boolean =>
  network === 'x';

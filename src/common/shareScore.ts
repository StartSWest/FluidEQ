/*
<AQUA: System-wide parametric audio equalizer interface>
Copyright (C) <2023>  <AQUA Dev Team>

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
 * What gets posted.
 *
 * The multiplier is only mentioned once it has been reached, because claiming
 * "×1" is worse than claiming nothing. Kept short enough to survive X's limit
 * with the URL attached, which is the tightest of the three by a wide margin.
 */
export const buildShareText = (
  score: number,
  multiplier: number,
  euphoric = isEuphoricRun(multiplier),
): string => {
  const points = Math.max(0, Math.floor(score));
  const peak = Math.max(1, Math.floor(multiplier));
  if (euphoric) {
    // Reaching the ceiling is the whole story, so it leads. Thirty-six
    // consecutive perfect taps is the thing worth telling people about; the
    // number is the evidence, not the headline.
    return `I hit EUPHORIA MODE — ×${Math.max(EUPHORIA_MULTIPLIER, peak)}, ${points} points — on the beat game hidden inside FluidEQ, a free open-source equaliser for Windows. The entire interface goes rainbow with the music.`;
  }
  return `I scored ${points} points at ×${peak} on the beat game hidden inside FluidEQ, a free open-source equaliser for Windows.`;
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

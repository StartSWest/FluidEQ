/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { parseCssColour } from '../utils/oklab';
import { stopOnWhite } from '../utils/rainbowPalette';
import { readSurface } from '../utils/theme';
import { isLightWindow } from '../utils/windowSide';

// THE KARAOKE'S DRAWINGS ON A WHITE WINDOW (Ivan, 2026-11-18: "fix karaoke,
// not good", and of the Maker "fix maker too notes, lyrics and waves on top").
// Every colour the stage's strip and the Maker's editor paint was chosen for a
// dark window: pale cyans, mint and peach washes, a near-white for words.
// On white those were 1.1 to 1.9:1 - note names, word rows and the stem
// waves all but gone. On a light window each one is taken down in OKLab
// lightness, hue kept (`stopOnWhite`), to the contrast its job needs; on a
// dark window it is returned exactly as written, so nothing there moves.

/**
 * A mark - a bar, a line, a wave, a dot - on white. WCAG 1.4.11 asks 3:1;
 * a little more, because the stage and the Maker lie on the floor and the
 * card (#ececec to #ffffff), not on pure white: 3.4:1 on white is 3:1 on the
 * floor.
 */
export const MARK_ON_WHITE = 3.4;

/**
 * Small words drawn in a colour - a note's name, a verdict, a lane's label,
 * 9-10px - on white: 5.3:1 there is 4.5:1 (WCAG 1.4.3) on the floor.
 */
export const TEXT_ON_WHITE = 5.3;

/** Transparent: a glow on a white window is a grey smudge, not light. */
const NO_GLOW = 'rgba(0, 0, 0, 0)';

const made = new Map<string, string>();

/** An sRGB channel, 0 to 1 as `parseCssColour` gives it, as a byte. */
const byteOf = (channel: number) =>
  Math.round(Math.min(1, Math.max(0, channel)) * 255);

const hexOf = (rgb: readonly number[]) =>
  `#${rgb.map((channel) => byteOf(channel).toString(16).padStart(2, '0')).join('')}`;

/**
 * `colour` as a white window wears it: the same hue, deep enough for
 * `ratio` on white; a mark keeps the alpha it was written with (a wash stays
 * a wash), a word at text's ratio is drawn solid.
 * Made once per colour and ratio; the drawings ask every frame.
 */
export const onWhite = (colour: string, ratio = MARK_ON_WHITE): string => {
  const key = `${colour}|${ratio}`;
  const known = made.get(key);
  if (known !== undefined) {
    return known;
  }
  const parsed = parseCssColour(colour);
  let out = colour;
  if (parsed) {
    const deep = parseCssColour(stopOnWhite(hexOf(parsed.rgb), ratio));
    if (deep) {
      const [red, green, blue] = deep.rgb.map(byteOf);
      // Words are solid: a name written at 90% lost half a step of the
      // contrast it was taken down for (4.45:1 where 5.3 was asked).
      out =
        parsed.alpha < 1 && ratio < TEXT_ON_WHITE
          ? `rgba(${red}, ${green}, ${blue}, ${Number(parsed.alpha.toFixed(3))})`
          : `rgb(${red}, ${green}, ${blue})`;
    }
  }
  made.set(key, out);
  return out;
};

/** `colour` on a dark window; its `onWhite` copy on a light one. */
export const inkForSide = (colour: string, ratio = MARK_ON_WHITE): string =>
  isLightWindow() ? onWhite(colour, ratio) : colour;

/** A glow's colour on a dark window; none on a light one. */
export const glowForSide = (colour: string): string =>
  isLightWindow() ? NO_GLOW : colour;

/**
 * How a name is written over a picture on a white window, as the lyrics are
 * there: a light face keyed in the window's own dark ink (Ivan, 2026-11-18:
 * "white text with a dark border ... clean, not green"; "fix the notes too
 * so they adapt like the lyrics"). The window's dark inks alone vanish into
 * a night picture, and a light one alone into snow.
 */
export interface IPictureKey {
  face: string;
  key: string;
}

/** Light faces, the lit one a step brighter. */
const KEYED_FACE = 'rgba(244, 248, 250, .96)';
const KEYED_FACE_LIT = '#ffffff';

/** The key for names over a picture on a white window; none elsewhere. */
export const pictureKeyFor = (overPicture: boolean): IPictureKey | undefined =>
  overPicture && isLightWindow()
    ? { face: KEYED_FACE, key: readSurface('--text-primary', '#1b1b1b') }
    : undefined;

/**
 * Writes `text` in the context's font and alignment: keyed when `keyed` is
 * given (`lit` the brighter face), else filled in `ink`.
 */
export const writeName = (
  context: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  ink: string,
  keyed: IPictureKey | undefined,
  lit = false,
) => {
  if (keyed) {
    context.save();
    context.lineJoin = 'round';
    context.lineWidth = 2.6;
    context.strokeStyle = keyed.key;
    context.strokeText(text, x, y);
    context.restore();
    context.fillStyle = lit ? KEYED_FACE_LIT : keyed.face;
  } else {
    context.fillStyle = ink;
  }
  context.fillText(text, x, y);
};

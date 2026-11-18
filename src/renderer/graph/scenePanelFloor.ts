/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  clamp01,
  contrast,
  luminance,
  parseCssColour,
  toGamma,
  toLinear,
} from '../utils/oklab';

/**
 * HOW SEE-THROUGH THE EQ PAGE'S PANELS MAY BE OVER WHAT IS BEHIND THEM NOW.
 *
 * Over a Plus scene the bands' card, its tab row and the graph's legend let
 * the picture through as far as the View menu's Transparency says
 * (`scenePanels.ts`, up to 50%). Their words are the window's own, so they
 * read only while the face under them stays on the window's side: a light
 * window's white card thinned over a night sky, or a dark window's slate
 * card over a pale one, fell into the mid-greys where no word reaches its
 * contrast - "BANDS", "Tone" and "Off" were lost at 50% (Ivan, 2026-11-17,
 * approving the one colour model). The Transparency stays the cap; this is
 * the floor under it: the thinnest face at which every ink still reaches its
 * contrast over the picture behind the card, read on the scene's own frames
 * (`useSceneInk.ts`). Over a picture on the window's own side it is no floor
 * at all, and the card is as see-through as chosen.
 */

/** The panels' face at full: `$surface-section`, the pane at 85%. */
export const SECTION_FACE_ALPHA = 0.85;

/** An ink the panel's words are written in, and the contrast it must keep. */
export interface IPanelInk {
  readonly colour: string;
  readonly contrast: number;
}

/** Halving steps for the face: far finer than the 1% the face is set in. */
const STEPS = 20;

/**
 * The least share of the panels' own face (0 to 100, as
 * `--scene-panel-face` is written) at which every one of `inks` keeps its
 * contrast on `panel` laid over a picture of mean relative luminance
 * `picture`. 0 when the bare picture already gives it, 100 when nothing
 * short of the full face does.
 *
 * The picture is taken as a grey of its luminance, and the face is mixed
 * over it channel by channel in sRGB, as the browser composites it.
 */
export const scenePanelFloor = (
  picture: number,
  panel: string,
  inks: readonly IPanelInk[],
): number => {
  const face = parseCssColour(panel);
  if (!face || !Number.isFinite(picture)) {
    return 0;
  }
  const behind = toGamma(clamp01(picture));
  const wanted = inks.flatMap((ink) => {
    const parsed = parseCssColour(ink.colour);
    return parsed
      ? [{ level: luminance(parsed.rgb.map(toLinear)), at: ink.contrast }]
      : [];
  });
  const groundAt = (alpha: number) =>
    luminance(
      face.rgb.map((channel) =>
        toLinear(alpha * channel + (1 - alpha) * behind),
      ),
    );
  const reads = (alpha: number) => {
    const ground = groundAt(alpha);
    return wanted.every(({ level, at }) => contrast(level, ground) >= at);
  };
  if (reads(0)) {
    return 0;
  }
  if (!reads(SECTION_FACE_ALPHA)) {
    return 100;
  }
  let thin = 0;
  let thick = SECTION_FACE_ALPHA;
  for (let step = 0; step < STEPS; step += 1) {
    const middle = (thin + thick) / 2;
    if (reads(middle)) {
      thick = middle;
    } else {
      thin = middle;
    }
  }
  return Math.min(100, Math.ceil((thick / SECTION_FACE_ALPHA) * 100));
};

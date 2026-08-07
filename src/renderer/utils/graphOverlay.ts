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

import { useSyncExternalStore } from 'react';
import { createPerViewSetting } from './graphStyle';

/**
 * How much of the page shows through the full-screen graph.
 *
 * A setting rather than a number picked here, because there is no single right
 * answer and the two ends are both legitimate. A visualiser playing underneath
 * is worth seeing, and the graph over it wants to be glass. A frequency
 * response being read carefully wants a solid card behind it and nothing else
 * moving. Which of those somebody is doing is not something this file can know.
 *
 * Two values, because they are genuinely separate controls and pretending
 * otherwise makes both worse:
 *
 *  - **Opacity** decides how much comes through at all.
 *  - **Blur** decides whether what comes through is a picture or a wash of
 *    light. A visualiser is worth seeing sharp; a talking head behind a
 *    spectrum is a competing thing to look at, and blurring it hard turns it
 *    back into colour and movement.
 *
 * Persisted. It is a preference about how somebody likes to look at their own
 * screen, not a mode, and having to set it again every launch is how a setting
 * ends up never being used.
 *
 * Persisted once per view mode, at that. The two larger modes are both cards
 * laid over the workspace and both read these variables, but they are laid over
 * different things: expanded floats over whatever editor is open, full screen
 * over a video with everything else gone. Glass is the obvious answer to one of
 * those and often the wrong answer to the other, and a single shared value made
 * choosing for one a choice for both. These are stems rather than keys for that
 * reason — see `createPerViewSetting`, which owns the naming and the migration.
 */
const OPACITY_KEY = 'fluideq.graphOverlayOpacity';
const BLUR_KEY = 'fluideq.graphOverlayBlur';

/**
 * Solid, and no blur.
 *
 * The default is the safe end deliberately. Somebody who has never opened this
 * setting gets a graph they can read; seeing through it is the thing you go
 * looking for, not the thing you are given and have to undo.
 */
const DEFAULT_OPACITY = 1;
const DEFAULT_BLUR = 0;

/**
 * All the way to clear.
 *
 * There was a floor here, on the reasoning that a panel faded to nothing is a
 * panel nobody can find again. That reasoning was wrong about what the fade
 * applies to: the transparency is on the surface layer *behind* the drawing, so
 * at zero the card's background disappears and everything on it — the curve,
 * the grid, the header and its controls — is still there at full strength,
 * painted straight over the video. Which is the best thing this setting does,
 * and it was the one position it would not go to.
 */
export const MIN_OVERLAY_OPACITY = 0;

/** Past this the backdrop is a flat wash and more costs frames for nothing. */
export const MAX_OVERLAY_BLUR = 40;

const clamp = (value: number, low: number, high: number) =>
  Math.min(high, Math.max(low, value));

/**
 * Anything that is not a number is the default rather than a refusal.
 *
 * What is in storage was written by some build of this app, but not
 * necessarily this one, and it is a string either way. A slider given `NaN`
 * stops responding to the pointer entirely — there is no position for it to be
 * at — so a value that cannot be read is treated as one that was never set.
 * Clamped as well as parsed, because the bounds have moved once already and
 * will again.
 */
const parseNumber =
  (fallback: number, low: number, high: number) => (raw: string) => {
    const value = Number(raw);
    return Number.isFinite(value) ? clamp(value, low, high) : fallback;
  };

const serializeNumber = (value: number) => String(value);

const opacitySetting = createPerViewSetting(
  OPACITY_KEY,
  DEFAULT_OPACITY,
  parseNumber(DEFAULT_OPACITY, MIN_OVERLAY_OPACITY, 1),
  serializeNumber,
);

const blurSetting = createPerViewSetting(
  BLUR_KEY,
  DEFAULT_BLUR,
  parseNumber(DEFAULT_BLUR, 0, MAX_OVERLAY_BLUR),
  serializeNumber,
);

// Clamped here as well as on the way out of storage. The store keeps whatever
// it is handed, and these are driven by a range input whose bounds are props —
// which is one refactor away from being wrong.
export const setOverlayOpacity = (next: number) => {
  opacitySetting.set(clamp(next, MIN_OVERLAY_OPACITY, 1));
};

export const setOverlayBlur = (next: number) => {
  blurSetting.set(clamp(Math.round(next), 0, MAX_OVERLAY_BLUR));
};

/**
 * The same two values outside a render, for the same reason the graph store has
 * `getGraphView` beside `useGraphView`.
 */
export const getOverlayOpacity = () => opacitySetting.get();
export const getOverlayBlur = () => blurSetting.get();

export const useOverlayOpacity = () =>
  useSyncExternalStore(
    opacitySetting.subscribe,
    opacitySetting.get,
    () => DEFAULT_OPACITY,
  );

export const useOverlayBlur = () =>
  useSyncExternalStore(
    blurSetting.subscribe,
    blurSetting.get,
    () => DEFAULT_BLUR,
  );

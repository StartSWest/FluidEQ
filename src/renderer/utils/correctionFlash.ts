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

import { useSyncExternalStore } from 'react';

/**
 * A correction having just landed, for a moment.
 *
 * The continuous modes spend nearly all of their time listening and finding
 * nothing to fix, so the one instant worth marking is the one where the config
 * on disk actually changed — which is also the only instant where the sound
 * changed. The bubble goes green on it.
 *
 * Set when the write settles rather than when it is decided, so it cannot claim
 * a correction that never reached Equalizer APO.
 *
 * A store rather than state because the two ends are far apart in time: the
 * write resolves inside a promise belonging to a capture callback, long after
 * the render that started it.
 */

export interface IFlashedRange {
  label: string;
  lowFrequency: number;
  highFrequency: number;
}

/** One correction landing, and which landing it is. */
export interface ICorrectionFlash {
  /** Bumped per landing, so two in a row are two moments rather than one. */
  id: number;
  regions: readonly IFlashedRange[];
}

/**
 * How long the moment lasts is the stylesheet's: the bubble's text holds the
 * applied colour for its `eq-bubble-applied` animation (`MainContent.scss`),
 * and the end of that animation is what ends the flash (`endCorrectionFlash`).
 *
 * It was a timer here, a second and a half from the write. A timer runs
 * whether or not anything is drawn, so a correction landing behind a
 * minimised window was over before anybody could see it, and the timer and
 * the colour were two clocks that only agreed while the window painted.
 */
let flash: ICorrectionFlash | undefined;
let lastId = 0;
const listeners = new Set<() => void>();

const emit = () => listeners.forEach((listener) => listener());

export const flashCorrection = (regions: readonly IFlashedRange[]) => {
  // With nothing mounted to show it, a landing is shown to nobody — and kept,
  // it would turn the bubble green over an old write whenever the EQ page next
  // opened, which is the one thing the colour must never say.
  if (regions.length === 0 || listeners.size === 0) {
    return;
  }
  lastId += 1;
  flash = { id: lastId, regions };
  emit();
};

/**
 * The moment named by `id` has been shown, so it is over.
 *
 * By id, because a second correction can land while the first is still
 * showing: the first one's end must not take the second away.
 */
export const endCorrectionFlash = (id: number) => {
  if (flash?.id !== id) {
    return;
  }
  flash = undefined;
  emit();
};

/**
 * Module-level rather than written inline in the hook, so React keeps one
 * subscription for the life of the component instead of swapping it on every
 * render — which would empty the set for a moment each time, and the last
 * one leaving is what ends a flash.
 */
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    // The page that showed it has gone — another tab opened — and the
    // animation that would have ended it went with it. Nothing will end it
    // now, so it is over.
    if (listeners.size === 0) {
      flash = undefined;
    }
  };
};

export const useCorrectionFlash = () =>
  useSyncExternalStore(
    subscribe,
    () => flash,
    () => undefined,
  );

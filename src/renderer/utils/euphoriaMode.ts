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
 * COLOURFUL MODE IS ALWAYS ON, AND HAS NO SWITCH (Ivan, 2026-11-18: "let's
 * remove the Colourful mode from the top, there is no more of it: Colourful
 * mode is always on"). It was a prize won in the rhythm game, then always on
 * with a switch in the menus, a pill on the signal and Ctrl+E to turn it off.
 * What it draws in is now the window's own pair of colours
 * (`windowTint.ts`): one colour unless the listener gives the Tint a second,
 * and then a gradient between the two — so "off" is simply both swatches the
 * same colour.
 *
 * The root carries `is-euphoric` for good (`EuphoriaGlow`): the stylesheets
 * and the canvas painters still key the look on it.
 */

import { useSyncExternalStore } from 'react';

/**
 * What older versions stored the mode under: the unlock, the first switch and
 * the last one. Read by nothing now, and forgotten on launch so a choice made
 * while the mode could be switched off does not linger in the profile.
 */
const RETIRED_KEYS = [
  'fluideq-euphoria-reached',
  'fluideq-euphoria-enabled',
  'fluideq-rainbow',
] as const;

export const forgetColourfulModeSwitch = () => {
  try {
    RETIRED_KEYS.forEach((key) => window.localStorage.removeItem(key));
  } catch {
    // Storage unavailable: there is nothing stored to forget either.
  }
};

/**
 * Whether the root carries the look, observed so a component re-renders when
 * the class arrives — it is set by a layout effect at the root, after the
 * first render of anything below it.
 */
const subscribeToRootEuphoria = (onChange: () => void) => {
  if (typeof document === 'undefined') {
    return () => {};
  }
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class'],
  });
  return () => observer.disconnect();
};

export const useIsRootEuphoric = () =>
  useSyncExternalStore(
    subscribeToRootEuphoria,
    () =>
      typeof document !== 'undefined' &&
      document.documentElement.classList.contains('is-euphoric'),
    () => false,
  );

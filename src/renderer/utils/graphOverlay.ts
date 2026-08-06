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
 * Never fully clear.
 *
 * Below about a fifth the grid and the axis labels stop being legible against
 * anything bright, and the control that would put it back is drawn on the same
 * surface — so the floor is what stops somebody making the panel invisible and
 * then being unable to find it.
 */
export const MIN_OVERLAY_OPACITY = 0.2;

/** Past this the backdrop is a flat wash and more costs frames for nothing. */
export const MAX_OVERLAY_BLUR = 40;

const clamp = (value: number, low: number, high: number) =>
  Math.min(high, Math.max(low, value));

const readStored = (
  key: string,
  fallback: number,
  low: number,
  high: number,
) => {
  try {
    const raw = window.localStorage.getItem(key);
    if (raw === null) {
      return fallback;
    }
    const value = Number(raw);
    return Number.isFinite(value) ? clamp(value, low, high) : fallback;
  } catch {
    return fallback;
  }
};

let opacity = readStored(OPACITY_KEY, DEFAULT_OPACITY, MIN_OVERLAY_OPACITY, 1);
let blur = readStored(BLUR_KEY, DEFAULT_BLUR, 0, MAX_OVERLAY_BLUR);

const listeners = new Set<() => void>();

const publish = (key: string, value: number) => {
  try {
    window.localStorage.setItem(key, String(value));
  } catch {
    // A preference that cannot be written is not worth failing a drag over.
  }
  listeners.forEach((listener) => listener());
};

export const setOverlayOpacity = (next: number) => {
  const value = clamp(next, MIN_OVERLAY_OPACITY, 1);
  if (value === opacity) {
    return;
  }
  opacity = value;
  publish(OPACITY_KEY, value);
};

export const setOverlayBlur = (next: number) => {
  const value = clamp(Math.round(next), 0, MAX_OVERLAY_BLUR);
  if (value === blur) {
    return;
  }
  blur = value;
  publish(BLUR_KEY, value);
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const useOverlayOpacity = () =>
  useSyncExternalStore(
    subscribe,
    () => opacity,
    () => DEFAULT_OPACITY,
  );

export const useOverlayBlur = () =>
  useSyncExternalStore(
    subscribe,
    () => blur,
    () => DEFAULT_BLUR,
  );

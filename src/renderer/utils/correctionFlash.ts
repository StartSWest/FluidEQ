/*
<AQUA: System-wide parametric audio equalizer interface>
Copyright (C) <2023>  <AQUA Dev Team>
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

/** How long the marks stay up. Long enough to catch, short enough to miss. */
export const CORRECTION_FLASH_MS = 1500;

let flashed: readonly IFlashedRange[] = [];
const NONE: readonly IFlashedRange[] = [];
let timer: ReturnType<typeof setTimeout> | undefined;
const listeners = new Set<() => void>();

const emit = () => listeners.forEach((listener) => listener());

export const flashCorrection = (regions: readonly IFlashedRange[]) => {
  if (regions.length === 0) {
    return;
  }
  flashed = regions;
  if (timer) {
    clearTimeout(timer);
  }
  timer = setTimeout(() => {
    flashed = NONE;
    timer = undefined;
    emit();
  }, CORRECTION_FLASH_MS);
  emit();
};

export const useCorrectionFlash = () =>
  useSyncExternalStore(
    (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    () => flashed,
    () => NONE,
  );

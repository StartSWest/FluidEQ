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

import { MAX_GAIN, MIN_GAIN } from 'common/constants';

/**
 * The preamp the USER chose, kept apart from the one auto-normalize computes.
 *
 * The two used to be the same number and there was no way to tell them apart:
 * both the slider and the automatic headroom effect wrote `preAmp` through the
 * same call, so switching auto-normalize off left the preamp parked wherever
 * the last automatic value had put it. Somebody who had deliberately set −3 dB,
 * turned auto-normalize on, and turned it off again got −7.4 dB and no way back
 * to their own figure except to remember it.
 *
 * So this remembers only the deliberate one. The slider writes here; the
 * automatic effect does not and must not — a value nobody chose is not a value
 * to restore. It survives a restart because the choice does: the preamp itself
 * is stored with the preset, but by then it may be an automatic figure, so this
 * is the only record of what was actually meant.
 *
 * Zero when there has never been one, which is the honest default: it is where
 * the app starts and where "no opinion" belongs.
 */
const STORAGE_KEY = 'fluideq.manualPreAmp';

const read = (): number => {
  try {
    const stored = Number(window.localStorage.getItem(STORAGE_KEY));
    // Anything outside the range, or not a number at all, is not a preamp
    // somebody set — it is a corrupted key or a different version's idea.
    return Number.isFinite(stored) && stored >= MIN_GAIN && stored <= MAX_GAIN
      ? stored
      : 0;
  } catch {
    return 0;
  }
};

let manual = read();

export const getManualPreAmp = () => manual;

/**
 * Called from the preamp slider and nowhere else.
 *
 * The slider is disabled while auto-normalize is on, so every value that
 * reaches here is one somebody moved a control to produce.
 */
export const rememberManualPreAmp = (value: number) => {
  if (!Number.isFinite(value)) {
    return;
  }
  manual = value;
  try {
    window.localStorage.setItem(STORAGE_KEY, String(manual));
  } catch {
    // Not worth failing the edit over; it simply will not survive a restart.
  }
};

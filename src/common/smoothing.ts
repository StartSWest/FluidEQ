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
 * Easing a drawn frame toward the last one the analyser produced.
 *
 * The analyser publishes about twenty-two times a second, which is the rate
 * the audio is actually measured at and not something worth raising — the FFT
 * is the expensive half. A display runs at sixty or more, so drawing only when
 * a measurement lands means two thirds of the frames show the same picture as
 * the one before, and the eye reads that as stepping.
 *
 * These fill the gaps. The measured frame is the target; what is drawn chases
 * it every time the display is ready, so the shape is always moving even
 * though the data underneath arrives in bursts.
 */

/**
 * Below this a value has arrived, and chasing it further is invisible work.
 *
 * Without a floor an exponential ease never technically finishes, so the
 * animation loop would run for the life of the app on differences of a
 * billionth.
 */
const SETTLED_EPSILON = 0.0005;

/**
 * How far to move toward the target in one frame, corrected for how long that
 * frame actually took.
 *
 * A fixed per-frame fraction ties the speed of the easing to the speed of the
 * machine: the same value settles in half the time on a 120Hz display and
 * crawls on a busy one. Converting through the elapsed time makes the motion
 * take the same wall-clock duration everywhere, which is what "smooth" has to
 * mean if it is going to survive leaving a laptop plugged in.
 *
 * `halfLifeMs` is how long the remaining distance takes to halve — a more
 * useful handle than a per-frame fraction, because it is a duration and can be
 * reasoned about against the 45ms between measurements.
 */
export const getEaseFactor = (deltaMs: number, halfLifeMs: number): number => {
  if (halfLifeMs <= 0) {
    return 1;
  }
  // Clamped, because a tab that was backgrounded hands back an enormous delta
  // on its first frame and would otherwise snap.
  const elapsed = Math.max(0, Math.min(deltaMs, halfLifeMs * 8));
  return 1 - 2 ** (-elapsed / halfLifeMs);
};

/**
 * The gap between drawn frames, by mode.
 *
 * Sixty is not free — every frame is an ease across hundreds of values and a
 * path rebuilt from them — so it is spent where it is the point and not
 * everywhere. Euphoria is a celebration somebody earned and is watching;
 * ordinary use is a meter glanced at beside an equaliser, and thirty is past
 * the rate at which a moving line reads as continuous.
 *
 * Zero means "every frame the display offers", which is sixty on most screens
 * and more on some. The cap is a floor on the interval rather than a target
 * rate, so a 144Hz display is not held to 60 during euphoria.
 */
export const SMOOTH_FRAME_MS = 1000 / 30;
export const EUPHORIA_FRAME_MS = 0;

/** Whether enough time has passed to be worth drawing again. */
export const shouldDrawFrame = (
  elapsedMs: number,
  minFrameMs: number,
): boolean => elapsedMs >= minFrameMs;

/**
 * Move `current` toward `target` in place, and say whether it is still going.
 *
 * In place because this runs every animation frame over hundreds of values:
 * allocating a new array each time is the exact per-frame garbage that the
 * rest of this pipeline has been carefully avoiding.
 *
 * Returns false once everything has arrived, which is the signal to stop the
 * animation loop rather than idle at sixty frames a second over a static
 * picture.
 */
export const easeTowards = (
  current: number[],
  target: readonly number[],
  factor: number,
): boolean => {
  let moving = false;
  for (let index = 0; index < current.length; index += 1) {
    const distance = target[index] - current[index];
    if (distance > SETTLED_EPSILON || distance < -SETTLED_EPSILON) {
      current[index] += distance * factor;
      moving = true;
    } else {
      // Snapped rather than left a hair short, so a settled frame is exactly
      // the measured one and not a permanent rounding error away from it.
      current[index] = target[index];
    }
  }
  return moving;
};

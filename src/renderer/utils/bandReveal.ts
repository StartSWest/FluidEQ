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

import { IFiltersMap, NO_GAIN_FILTER_TYPES } from 'common/constants';
import { cloneFilters } from 'common/utils';
import { chosenMotion } from './motionPreference';
import { clamp } from './utils';

/**
 * Bringing a new set of gains in one band at a time.
 *
 * A whole tuning arriving in a single commit — every slider in the editor
 * teleporting at once — reads as a glitch rather than as a result. Walked from
 * the bottom of the spectrum upwards it reads as the EQ building itself, which
 * is what it is actually doing.
 *
 * This is a drawing, not a write. Whoever calls it has already sent the final
 * values to the main process in one message, and Equalizer APO is already
 * playing them by the time the first band appears on screen. Revealing by
 * writing each band separately would be a config rewrite per band — a hundred
 * and more of them for a GraphicEQ reference — and the audio would stutter
 * through the whole animation. Nothing here talks to the main process.
 */

/**
 * Roughly how long a reveal takes, regardless of how many bands it has.
 *
 * Long enough to read as motion, short enough that nobody is waiting for it.
 * Bands are grouped rather than slowed down when there are a lot of them, so a
 * 128-band GraphicEQ reference takes the same moment as a 10-band one.
 */
const BAND_REVEAL_DURATION_MS = 600;

/** Bounds on one frame's dwell, so very small sets are neither a blur nor a wait. */
const MIN_STEP_MS = 14;
const MAX_STEP_MS = 60;

/**
 * The most frames a reveal is cut into.
 *
 * References can carry up to MAX_NUM_FILTERS bands. One frame each would mean a
 * hundred-odd React commits, each re-rendering every slider, for an animation
 * nobody asked to be longer — so past this many the bands are dealt out several
 * per frame instead.
 */
const MAX_STEPS = 40;

/** One band arriving: which one, and where it lands. */
export interface IBandRevealBand {
  id: string;
  gain: number;
}

export interface IBandRevealPlan {
  /** The band set as it looks before the first frame. */
  initial: IFiltersMap;
  /** One entry per frame, low frequency first. */
  steps: IBandRevealBand[][];
}

export interface IBandRevealPlanOptions {
  /**
   * Where the reveal starts from, band by band. Anything missing starts at
   * 0 dB, which is what a freshly applied reference wants: its bands did not
   * exist a moment ago, so there is nothing for them to move from.
   */
  from?: IFiltersMap;
  /** Defaults to the OS setting; injectable so the behaviour can be tested. */
  isMotionReduced?: boolean;
}

export interface IBandRevealOptions {
  /**
   * Whether the reveal still describes what is on screen. Checked before every
   * frame, and the reveal abandons the rest the moment it goes false.
   */
  isCurrent: () => boolean;
  /** Defaults to the pacing derived from the step count. */
  stepMs?: number;
}

/**
 * Whether the user has asked not to be shown animation.
 *
 * Answered defensively: this runs under jsdom in tests and in a preload-less
 * renderer during early boot, and neither is guaranteed to have matchMedia.
 * Reduced motion is the safe assumption only when it is actually set, so an
 * absent matchMedia means "animate", not "do not".
 */
export const prefersReducedMotion = (): boolean => {
  // The app's own switch first, which is felt the moment it is pressed; the
  // media query answers a Chromium launch switch and cannot change under a
  // running window (`utils/motionPreference.ts`).
  const chosen = chosenMotion();
  if (chosen) {
    return chosen === 'reduced';
  }
  if (
    typeof window === 'undefined' ||
    typeof window.matchMedia !== 'function'
  ) {
    return false;
  }
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
};

/** Deal items out into at most `groupCount` runs, keeping their order. */
const group = <T>(items: T[], groupCount: number): T[][] => {
  const groups: T[][] = [];
  for (let index = 0; index < groupCount; index += 1) {
    const start = Math.floor((index * items.length) / groupCount);
    const end = Math.floor(((index + 1) * items.length) / groupCount);
    if (end > start) {
      groups.push(items.slice(start, end));
    }
  }
  return groups;
};

/** How long one frame holds, so the whole reveal lands near its budget. */
export const getBandRevealStepMs = (stepCount: number): number =>
  stepCount <= 0
    ? MIN_STEP_MS
    : clamp(
        Math.round(BAND_REVEAL_DURATION_MS / stepCount),
        MIN_STEP_MS,
        MAX_STEP_MS,
      );

/**
 * Work out what the reveal will show, or that there is nothing to show.
 *
 * Undefined means hand the caller's target straight to the screen: either
 * nothing moves, or the user has asked for reduced motion and would rather have
 * the answer than the animation. Collapsing both into one answer is deliberate
 * — every caller already has to handle "no reveal", so honouring the preference
 * costs them nothing.
 *
 * Only bands whose gain actually changes are revealed. Band pass, notch and the
 * pass filters carry no gain in Equalizer APO at all, so animating theirs would
 * be animating a number nothing reads.
 */
export const planBandReveal = (
  target: IFiltersMap,
  {
    from,
    isMotionReduced = prefersReducedMotion(),
  }: IBandRevealPlanOptions = {},
): IBandRevealPlan | undefined => {
  if (isMotionReduced) {
    return undefined;
  }

  const initial = cloneFilters(target);
  const moving = Object.values(target)
    .filter((filter) => !NO_GAIN_FILTER_TYPES.includes(filter.type))
    .map((filter) => ({
      filter,
      startGain: from?.[filter.id]?.gain ?? 0,
    }))
    .filter(({ filter, startGain }) => filter.gain !== startGain)
    .sort((left, right) => left.filter.frequency - right.filter.frequency);

  if (moving.length === 0) {
    return undefined;
  }

  moving.forEach(({ filter, startGain }) => {
    initial[filter.id] = { ...filter, gain: startGain };
  });

  return {
    initial,
    steps: group(
      moving.map(({ filter }) => ({ id: filter.id, gain: filter.gain })),
      Math.min(moving.length, MAX_STEPS),
    ),
  };
};

/**
 * The painted frame the next step belongs on: the first one at least
 * `stepMs` after the frame the last step was drawn in, answered with that
 * frame's time.
 *
 * A reveal is a drawing, so it is paced by the frames it is drawn in. It was
 * paced by a timer, which went on handing steps to a window that was not
 * painting them — in a minimised one, where timers are throttled to one a
 * second and then one a minute, a 600 ms reveal took most of a minute, and
 * `refreshState` waited on it all that time for a picture nobody could see.
 *
 * So a window nobody can see does not wait at all: the steps go straight
 * through, the reveal ends where it would have, and the answer is on screen
 * whenever the window next is. The page being hidden mid-wait ends the wait
 * for the same reason. Where there are no frames at all — Jest's jsdom has
 * them, a Node test does not — there is nothing to pace by either.
 */
const nextStepFrame = (lastDrawnAt: number, stepMs: number) =>
  new Promise<number>((resolve) => {
    if (
      typeof document === 'undefined' ||
      typeof requestAnimationFrame !== 'function' ||
      document.visibilityState === 'hidden'
    ) {
      resolve(lastDrawnAt);
      return;
    }
    let frame = 0;
    const listening = new AbortController();
    const finish = (at: number) => {
      cancelAnimationFrame(frame);
      listening.abort();
      resolve(at);
    };
    const onFrame = (at: number) => {
      if (at - lastDrawnAt >= stepMs) {
        finish(at);
        return;
      }
      frame = requestAnimationFrame(onFrame);
    };
    document.addEventListener(
      'visibilitychange',
      () => {
        if (document.visibilityState === 'hidden') {
          finish(lastDrawnAt);
        }
      },
      { signal: listening.signal },
    );
    frame = requestAnimationFrame(onFrame);
  });

/**
 * Hand the planned frames over one at a time.
 *
 * Returns whether it ran to the end. A false answer means something replaced
 * what was being revealed — the output changed, a different reference was
 * applied, the EQ was cleared — and the caller must not go on to assert the
 * finished value over whatever took its place.
 */
export const revealBands = async (
  steps: IBandRevealBand[][],
  onStep: (bands: IBandRevealBand[]) => void,
  { isCurrent, stepMs = getBandRevealStepMs(steps.length) }: IBandRevealOptions,
): Promise<boolean> => {
  let lastDrawnAt = performance.now();
  for (let index = 0; index < steps.length; index += 1) {
    if (index > 0) {
      // The pacing is the whole point, so it is an explicit wait rather than
      // the incidental cost of an IPC round trip per band — and a wait on the
      // frames that draw it (`nextStepFrame`).
      // eslint-disable-next-line no-await-in-loop
      lastDrawnAt = await nextStepFrame(lastDrawnAt, stepMs);
    }
    if (!isCurrent()) {
      return false;
    }
    onStep(steps[index]);
  }
  return isCurrent();
};

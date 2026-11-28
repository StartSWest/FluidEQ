/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  SCENE_BOUNCE_MS,
  SCENE_CEILING_MS,
  SCENE_CLIMB_MS,
  SCENE_FINISH_SHARE,
  SCENE_HOLD_MS,
  SCENE_MAX_CEILING_DOUBLINGS,
  SCENE_OVER_SHARE,
  SCENE_RENDER_SCALES,
  SCENE_SLOW_PACE_MS,
  SCENE_STEP_DOWN_FRAMES,
  SCENE_TARGET_SHARE,
  type ISceneCostReading,
} from './sceneHealth';

/**
 * The one size controller behind every scene: how large it is drawn, frame
 * by frame, from what its frames cost the GPU (Ivan, 2026-11-27: "fast or
 * best automatically depending on the fps ... always trying to display its
 * best quality").
 *
 * It starts at the best picture the quality allows, steps down after a run
 * of frames the GPU could not finish inside the budget — straight to the
 * rung the measured cost predicts will fit, since a shader's cost is per
 * pixel — and climbs back the same way once frames have run clean with room
 * to spare: straight to the largest rung the same arithmetic says fits. The
 * gap between the two thresholds is the hysteresis — down past 0.9 of the
 * interval, up only where the next size is predicted under 0.63 of it — and
 * a climb that has to be undone soon after bars that rung for twenty
 * seconds, doubling each time, so a picture never pulses between two sizes
 * on the boundary. Below the smallest picture there is one rung more: the
 * same picture held to `SCENE_SLOW_PACE_MS`.
 *
 * A scene nobody here has watched — a member's, the listener's own — runs
 * on the same rules from the other end (`createWarmupLadder`): its cost is
 * unknown and one heavy enough can hold the GPU until Windows resets the
 * display driver for every program, so it starts at the smallest picture
 * and climbs, each climb at most four times the pixels it has just drawn.
 * Two ladders used to do this with two sets of rules; the members' one only
 * stepped down at three times the interval, so a member's scene running at
 * half the display's rate stayed there, and never climbed back to a size it
 * had once stepped down from.
 *
 * Never a lesser look for being slow (Ivan, 2026-11-08: "remove all low
 * performance laptop fallback scenes ... so only the good one display"): a
 * soft, slower picture of the scene is the scene. It stops only where it
 * cannot run at all — a context lost, a program that will not build, or an
 * unwatched scene that stalls the GPU even at an eighth of the panel.
 *
 * Nothing here has a timer: every wait is counted in frames, from the
 * interval frames are arriving at.
 */

/**
 * Where a frame was drawn from the ladder's point of view.
 *
 * - `shown`: on screen at the rate the listener chose; judged.
 * - `hidden`: the window is occluded and `backgroundThrottling` drops it to
 *   about a frame a second. Counting those would ratchet the picture down
 *   every minute the window sat minimised.
 * - `resting`: nothing has played for a while and every scene eases to
 *   thirty frames a second (`sceneRest.ts`). Judged at that rate, so a
 *   desktop background that rests for good still finds its best size; and
 *   when the music comes back, the picture goes back to the size it held
 *   before the rest, which is the one its frames were judged at the full
 *   rate for — a climb made at thirty would stutter for a dozen frames at
 *   the first beat before stepping down again.
 */
export type TLadderFrame = 'shown' | 'hidden' | 'resting';

export interface ICostLadder {
  scale(): number;
  /**
   * On the rung below the smallest picture: the caller holds frames to
   * `SCENE_SLOW_PACE_MS`, whatever rate the listener chose.
   */
  slowed(): boolean;
  /**
   * Report one frame's reading against the interval frames arrive at.
   * Returns `degraded` only where a scene nobody here has watched holds the
   * GPU so long, at its smallest size, that it would freeze the window and
   * risk a display-driver reset: then the caller stops it. Being slow is
   * never a reason - a slow scene rests on its smallest size at the slow
   * rate and stays on screen.
   */
  frame(
    reading: ISceneCostReading,
    intervalMs: number,
    seen: TLadderFrame,
  ): 'ok' | 'degraded';
  /** The finishing passes have proved too dear here: use the plain scaler. */
  cheapFinish(): boolean;
  /**
   * The quality now allows a different smallest size. The picture stays
   * where it is and only the rungs move: a ladder made anew started a
   * member's scene from the bottom again for a change it had not hit.
   */
  refloor(floor: number): void;
  /**
   * Start from a size this program has already proved it draws in this
   * session, rather than from the ladder's own start: a scene built again —
   * for full screen and back, for a look put away and taken out — began its
   * climb from the bottom every time, a second of blur for a scene that had
   * just run whole.
   */
  resume(scale: number): void;
  reset(): void;
}

/**
 * Smooth frames a scene nobody has watched needs before each climb while it
 * is still finding its size — under a quarter of a second at sixty. After
 * its first step down it waits `SCENE_CLIMB_MS` like any scene.
 */
export const WARMUP_GOOD_FRAMES_TO_CLIMB = 12;

/**
 * How far one climb of an unwatched scene may go: twice the size each way,
 * four times the pixels. The heaviest frame it can ever submit is then
 * bounded by one it has already drawn, whatever its cost does with size.
 */
export const WARMUP_CLIMB_RATIO = 2;

/**
 * A frame this many intervals long is not a slow scene but a stalled GPU,
 * and three in a row is proof enough: waiting for the usual count would
 * mean seconds of a frozen window. Above its smallest size the picture steps
 * down at once; at it the scene is drawn again at `WARMUP_STALL_SCALE` and
 * the slow rate; a third time there is the one thing that stops a scene,
 * because one nobody here has watched can hold the GPU until Windows resets
 * the display driver for every program on the machine.
 */
export const WARMUP_HOPELESS_FACTOR = 10;
export const WARMUP_HOPELESS_FRAMES = 3;

/** An eighth of the panel each way: where a stalled scene is drawn again. */
export const WARMUP_STALL_SCALE = 0.125;

const framesOf = (ms: number, intervalMs: number) =>
  Math.max(1, Math.ceil(ms / Math.max(1, intervalMs)));

/**
 * The rungs a ladder climbs: the largest size — the panel's, or the
 * supersampled size above it — and the scales below it down to the smallest
 * the quality allows. A floor at or above the largest size is a ladder of
 * one rung, which is how Full holds its picture: only the rate can give.
 */
export const ladderScales = (
  top: number,
  floor: number = SCENE_RENDER_SCALES[SCENE_RENDER_SCALES.length - 1],
): readonly number[] => {
  if (floor >= top - 1e-6) {
    return [top];
  }
  const allowed = SCENE_RENDER_SCALES.filter((scale) => scale >= floor - 1e-6);
  const scales = allowed.length > 0 ? allowed : [SCENE_RENDER_SCALES[0]];
  return top > 1 ? [top, ...scales] : scales;
};

/**
 * Counts the frames whose finishing was too dear and says when it has been
 * so for a run of them: a decision for the session.
 */
export const createFinishWatch = () => {
  let streak = 0;
  let cheap = false;
  return {
    frame: ({ postMs }: ISceneCostReading, intervalMs: number) => {
      if (cheap || postMs === undefined) {
        return;
      }
      streak = postMs > intervalMs * SCENE_FINISH_SHARE ? streak + 1 : 0;
      if (streak >= SCENE_STEP_DOWN_FRAMES) {
        cheap = true;
      }
    },
    cheap: () => cheap,
    reset: () => {
      streak = 0;
      cheap = false;
    },
  };
};

/** Whether a reading is over budget, on an exact clock or on the pipeline. */
const isOver = (
  { costMs, behind }: ISceneCostReading,
  intervalMs: number,
): boolean => {
  if (costMs !== undefined) {
    // On the clock alone. Frames still in hand say nothing here: traced in
    // the running window at a hundred frames a second, a scene costing
    // 0.14 ms a frame had one frame in hand on three polls of four and two
    // on one in ten, because a fence is seen signalled a frame or two after
    // the GPU is through with it. Counted as late, that held a member's
    // scene at an eighth of the size for good and reset the clean run every
    // climb waits for.
    return costMs > intervalMs * SCENE_OVER_SHARE;
  }
  return behind >= 1;
};

interface ILadderShape {
  top: number;
  floor: number;
  /** A scene nobody here has measured: from the bottom, bounded, guarded. */
  unwatched: boolean;
}

const createLadder = ({ top, floor, unwatched }: ILadderShape): ICostLadder => {
  let scales = ladderScales(top, floor);
  /** The rung past the last scale: the smallest picture at the slow rate. */
  let slowRung = scales.length;
  const startRung = () => (unwatched ? slowRung - 1 : 0);
  const finish = createFinishWatch();
  let rung = startRung();
  /** An unwatched scene still finding its size: short waits between climbs. */
  let warming = unwatched;
  /** Drawn again at an eighth and the slow rate after a stall, for good. */
  let stalled = false;
  let degraded = false;
  let slowStreak = 0;
  let cleanStreak = 0;
  let hopelessStreak = 0;
  let holdLeft = 0;
  let sinceClimb: number | undefined;
  let ceilingRung = 0;
  let ceilingLeft = 0;
  let doublings = 0;
  let typicalCostMs: number | undefined;
  /** The interval frames arrived at before the slow rung: the way out of it. */
  let fastIntervalMs: number | undefined;
  /** The rung the picture was on when a rest in silence began. */
  let restRung: number | undefined;

  const scaleAt = (at: number) => scales[Math.min(at, slowRung - 1)];

  const predicted = (fromRung: number, toRung: number) =>
    typicalCostMs === undefined
      ? undefined
      : typicalCostMs * (scaleAt(toRung) / scaleAt(fromRung)) ** 2;

  /** Whether holding frames to the slow rate would change anything here. */
  const canSlow = (intervalMs: number) => intervalMs < SCENE_SLOW_PACE_MS * 0.9;

  /** Nothing below this rung: the slow rate, or the floor where there is none. */
  const atBottom = (intervalMs: number) =>
    rung === slowRung || (rung === slowRung - 1 && !canSlow(intervalMs));

  /** Whether one climb may reach this rung from the one the picture is on. */
  const withinReach = (at: number) =>
    !unwatched || scaleAt(at) <= scaleAt(rung) * WARMUP_CLIMB_RATIO + 1e-6;

  const stepDown = (intervalMs: number) => {
    const target = SCENE_TARGET_SHARE * intervalMs;
    let next = rung + 1;
    // The first rung the measured cost says will fit, so a scene four times
    // too heavy is not walked down one rung at a time, stuttering at each.
    while (next < slowRung - 1) {
      const cost = predicted(rung, next);
      if (cost === undefined || cost <= target) {
        break;
      }
      next += 1;
    }
    // Not even the smallest picture fits: straight to the slow rate, whose
    // interval is the budget it brings, rather than a stutter at the floor
    // first. Without a clock the floor is tried first, like every rung.
    if (next === slowRung - 1 && canSlow(intervalMs)) {
      const cost = predicted(rung, next);
      if (cost !== undefined && cost > target) {
        next = slowRung;
      }
    }
    const bounced =
      sinceClimb !== undefined &&
      sinceClimb < framesOf(SCENE_BOUNCE_MS, intervalMs);
    if (bounced) {
      ceilingRung = Math.max(ceilingRung, rung + 1);
      ceilingLeft = framesOf(SCENE_CEILING_MS * 2 ** doublings, intervalMs);
      doublings = Math.min(SCENE_MAX_CEILING_DOUBLINGS, doublings + 1);
    }
    if (next === slowRung) {
      fastIntervalMs = intervalMs;
    }
    rung = next;
    sinceClimb = undefined;
    holdLeft = framesOf(SCENE_HOLD_MS, intervalMs);
    warming = false;
  };

  const climb = (intervalMs: number) => {
    if (rung - 1 < ceilingRung || holdLeft > 0) {
      return;
    }
    const wait = warming
      ? WARMUP_GOOD_FRAMES_TO_CLIMB
      : framesOf(SCENE_CLIMB_MS, intervalMs);
    if (cleanStreak < wait) {
      return;
    }
    // Out of the slow rung the picture stays and the interval halves, so the
    // same picture is judged against the interval frames arrived at before.
    const budget =
      rung === slowRung && fastIntervalMs !== undefined
        ? fastIntervalMs
        : intervalMs;
    const room = SCENE_TARGET_SHARE * budget * 0.9;
    // The largest rung not barred that the measured cost says fits with room
    // to spare — the way down is predictive, and the way up is the same, or a
    // picture dropped for one heavy passage crept back a rung at a time.
    // Without a clock, the next rung up, by trying.
    let next = rung - 1;
    if (typicalCostMs !== undefined) {
      const cost = predicted(rung, next);
      if (cost === undefined || cost > room) {
        cleanStreak = 0;
        return;
      }
      while (next - 1 >= ceilingRung && withinReach(next - 1)) {
        const above = predicted(rung, next - 1);
        if (above === undefined || above > room) {
          break;
        }
        next -= 1;
      }
    }
    rung = next;
    cleanStreak = 0;
    sinceClimb = 0;
    if (rung === 0) {
      warming = false;
    }
  };

  /** The stalled-GPU guard of an unwatched scene; `undefined` to judge on. */
  const guardStall = (
    { costMs }: ISceneCostReading,
    intervalMs: number,
  ): 'ok' | 'degraded' | undefined => {
    const hopeless =
      costMs !== undefined &&
      costMs > Math.max(1, intervalMs) * WARMUP_HOPELESS_FACTOR;
    hopelessStreak = hopeless ? hopelessStreak + 1 : 0;
    if (hopelessStreak < WARMUP_HOPELESS_FRAMES) {
      return stalled ? 'ok' : undefined;
    }
    hopelessStreak = 0;
    slowStreak = 0;
    cleanStreak = 0;
    if (stalled) {
      degraded = true;
      return 'degraded';
    }
    // At the smallest size, slowed or not: the slow rate halves how often the
    // GPU is held, never for how long, and how long is what resets a driver.
    if (rung >= slowRung - 1) {
      // The same scene smaller and slower, never a lesser look (Ivan,
      // 2026-11-14: "only the full scene can show, always").
      stalled = true;
      return 'ok';
    }
    stepDown(intervalMs);
    return 'ok';
  };

  /** Back from a rest: to the size the full rate was judged to hold. */
  const wake = (intervalMs: number) => {
    if (restRung !== undefined && rung < restRung) {
      rung = restRung;
      cleanStreak = 0;
      sinceClimb = undefined;
      holdLeft = framesOf(SCENE_HOLD_MS, intervalMs);
    }
    restRung = undefined;
  };

  return {
    scale: () => (stalled ? WARMUP_STALL_SCALE : scaleAt(rung)),
    slowed: () => stalled || rung === slowRung,
    cheapFinish: finish.cheap,
    refloor: (next) => {
      const current = scaleAt(rung);
      const wasSlow = rung === slowRung;
      scales = ladderScales(top, next);
      slowRung = scales.length;
      // The same picture where the new rungs still have it, the smallest
      // allowed where they do not, and the slow rate stays the slow rate. A
      // rung barred after a bounce is forgotten with the rungs it was among.
      const at = scales.findIndex((scale) => Math.abs(scale - current) < 1e-6);
      if (wasSlow) {
        rung = slowRung;
      } else {
        rung = at >= 0 ? at : slowRung - 1;
      }
      ceilingRung = 0;
      ceilingLeft = 0;
      restRung = undefined;
    },
    resume: (proved) => {
      // The rung of that size, or the next one down where the rungs have
      // moved since; larger than every rung means the largest.
      const at = scales.findIndex((entry) => entry <= proved + 1e-6);
      rung = at >= 0 ? at : slowRung - 1;
      cleanStreak = 0;
    },
    frame: (reading, intervalMs, seen) => {
      if (seen === 'hidden' || degraded) {
        slowStreak = 0;
        hopelessStreak = 0;
        return degraded ? 'degraded' : 'ok';
      }
      if (seen === 'resting') {
        restRung ??= rung;
      } else {
        wake(intervalMs);
      }
      finish.frame(reading, intervalMs);
      if (reading.costMs !== undefined) {
        typicalCostMs =
          typicalCostMs === undefined
            ? reading.costMs
            : typicalCostMs + (reading.costMs - typicalCostMs) * 0.2;
      }
      if (sinceClimb !== undefined) {
        sinceClimb += 1;
      }
      if (holdLeft > 0) {
        holdLeft -= 1;
      }
      if (ceilingLeft > 0) {
        ceilingLeft -= 1;
        if (ceilingLeft === 0) {
          ceilingRung = 0;
        }
      }
      if (unwatched) {
        const guarded = guardStall(reading, intervalMs);
        if (guarded !== undefined) {
          return guarded;
        }
      }
      if (isOver(reading, intervalMs)) {
        slowStreak += 1;
        // A lone late frame — a pause on the page, a frame the compositor
        // held — is a hiccup, not a load: the run of clean frames a climb
        // waits for survives one, as the step down needs six in a row.
        if (slowStreak >= 2) {
          cleanStreak = 0;
        }
        if (slowStreak >= SCENE_STEP_DOWN_FRAMES) {
          slowStreak = 0;
          if (!atBottom(intervalMs)) {
            stepDown(intervalMs);
          }
        }
      } else {
        slowStreak = 0;
        cleanStreak += 1;
        if (rung > 0) {
          climb(intervalMs);
        }
      }
      return 'ok';
    },
    reset: () => {
      rung = startRung();
      warming = unwatched;
      stalled = false;
      degraded = false;
      slowStreak = 0;
      cleanStreak = 0;
      hopelessStreak = 0;
      holdLeft = 0;
      sinceClimb = undefined;
      ceilingRung = 0;
      ceilingLeft = 0;
      doublings = 0;
      typicalCostMs = undefined;
      fastIntervalMs = undefined;
      restRung = undefined;
      finish.reset();
    },
  };
};

/**
 * The ladder of a scene somebody already watched run (FluidEQ's own, measured
 * before release): from its largest size down as far as the rate forces it.
 */
export const createCostLadder = (
  top = 1,
  floor: number = SCENE_RENDER_SCALES[SCENE_RENDER_SCALES.length - 1],
): ICostLadder => createLadder({ top, floor, unwatched: false });

/**
 * The ladder of a scene nobody here has measured: from its smallest size up,
 * each climb bounded, with the stalled-GPU guard.
 */
export const createWarmupLadder = (
  top = 1,
  floor: number = SCENE_RENDER_SCALES[SCENE_RENDER_SCALES.length - 1],
): ICostLadder => createLadder({ top, floor, unwatched: true });

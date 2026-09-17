import {
  createFinishWatch,
  SCENE_SLOW_FRAME_FACTOR,
  SCENE_SLOW_FRAMES_TO_STEP,
  SCENE_SLOW_PACE_MS,
  type ICostLadder,
  type ISceneCostReading,
} from './sceneHealth';

/**
 * How a member's scene reaches full size: from the bottom, one step at a time.
 *
 * An official scene starts at full resolution and the cost ladder steps it
 * down if it runs slow, because a person already watched it run. A member's
 * scene has been watched by nobody, and a fragment shader's cost is per pixel:
 * one heavy enough can hold the GPU long enough for Windows to reset the
 * display driver. So it starts at the listener's smallest size and climbs a
 * rung only after a run of frames inside the budget. Each rung is at most four times the
 * pixels of the last, so the heaviest single frame it can ever submit is
 * bounded by what it has already proved it can draw.
 *
 * Same interface as the cost ladder, so the scene runner holds either. Nothing
 * here has a timer: every decision is made on a frame as it arrives. Judged on
 * the GPU's own clock where the driver has one, and on whether the GPU is
 * keeping up with the display where it does not (`sceneGpuClock.ts`).
 */

/**
 * With the cost ladder's floor, 0.35, among them: a member's scene rests on
 * the highest rung it runs smoothly at, and the smallest picture a listener
 * allows has to be a rung it can rest on.
 */
export const WARMUP_RENDER_SCALES: readonly number[] = [
  0.125, 0.25, 0.35, 0.5, 0.67, 0.85, 1,
];

/** Smooth frames needed before trying the next rung — under half a second. */
export const WARMUP_GOOD_FRAMES_TO_CLIMB = 12;

/**
 * A frame this many intervals long is not a slow scene but a stalled GPU, and
 * three in a row at the smallest size is proof enough: waiting for the cost
 * ladder's usual count would mean seconds of a frozen window.
 */
export const WARMUP_HOPELESS_FACTOR = 10;
export const WARMUP_HOPELESS_FRAMES = 3;

/** Slack for the clock's jitter when deciding a frame was smooth. */
const SMOOTH_SLACK = 1.25;

/**
 * `top` above 1 is the supersampled size `best` smoothing asks for: one more
 * rung, climbed last, after the scene has proved it can draw the panel.
 * `floor` is the smallest picture the listener allows (`autoFloor`): the
 * climb still starts below it, for the GPU's safety, but a scene that runs
 * slow there is held to `SCENE_SLOW_PACE_MS` before it is backed down past
 * it — as the cost ladder does — and rests there.
 */
export const createWarmupLadder = (top = 1, floor = 0): ICostLadder => {
  const scales =
    top > 1 ? [...WARMUP_RENDER_SCALES, top] : WARMUP_RENDER_SCALES;
  /** The lowest rung the listener would have a scene rest on. */
  const floorRungFor = (allowed: number) =>
    Math.max(
      0,
      scales.findIndex((scale) => scale >= allowed - 1e-6),
    );
  let floorRung = floorRungFor(floor);
  const finish = createFinishWatch();
  // From the listener's smallest size, not from an eighth: a scene that
  // opened at an eighth was a blur for its first second, and Ivan asked
  // (2026-09-16) for the minimum to hold from the first frame. The first
  // rung's frames are eight times heavier than they were; the hopeless
  // check below still ends a runaway within three of them.
  let rung = floorRung;
  let ceiling = scales.length - 1;
  let goodStreak = 0;
  let slowStreak = 0;
  let hopelessStreak = 0;
  let slowed = false;
  let degraded = false;

  const state = () => (degraded ? 'degraded' : 'ok');

  return {
    scale: () => scales[rung],
    slowed: () => slowed,
    cheapFinish: finish.cheap,
    // The climb goes on from where it is, never under the new floor.
    refloor: (allowed) => {
      floorRung = floorRungFor(allowed);
      if (rung < floorRung) {
        rung = floorRung;
        goodStreak = 0;
      }
    },
    // Up to the highest rung not above that size: proved once this session,
    // it need not be proved from an eighth again.
    resume: (proved) => {
      let at = 0;
      scales.forEach((scale, index) => {
        if (scale <= proved + 1e-6 && index <= ceiling) {
          at = index;
        }
      });
      rung = at;
      goodStreak = 0;
    },
    frame: (reading: ISceneCostReading, intervalMs, hidden) => {
      const { costMs, behind } = reading;
      // An occluded window runs at about one frame a second; judging those
      // would condemn every scene left behind another window.
      if (hidden || degraded) {
        goodStreak = 0;
        slowStreak = 0;
        hopelessStreak = 0;
        return state();
      }
      finish.frame(reading, intervalMs);
      const budget = Math.max(1, intervalMs);
      const exact = costMs !== undefined;
      const hopeless = exact && costMs > budget * WARMUP_HOPELESS_FACTOR;
      // On the clock where there is one. Frames still in hand are seen a
      // frame or two late in the running window (`sceneHealth.ts`), so at a
      // hundred frames a second one is in hand on most polls of a scene
      // costing nothing; read as "not smooth", it kept a member's scene at
      // an eighth of the size for as long as it ran.
      const slow = exact
        ? costMs > budget * SCENE_SLOW_FRAME_FACTOR
        : behind >= 2;
      const smooth = exact ? costMs <= budget * SMOOTH_SLACK : behind === 0;

      hopelessStreak = hopeless ? hopelessStreak + 1 : 0;
      if (rung <= floorRung && hopelessStreak >= WARMUP_HOPELESS_FRAMES) {
        degraded = true;
        return state();
      }

      if (slow) {
        goodStreak = 0;
        slowStreak += 1;
        if (slowStreak >= SCENE_SLOW_FRAMES_TO_STEP) {
          slowStreak = 0;
          if (
            rung === floorRung &&
            rung > 0 &&
            !slowed &&
            intervalMs < SCENE_SLOW_PACE_MS * 0.9
          ) {
            // The smallest picture allowed, still slow: the rate goes before
            // the picture does, and the ladder rests here. Not at the very
            // bottom — a scene slow at an eighth of the size is hopeless, and
            // halving its rate would only halve the proof.
            slowed = true;
            ceiling = rung;
          } else if (rung <= floorRung) {
            // Never below the listener's smallest size: slow there too, the
            // scene is handed over rather than shown smaller than allowed.
            degraded = true;
          } else {
            // Never back up to the rung that ran slow: a picture that climbs
            // and falls on the boundary pulses, which is worse than smaller.
            ceiling = rung - 1;
            rung -= 1;
          }
        }
        return state();
      }

      slowStreak = 0;
      goodStreak = smooth ? goodStreak + 1 : 0;
      if (goodStreak >= WARMUP_GOOD_FRAMES_TO_CLIMB && rung < ceiling) {
        rung += 1;
        goodStreak = 0;
      }
      return state();
    },
    reset: () => {
      rung = floorRung;
      ceiling = scales.length - 1;
      goodStreak = 0;
      slowStreak = 0;
      hopelessStreak = 0;
      slowed = false;
      degraded = false;
      finish.reset();
    },
  };
};

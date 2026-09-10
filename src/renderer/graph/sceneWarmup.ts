import { SMOOTH_FRAME_MS } from '../../common/smoothing';
import {
  SCENE_SLOW_FRAME_FACTOR,
  SCENE_SLOW_FRAMES_TO_STEP,
  type ICostLadder,
} from './sceneHealth';

/**
 * How a member's scene reaches full size: from the bottom, one step at a time.
 *
 * An official scene starts at full resolution and the cost ladder steps it
 * down if it runs slow, because a person already watched it run. A member's
 * scene has been watched by nobody, and a fragment shader's cost is per pixel:
 * one heavy enough can hold the GPU long enough for Windows to reset the
 * display driver. So it starts at an eighth of the size and climbs a rung only
 * after a run of frames inside the budget. Each rung is at most four times the
 * pixels of the last, so the heaviest single frame it can ever submit is
 * bounded by what it has already proved it can draw.
 *
 * Same interface as the cost ladder, so the scene runner holds either. Nothing
 * here has a timer: every decision is made on a frame as it arrives.
 */

export const WARMUP_RENDER_SCALES: readonly number[] = [
  0.125, 0.25, 0.5, 0.75, 1,
];

/** Smooth frames needed before trying the next rung — under half a second. */
export const WARMUP_GOOD_FRAMES_TO_CLIMB = 12;

/**
 * A frame this many budgets long is not a slow scene but a stalled GPU, and
 * three in a row at the smallest size is proof enough: waiting for the cost
 * ladder's usual count would mean seconds of a frozen window.
 */
export const WARMUP_HOPELESS_FACTOR = 10;
export const WARMUP_HOPELESS_FRAMES = 3;

/** Slack for animation-frame jitter when deciding a frame was smooth. */
const SMOOTH_SLACK = 1.25;

export const createWarmupLadder = (): ICostLadder => {
  let rung = 0;
  let ceiling = WARMUP_RENDER_SCALES.length - 1;
  let goodStreak = 0;
  let slowStreak = 0;
  let hopelessStreak = 0;
  let degraded = false;

  const state = () => (degraded ? 'degraded' : 'ok');

  return {
    scale: () => WARMUP_RENDER_SCALES[rung],
    frame: (deltaMs, budgetMs, hidden) => {
      // An occluded window runs at about one frame a second; judging those
      // would condemn every scene left behind another window.
      if (hidden || degraded) {
        goodStreak = 0;
        slowStreak = 0;
        hopelessStreak = 0;
        return state();
      }
      // Euphoria asks for every frame (a budget of zero); a member's scene is
      // still judged against thirty a second.
      const budget = budgetMs > 0 ? budgetMs : SMOOTH_FRAME_MS;

      hopelessStreak =
        deltaMs > budget * WARMUP_HOPELESS_FACTOR ? hopelessStreak + 1 : 0;
      if (rung === 0 && hopelessStreak >= WARMUP_HOPELESS_FRAMES) {
        degraded = true;
        return state();
      }

      if (deltaMs > budget * SCENE_SLOW_FRAME_FACTOR) {
        goodStreak = 0;
        slowStreak += 1;
        if (slowStreak >= SCENE_SLOW_FRAMES_TO_STEP) {
          slowStreak = 0;
          if (rung === 0) {
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
      goodStreak = deltaMs <= budget * SMOOTH_SLACK ? goodStreak + 1 : 0;
      if (goodStreak >= WARMUP_GOOD_FRAMES_TO_CLIMB && rung < ceiling) {
        rung += 1;
        goodStreak = 0;
      }
      return state();
    },
    reset: () => {
      rung = 0;
      ceiling = WARMUP_RENDER_SCALES.length - 1;
      goodStreak = 0;
      slowStreak = 0;
      hopelessStreak = 0;
      degraded = false;
    },
  };
};

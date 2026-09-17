/**
 * Whether this machine can run a scene at all, and how hard it may be pushed.
 *
 * Two things live here and neither has a timer. The WebGL2 probe is asked once,
 * lazily, the first time anything wants to know — under Jest the canvas answers
 * null and every premium row simply never appears, which is also what happens
 * on a machine with no usable GPU. The resolution controller watches what
 * frames cost the GPU as the readings arrive and moves the drawn size down and
 * back up; every wait in it is counted in frames, from the interval frames
 * are arriving at.
 */

import { SMOOTH_FRAME_MS } from 'common/smoothing';

let webgl2Available: boolean | undefined;

/**
 * The attributes a scene asks for, kept in one place so the probe and the real
 * canvas cannot disagree. No depth, no stencil, no multisampling — a single
 * fullscreen triangle needs none of them and each one costs fill. Power
 * preference is `default`, deliberately not `high-performance`: this app sits
 * in the notification area for weeks, and waking a laptop's discrete GPU for a
 * decorative background is a battery bug nobody would trace to the setting.
 */
export const SCENE_CONTEXT_ATTRIBUTES: WebGLContextAttributes = {
  alpha: true,
  premultipliedAlpha: true,
  antialias: false,
  depth: false,
  stencil: false,
  preserveDrawingBuffer: false,
  powerPreference: 'default',
  failIfMajorPerformanceCaveat: false,
};

export const isSceneRenderingAvailable = (): boolean => {
  if (webgl2Available !== undefined) {
    return webgl2Available;
  }
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2', SCENE_CONTEXT_ATTRIBUTES);
    webgl2Available = gl !== null;
    // Release the probe's context at once rather than letting it sit until GC:
    // browsers cap the number of live contexts, and this one did its job.
    if (gl) {
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    }
  } catch {
    webgl2Available = false;
  }
  return webgl2Available;
};

/** For a test that wants to pretend the GPU is or is not there. */
export const setSceneRenderingAvailableForTesting = (
  value: boolean | undefined,
) => {
  webgl2Available = value;
};

/**
 * What one frame cost, as the worker's clock reports it (`sceneGpuClock.ts`).
 *
 * `costMs` is the GPU's own time for the newest frame it finished, absent on a
 * driver without timer queries. `behind` is how many frames' fences had not
 * yet been seen signalled when the next frame was due. With a clock it says
 * little — in the running window a fence is seen a frame or two after the
 * GPU is through with it, so one in hand is the ordinary state at a hundred
 * frames a second — and it is read only where there is no clock.
 */
export interface ISceneCostReading {
  costMs?: number;
  /** The finishing passes' share of `costMs` (`scenePost.ts`), when timed. */
  postMs?: number;
  behind: number;
}

/**
 * Backing-store scales, full to a third.
 *
 * A fragment shader costs per pixel, and a picture drawn at 0.77 has 59 % of
 * the pixels, at 0.5 a quarter. The steps after full are AMD's own FSR
 * presets — Ultra Quality, Quality, Balanced, Performance — because that is
 * what the upscale pass (`sceneUpscale.ts`) is tuned for, with one more at
 * 0.85 so the first step off native is a small one. Half used to be the
 * floor, on the grounds that the upscale cannot make an edge below it; but
 * measured on a laptop's integrated chip at 4K, six of the shipped scenes
 * (Coral, Truss, Road Trip, Glacier, Neon City 3D, Crystal) cost 72 to 137 ms
 * a frame at full size and could not keep up even at half, so every one of
 * them stopped there. Two more steps, 0.42 and 0.35 — an eighth and a
 * twelfth of the pixels — keep them running as a soft picture, which a
 * viewer would take over none. Below the last scale the ladder has one more
 * rung: the same picture at `SCENE_SLOW_PACE_MS`.
 */
export const SCENE_RENDER_SCALES: readonly number[] = [
  1, 0.85, 0.77, 0.67, 0.59, 0.5, 0.42, 0.35,
];

/**
 * The frame rate a scene is held to on the rung below the smallest picture.
 *
 * Thirty a second: half the budget again, which on that same chip at 4K is
 * what the heaviest scene of the six needs at a third of the pixels. Only a
 * rung at all while frames arrive faster than this — a listener who chose
 * thirty, or a thirty-hertz panel, has nothing to slow.
 */
export const SCENE_SLOW_PACE_MS = SMOOTH_FRAME_MS;

/**
 * What a frame should cost, as a share of the interval frames arrive at.
 *
 * Not the whole interval: the compositor, the graph's own 2D canvases and
 * whatever else the machine runs share the GPU, and a scene that takes the
 * whole interval for itself drops frames on the first of them.
 */
export const SCENE_TARGET_SHARE = 0.7;

/** Past this share of the interval a frame counts as over budget. */
export const SCENE_OVER_SHARE = 0.9;

/**
 * Consecutive over-budget frames before stepping down.
 *
 * Six: 60 ms at a hundred frames a second, a tenth of a second at sixty. A
 * stutter is what the step exists to end, and every frame it waits is one
 * more of it; one slow frame, or a driver hiccup, ends the run on its own.
 */
export const SCENE_STEP_DOWN_FRAMES = 6;

/**
 * Clean frames, in time, before a climb is tried.
 *
 * One second. It was three, and a picture that had dropped for a heavy
 * passage took twenty seconds to come back, a rung every three; Ivan asked
 * (2026-09-16) for the way up to be as quick as the way down. The climb is
 * predictive like the step down — straight to the largest rung the measured
 * cost says fits — so a second is enough to know the cost, and the bounce
 * ceiling below is what stops a climb into a lull from pulsing.
 */
export const SCENE_CLIMB_MS = 1000;

/** After a step down, no climb is considered for this long. */
export const SCENE_HOLD_MS = 1000;

/**
 * A step down this soon after a step up is a bounce: the rung climbed to is
 * out of reach, and is barred for `SCENE_CEILING_MS`, doubling each time.
 * Twenty seconds, then forty, eighty, a hundred and sixty: a minute at the
 * first bounce kept a picture small long after whatever else the machine
 * was doing had finished.
 */
export const SCENE_BOUNCE_MS = 8000;
export const SCENE_CEILING_MS = 20000;
export const SCENE_MAX_CEILING_DOUBLINGS = 3;

/**
 * A frame is catastrophically slow past this many intervals; a run of them at
 * the floor is when the scene is handed over.
 *
 * Three, not two. At a sixty-frame interval that is fifty milliseconds — under
 * twenty frames a second — which is where a scene has visibly stopped being
 * motion.
 */
export const SCENE_SLOW_FRAME_FACTOR = 3;

/**
 * Consecutive catastrophic frames at the floor before giving up.
 *
 * Twenty-four is under half a second at sixty: long enough that a single
 * driver stall does not stop the scene for the rest of the session.
 */
export const SCENE_SLOW_FRAMES_TO_STEP = 24;

/**
 * The finishing passes' share of the interval past which they are too dear
 * for this GPU, and the plain scaler is used instead for the session.
 *
 * The passes cost per pixel of the panel, whatever size the scene is drawn
 * at, so shrinking the scene cannot pay for them: on the integrated chip of
 * a laptop they were 13 ms at 4K, more than a light scene at half size, and
 * the compositor's stretch costs nothing.
 */
export const SCENE_FINISH_SHARE = 0.3;

export interface ICostLadder {
  scale(): number;
  /**
   * On the rung below the smallest picture: the caller holds frames to
   * `SCENE_SLOW_PACE_MS`, whatever rate the listener chose.
   */
  slowed(): boolean;
  /**
   * Report one frame's reading against the interval frames arrive at.
   * Returns `degraded` when the bottom has been reached — the smallest
   * picture at the slow rate, or the smallest picture where there is no
   * slower rate — and the scene is still too slow, at which point the caller
   * hands over to the 2D fallback.
   */
  frame(
    reading: ISceneCostReading,
    intervalMs: number,
    hidden: boolean,
  ): 'ok' | 'degraded';
  /** The finishing passes have proved too dear here: use the plain scaler. */
  cheapFinish(): boolean;
  /**
   * The listener changed the smallest size allowed. The picture stays where
   * it is and only the rungs move: a ladder made anew started a member's
   * scene from an eighth again for a change to a setting it had not hit.
   */
  refloor(floor: number): void;
  /**
   * Start from a size this program has already proved it draws in this
   * session, rather than from the ladder's own start: a scene built again —
   * for full screen and back, for a look put away and taken out — began the
   * warm-up's climb from an eighth every time, a second of blur for a scene
   * that had just run whole.
   */
  resume(scale: number): void;
  reset(): void;
}

const framesOf = (ms: number, intervalMs: number) =>
  Math.max(1, Math.ceil(ms / Math.max(1, intervalMs)));

/**
 * The rungs a ladder climbs: the panel's size and the scales below it, down
 * to the smallest the listener allows, with the supersampled size above when
 * `best` smoothing asks for one.
 */
export const ladderScales = (
  top: number,
  floor: number = SCENE_RENDER_SCALES[SCENE_RENDER_SCALES.length - 1],
): readonly number[] => {
  const allowed = SCENE_RENDER_SCALES.filter((scale) => scale >= floor - 1e-6);
  const scales = allowed.length > 0 ? allowed : [SCENE_RENDER_SCALES[0]];
  return top > 1 ? [top, ...scales] : scales;
};

/**
 * Counts the frames whose finishing was too dear and says when it has been
 * so for a run of them. Shared by both ladders; a decision for the session.
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

/**
 * Whether a reading is over budget, and whether it is catastrophic, on an
 * exact clock or on the pipeline alone.
 */
const judge = (
  { costMs, behind }: ISceneCostReading,
  intervalMs: number,
): { over: boolean; catastrophic: boolean } => {
  if (costMs !== undefined) {
    // On the clock alone. Frames still in hand say nothing here: traced in
    // the running window at a hundred frames a second, a scene costing
    // 0.14 ms a frame had one frame in hand on three polls of four and two
    // on one in ten, because a fence is seen signalled a frame or two after
    // the GPU is through with it. Counted as late, that held a member's
    // scene at an eighth of the size for good and reset the clean run every
    // climb waits for.
    return {
      over: costMs > intervalMs * SCENE_OVER_SHARE,
      catastrophic: costMs > intervalMs * SCENE_SLOW_FRAME_FACTOR,
    };
  }
  return { over: behind >= 1, catastrophic: behind >= 2 };
};

/**
 * The resolution controller for a scene somebody has already watched run.
 *
 * Starts at full size. Steps down after a run of frames the GPU could not
 * finish inside the budget — straight to the rung the measured cost predicts
 * will fit, since a shader's cost is per pixel — and climbs back the same
 * way after a second of clean frames: straight to the largest rung the same
 * arithmetic says fits with room to spare. A climb that has to be undone
 * shortly after bars that rung for twenty seconds, doubling each time: a
 * picture that pulses between two sizes on the boundary is worse than the
 * smaller one, and this is what stops it. Without an exact clock — a driver
 * with no timer queries — it steps down on the pipeline alone and climbs one
 * rung at a time, by trying.
 *
 * Below the smallest picture the listener allows (`floor`) there is one rung
 * more: the same picture held to `SCENE_SLOW_PACE_MS`, taken only where
 * frames arrive faster than that. A scene gives up its rate before it gives
 * up altogether, and only a scene still catastrophic there is handed over.
 */
export const createCostLadder = (
  top = 1,
  floor: number = SCENE_RENDER_SCALES[SCENE_RENDER_SCALES.length - 1],
): ICostLadder => {
  let scales = ladderScales(top, floor);
  /** The rung past the last scale: the smallest picture at the slow rate. */
  let slowRung = scales.length;
  const finish = createFinishWatch();
  let rung = 0;
  let slowStreak = 0;
  let cleanStreak = 0;
  let floorStreak = 0;
  let holdLeft = 0;
  let sinceClimb: number | undefined;
  let ceilingRung = 0;
  let ceilingLeft = 0;
  let doublings = 0;
  let typicalCostMs: number | undefined;
  /** The interval frames arrived at before the slow rung: the way out of it. */
  let fastIntervalMs: number | undefined;
  let degraded = false;

  const state = () => (degraded ? 'degraded' : 'ok');

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
  };

  const climb = (intervalMs: number) => {
    if (rung - 1 < ceilingRung || holdLeft > 0) {
      return;
    }
    if (cleanStreak < framesOf(SCENE_CLIMB_MS, intervalMs)) {
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
      while (next - 1 >= ceilingRung) {
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
  };

  return {
    scale: () => scaleAt(rung),
    slowed: () => rung === slowRung,
    cheapFinish: finish.cheap,
    refloor: (floor) => {
      const current = scaleAt(rung);
      const wasSlow = rung === slowRung;
      scales = ladderScales(top, floor);
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
    },
    resume: (scale) => {
      // The rung of that size, or the next one down where the rungs have
      // moved since; larger than every rung means full size, the start.
      const at = scales.findIndex((entry) => entry <= scale + 1e-6);
      rung = at >= 0 ? at : slowRung - 1;
    },
    frame: (reading, intervalMs, hidden) => {
      // `backgroundThrottling` drops an occluded window to about one frame a
      // second. Counting those would ratchet the quality down every minute the
      // window was minimised, for nobody.
      if (hidden || degraded) {
        slowStreak = 0;
        floorStreak = 0;
        return state();
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
      const { over, catastrophic } = judge(reading, intervalMs);
      const bottom = atBottom(intervalMs);
      floorStreak = bottom && catastrophic ? floorStreak + 1 : 0;
      if (floorStreak >= SCENE_SLOW_FRAMES_TO_STEP) {
        degraded = true;
        return state();
      }
      if (over) {
        slowStreak += 1;
        // A lone late frame — a pause on the page, a frame the compositor
        // held — is a hiccup, not a load: the run of clean frames a climb
        // waits for survives one, as the step down needs six in a row.
        if (slowStreak >= 2) {
          cleanStreak = 0;
        }
        if (slowStreak >= SCENE_STEP_DOWN_FRAMES) {
          slowStreak = 0;
          if (!bottom) {
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
      return state();
    },
    reset: () => {
      rung = 0;
      slowStreak = 0;
      cleanStreak = 0;
      floorStreak = 0;
      holdLeft = 0;
      sinceClimb = undefined;
      ceilingRung = 0;
      ceilingLeft = 0;
      doublings = 0;
      typicalCostMs = undefined;
      fastIntervalMs = undefined;
      degraded = false;
      finish.reset();
    },
  };
};

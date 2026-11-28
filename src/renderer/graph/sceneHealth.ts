/**
 * Whether this machine can run a scene at all, and the numbers every scene's
 * size controller (`sceneLadder.ts`) is judged by.
 *
 * The WebGL2 probe is asked once, lazily, the first time anything wants to
 * know — under Jest the canvas answers null and every premium row simply
 * never appears, which is also what happens on a machine with no usable GPU.
 */

import { SCENE_AUTO_FLOOR } from 'common/scenePerformance';
import { THIRTY_A_SECOND_MS } from 'common/smoothing';

let webgl2Available: boolean | undefined;

/**
 * The attributes a scene asks for, kept in one place so the probe and every
 * real canvas — the renderer worker's, the still worker's (a 3D world draws
 * on the context it is handed), the desk lights' — cannot disagree. No
 * depth, no stencil, no multisampling — a single fullscreen triangle needs
 * none of them and each one costs fill.
 *
 * The fast graphics card, always (Ivan, 2026-11-27: "always to try enforce
 * fast high performance"). On Windows this attribute alone moves nothing:
 * Chromium keeps WebGL on its own GPU unless `EGLDualGPURendering` is on,
 * and it is off by default there (`ui/gl/gl_switches.cc`), which is why main
 * starts the whole app on the fast card (`force_high_performance_gpu`,
 * `main.ts`). On a Mac with two graphics chips that feature is on by
 * default, and this is what puts a scene on the discrete one.
 */
export const SCENE_CONTEXT_ATTRIBUTES: WebGLContextAttributes = {
  alpha: true,
  premultipliedAlpha: true,
  antialias: false,
  depth: false,
  stencil: false,
  preserveDrawingBuffer: false,
  powerPreference: 'high-performance',
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
 * viewer would take over none; the last is Auto's floor, and Balanced's
 * half is among them. Below the floor the ladder has one more rung: the
 * same picture at `SCENE_SLOW_PACE_MS`.
 */
export const SCENE_RENDER_SCALES: readonly number[] = [
  1,
  0.85,
  0.77,
  0.67,
  0.59,
  0.5,
  0.42,
  SCENE_AUTO_FLOOR,
];

/**
 * The frame rate a scene is held to on the rung below the smallest picture.
 *
 * Thirty a second: half the budget again, which on that same chip at 4K is
 * what the heaviest scene of the six needs at a third of the pixels. Only a
 * rung at all while frames arrive faster than this — a listener who chose
 * thirty, or a thirty-hertz panel, has nothing to slow.
 */
export const SCENE_SLOW_PACE_MS = THIRTY_A_SECOND_MS;

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
 * The finishing passes' share of the interval past which they are too dear
 * for this GPU, and the plain scaler is used instead for the session.
 *
 * The passes cost per pixel of the panel, whatever size the scene is drawn
 * at, so shrinking the scene cannot pay for them: on the integrated chip of
 * a laptop they were 13 ms at 4K, more than a light scene at half size, and
 * the compositor's stretch costs nothing.
 */
export const SCENE_FINISH_SHARE = 0.3;

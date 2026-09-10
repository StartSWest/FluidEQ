/**
 * Whether this machine can run a scene at all, and how hard it may be pushed.
 *
 * Two things live here and neither has a timer. The WebGL2 probe is asked once,
 * lazily, the first time anything wants to know — under Jest the canvas answers
 * null and every premium row simply never appears, which is also what happens
 * on a machine with no usable GPU. The cost ladder watches frame times as they
 * arrive and steps the resolution down; it never steps back up within a
 * session, because a scale that oscillates on the boundary is a visibly
 * pulsing picture, which is worse than a lower one.
 */

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
 * Backing-store scale, full to half.
 *
 * A fragment shader costs per pixel. Half resolution is a quarter of the work
 * and, for a soft scene behind a chart, not something a person notices — where
 * a stutter is.
 */
export const SCENE_RENDER_SCALES: readonly number[] = [1, 0.75, 0.5];

/**
 * Consecutive over-budget frames before stepping down.
 *
 * Twelve is about half a second at thirty frames: long enough that a single
 * garbage-collection pause or a window being dragged does not lower the
 * picture for the rest of the session.
 */
export const SCENE_SLOW_FRAMES_TO_STEP = 24;

/**
 * A frame is "slow" past this many budgets.
 *
 * Three, not two. At the ordinary thirty-frame budget that is a hundred
 * milliseconds — under ten frames a second — which is where a scene has
 * visibly stopped being motion. Two budgets was sixty-six, and a development
 * build with a dozen shaders open sat there on an ordinary afternoon and
 * stepped every look down to its floor.
 */
export const SCENE_SLOW_FRAME_FACTOR = 3;

export interface ICostLadder {
  scale(): number;
  /**
   * Report one frame. Returns `degraded` when the floor has been reached and
   * the scene is still too slow — at which point the caller hands over to the
   * 2D fallback.
   */
  frame(deltaMs: number, budgetMs: number, hidden: boolean): 'ok' | 'degraded';
  reset(): void;
}

export const createCostLadder = (): ICostLadder => {
  let rung = 0;
  let slowStreak = 0;
  let degraded = false;

  return {
    scale: () => SCENE_RENDER_SCALES[rung],
    frame: (deltaMs, budgetMs, hidden) => {
      // `backgroundThrottling` drops an occluded window to about one frame a
      // second. Counting those would ratchet the quality down every minute the
      // window was minimised, for nobody.
      if (hidden || budgetMs <= 0) {
        slowStreak = 0;
        return degraded ? 'degraded' : 'ok';
      }
      if (deltaMs > budgetMs * SCENE_SLOW_FRAME_FACTOR) {
        slowStreak += 1;
      } else {
        slowStreak = 0;
      }
      if (slowStreak >= SCENE_SLOW_FRAMES_TO_STEP) {
        slowStreak = 0;
        if (rung < SCENE_RENDER_SCALES.length - 1) {
          rung += 1;
        } else {
          degraded = true;
        }
      }
      return degraded ? 'degraded' : 'ok';
    },
    reset: () => {
      rung = 0;
      slowStreak = 0;
      degraded = false;
    },
  };
};

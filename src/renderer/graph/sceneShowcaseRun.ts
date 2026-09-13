import type { IScenePack } from 'common/scenePacks';
import {
  createStudioSignalBuffers,
  shapeStudioFrame,
} from '../studio/studioSignals';
import type { ISceneFrame } from './sceneGl';
import { createSceneTuner } from './sceneTuner';

/**
 * The frames a scene is drawn through when it is pictured or measured off
 * screen: the showcase signal from its first frame to the first kick after
 * the warm-up. Free of the page — no document, no styles — because it runs in
 * the scene still worker, where the pictures and the sky are drawn.
 */

/**
 * How long a scene hears the showcase before its picture can be taken: long
 * enough for the slow spectrum to fill and anything that grows with the music
 * to have grown.
 */
const SHOWCASE_WARMUP_S = 1.6;

/** A kick this fresh is the frame where the scene reacts most. */
const KICK_THRESHOLD = 0.35;

/**
 * Steps of the simulated clock. Thirty a second reaches the same eased state
 * as sixty, with half the draws.
 */
export const STILL_FRAME_MS = 1000 / 30;

/**
 * Past this the scene is pictured as it is. The first kick after the warm-up
 * arrives at 2.03 s at the showcase's 118 BPM; three seconds leaves room.
 */
const MAX_STILL_FRAMES = 30 * 3;

/**
 * A run may reuse one set of buffers from frame to frame: each frame is drawn
 * before the next is asked for, and a run that is over hands out nothing
 * rather than touching them again.
 */
export type TFrameRun = () => ISceneFrame | undefined;

/**
 * The showcase from its first frame to the first kick after the warm-up —
 * the frame a kick crosses the threshold on, where a scene reacts most — or
 * to the end of the run for a scene that never gets there.
 *
 * `accent` is the theme's accent as the page reads it, since a worker has no
 * styles to read it from. The window's tint is measured from this same run
 * (`sceneSky.ts`), so the colour a scene lends the app comes from the same
 * few seconds its picture does.
 */
export const showcaseRun = (
  pack: IScenePack,
  accent: readonly [number, number, number],
): TFrameRun => {
  const buffers = createStudioSignalBuffers();
  // Through the scene's own response and at its controls' values, as the
  // graph would draw it: a scene tuned to rest through quiet parts should
  // not be pictured doing otherwise.
  const tuner = createSceneTuner();
  const base = Object.fromEntries(
    pack.params.map((param) => [param.id, param.value]),
  );
  let index = 0;
  let wasKicking = false;
  let over = false;
  return () => {
    if (over || index >= MAX_STILL_FRAMES) {
      return undefined;
    }
    const seconds = (index * STILL_FRAME_MS) / 1000;
    index += 1;
    const heard = shapeStudioFrame(
      {
        timeSeconds: seconds,
        deltaMs: STILL_FRAME_MS,
        level: 0,
        beat: 0,
        bands: [0, 0, 0],
        accent,
        fade: 1,
        spectrum: buffers.spectrum,
        waveform: buffers.waveform,
        params: {},
      },
      'showcase',
      buffers,
    );
    // The moment is chosen on what was played, so every scene is pictured
    // at the same kick whatever its response makes of it.
    const kicking = heard.beat >= KICK_THRESHOLD;
    over = kicking && !wasKicking && seconds >= SHOWCASE_WARMUP_S;
    wasKicking = kicking;
    return tuner.apply(heard, STILL_FRAME_MS, pack, base, undefined);
  };
};

/** `frames` replayed oldest first, each at full presence. */
export const capturedRun = (frames: readonly ISceneFrame[]): TFrameRun => {
  let index = 0;
  return () => {
    if (index >= frames.length) {
      return undefined;
    }
    const frame = frames[index];
    index += 1;
    return { ...frame, fade: 1 };
  };
};

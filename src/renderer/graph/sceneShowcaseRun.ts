import type { IScenePack } from 'common/scenePacks';
import { SCENE_TAP_AGE_LIMIT_S } from 'common/sceneUniformContract';
import { STUDIO_TEST_ACCENT_AT_S } from 'common/studioTestMusic';
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
 * The showcase carries one big moment of its own, half a second in and gone
 * a second and a half later, so a scene that answers a musical accent is
 * caught answering it rather than waiting for one.
 */
const SHOWCASE_ACCENT_AT_S = STUDIO_TEST_ACCENT_AT_S;
const showcaseAccent = (seconds: number): number => {
  const since = seconds - SHOWCASE_ACCENT_AT_S;
  if (since < 0) {
    return 0;
  }
  return Math.max(0, 1 - since / 1.5);
};

/**
 * Steps that end exactly `seconds` in, none longer than a still frame: the
 * last frame is the picture, taken at the very moment asked for. Counted on
 * the still frame's own grid instead, a picture asked for on a beat at 2.034 s
 * was taken at 2.0 - 0.93 of a beat - and an AI placing a dancer's steps from
 * such pictures was a frame out on every one of them.
 */
const stepsTo = (seconds: number) => {
  const steps = Math.max(1, Math.ceil((seconds * 1000) / STILL_FRAME_MS));
  return { frames: steps + 1, stepMs: (seconds * 1000) / steps };
};

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
  /**
   * Play exactly this many seconds instead, kick or no kick: the member's AI
   * taking pictures a moment apart to see how the scene moves.
   */
  until?: number,
  /** The music at another tempo, for the member's AI to try its dance on. */
  tempo?: number,
): TFrameRun => {
  const { frames, stepMs } =
    until === undefined
      ? { frames: MAX_STILL_FRAMES, stepMs: STILL_FRAME_MS }
      : stepsTo(until);
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
    if (over || index >= frames) {
      return undefined;
    }
    const seconds = (index * stepMs) / 1000;
    index += 1;
    const heard = shapeStudioFrame(
      {
        timeSeconds: seconds,
        deltaMs: stepMs,
        level: 0,
        beat: 0,
        bands: [0, 0, 0],
        musicAccent: [showcaseAccent(seconds), 1],
        // The showcase turns the wheel at a steady half speed, so a scene
        // that is carried by it is caught moving rather than standing still.
        musicRun: [(seconds * 0.22) % 1, 0.22],
        accent,
        fade: 1,
        spectrum: buffers.spectrum,
        waveform: buffers.waveform,
        params: {},
      },
      'showcase',
      buffers,
      { tempo },
    );
    // The moment is chosen on what was played, so every scene is pictured
    // at the same kick whatever its response makes of it.
    const kicking = heard.beat >= KICK_THRESHOLD;
    over =
      until === undefined &&
      kicking &&
      !wasKicking &&
      seconds >= SHOWCASE_WARMUP_S;
    wasKicking = kicking;
    return tuner.apply(heard, stepMs, pack, base, undefined);
  };
};

/**
 * `seconds` of nothing at all, through the scene's own response: what the
 * scene looks like between songs, which the member rules require to be calm.
 * The flywheel stands still and every reading is zero.
 */
export const silenceRun = (
  pack: IScenePack,
  accent: readonly [number, number, number],
  seconds: number,
): TFrameRun => {
  const buffers = createStudioSignalBuffers();
  const tuner = createSceneTuner();
  const base = Object.fromEntries(
    pack.params.map((param) => [param.id, param.value]),
  );
  const { frames, stepMs } = stepsTo(seconds);
  let index = 0;
  return () => {
    if (index >= frames) {
      return undefined;
    }
    const heard: ISceneFrame = {
      timeSeconds: (index * stepMs) / 1000,
      deltaMs: stepMs,
      level: 0,
      beat: 0,
      bands: [0, 0, 0],
      musicAccent: [0, 0],
      musicRun: [0, 0],
      accent,
      fade: 1,
      spectrum: buffers.spectrum,
      waveform: buffers.waveform,
      params: {},
    };
    index += 1;
    return tuner.apply(heard, stepMs, pack, base, undefined);
  };
};

/**
 * What the member's AI puts in a scene for its picture, beside the sound: the
 * wave's band, and the viewer's hands — the camera turned, the pointer
 * resting, a tap some seconds before.
 */
export interface IPictureHands {
  spectrumRect: readonly [number, number, number, number];
  camera?: readonly [number, number, number];
  pointer?: { x: number; y: number; pressed: boolean };
  tap?: { x: number; y: number; seconds: number };
}

/**
 * The run `make` plays, with `hands` in every frame.
 *
 * The tap lands `tap.seconds` before the run's last frame — the one that is
 * pictured — and has not happened before then. Without a length of its own a
 * showcase ends on a kick nobody can name in advance, so the run is played
 * once dry to find where it ends: frames with no drawing are nothing to pay.
 */
export const handedRun = (
  make: () => TFrameRun,
  { spectrumRect, camera, pointer, tap }: IPictureHands,
): TFrameRun => {
  let tapAt = Number.POSITIVE_INFINITY;
  if (tap) {
    const dry = make();
    let end = 0;
    for (let frame = dry(); frame; frame = dry()) {
      end = frame.timeSeconds;
    }
    tapAt = end - tap.seconds;
  }
  const held: Partial<ISceneFrame> = {
    spectrumRect,
    ...(camera ? { camera } : {}),
    ...(pointer
      ? { pointer: [pointer.x, pointer.y, pointer.pressed ? 1 : 0, 1] }
      : {}),
  };
  const played = make();
  return () => {
    const frame = played();
    if (!frame) {
      return undefined;
    }
    const since = frame.timeSeconds - tapAt;
    return {
      ...frame,
      ...held,
      ...(tap && since >= 0
        ? {
            tap: [tap.x, tap.y, Math.min(SCENE_TAP_AGE_LIMIT_S, since), 1],
          }
        : {}),
    };
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

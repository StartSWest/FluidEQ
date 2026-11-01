import { getEaseFactor } from 'common/smoothing';

/**
 * Where the music stands between the speakers (`common/liveFrames.ts`, where
 * the core reads it for the desktop backgrounds too), and below, how a scene
 * is handed it.
 */
export { readStereoImage } from 'common/liveFrames';

/** How quickly the shown image follows the music, and how it fades out. */
const FOLLOW_HALF_LIFE_MS = 90;
const FADE_HALF_LIFE_MS = 300;

/**
 * The image a scene is handed, eased so a window's worth of noise does not
 * shake it: following what is heard, and settling to the middle, no width,
 * when nothing is (paused, a mono capture).
 * Returns a fresh pair each step, since a frame may be kept (a recorded
 * moment) after the next one is made.
 */
export const createStereoFollower = () => {
  let shown: readonly [number, number] = [0, 0];
  return (
    heard: readonly [number, number] | undefined,
    elapsedMs: number,
  ): readonly [number, number] => {
    const target = heard ?? [0, 0];
    const ease = getEaseFactor(
      elapsedMs,
      heard ? FOLLOW_HALF_LIFE_MS : FADE_HALF_LIFE_MS,
    );
    shown = [
      shown[0] + (target[0] - shown[0]) * ease,
      shown[1] + (target[1] - shown[1]) * ease,
    ];
    return shown;
  };
};

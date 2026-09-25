import { getEaseFactor } from 'common/smoothing';

/**
 * Where the music stands between the speakers, for a scene's `uStereo`: its
 * balance, and how wide it is.
 *
 * Read from the two channels' own samples, not their peaks. Peaks say which
 * side is louder and nothing else: a wide mix with both sides at the same
 * level read as a mono one, and a hard-panned guitar and a centred vocal at
 * the same level cancelled out. The width is the share of the energy in the
 * difference between the channels — 0 for mono, a half for two unrelated
 * sides, 1 for one side the other's opposite — and the balance compares the
 * two sides' RMS levels, so the Windows volume under the capture cancels out.
 */

/** Below this mean energy a window is silence, and has no image. */
const SILENT_ENERGY = 1e-9;

/**
 * `[balance, width]` of one window of the two channels: balance -1 all left
 * to 1 all right, width 0..1. Written into `out`, which is returned.
 */
export const readStereoImage = (
  left: Float32Array,
  right: Float32Array,
  out: [number, number],
): [number, number] => {
  const length = Math.min(left.length, right.length);
  let leftEnergy = 0;
  let rightEnergy = 0;
  let sideEnergy = 0;
  for (let index = 0; index < length; index += 1) {
    const l = left[index];
    const r = right[index];
    leftEnergy += l * l;
    rightEnergy += r * r;
    const side = l - r;
    sideEnergy += side * side;
  }
  // Mid and side at the same scale, (l + r) and (l - r): together they hold
  // twice the two channels' energy, so the side's share needs no mid sum.
  const total = leftEnergy + rightEnergy;
  if (length === 0 || total / length < SILENT_ENERGY) {
    out[0] = 0;
    out[1] = 0;
    return out;
  }
  const leftLevel = Math.sqrt(leftEnergy);
  const rightLevel = Math.sqrt(rightEnergy);
  out[0] = (rightLevel - leftLevel) / (rightLevel + leftLevel);
  out[1] = Math.min(1, sideEnergy / (2 * total));
  return out;
};

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

/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * An animation in a Studio project (Ivan, 2026-11-09: "a wolf that walks and
 * be able to group it on stripe object so when I open it it shows the
 * animation"): one sheet of poses in a grid, how it is cut, how fast it
 * plays and where the creature belongs. Kept as `animations/<name>.json`
 * beside the picture it names, so the member's AI writes it as it writes any
 * other file, and the Studio's Animations tab and the scene read one thing.
 */

export const ANIMATIONS_DIR = 'animations';
/** The name is the file's: what the agent calls it and the member sees. */
export const ANIMATION_NAME = /^[a-z][a-z0-9-]{0,39}$/;
export const MAX_ANIMATION_FRAMES = 256;
export const MAX_ANIMATIONS = 32;
export const MAX_ANIMATION_FILE_BYTES = 16 * 1024;

/**
 * Where the creature belongs, which the Studio shows it against while it is
 * worked on (never in the scene or a thumbnail): a base line its lowest foot
 * stands on, the sky, the water, or nothing at all.
 */
export type TAnimationGround = 'ground' | 'sky' | 'water' | 'none';
export const ANIMATION_GROUNDS: readonly TAnimationGround[] = [
  'ground',
  'sky',
  'water',
  'none',
];

export interface IStudioAnimation {
  name: string;
  /** The sheet, a picture in the project, as a path from its folder. */
  sheet: string;
  count: number;
  /** Frames to a row, left to right and then top to bottom. */
  columns: number;
  /** Frames a second. */
  fps: number;
  /** False: plays once and holds the last frame. */
  loop: boolean;
  ground: TAnimationGround;
}

/**
 * A picture inside the project, written with forward slashes: never
 * absolute, never climbing out, never hidden, and a still the window
 * decodes. Only a path; that it is a plain file is main's to check.
 */
const SHEET_PATH =
  /^(?:[A-Za-z0-9][A-Za-z0-9_-]*\/){0,3}[A-Za-z0-9][A-Za-z0-9_.-]*\.(?:png|jpe?g|webp)$/i;

const whole = (
  value: unknown,
  fallback: number,
  least: number,
  most: number,
): number =>
  typeof value === 'number' && Number.isFinite(value)
    ? Math.min(most, Math.max(least, Math.round(value)))
    : fallback;

/**
 * An animation file as written, read forgivingly: a field it cannot use
 * takes its default, and only a file with no picture to play is refused.
 */
export const readStudioAnimation = (
  name: string,
  raw: unknown,
): IStudioAnimation | undefined => {
  if (
    !ANIMATION_NAME.test(name) ||
    typeof raw !== 'object' ||
    raw === null ||
    Array.isArray(raw)
  ) {
    return undefined;
  }
  const value = raw as Record<string, unknown>;
  if (
    typeof value.sheet !== 'string' ||
    !SHEET_PATH.test(value.sheet) ||
    value.sheet.includes('..')
  ) {
    return undefined;
  }
  const count = whole(value.count, 1, 1, MAX_ANIMATION_FRAMES);
  return {
    name,
    sheet: value.sheet,
    count,
    columns: whole(value.columns, count, 1, count),
    fps:
      typeof value.fps === 'number' && Number.isFinite(value.fps)
        ? Math.min(60, Math.max(1, value.fps))
        : 8,
    loop: typeof value.loop === 'boolean' ? value.loop : true,
    ground:
      ANIMATION_GROUNDS.find((ground) => ground === value.ground) ?? 'none',
  };
};

export interface IFrameCell {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Where frame `index` sits on a sheet `width` by `height`. */
export const frameCell = (
  animation: Pick<IStudioAnimation, 'count' | 'columns'>,
  width: number,
  height: number,
  index: number,
): IFrameCell => {
  const rows = Math.ceil(animation.count / animation.columns);
  const cellWidth = width / animation.columns;
  const cellHeight = height / rows;
  const frame = ((index % animation.count) + animation.count) % animation.count;
  return {
    x: Math.round((frame % animation.columns) * cellWidth),
    y: Math.round(Math.floor(frame / animation.columns) * cellHeight),
    width: Math.floor(cellWidth),
    height: Math.floor(cellHeight),
  };
};

/**
 * The frame showing `elapsedMs` into the animation: counted on the clock
 * the caller hands in (a painted frame's own time), never a timer of its
 * own; a one-shot holds its last frame.
 */
export const frameAtTime = (
  animation: Pick<IStudioAnimation, 'count' | 'loop'>,
  fps: number,
  elapsedMs: number,
): number => {
  const played = Math.floor((Math.max(0, elapsedMs) * fps) / 1000);
  return animation.loop
    ? played % animation.count
    : Math.min(played, animation.count - 1);
};

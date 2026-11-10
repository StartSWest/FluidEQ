/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  animationFindings,
  measureAnimation,
} from '../../common/animationFrames';
import {
  ANIMATION_GROUNDS,
  type TAnimationGround,
} from '../../common/studioAnimation';
import type { TAgentProject } from '../studioAgent/agentProject';
import {
  borderKey,
  keyOut,
  premultiply,
  unpremultiply,
  type TKey,
} from './chromaKey';
import type { IAnimationFields, ISheetCodec } from './sheetFiles';
import type { IPixels } from './sheetRig';

/** What both sheet tools are built from, per chat. */
export interface ISheetToolsDeps {
  /** The chat's project, asked again on every call. */
  project(): TAgentProject;
  /** The Stop signal of the reply in progress. */
  signal(): AbortSignal;
  codec: ISheetCodec;
}

export const NO_PROJECT =
  "This chat's project is not in FluidEQ's Studio list any more, or may not be used now: ask the member to open it in the Studio again.";

/** Most frames a sheet tool builds into one sheet. */
export const MAX_SHEET_FRAMES = 48;
/** Most columns: a sheet's row stays under SHEET_BOUNDS' side at the largest cell. */
export const MAX_SHEET_COLUMNS = 16;
export const MIN_CELL = 32;
export const MAX_CELL = 512;

export const isWhole = (
  value: unknown,
  least: number,
  most: number,
): value is number =>
  typeof value === 'number' &&
  Number.isInteger(value) &&
  value >= least &&
  value <= most;

export const isNumber = (
  value: unknown,
  least: number,
  most: number,
): value is number =>
  typeof value === 'number' &&
  Number.isFinite(value) &&
  value >= least &&
  value <= most;

/**
 * Lets the main process breathe between frames: the window's other calls
 * are answered before the next frame is drawn. No duration: it waits for
 * the event loop's own turn, never a guess at how long anything takes.
 */
export const breathe = () =>
  new Promise<void>((resolve) => {
    setImmediate(resolve);
  });

/** How a sheet plays when the call says nothing: on twos, about. */
const DEFAULT_FPS = 10;

export const REPLACE_SCHEMA = {
  type: 'boolean',
  description:
    'true to give an animation that already exists this new sheet; the sheet it has now stays in its history, undoable. Without it, a name already in use is refused.',
};

export const ANIMATION_SCHEMA = {
  type: 'object',
  description: `How animations/<name>.json, written beside the sheet so it plays in the Animations tab, plays it: ${DEFAULT_FPS} a second and shown against nothing when left out.`,
  properties: {
    fps: { type: 'number', minimum: 1, maximum: 60 },
    loop: { type: 'boolean' },
    ground: { type: 'string', enum: ANIMATION_GROUNDS },
  },
  required: ['fps'],
  additionalProperties: false,
};

/**
 * The animation fields as asked, or their defaults, or a reason. Every
 * sheet a tool makes gets its animation file: that is what makes it one of
 * the tools' sheets, which a later call may write over
 * (`sheetTargetProblem`), and what the Animations tab plays.
 */
export const readAnimationFields = (
  raw: unknown,
  loop: boolean,
): IAnimationFields | string => {
  if (raw === undefined) {
    return { fps: DEFAULT_FPS, loop, ground: 'none' };
  }
  if (typeof raw !== 'object' || raw === null) {
    return 'animation is { fps, loop, ground }.';
  }
  const { fps, loop: asked, ground } = raw as Record<string, unknown>;
  if (!isNumber(fps, 1, 60)) {
    return "animation's fps is 1 to 60 frames a second.";
  }
  if (asked !== undefined && typeof asked !== 'boolean') {
    return "animation's loop is true or false.";
  }
  const where = ANIMATION_GROUNDS.find((value) => value === ground);
  if (ground !== undefined && !where) {
    return `animation's ground is one of ${ANIMATION_GROUNDS.join(', ')}.`;
  }
  return {
    fps,
    loop: typeof asked === 'boolean' ? asked : loop,
    ground: where ?? ('none' as TAnimationGround),
  };
};

const HEX = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i;

/** A key colour as written (#rrggbb), in the BGR order Electron's pixels are. */
export const readKey = (raw: unknown): TKey | 'auto' | 'none' | undefined => {
  if (raw === undefined || raw === 'auto') {
    return 'auto';
  }
  if (raw === 'none') {
    return 'none';
  }
  const match = typeof raw === 'string' ? HEX.exec(raw) : null;
  return match
    ? [parseInt(match[3], 16), parseInt(match[2], 16), parseInt(match[1], 16)]
    : undefined;
};

/** A picture already cut out: its corners are not all opaque. */
const isCutOut = (picture: IPixels) => {
  const { data, width, height } = picture;
  return [
    0,
    (width - 1) * 4,
    (height - 1) * width * 4,
    ((height - 1) * width + width - 1) * 4,
  ].some((at) => data[at + 3] < 250);
};

/** The green a picture is usually stood on, when it says nothing else. */
const GREEN: TKey = [0, 255, 0];

/**
 * The picture with its flat background taken out (in place), or why not:
 * one already cut out is left as it is, and `auto` takes the colour from the
 * picture's own border, which must then be one colour.
 */
export const cutOut = (
  picture: IPixels,
  key: TKey | 'auto' | 'none',
): IPixels | 'not-flat' => {
  if (key === 'none' || isCutOut(picture)) {
    return picture;
  }
  const { data, width, height } = picture;
  unpremultiply(data);
  if (key === 'auto' && !borderKey(data, width, height)) {
    premultiply(data);
    return 'not-flat';
  }
  keyOut(data, width, height, key === 'auto' ? GREEN : key);
  premultiply(data);
  return picture;
};

/** What `look_at_animation` would name, said with the tool's own answer. */
export const findingsOf = (
  sheet: IPixels,
  count: number,
  columns: number,
  how: { loop: boolean; ground?: TAnimationGround },
): string => {
  const findings = animationFindings(
    measureAnimation(sheet, { count, columns }),
    how,
  );
  if (findings.length === 0) {
    return 'No frame floats, sinks, pops or jumps by the measures.';
  }
  return findings
    .map(({ frame, kind }) => {
      const what = {
        empty: 'is empty',
        feet: 'stands off the line the others stand on',
        size: 'is a different size from the others',
        jump: 'jumps from the frame before',
      }[kind];
      return `Frame ${frame} ${what}.`;
    })
    .join(' ');
};

/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import fs from 'fs';
import path from 'path';
import {
  isDecodablePicture,
  pictureHeaderSize,
  SHEET_BOUNDS,
} from '../../common/pictureBounds';
import {
  ANIMATION_NAME,
  ANIMATIONS_DIR,
  type TAnimationGround,
} from '../../common/studioAnimation';
import { modelImageSize } from '../../common/worldModelImages';
import { recordSheet, type IRecordHow } from '../memberScenes/animationHistory';
import {
  MAX_SHEET_BYTES,
  readProjectAnimation,
  readProjectAnimations,
} from '../memberScenes/projectAnimations';
import type { IMcpToolResult } from '../studioAgent/mcpProtocol';
import { ART_DIR, ART_NAME, artFolder, READABLE_PICTURES } from './artFolder';
import { insideFolder } from './projectPath';
import type { IPixels } from './sheetRig';

/**
 * What the sheet tools read and write in a project, and nothing else
 * (`projectPath.ts`: FluidEQ's own tools work inside the scene's folder).
 *
 * - A picture is read only from a path whose real location, links and
 *   junctions followed, is inside the project folder (`insideFolder`), as a
 *   plain file with one name, within `MAX_SHEET_BYTES`, and decoded only
 *   once its own header says it fits `SHEET_BOUNDS`.
 * - A sheet is written only as `art/<name>.png` and its animation only as
 *   `animations/<name>.json`, from a name the tool checks, never a path the
 *   model sends; each through a temporary file renamed over the old one.
 *
 * Decoding and encoding are the codec's (`sheetCodec.ts`, Electron's own
 * decoder in FluidEQ), so the rules here are tested without it.
 */

export interface ISheetCodec {
  /** Premultiplied pixels, alpha last; undefined when it cannot be read. */
  decode(bytes: Uint8Array): IPixels | undefined;
  encodePng(picture: IPixels): Buffer;
  resize(picture: IPixels, width: number, height: number): IPixels;
  /** A small opaque JPEG of the sheet on grey, for Claude to see. */
  shown(picture: IPixels, longest: number): Buffer;
}

export interface IPictureFile {
  /** The real path, inside the project. */
  real: string;
  /** As the model named it, for its answers. */
  named: string;
  width: number;
  height: number;
  bytes: Uint8Array;
  /** The animation whose sheet this is, when it was read as one. */
  ofAnimation?: string;
}

/**
 * A picture in the project by the path the model gave, read and checked,
 * not decoded; or why not, in words for Claude.
 */
export const readPictureFile = (
  folder: string,
  named: unknown,
): IPictureFile | string => {
  if (typeof named !== 'string' || named.length > 200) {
    return 'Name a picture by its path in the project, like art/whale.png.';
  }
  const real = insideFolder(folder, named);
  if (!real) {
    return `${named} is not inside this scene's project folder; the Studio reads only pictures there.`;
  }
  let bytes: Uint8Array;
  try {
    const stats = fs.lstatSync(real);
    if (!stats.isFile() || stats.nlink !== 1) {
      return `${named} is not a plain picture file.`;
    }
    if (stats.size > MAX_SHEET_BYTES) {
      return `${named} is larger than the ${MAX_SHEET_BYTES / 1024 / 1024} MB a sheet's picture may be.`;
    }
    bytes = new Uint8Array(fs.readFileSync(real));
  } catch {
    return `There is no picture ${named} in the project.`;
  }
  // Electron's decoder in main reads PNG and JPEG only: a WebP decodes to
  // nothing there, so it is said plainly rather than as an unreadable file.
  if (modelImageSize(bytes, 'image/webp')) {
    return `${named} is a WebP, which FluidEQ cannot cut frames from. ${READABLE_PICTURES}`;
  }
  const size = pictureHeaderSize(bytes);
  if (!size || !isDecodablePicture(bytes, SHEET_BOUNDS)) {
    return `${named} is not a PNG or JPEG of at most ${SHEET_BOUNDS.side} pixels a side and ${SHEET_BOUNDS.pixels / 1024 / 1024} megapixels.`;
  }
  return { real, named, width: size[0], height: size[1], bytes };
};

/** Whether `name` is one the tools may write a sheet and animation under. */
export const isSheetName = (name: unknown): name is string =>
  typeof name === 'string' && ART_NAME.test(name) && ANIMATION_NAME.test(name);

/** `folder/<sub>`, made if needed, only when it is a plain folder and no link. */
const plainSubfolder = (folder: string, sub: string): string | undefined => {
  const target = path.join(folder, sub);
  try {
    const stats = fs.lstatSync(target);
    return stats.isDirectory() && !stats.isSymbolicLink() ? target : undefined;
  } catch {
    try {
      fs.mkdirSync(target);
      return target;
    } catch {
      return undefined;
    }
  }
};

export interface IAnimationFields {
  fps: number;
  loop: boolean;
  ground: TAnimationGround;
}

/**
 * Writes the sheet as `art/<name>.png` and its animation as
 * `animations/<name>.json`, through the animation's history
 * (`animationHistory.ts`), so every sheet written - the agent's, the
 * member's import - can be undone; the relative path of the sheet, or why
 * not. `how` says what the change was, and with a first write carries the
 * member's files as they came, kept as the original.
 */
export const writeSheet = async (
  folder: string,
  name: string,
  png: Buffer,
  animation: IAnimationFields & { count: number; columns: number },
  how: IRecordHow = { label: 'Made the sheet' },
): Promise<{ sheet: string } | string> => {
  if (!isSheetName(name)) {
    return 'The name is lowercase letters, digits and hyphens, starting with a letter.';
  }
  // Both folders checked before anything is written: a refusal never leaves
  // a sheet without the animation Claude was told failed.
  try {
    const art = artFolder(folder);
    if (!art || !insideFolder(folder, ART_DIR)) {
      return "The project's art folder is not a plain folder inside it.";
    }
    const animations = plainSubfolder(folder, ANIMATIONS_DIR);
    if (!animations || !insideFolder(folder, ANIMATIONS_DIR)) {
      return "The project's animations folder is not a plain folder inside it.";
    }
  } catch {
    return 'The sheet could not be written into the project.';
  }
  const recorded = await recordSheet(folder, name, png, animation, how);
  return recorded.ok ? { sheet: `${ART_DIR}/${name}.png` } : recorded.reason;
};

/**
 * Why a sheet may not be written as the animation `name`, or undefined: an
 * animation already there is replaced only when the call says so, and the
 * replaced sheet stays in its history. A chat asked to save a sheet "as"
 * some file used to make a second animation, or quietly write over the
 * first (Ivan's alpine project, 2026-11-10).
 */
export const replaceProblem = (
  folder: string,
  name: string,
  replace: unknown,
): string | undefined => {
  const file = insideFolder(folder, `${ANIMATIONS_DIR}/${name}.json`);
  if (!file || !fs.existsSync(file) || replace === true) {
    return undefined;
  }
  return `The animation ${name} already exists. To give it this new sheet, call again with replace: true - the sheet it has now stays in its history, and the member can undo. To make a different animation, give it a name nothing uses yet.`;
};

const sameFile = (a: string, b: string) =>
  process.platform === 'win32' ? a.toLowerCase() === b.toLowerCase() : a === b;

/**
 * Why `art/<name>.png` may not be written over, or undefined when it may:
 * nothing there yet, or a sheet an animation of the same name plays. Never
 * the member's own picture - not one this call reads from (bending
 * art/whale.png into art/whale.png would replace the source), nor any
 * other picture of theirs that only happens to have the name.
 */
export const sheetTargetProblem = async (
  folder: string,
  name: string,
  sources: readonly IPictureFile[],
): Promise<string | undefined> => {
  const target = insideFolder(folder, `${ART_DIR}/${name}.png`);
  if (!target) {
    return "The project's art folder is not a plain folder inside it.";
  }
  // A sheet another animation plays is that animation's: writing a new one
  // under its picture's name made two animations of one sheet (Ivan's
  // alpine project, 2026-11-10: whale-dive.json and whale-dive-sheet.json
  // both on art/whale-dive-sheet.png).
  const others = (await readProjectAnimations(folder)).filter(
    ({ animation }) =>
      animation.name !== name && animation.sheet === `${ART_DIR}/${name}.png`,
  );
  if (others.length > 0) {
    return `art/${name}.png is the sheet of the animation ${others[0].animation.name}. Work on that animation by its own name, ${others[0].animation.name}, or give a new animation a name nothing uses yet.`;
  }
  if (!fs.existsSync(target)) {
    return undefined;
  }
  const own = await readProjectAnimation(folder, name);
  const isItsSheet =
    own !== undefined && own.animation.sheet === `${ART_DIR}/${name}.png`;
  const readFrom = sources.some(
    (source) =>
      sameFile(source.real, target) &&
      // A sheet rebuilt from its own frames is the repair path.
      !(isItsSheet && source.ofAnimation === name),
  );
  if (readFrom || !isItsSheet) {
    return `art/${name}.png is a picture of the member's${readFrom ? ' that this sheet is made from' : ''}; name the sheet something else, like ${name}-sheet.`;
  }
  return undefined;
};

/** Sheets one reply may build: each is seconds of work on the main process. */
export const MAX_SHEETS_PER_REPLY = 12;

/**
 * Counts each reply's sheets by the reply's own Stop signal, which the chat
 * makes new for every reply: the count is main's, whatever the model says.
 */
export const createSheetBudget = (signalOf: () => AbortSignal) => {
  const used = new WeakMap<AbortSignal, number>();
  return {
    /** Takes one sheet from this reply's budget; false when none is left. */
    take: (): boolean => {
      const signal = signalOf();
      const count = used.get(signal) ?? 0;
      if (count >= MAX_SHEETS_PER_REPLY) {
        return false;
      }
      used.set(signal, count + 1);
      return true;
    },
  };
};

export const BUDGET_SPENT = `This reply has built ${MAX_SHEETS_PER_REPLY} sheets, the most one reply may. Look at what you have with look_at_animation, tell the member where it stands, and carry on in the next reply.`;

/** The tool's answer: the sheet as Claude sees it, and the words. */
export const sheetAnswer = (
  codec: ISheetCodec,
  sheet: IPixels,
  words: string,
): IMcpToolResult => ({
  content: [
    {
      type: 'image',
      data: codec.shown(sheet, 1600).toString('base64'),
      mimeType: 'image/jpeg',
    },
    { type: 'text', text: words },
  ],
});

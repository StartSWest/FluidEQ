/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import fs from 'fs';
import path from 'path';
import { ipcMain } from 'electron';
import {
  isDecodablePicture,
  pictureHeaderSize,
  SHEET_BOUNDS,
} from '../../common/pictureBounds';
import {
  ANIMATION_GROUNDS,
  ANIMATIONS_DIR,
  MAX_ANIMATION_FRAMES,
  MAX_ANIMATIONS,
} from '../../common/studioAnimation';
import { MAX_SHEET_BYTES } from '../memberScenes/projectAnimations';
import { ART_DIR } from '../studioChat/artFolder';
import { insideFolder } from '../studioChat/projectPath';
import { isSheetName, writeSheet } from '../studioChat/sheetFiles';

/**
 * An animation the member imported in the Animations tab, written into the
 * open project the way `build_sheet` writes one (`writeSheet`): its sheet
 * as `art/<name>.png`, and `animations/<name>.json` naming it. The window
 * read the member's files and laid them into the sheet, since only the
 * window decodes GIFs and WebP; main checks everything it is handed before
 * a byte is written.
 *
 * NO PATH COMES FROM THE PAGE, as everywhere in the Studio: the folder is
 * the open project's, and the name is a name (`isSheetName`), never a path.
 * Only a PNG is written, because the Animator's own tools read PNG and
 * JPEG only (Electron's decoder in main reads nothing else).
 */

export interface IAnimationImportRequest {
  name: string;
  /** The sheet, a PNG of `count` cells, `columns` across. */
  sheet: Uint8Array;
  count: number;
  columns: number;
  fps: number;
  loop: boolean;
  ground: string;
}

export type TAnimationImportOutcome =
  | { ok: true; name: string }
  | {
      ok: false;
      reason: 'closed' | 'invalid' | 'taken' | 'full' | 'failed';
    };

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

const isWhole = (
  value: unknown,
  least: number,
  most: number,
): value is number =>
  typeof value === 'number' &&
  Number.isInteger(value) &&
  value >= least &&
  value <= most;

/** The request, when every part of it is what a sheet may be. */
export const checkedImport = (
  raw: unknown,
): IAnimationImportRequest | undefined => {
  if (typeof raw !== 'object' || raw === null) {
    return undefined;
  }
  const value = raw as Record<string, unknown>;
  const { name, sheet, count, columns, fps, loop, ground } = value;
  if (
    !isSheetName(name) ||
    !(sheet instanceof Uint8Array) ||
    sheet.byteLength > MAX_SHEET_BYTES ||
    !PNG_SIGNATURE.every((byte, at) => sheet[at] === byte) ||
    !isDecodablePicture(sheet, SHEET_BOUNDS) ||
    !isWhole(count, 1, MAX_ANIMATION_FRAMES) ||
    !isWhole(columns, 1, count) ||
    !isWhole(fps, 1, 60) ||
    typeof loop !== 'boolean' ||
    !ANIMATION_GROUNDS.some((each) => each === ground)
  ) {
    return undefined;
  }
  // The scene cuts the sheet into even cells: a picture that does not
  // divide into them would cut every frame a little off.
  const size = pictureHeaderSize(sheet);
  const rows = Math.ceil(count / columns);
  if (!size || size[0] % columns !== 0 || size[1] % rows !== 0) {
    return undefined;
  }
  return { name, sheet, count, columns, fps, loop, ground: ground as string };
};

/** How many animations the project's folder already has. */
const animationsIn = (folder: string): number => {
  try {
    return fs
      .readdirSync(path.join(folder, ANIMATIONS_DIR))
      .filter((file) => file.endsWith('.json')).length;
  } catch {
    return 0;
  }
};

/**
 * Whether the animation's two files may be written: `outside` when either
 * would land outside the project (a folder that is a link out of it),
 * `taken` when anything already stands there.
 */
const targetProblem = (
  folder: string,
  name: string,
): 'outside' | 'taken' | undefined => {
  const targets = [
    `${ART_DIR}/${name}.png`,
    `${ANIMATIONS_DIR}/${name}.json`,
  ].map((relative) => insideFolder(folder, relative));
  if (targets.some((target) => target === undefined)) {
    return 'outside';
  }
  return targets.some((target) => target !== undefined && fs.existsSync(target))
    ? 'taken'
    : undefined;
};

/** Registers the handler; the returned function takes it away. */
export const registerStudioAnimationImport = ({
  mayEdit,
  activeFolder,
}: {
  mayEdit: () => boolean;
  activeFolder: () => string | undefined;
}): (() => void) => {
  ipcMain.handle(
    'studio-animation-import',
    async (_event, raw: unknown): Promise<TAnimationImportOutcome> => {
      const folder = activeFolder();
      if (!folder || !mayEdit()) {
        return { ok: false, reason: 'closed' };
      }
      const request = checkedImport(raw);
      if (!request) {
        return { ok: false, reason: 'invalid' };
      }
      // Never over the member's own: an import is always something new.
      const problem = targetProblem(folder, request.name);
      if (problem) {
        return { ok: false, reason: problem === 'taken' ? 'taken' : 'failed' };
      }
      if (animationsIn(folder) >= MAX_ANIMATIONS) {
        return { ok: false, reason: 'full' };
      }
      // Through the animation's history, as its first record: the sheet as
      // imported is the original every later change can go back to.
      const written = await writeSheet(
        folder,
        request.name,
        Buffer.from(request.sheet),
        {
          count: request.count,
          columns: request.columns,
          fps: request.fps,
          loop: request.loop,
          ground: request.ground as (typeof ANIMATION_GROUNDS)[number],
        },
        { label: 'Import' },
      );
      return typeof written === 'string'
        ? { ok: false, reason: 'failed' }
        : { ok: true, name: request.name };
    },
  );
  return () => ipcMain.removeHandler('studio-animation-import');
};

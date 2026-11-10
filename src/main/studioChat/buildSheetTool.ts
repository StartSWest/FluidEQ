/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { PICTURE_BOUNDS } from '../../common/pictureBounds';
import {
  ANIMATION_NAME,
  frameCell,
  type IFrameCell,
} from '../../common/studioAnimation';
import { readProjectAnimation } from '../memberScenes/projectAnimations';
import type { IMcpTool, IMcpToolResult } from '../studioAgent/mcpProtocol';
import { failure, READABLE_PICTURES } from './artFolder';
import {
  BUDGET_SPENT,
  createSheetBudget,
  isSheetName,
  readPictureFile,
  sheetAnswer,
  sheetTargetProblem,
  writeSheet,
  type IPictureFile,
} from './sheetFiles';
import { cropPixels, laySheet, type TSheetAlign } from './sheetLayout';
import type { IPixels } from './sheetRig';
import {
  ANIMATION_SCHEMA,
  breathe,
  cutOut,
  findingsOf,
  isWhole,
  MAX_CELL,
  MAX_SHEET_COLUMNS,
  MAX_SHEET_FRAMES,
  MIN_CELL,
  NO_PROJECT,
  readAnimationFields,
  readKey,
  type ISheetToolsDeps,
} from './sheetShared';

/**
 * `build_sheet`: an animation's sheet laid out from frames already in the
 * project - pictures the member brought (one per frame, or a whole grid in
 * one picture), cells of a sheet already made - into one even grid: the
 * flat background keyed out, every frame at one scale, the drawing kept on
 * one baseline or in the middle (`sheetLayout.ts`). It is also how one
 * frame is fixed: the same frames again with that one replaced, from
 * another picture or another cell, or left out.
 */

/** A frame's longest side as worked on: beyond it, nothing a cell shows. */
const WORK_SIDE = 768;
const MAX_MARGIN = 64;
const ALIGNS: readonly TSheetAlign[] = ['keep', 'baseline', 'centre'];

const FRAME_SCHEMA = {
  type: 'object',
  description:
    'Where one frame - or, with columns and rows and no cell, a whole grid of them - comes from: a picture in the project (from), or an animation already made (animation).',
  properties: {
    from: {
      type: 'string',
      description: 'A picture in the project: art/whale-dive-03.png.',
    },
    columns: {
      type: 'integer',
      minimum: 1,
      maximum: MAX_SHEET_COLUMNS,
      description: 'The picture is a grid of frames this many across.',
    },
    rows: { type: 'integer', minimum: 1, maximum: MAX_SHEET_FRAMES },
    cell: {
      type: 'integer',
      minimum: 1,
      description:
        'Only this frame of the grid, counted from 1, left to right and top to bottom; every frame of it in order when left out.',
    },
    count: {
      type: 'integer',
      minimum: 1,
      description: 'With a whole grid: only its first this many frames.',
    },
    animation: {
      type: 'string',
      description:
        'An animation of the project by name (whale-dive): its frames.',
    },
    frame: {
      type: 'integer',
      minimum: 1,
      description:
        'With animation: only this frame, counted from 1; all of them when left out.',
    },
  },
  additionalProperties: false,
};

const BUILD_SCHEMA = {
  type: 'object',
  properties: {
    name: {
      type: 'string',
      description:
        'The sheet and animation: lowercase letters, digits and hyphens, starting with a letter. Written as art/<name>.png; the same name again replaces it, so a sheet can be rebuilt from its own cells.',
    },
    frames: {
      type: 'array',
      minItems: 1,
      maxItems: MAX_SHEET_FRAMES,
      items: FRAME_SCHEMA,
      description: `The frames in order, at most ${MAX_SHEET_FRAMES} once every grid is counted.`,
    },
    columns: { type: 'integer', minimum: 1, maximum: MAX_SHEET_COLUMNS },
    cell: {
      type: 'integer',
      minimum: MIN_CELL,
      maximum: MAX_CELL,
      description:
        "Each frame's width; left out, the frames' own size, at most 512.",
    },
    cell_height: { type: 'integer', minimum: MIN_CELL, maximum: MAX_CELL },
    align: {
      type: 'string',
      enum: ALIGNS,
      description:
        "baseline (when left out): every frame's lowest drawn row on one line, for feet or a waterline. keep: where each frame had it, for cells cut from one sheet. centre: each drawing in the middle, for what flies or floats.",
    },
    margin: {
      type: 'integer',
      minimum: 0,
      maximum: MAX_MARGIN,
      description:
        'Clear pixels round the drawing in each cell; 4 when left out.',
    },
    key: {
      type: 'string',
      description:
        "The flat background to take out of frames that have no transparency: auto (read from each frame's border; when left out), none, or a colour as #rrggbb.",
    },
    animation: ANIMATION_SCHEMA,
  },
  required: ['name', 'frames', 'columns'],
  additionalProperties: false,
};

/** One frame to cut: a rectangle of a picture file. */
interface IFramePlan {
  file: IPictureFile;
  rect: IFrameCell;
  /** How the model named it, for its answers. */
  label: string;
}

const gridCells = (
  file: IPictureFile,
  columns: number,
  rows: number,
): IFrameCell[] =>
  Array.from({ length: columns * rows }, (_, index) =>
    frameCell(
      { count: columns * rows, columns },
      file.width,
      file.height,
      index,
    ),
  );

/** One entry of `frames`, as the frames it stands for; or why not. */
const planEntry = async (
  folder: string,
  entry: unknown,
  files: Map<string, IPictureFile>,
): Promise<IFramePlan[] | string> => {
  if (typeof entry !== 'object' || entry === null) {
    return 'Each frame is { from } or { animation }.';
  }
  const value = entry as Record<string, unknown>;
  const remember = (file: IPictureFile) => {
    const known = files.get(file.real);
    if (known) {
      return known;
    }
    files.set(file.real, file);
    return file;
  };
  if (typeof value.animation === 'string') {
    if (!ANIMATION_NAME.test(value.animation)) {
      return 'An animation is named by its file in animations/, without .json.';
    }
    const found = await readProjectAnimation(folder, value.animation);
    if (!found) {
      return `There is no animation ${value.animation} whose sheet FluidEQ can read. ${READABLE_PICTURES}`;
    }
    const file = readPictureFile(folder, found.animation.sheet);
    if (typeof file === 'string') {
      return file;
    }
    const sheet = remember({ ...file, ofAnimation: value.animation });
    const { count } = found.animation;
    if (value.frame !== undefined && !isWhole(value.frame, 1, count)) {
      return `${value.animation} has frames 1 to ${count}.`;
    }
    const indexes =
      typeof value.frame === 'number'
        ? [value.frame - 1]
        : Array.from({ length: count }, (_, index) => index);
    return indexes.map((index) => ({
      file: sheet,
      rect: frameCell(found.animation, sheet.width, sheet.height, index),
      label: `${value.animation} frame ${index + 1}`,
    }));
  }
  const file = readPictureFile(folder, value.from);
  if (typeof file === 'string') {
    return file;
  }
  const picture = remember(file);
  const { columns, rows, cell, count } = value;
  if (columns === undefined && rows === undefined) {
    return [
      {
        file: picture,
        rect: { x: 0, y: 0, width: picture.width, height: picture.height },
        label: picture.named,
      },
    ];
  }
  if (
    !isWhole(columns, 1, MAX_SHEET_COLUMNS) ||
    !isWhole(rows, 1, MAX_SHEET_FRAMES) ||
    picture.width < columns ||
    picture.height < rows
  ) {
    return `${picture.named}: a grid needs columns (1 to ${MAX_SHEET_COLUMNS}) and rows that fit its pixels.`;
  }
  const cells = gridCells(picture, columns, rows);
  if (cell !== undefined) {
    if (!isWhole(cell, 1, cells.length)) {
      return `${picture.named} has cells 1 to ${cells.length}.`;
    }
    return [
      {
        file: picture,
        rect: cells[cell - 1],
        label: `${picture.named} cell ${cell}`,
      },
    ];
  }
  if (count !== undefined && !isWhole(count, 1, cells.length)) {
    return `${picture.named} has ${cells.length} cells; count is 1 to that.`;
  }
  return cells
    .slice(0, typeof count === 'number' ? count : cells.length)
    .map((rect, index) => ({
      file: picture,
      rect,
      label: `${picture.named} cell ${index + 1}`,
    }));
};

const createBuildSheetTool = ({
  project,
  signal,
  codec,
}: ISheetToolsDeps): IMcpTool => {
  const budget = createSheetBudget(signal);

  const buildSheet = async (
    args: Record<string, unknown>,
  ): Promise<IMcpToolResult> => {
    const {
      name,
      frames,
      columns,
      cell,
      cell_height: cellHeight,
      align,
      margin,
    } = args;
    if (
      !isSheetName(name) ||
      !Array.isArray(frames) ||
      frames.length < 1 ||
      frames.length > MAX_SHEET_FRAMES ||
      !isWhole(columns, 1, MAX_SHEET_COLUMNS) ||
      (cell !== undefined && !isWhole(cell, MIN_CELL, MAX_CELL)) ||
      (cellHeight !== undefined && !isWhole(cellHeight, MIN_CELL, MAX_CELL)) ||
      (align !== undefined && !ALIGNS.some((value) => value === align)) ||
      (margin !== undefined && !isWhole(margin, 0, MAX_MARGIN))
    ) {
      return failure(
        `build_sheet needs a name (a-z, 0-9 and -, starting with a letter), 1 to ${MAX_SHEET_FRAMES} frames, columns from 1 to ${MAX_SHEET_COLUMNS}, and if given a cell of ${MIN_CELL} to ${MAX_CELL} pixels, an align of ${ALIGNS.join(', ')} and a margin of 0 to ${MAX_MARGIN}.`,
      );
    }
    const key = readKey(args.key);
    if (!key) {
      return failure('key is auto, none or a colour written #rrggbb.');
    }
    const open = project();
    if (!open.ok) {
      return failure(NO_PROJECT);
    }
    const files = new Map<string, IPictureFile>();
    const plans: IFramePlan[] = [];
    for (let at = 0; at < frames.length; at += 1) {
      // eslint-disable-next-line no-await-in-loop -- each entry's file is read and checked in turn, and the count is held as they add up
      const planned = await planEntry(open.folder, frames[at], files);
      if (typeof planned === 'string') {
        return failure(planned);
      }
      plans.push(...planned);
      if (plans.length > MAX_SHEET_FRAMES) {
        return failure(
          `That is more than ${MAX_SHEET_FRAMES} frames once every grid is counted.`,
        );
      }
    }
    if (columns > plans.length) {
      return failure(
        `columns is at most the number of frames, ${plans.length}.`,
      );
    }
    const target = await sheetTargetProblem(open.folder, name, [
      ...files.values(),
    ]);
    if (target) {
      return failure(target);
    }
    // Every picture is decoded one at a time, but all of them together are
    // held to what one picture may be: forty-eight sheets at the most a
    // sheet may be would be gigabytes, decoded for a few small cells.
    const decodedPixels = [...files.values()].reduce(
      (sum, file) => sum + file.width * file.height,
      0,
    );
    if (decodedPixels > PICTURE_BOUNDS.pixels) {
      return failure(
        `Those pictures come to ${Math.round(decodedPixels / 1024 / 1024)} megapixels; one sheet is built from at most ${PICTURE_BOUNDS.pixels / 1024 / 1024}. Use smaller pictures, or fewer.`,
      );
    }
    const animation = readAnimationFields(args.animation, true);
    if (typeof animation === 'string') {
      return failure(animation);
    }
    if (!budget.take()) {
      return failure(BUDGET_SPENT);
    }
    // One working scale for every frame, so frames drawn at one size stay
    // one size; nothing is worked on larger than a cell can show.
    const largestSide = Math.max(
      ...plans.map(({ rect }) => Math.max(rect.width, rect.height)),
    );
    const work = Math.min(1, WORK_SIDE / largestSide);
    const cut: IPixels[] = new Array<IPixels>(plans.length);
    const sources = [...files.values()];
    for (let at = 0; at < sources.length; at += 1) {
      const file = sources[at];
      if (signal().aborted) {
        return failure('The member stopped the reply.');
      }
      const picture = codec.decode(file.bytes);
      if (!picture) {
        return failure(
          `${file.named} could not be read as a picture. ${READABLE_PICTURES}`,
        );
      }
      for (let index = 0; index < plans.length; index += 1) {
        const plan = plans[index];
        if (plan.file === file) {
          const { x, y, width, height } = plan.rect;
          let frame: IPixels;
          try {
            frame = codec.resize(
              cropPixels(picture, x, y, width, height),
              Math.max(1, Math.round(width * work)),
              Math.max(1, Math.round(height * work)),
            );
          } catch {
            return failure(`${plan.label} could not be cut out.`);
          }
          // A cut is always pixels of its own (`cropPixels`), so keying it in
          // place leaves the picture's other cells as they were.
          const keyed = cutOut(frame, key);
          if (keyed === 'not-flat') {
            return failure(
              `${plan.label} has no transparency and its border is not one flat colour, so FluidEQ cannot tell the creature from its background. Give key as the background's colour (#rrggbb), or none to keep it.`,
            );
          }
          cut[index] = keyed;
        }
      }
      // eslint-disable-next-line no-await-in-loop -- one picture at a time, so main answers the window between them
      await breathe();
    }
    let laid;
    try {
      laid = laySheet(
        cut,
        {
          columns,
          ...(typeof cell === 'number' ? { cellWidth: cell } : {}),
          ...(typeof cellHeight === 'number' || typeof cell === 'number'
            ? { cellHeight: typeof cellHeight === 'number' ? cellHeight : cell }
            : {}),
          align: (align as TSheetAlign | undefined) ?? 'baseline',
          margin: typeof margin === 'number' ? margin : 4,
        },
        codec.resize,
        MAX_CELL,
      );
    } catch {
      return failure('The frames could not be laid into a sheet.');
    }
    if (!laid) {
      return failure(
        'Nothing is drawn in any of those frames once their background is taken out, or the cell is too small for the margin.',
      );
    }
    if (signal().aborted) {
      return failure('The member stopped the reply.');
    }
    const written = writeSheet(open.folder, name, codec.encodePng(laid.sheet), {
      count: plans.length,
      columns,
      ...animation,
    });
    if (typeof written === 'string') {
      return failure(written);
    }
    return sheetAnswer(
      codec,
      laid.sheet,
      [
        `Made ${written.sheet}: ${plans.length} frames, ${columns} to a row, each ${laid.cellWidth} x ${laid.cellHeight}, aligned ${(align as string | undefined) ?? 'baseline'}, and animations/${name}.json naming it (${animation.fps} a second, ${animation.loop ? 'looping' : 'played once'}, shown against ${animation.ground}).`,
        `In order: ${plans.map(({ label }) => label).join('; ')}.`,
        findingsOf(laid.sheet, plans.length, columns, animation),
        `Look at it with look_at_animation("${name}") before saying it is done.`,
      ].join('\n'),
    );
  };

  return {
    name: 'build_sheet',
    title: 'Lay frames into an animation sheet',
    description:
      'Lays frames already in the project into one animation sheet, an even grid of equal cells, and writes it as art/<name>.png with animations/<name>.json naming it: pictures the member brought, one per frame or a whole grid in one picture, and cells of an animation already made. Takes a flat background out, keeps every frame at one scale, and holds the drawing on one baseline, where it was, or in the middle. Fix one frame by building the same frames again with that one replaced or left out.',
    inputSchema: BUILD_SCHEMA,
    annotations: {
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: true,
      openWorldHint: false,
    },
    call: buildSheet,
  };
};

export default createBuildSheetTool;

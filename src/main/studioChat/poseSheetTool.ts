/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { SHEET_BOUNDS } from '../../common/pictureBounds';
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
} from './sheetFiles';
import { cropPixels } from './sheetLayout';
import {
  drawnBox,
  drawPose,
  poseAt,
  traceSpine,
  type IPixels,
  type IRigKey,
  type TPoint,
} from './sheetRig';
import {
  ANIMATION_SCHEMA,
  breathe,
  cutOut,
  findingsOf,
  isNumber,
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
 * `pose_sheet`: an animation's frames made from one picture already in the
 * project, bent along its spine through key poses (`sheetRig.ts`). Every
 * frame is that picture's own pixels, so a photo stays a photo and the
 * animal stays one animal; and a fix is the same call with a key changed,
 * which costs nothing. It suits what bends: a whale's dive and fluke, a
 * fish, a snake, a tail, a flag, a bird's wing seen from the front. Legs
 * that swing past each other are not a bend; those are frames the member
 * brings (`build_sheet`).
 */

const MIN_SPINE = 3;
const MAX_SPINE = 10;
const MAX_KEYS = 24;
const MAX_BEND = 120;
const DEFAULT_SPINE = 6;
/** A drawing this close to its cell's edge is cut off by it. */
const EDGE_PX = 1;

const POSE_SCHEMA = {
  type: 'object',
  properties: {
    name: {
      type: 'string',
      description:
        'The sheet and animation: lowercase letters, digits and hyphens, starting with a letter (whale-dive). Written as art/<name>.png; the same name again replaces it.',
    },
    from: {
      type: 'string',
      description:
        'The picture to bend, a path in the project (art/whale-rig-cut.png): one creature on a transparent or one flat colour background, side on.',
    },
    count: { type: 'integer', minimum: 2, maximum: MAX_SHEET_FRAMES },
    columns: { type: 'integer', minimum: 1, maximum: MAX_SHEET_COLUMNS },
    cell: {
      type: 'integer',
      minimum: MIN_CELL,
      maximum: MAX_CELL,
      description: "Each frame's width in pixels.",
    },
    cell_height: {
      type: 'integer',
      minimum: MIN_CELL,
      maximum: MAX_CELL,
      description: "Each frame's height; the same as cell when left out.",
    },
    zoom: {
      type: 'number',
      minimum: 0.2,
      maximum: 1,
      description:
        'How much of the cell the picture fills at scale 1 (0.8 when left out): room for the bends and turns to stay inside it.',
    },
    spine: {
      type: 'array',
      minItems: MIN_SPINE,
      maxItems: MAX_SPINE,
      items: {
        type: 'array',
        items: { type: 'number', minimum: 0, maximum: 1 },
        minItems: 2,
        maxItems: 2,
      },
      description:
        "Points along the body in order from one end to the other, as [x, y] shares of the picture from its top-left. Left out, six points are traced along the drawing's middle from its left end to its right end.",
    },
    root: {
      type: 'integer',
      description:
        'Which spine point stays put (0 is the first); the middle one when left out. Bends turn everything from a joint away from the root.',
    },
    keys: {
      type: 'array',
      minItems: 1,
      maxItems: MAX_KEYS,
      description:
        'Key poses through the animation, eased into each other. A loop runs from the last back into the first; a one-shot holds at 0 and 1.',
      items: {
        type: 'object',
        properties: {
          at: {
            type: 'number',
            minimum: 0,
            maximum: 1,
            description: 'Where in the animation, 0 to 1.',
          },
          bend: {
            type: 'array',
            items: { type: 'number', minimum: -MAX_BEND, maximum: MAX_BEND },
            description:
              'Degrees at each interior spine point in spine order (two fewer than the points); positive turns clockwise. Each turns everything beyond it, away from the root; a bend at the root itself turns nothing.',
          },
          turn: {
            type: 'number',
            minimum: -360,
            maximum: 360,
            description:
              'Degrees the whole turns about its middle; positive is clockwise.',
          },
          x: {
            type: 'number',
            minimum: -1,
            maximum: 1,
            description: 'Moves right, in shares of the cell.',
          },
          y: {
            type: 'number',
            minimum: -1,
            maximum: 1,
            description: 'Moves down, in shares of the cell.',
          },
          scale: { type: 'number', minimum: 0.2, maximum: 2 },
        },
        required: ['at'],
        additionalProperties: false,
      },
    },
    loop: { type: 'boolean', description: 'true when left out.' },
    key: {
      type: 'string',
      description:
        'The flat background to take out: auto (read from the border; when left out), none, or a colour as #rrggbb.',
    },
    animation: ANIMATION_SCHEMA,
  },
  required: ['name', 'from', 'count', 'columns', 'cell', 'keys'],
  additionalProperties: false,
};

/** The keys as asked, or why not. */
const readKeys = (raw: unknown, joints: number): IRigKey[] | string => {
  if (!Array.isArray(raw) || raw.length < 1 || raw.length > MAX_KEYS) {
    return `keys is a list of 1 to ${MAX_KEYS} poses.`;
  }
  const keys: IRigKey[] = [];
  for (let index = 0; index < raw.length; index += 1) {
    const entry: unknown = raw[index];
    if (typeof entry !== 'object' || entry === null) {
      return 'Each key is { at, bend, turn, x, y, scale }.';
    }
    const { at, bend, turn, x, y, scale } = entry as Record<string, unknown>;
    const bends = bend === undefined ? [] : bend;
    if (
      !isNumber(at, 0, 1) ||
      !Array.isArray(bends) ||
      bends.length > joints ||
      !bends.every((value) => isNumber(value, -MAX_BEND, MAX_BEND)) ||
      (turn !== undefined && !isNumber(turn, -360, 360)) ||
      (x !== undefined && !isNumber(x, -1, 1)) ||
      (y !== undefined && !isNumber(y, -1, 1)) ||
      (scale !== undefined && !isNumber(scale, 0.2, 2))
    ) {
      return `Each key needs at (0 to 1); bend has at most ${joints} angles of ±${MAX_BEND} degrees (one per interior spine point); turn ±360; x and y ±1; scale 0.2 to 2.`;
    }
    keys.push({
      at,
      pose: {
        bend: bends as number[],
        turn: typeof turn === 'number' ? turn : 0,
        x: typeof x === 'number' ? x : 0,
        y: typeof y === 'number' ? y : 0,
        scale: typeof scale === 'number' ? scale : 1,
      },
    });
  }
  return keys;
};

/** The spine as asked, in shares of the picture, or why not. */
const readSpine = (raw: unknown): TPoint[] | undefined | string => {
  if (raw === undefined) {
    return undefined;
  }
  if (
    !Array.isArray(raw) ||
    raw.length < MIN_SPINE ||
    raw.length > MAX_SPINE ||
    !raw.every(
      (point) =>
        Array.isArray(point) &&
        point.length === 2 &&
        isNumber(point[0], 0, 1) &&
        isNumber(point[1], 0, 1),
    )
  ) {
    return `spine is ${MIN_SPINE} to ${MAX_SPINE} points, each [x, y] as shares of the picture (0 to 1).`;
  }
  return raw as TPoint[];
};

/** Whether a frame's drawing touches its cell's edge. */
const touchesEdge = (cell: IPixels) => {
  const box = drawnBox(cell);
  return (
    box !== undefined &&
    (box.left < EDGE_PX ||
      box.top < EDGE_PX ||
      box.right >= cell.width - EDGE_PX ||
      box.bottom >= cell.height - EDGE_PX)
  );
};

const createPoseSheetTool = ({
  project,
  signal,
  codec,
}: ISheetToolsDeps): IMcpTool => {
  const budget = createSheetBudget(signal);

  const poseSheet = async (
    args: Record<string, unknown>,
  ): Promise<IMcpToolResult> => {
    const {
      name,
      from,
      count,
      columns,
      cell,
      cell_height: cellHeightRaw,
      zoom,
      root,
      loop,
    } = args;
    if (
      !isSheetName(name) ||
      !isWhole(count, 2, MAX_SHEET_FRAMES) ||
      !isWhole(columns, 1, Math.min(MAX_SHEET_COLUMNS, count)) ||
      !isWhole(cell, MIN_CELL, MAX_CELL) ||
      (cellHeightRaw !== undefined &&
        !isWhole(cellHeightRaw, MIN_CELL, MAX_CELL)) ||
      (zoom !== undefined && !isNumber(zoom, 0.2, 1)) ||
      (loop !== undefined && typeof loop !== 'boolean')
    ) {
      return failure(
        `pose_sheet needs a name (a-z, 0-9 and -, starting with a letter), a picture to bend, a count of 2 to ${MAX_SHEET_FRAMES} frames, columns from 1 to ${MAX_SHEET_COLUMNS} and no more than the count, and a cell of ${MIN_CELL} to ${MAX_CELL} pixels.`,
      );
    }
    const cellWidth = cell;
    const cellHeight = typeof cellHeightRaw === 'number' ? cellHeightRaw : cell;
    const rows = Math.ceil(count / columns);
    if (
      columns * cellWidth > SHEET_BOUNDS.side ||
      rows * cellHeight > SHEET_BOUNDS.side ||
      columns * cellWidth * rows * cellHeight > SHEET_BOUNDS.pixels
    ) {
      return failure(
        `That sheet would be ${columns * cellWidth} x ${rows * cellHeight}; a sheet is at most ${SHEET_BOUNDS.side} a side and ${SHEET_BOUNDS.pixels / 1024 / 1024} megapixels. Use smaller cells or fewer frames.`,
      );
    }
    const looping = loop !== false;
    const animation = readAnimationFields(args.animation, looping);
    if (typeof animation === 'string') {
      return failure(animation);
    }
    const key = readKey(args.key);
    if (!key) {
      return failure('key is auto, none or a colour written #rrggbb.');
    }
    const asked = readSpine(args.spine);
    if (typeof asked === 'string') {
      return failure(asked);
    }
    const points = asked?.length ?? DEFAULT_SPINE;
    if (root !== undefined && !isWhole(root, 0, points - 1)) {
      return failure(`root is a spine point's place, 0 to ${points - 1}.`);
    }
    const keys = readKeys(args.keys, points - 2);
    if (typeof keys === 'string') {
      return failure(keys);
    }
    const open = project();
    if (!open.ok) {
      return failure(NO_PROJECT);
    }
    const file = readPictureFile(open.folder, from);
    if (typeof file === 'string') {
      return failure(file);
    }
    const target = await sheetTargetProblem(open.folder, name, [file]);
    if (target) {
      return failure(target);
    }
    if (!budget.take()) {
      return failure(BUDGET_SPENT);
    }
    const decoded = codec.decode(file.bytes);
    if (!decoded) {
      return failure(
        `${file.named} could not be read as a picture. ${READABLE_PICTURES}`,
      );
    }
    const picture = cutOut(decoded, key);
    if (picture === 'not-flat') {
      return failure(
        `${file.named} has no transparency and its border is not one flat colour, so FluidEQ cannot tell the creature from its background. Use a cut-out, or give key as the background's colour (#rrggbb).`,
      );
    }
    const box = drawnBox(picture);
    if (!box) {
      return failure(`Nothing is drawn in ${file.named}.`);
    }
    // Only the drawing, with a clear border, and no larger than the frames
    // will show it: bending a 4000-pixel photo into 300-pixel cells would
    // spend the work on pixels nobody sees, and alias besides.
    const pad = 2;
    const spanX = box.right - box.left + 1;
    const spanY = box.bottom - box.top + 1;
    const fit =
      (typeof zoom === 'number' ? zoom : 0.8) *
      Math.min(cellWidth / spanX, cellHeight / spanY);
    const largest = Math.max(...keys.map(({ pose }) => pose.scale), 1);
    const shrink = Math.min(1, fit * largest);
    const cropped = cropPixels(
      picture,
      box.left - pad,
      box.top - pad,
      spanX + 2 * pad,
      spanY + 2 * pad,
    );
    let work: IPixels;
    try {
      work = codec.resize(
        cropped,
        Math.max(1, Math.round(cropped.width * shrink)),
        Math.max(1, Math.round(cropped.height * shrink)),
      );
    } catch {
      return failure(`${file.named} could not be made ready to bend.`);
    }
    const scaleX = work.width / cropped.width;
    const scaleY = work.height / cropped.height;
    const workBox = drawnBox(work);
    if (!workBox) {
      return failure(`Nothing is drawn in ${file.named} at the cell's size.`);
    }
    const spine: TPoint[] = asked
      ? asked.map(([x, y]) => [
          (x * file.width - (box.left - pad)) * scaleX,
          (y * file.height - (box.top - pad)) * scaleY,
        ])
      : traceSpine(work, workBox, DEFAULT_SPINE);
    const rig = {
      picture: work,
      box: workBox,
      spine,
      root: typeof root === 'number' ? root : Math.floor((points - 1) / 2),
      fit: fit / shrink,
    };
    const sheet: IPixels = {
      data: new Uint8Array(columns * cellWidth * rows * cellHeight * 4),
      width: columns * cellWidth,
      height: rows * cellHeight,
    };
    const clipped: number[] = [];
    for (let index = 0; index < count; index += 1) {
      if (signal().aborted) {
        return failure('The member stopped the reply.');
      }
      const t = looping ? index / count : index / (count - 1);
      const frame = drawPose(
        rig,
        poseAt(keys, t, looping),
        cellWidth,
        cellHeight,
      );
      if (touchesEdge(frame)) {
        clipped.push(index + 1);
      }
      const left = (index % columns) * cellWidth;
      const top = Math.floor(index / columns) * cellHeight;
      for (let row = 0; row < cellHeight; row += 1) {
        sheet.data.set(
          frame.data.subarray(row * cellWidth * 4, (row + 1) * cellWidth * 4),
          ((top + row) * sheet.width + left) * 4,
        );
      }
      // eslint-disable-next-line no-await-in-loop -- one frame at a time, so main answers the window between them
      await breathe();
    }
    if (signal().aborted) {
      return failure('The member stopped the reply.');
    }
    const written = writeSheet(open.folder, name, codec.encodePng(sheet), {
      count,
      columns,
      ...animation,
    });
    if (typeof written === 'string') {
      return failure(written);
    }
    const shares = spine.map(
      ([x, y]) =>
        `[${((x / scaleX + box.left - pad) / file.width).toFixed(3)}, ${((y / scaleY + box.top - pad) / file.height).toFixed(3)}]`,
    );
    return sheetAnswer(
      codec,
      sheet,
      [
        `Made ${written.sheet}: ${count} frames of ${file.named}, ${columns} to a row, each ${cellWidth} x ${cellHeight}, and animations/${name}.json naming it (${animation.fps} a second, ${animation.loop ? 'looping' : 'played once'}, shown against ${animation.ground}).`,
        `Spine used, in order: ${shares.join(' ')}; root ${rig.root}. To change a frame, change the key poses around it and call pose_sheet again with the same name.`,
        clipped.length
          ? `Frames ${clipped.join(', ')} touch their cell's edge and are cut off there: lower zoom, or move or turn less.`
          : 'Every frame stays inside its cell.',
        findingsOf(sheet, count, columns, animation),
        `Look at it with look_at_animation("${name}") before saying it is done.`,
      ].join('\n'),
    );
  };

  return {
    name: 'pose_sheet',
    title: 'Make an animation sheet from a picture',
    description:
      "Makes an animation's frames from one picture already in the project, bent along its spine through key poses you give, and writes the sheet as art/<name>.png with animations/<name>.json naming it. Every frame is the picture's own pixels, so a photo stays photo-real and the creature stays the same in every frame. For what bends: a whale or a fish swimming or diving, a snake, a tail, a flag, a wing seen from the front. A fix is the same call with a key changed. Answers the sheet, the spine it used and any frame cut off by its cell.",
    inputSchema: POSE_SCHEMA,
    annotations: {
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: true,
      openWorldHint: false,
    },
    call: poseSheet,
  };
};

export default createPoseSheetTool;

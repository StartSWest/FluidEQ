import {
  detectGrid,
  type IGridPixels,
} from '../../renderer/studio/animations/import/importGrid';
import { ART_DIR, readArt } from './artFolder';
import { isSheetName, replaceProblem, writeSheet } from './sheetFiles';

/**
 * A sheet of frames packed into the artwork as a plain picture, caught and
 * made the animation it is.
 *
 * An animation is an object of its own: `animations/<name>.json` beside its
 * sheet, in the member's Animations tab, where they see it play and change
 * its speed. A chat that drew a grid of poses, saved it as `art/<name>.png`
 * and packed it like a rock had a scene that played frames and a member who
 * had no animation anywhere (Ivan, 2026-11-11: "the agent create a full
 * animation sheet as a pic instead of as an animation ... when it do that
 * needs to be corrected and put the sheet into the animator").
 *
 * So `pack_artwork` looks at every picture it packs that no animation
 * owns. One that is a grid of frames - gaps between them all the way
 * across, three or more, each holding a drawing of about one size - is
 * written as the animation of that name, and the chat is told, firmly,
 * what it did and what to do from now on.
 */

/** Two of a thing side by side are two things; three in a grid are frames. */
const MIN_FRAMES = 3;
/** What a sheet nobody timed plays at, until the chat or the member says. */
const ADOPTED_FPS = 12;
/** A pixel this transparent is empty. */
const EMPTY_ALPHA = 8;
/** Frames of one thing are about one size: within this of the middle one. */
const SIZE_SPREAD = 0.4;

export interface ISheetGrid {
  columns: number;
  rows: number;
}

/** The drawn box of one cell: its width and height, or undefined if empty. */
const drawnIn = (
  pixels: IGridPixels,
  left: number,
  top: number,
  width: number,
  height: number,
) => {
  let minX = width;
  let maxX = -1;
  let minY = height;
  let maxY = -1;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (
        pixels.data[((top + y) * pixels.width + left + x) * 4 + 3] >=
        EMPTY_ALPHA
      ) {
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
      }
    }
  }
  return maxX < 0
    ? undefined
    : { width: maxX - minX + 1, height: maxY - minY + 1 };
};

const middle = (values: number[]) =>
  [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];

/**
 * The grid of frames `pixels` is, or undefined for a picture that is not a
 * sheet: one thing, or several things of different sizes that only happen
 * to stand apart.
 */
export const sheetIn = (pixels: IGridPixels): ISheetGrid | undefined => {
  const grid = detectGrid(pixels);
  if (!grid.found || grid.columns * grid.rows < MIN_FRAMES) {
    return undefined;
  }
  const cellWidth = Math.floor(pixels.width / grid.columns);
  const cellHeight = Math.floor(pixels.height / grid.rows);
  const drawn = Array.from({ length: grid.columns * grid.rows }, (_, index) =>
    drawnIn(
      pixels,
      (index % grid.columns) * cellWidth,
      Math.floor(index / grid.columns) * cellHeight,
      cellWidth,
      cellHeight,
    ),
  ).flatMap((box) => (box ? [box] : []));
  // The last row of a sheet may be short; the rest hold a frame each.
  if (drawn.length < Math.max(MIN_FRAMES, (grid.rows - 1) * grid.columns + 1)) {
    return undefined;
  }
  const width = middle(drawn.map((box) => box.width));
  const height = middle(drawn.map((box) => box.height));
  const alike = drawn.every(
    (box) =>
      Math.abs(box.width - width) <= width * SIZE_SPREAD &&
      Math.abs(box.height - height) <= height * SIZE_SPREAD,
  );
  return alike ? { columns: grid.columns, rows: grid.rows } : undefined;
};

/** What the chat is told of a sheet it packed as a picture. */
export const adoptedNote = (name: string, { columns, rows }: ISheetGrid) =>
  [
    `STOP AND READ: ${ART_DIR}/${name}.png is a sheet of animation frames (${columns} across, ${rows} down), and you saved it as a plain picture and packed it. That is wrong: the member then has no animation - nothing in their Animations tab to play, slow down or fix.`,
    `FluidEQ has corrected it: "${name}" is now an animation in the member's Animations tab, ${columns * rows} frames, ${ADOPTED_FPS} frames a second, looping. Those are guesses. Set them right now by writing it again with build_sheet (name "${name}", replace: true) with its real frame count, fps, loop and ground, then check it with look_at_animation.`,
    'From now on, without exception: a grid of poses is NEVER saved as a picture and packed. Frames go through build_sheet (or pose_sheet for one picture bent into poses), which writes the sheet and the animation together; only then is the sheet packed, and the scene plays it as that animation (fluideq-animation skill).',
  ].join('\n');

/**
 * Makes an animation of every picture in `pictures` (as `art/<name>.png`)
 * that is a sheet of frames and has none, and answers what to tell the
 * chat about each. `pixelsOf` reads a picture's pixels, alpha last.
 */
export const adoptPackedSheets = async (
  folder: string,
  pictures: readonly string[],
  pixelsOf: (png: Uint8Array) => IGridPixels | undefined,
): Promise<string[]> => {
  const names = [
    ...new Set(
      pictures.flatMap((picture) => {
        const match = /^art\/([^/]+)\.png$/.exec(picture);
        return match && isSheetName(match[1]) ? [match[1]] : [];
      }),
    ),
  ];
  const notes: string[] = [];
  await names.reduce(async (before, name) => {
    await before;
    // Already an animation: packed the right way.
    if (replaceProblem(folder, name, undefined) !== undefined) {
      return;
    }
    const png = readArt(folder, name);
    const pixels = png && pixelsOf(png);
    const grid = pixels && sheetIn(pixels);
    if (!png || !grid) {
      return;
    }
    const written = await writeSheet(
      folder,
      name,
      png,
      {
        fps: ADOPTED_FPS,
        loop: true,
        ground: 'none',
        count: grid.columns * grid.rows,
        columns: grid.columns,
      },
      { label: 'Found packed as a picture' },
    );
    notes.push(
      typeof written === 'string'
        ? `${ART_DIR}/${name}.png is a sheet of animation frames packed as a plain picture, and FluidEQ could not make it an animation (${written}) Build it with build_sheet now, name "${name}": a grid of poses is never saved as a picture and packed.`
        : adoptedNote(name, grid),
    );
  }, Promise.resolve());
  return notes;
};

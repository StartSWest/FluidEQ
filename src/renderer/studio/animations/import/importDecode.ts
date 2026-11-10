/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  isDecodablePicture,
  PICTURE_BOUNDS,
  pictureHeaderSize,
  SHEET_BOUNDS,
} from 'common/pictureBounds';
import { MAX_ANIMATION_FRAMES } from 'common/studioAnimation';
import { readAseprite } from './importAseprite';
import { readAtlas } from './importAtlas';
import { gifSize, type IChosenFile, type TImportKind } from './importFiles';
import { detectGrid, guessGrid, sheetLayout, type IGrid } from './importGrid';

/**
 * The chosen files decoded into frames the window can lay into a sheet:
 * where each frame's pixels are, how it sits on its own canvas, how long it
 * is shown, and which frames make which animation. Every picture's header
 * is read before anything decodes it (`pictureBounds.ts`), and frames of an
 * animated picture or of a sequence are drawn one at a time into one canvas
 * no larger than a sheet may be, never held as hundreds of pictures.
 */

export interface IImportFrame {
  /** Where its pixels are in the image, as stored. */
  sx: number;
  sy: number;
  sw: number;
  sh: number;
  /** Stored turned a quarter clockwise. */
  rotated: boolean;
  /** Where it sits on its own canvas, and that canvas. */
  placed: { x: number; y: number; w: number; h: number };
  source: { w: number; h: number };
  /** Milliseconds shown, when the file says. */
  duration?: number;
}

export interface IImportClip {
  /** A tag's or a group's name; empty for the only animation. */
  name: string;
  /** Frames in playing order, as indexes into `frames`. */
  order: number[];
}

export interface IDecodedImport {
  image: ImageBitmap | HTMLCanvasElement;
  frames: IImportFrame[];
  clips: IImportClip[];
  /** Every frame's canvas: the largest of them. */
  width: number;
  height: number;
  /** A still sheet's grid, read or guessed, for the member to correct. */
  grid?: IGrid;
  close(): void;
}

export type TDecodeRefusal =
  | { refused: 'too-large'; file: string }
  | { refused: 'too-many'; most: number }
  | { refused: 'unreadable'; file: string }
  | { refused: 'no-frames'; file: string };

/** Above this many pixels the gaps are not looked for: it is only guessed. */
const MOST_PIXELS_SEARCHED = SHEET_BOUNDS.pixels;

const whole = (w: number, h: number) => ({
  placed: { x: 0, y: 0, w, h },
  source: { w, h },
  rotated: false,
});

const stillBitmap = async (
  file: IChosenFile,
): Promise<ImageBitmap | undefined> => {
  if (!isDecodablePicture(file.bytes, PICTURE_BOUNDS)) {
    return undefined;
  }
  try {
    return await createImageBitmap(new Blob([file.bytes.slice()]));
  } catch {
    return undefined;
  }
};

const canvasOf = (width: number, height: number) => {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (context) {
    context.imageSmoothingQuality = 'high';
  }
  return { canvas, context };
};

/** A still sheet's frames for `grid`, its first `count` cells. */
export const gridFrames = (
  width: number,
  height: number,
  grid: { columns: number; rows: number },
  count: number,
): IImportFrame[] => {
  const cellW = Math.floor(width / grid.columns);
  const cellH = Math.floor(height / grid.rows);
  return Array.from({ length: count }, (_, index) => ({
    sx: (index % grid.columns) * cellW,
    sy: Math.floor(index / grid.columns) * cellH,
    sw: cellW,
    sh: cellH,
    ...whole(cellW, cellH),
  }));
};

const decodeGrid = async (
  picture: IChosenFile,
): Promise<IDecodedImport | TDecodeRefusal> => {
  const bitmap = await stillBitmap(picture);
  if (!bitmap) {
    return { refused: 'unreadable', file: picture.name };
  }
  let grid = guessGrid(bitmap.width, bitmap.height);
  if (bitmap.width * bitmap.height <= MOST_PIXELS_SEARCHED) {
    const { context } = canvasOf(bitmap.width, bitmap.height);
    context?.drawImage(bitmap, 0, 0);
    const pixels = context?.getImageData(0, 0, bitmap.width, bitmap.height);
    if (pixels) {
      grid = detectGrid(pixels);
    }
  }
  const count = grid.columns * grid.rows;
  const frames = gridFrames(bitmap.width, bitmap.height, grid, count);
  return {
    image: bitmap,
    frames,
    clips: [{ name: '', order: frames.map((_, index) => index) }],
    width: frames[0].source.w,
    height: frames[0].source.h,
    grid,
    close: () => bitmap.close(),
  };
};

const decodeAtlas = async (
  picture: IChosenFile,
  atlasFile: IChosenFile,
): Promise<IDecodedImport | TDecodeRefusal> => {
  const atlas = readAtlas(new TextDecoder().decode(atlasFile.bytes));
  if (!atlas) {
    return { refused: 'no-frames', file: atlasFile.name };
  }
  const bitmap = await stillBitmap(picture);
  if (!bitmap) {
    return { refused: 'unreadable', file: picture.name };
  }
  // Frames that reach past the picture are another sheet's.
  const frames = atlas.frames.flatMap((entry): IImportFrame[] =>
    entry.frame.x + entry.frame.w <= bitmap.width &&
    entry.frame.y + entry.frame.h <= bitmap.height
      ? [
          {
            sx: entry.frame.x,
            sy: entry.frame.y,
            sw: entry.frame.w,
            sh: entry.frame.h,
            rotated: entry.rotated,
            placed: entry.placed,
            source: entry.source,
            ...(entry.duration === undefined
              ? {}
              : { duration: entry.duration }),
          },
        ]
      : [],
  );
  if (frames.length !== atlas.frames.length || frames.length === 0) {
    bitmap.close();
    return { refused: 'no-frames', file: atlasFile.name };
  }
  return {
    image: bitmap,
    frames,
    clips: atlas.animations.map(({ name, order }) => ({ name, order })),
    width: Math.max(...frames.map(({ source }) => source.w)),
    height: Math.max(...frames.map(({ source }) => source.h)),
    close: () => bitmap.close(),
  };
};

/** One canvas of `count` cells for frames `width` by `height`. */
const framesCanvas = (count: number, width: number, height: number) => {
  const layout = sheetLayout(count, width, height);
  const { canvas, context } = canvasOf(
    layout.columns * layout.cellWidth,
    layout.rows * layout.cellHeight,
  );
  const cellAt = (index: number) => ({
    x: (index % layout.columns) * layout.cellWidth,
    y: Math.floor(index / layout.columns) * layout.cellHeight,
  });
  const frameAt = (index: number, duration?: number): IImportFrame => ({
    sx: cellAt(index).x,
    sy: cellAt(index).y,
    sw: layout.cellWidth,
    sh: layout.cellHeight,
    ...whole(layout.cellWidth, layout.cellHeight),
    ...(duration === undefined ? {} : { duration }),
  });
  return { canvas, context, layout, cellAt, frameAt };
};

const decodeAnimated = async (
  picture: IChosenFile,
  type: string,
): Promise<IDecodedImport | TDecodeRefusal> => {
  const size =
    type === 'image/gif'
      ? gifSize(picture.bytes)
      : pictureHeaderSize(picture.bytes);
  if (
    !size ||
    size[0] < 1 ||
    size[1] < 1 ||
    size[0] > PICTURE_BOUNDS.side ||
    size[1] > PICTURE_BOUNDS.side ||
    size[0] * size[1] > PICTURE_BOUNDS.pixels ||
    typeof ImageDecoder === 'undefined'
  ) {
    return { refused: 'unreadable', file: picture.name };
  }
  let decoder: ImageDecoder | undefined;
  try {
    decoder = new ImageDecoder({ data: picture.bytes.slice(), type });
    // The track list fills on its own promise: read before it, the decoder
    // has no selected track and no frame count, and every GIF read as none.
    await decoder.tracks.ready;
    await decoder.completed;
    const track = decoder.tracks.selectedTrack;
    const count = track?.frameCount ?? 0;
    if (count < 1) {
      return { refused: 'unreadable', file: picture.name };
    }
    if (count > MAX_ANIMATION_FRAMES) {
      return { refused: 'too-many', most: MAX_ANIMATION_FRAMES };
    }
    const sheet = framesCanvas(count, size[0], size[1]);
    if (!sheet.context) {
      return { refused: 'unreadable', file: picture.name };
    }
    const frames: IImportFrame[] = [];
    for (let index = 0; index < count; index += 1) {
      // eslint-disable-next-line no-await-in-loop -- one frame decoded, drawn and let go at a time
      const { image } = await decoder.decode({ frameIndex: index });
      const { x, y } = sheet.cellAt(index);
      sheet.context.drawImage(
        image,
        x,
        y,
        sheet.layout.cellWidth,
        sheet.layout.cellHeight,
      );
      // Microseconds, or nothing for a frame with no timing of its own.
      const duration =
        image.duration === null ? undefined : image.duration / 1000;
      image.close();
      frames.push(sheet.frameAt(index, duration));
    }
    return {
      image: sheet.canvas,
      frames,
      clips: [{ name: '', order: frames.map((_, index) => index) }],
      width: sheet.layout.cellWidth,
      height: sheet.layout.cellHeight,
      close: () => undefined,
    };
  } catch {
    return { refused: 'unreadable', file: picture.name };
  } finally {
    decoder?.close();
  }
};

const decodeSequence = async (
  pictures: IChosenFile[],
): Promise<IDecodedImport | TDecodeRefusal> => {
  const sizes = pictures.map((picture) => ({
    picture,
    size: isDecodablePicture(picture.bytes, PICTURE_BOUNDS)
      ? pictureHeaderSize(picture.bytes)
      : null,
  }));
  const unread = sizes.find(({ size }) => !size);
  if (unread) {
    return { refused: 'unreadable', file: unread.picture.name };
  }
  const width = Math.max(...sizes.map(({ size }) => size?.[0] ?? 1));
  const height = Math.max(...sizes.map(({ size }) => size?.[1] ?? 1));
  const sheet = framesCanvas(pictures.length, width, height);
  if (!sheet.context) {
    return { refused: 'unreadable', file: pictures[0].name };
  }
  const scale = sheet.layout.cellWidth / width;
  for (let index = 0; index < pictures.length; index += 1) {
    // eslint-disable-next-line no-await-in-loop -- one picture decoded, drawn and let go at a time
    const bitmap = await stillBitmap(pictures[index]);
    if (!bitmap) {
      return { refused: 'unreadable', file: pictures[index].name };
    }
    // A smaller frame among larger ones stands on the same floor, centred.
    const w = bitmap.width * scale;
    const h = bitmap.height * scale;
    const { x, y } = sheet.cellAt(index);
    sheet.context.drawImage(
      bitmap,
      x + (sheet.layout.cellWidth - w) / 2,
      y + sheet.layout.cellHeight - h,
      w,
      h,
    );
    bitmap.close();
  }
  const frames = pictures.map((_, index) => sheet.frameAt(index));
  return {
    image: sheet.canvas,
    frames,
    clips: [{ name: '', order: frames.map((_, index) => index) }],
    width: sheet.layout.cellWidth,
    height: sheet.layout.cellHeight,
    close: () => undefined,
  };
};

/**
 * An Aseprite file's frames, each composited from its visible layers
 * (`importAseprite.ts`) and drawn into its cell one at a time, its tags as
 * animations.
 */
const decodeAseprite = async (
  picture: IChosenFile,
): Promise<IDecodedImport | TDecodeRefusal> => {
  const read = await readAseprite(picture.bytes);
  if (read === 'too-many') {
    return { refused: 'too-many', most: MAX_ANIMATION_FRAMES };
  }
  if (read === 'too-large') {
    return { refused: 'too-large', file: picture.name };
  }
  if (read === 'unreadable') {
    return { refused: 'unreadable', file: picture.name };
  }
  const count = read.durations.length;
  const sheet = framesCanvas(count, read.width, read.height);
  const one = canvasOf(read.width, read.height);
  if (!sheet.context || !one.context) {
    return { refused: 'unreadable', file: picture.name };
  }
  for (let index = 0; index < count; index += 1) {
    one.context.putImageData(
      new ImageData(read.frame(index), read.width, read.height),
      0,
      0,
    );
    const { x, y } = sheet.cellAt(index);
    sheet.context.drawImage(
      one.canvas,
      x,
      y,
      sheet.layout.cellWidth,
      sheet.layout.cellHeight,
    );
  }
  const frames = read.durations.map((duration, index) =>
    sheet.frameAt(index, duration),
  );
  return {
    image: sheet.canvas,
    frames,
    clips:
      read.tags.length > 0
        ? read.tags.map(({ name, order }) => ({ name, order }))
        : [{ name: '', order: frames.map((_, index) => index) }],
    width: sheet.layout.cellWidth,
    height: sheet.layout.cellHeight,
    close: () => undefined,
  };
};

/** The files decoded into frames, or why they cannot be. */
export const decodeImport = (
  kind: TImportKind,
): Promise<IDecodedImport | TDecodeRefusal> => {
  switch (kind.kind) {
    case 'grid':
      return decodeGrid(kind.picture);
    case 'atlas':
      return decodeAtlas(kind.picture, kind.atlas);
    case 'animated':
      return decodeAnimated(kind.picture, kind.type);
    case 'aseprite':
      return decodeAseprite(kind.picture);
    default:
      return decodeSequence(kind.pictures);
  }
};

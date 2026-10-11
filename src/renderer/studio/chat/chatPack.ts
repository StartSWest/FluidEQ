/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { MAX_SCENE_ARTWORK_BYTES } from 'common/sceneArtwork';
import type {
  IStudioChatPackAsk,
  IStudioChatPackPiece,
  TStudioChatPackAnswer,
} from 'common/studioChat';
import { decodePicture, encodeWithin } from '../scenePicture';

/**
 * The scene's artwork as main laid it out for Claude's pack_artwork
 * (`main/studioChat/packArtworkTool.ts`), drawn and encoded here because
 * only a page encodes WebP: the member's photo places copied from the
 * artwork as it was, each piece in its place, and every tile's gutter
 * filled with its own wrapped pixels so a distant mipmap of a repeating
 * material never brings in its neighbour's colour.
 */

type TSource = {
  bitmap: ImageBitmap;
  x: number;
  y: number;
  width: number;
  height: number;
};

const sourceOf = async (
  piece: IStudioChatPackPiece,
  current: ImageBitmap | undefined,
): Promise<TSource | undefined> => {
  if (piece.image) {
    const bitmap = await decodePicture(piece.image);
    return bitmap
      ? { bitmap, x: 0, y: 0, width: bitmap.width, height: bitmap.height }
      : undefined;
  }
  return piece.fromArtwork && current
    ? { bitmap: current, ...piece.fromArtwork }
    : undefined;
};

/** The piece, and for a tile its copies around it, cut to its gutter. */
const drawPiece = (
  context: CanvasRenderingContext2D,
  piece: IStudioChatPackPiece,
  source: TSource,
) => {
  const draw = (x: number, y: number) =>
    context.drawImage(
      source.bitmap,
      source.x,
      source.y,
      source.width,
      source.height,
      x,
      y,
      piece.width,
      piece.height,
    );
  context.save();
  context.beginPath();
  context.rect(
    piece.x - piece.gutter,
    piece.y - piece.gutter,
    piece.width + piece.gutter * 2,
    piece.height + piece.gutter * 2,
  );
  context.clip();
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  if (piece.wrap) {
    // As many copies each way as a gutter wider than the tile needs.
    const across = Math.ceil(piece.gutter / piece.width);
    const down = Math.ceil(piece.gutter / piece.height);
    for (let row = -down; row <= down; row += 1) {
      for (let column = -across; column <= across; column += 1) {
        draw(piece.x + column * piece.width, piece.y + row * piece.height);
      }
    }
  } else {
    draw(piece.x, piece.y);
  }
  context.restore();
};

const packArtwork = async (
  ask: IStudioChatPackAsk,
): Promise<TStudioChatPackAnswer> => {
  const canvas = document.createElement('canvas');
  canvas.width = ask.width;
  canvas.height = ask.height;
  const context = canvas.getContext('2d');
  if (!context) {
    return { ok: false, reason: 'failed' };
  }
  const current = ask.current ? await decodePicture(ask.current) : undefined;
  if (ask.current && !current) {
    return { ok: false, reason: 'unreadable' };
  }
  const sources = await Promise.all(
    ask.pieces.map((piece) => sourceOf(piece, current)),
  );
  try {
    if (sources.some((source) => !source)) {
      return { ok: false, reason: 'unreadable' };
    }
    if (current) {
      ask.keep.forEach(({ x, y, width, height }) =>
        context.drawImage(current, x, y, width, height, x, y, width, height),
      );
    }
    ask.pieces.forEach((piece, index) => {
      const source = sources[index];
      if (source) {
        drawPiece(context, piece, source);
      }
    });
    const webp = await encodeWithin(canvas, MAX_SCENE_ARTWORK_BYTES);
    return webp ? { ok: true, webp } : { ok: false, reason: 'too-big' };
  } finally {
    sources.forEach((source) => {
      if (source && source.bitmap !== current) {
        source.bitmap.close();
      }
    });
    current?.close();
  }
};

export default packArtwork;

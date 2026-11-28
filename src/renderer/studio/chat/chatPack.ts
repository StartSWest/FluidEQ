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
import { pieceDraws } from './chatPackGutter';

/**
 * The scene's artwork as main laid it out for Claude's pack_artwork
 * (`main/studioChat/packArtworkTool.ts`), drawn and encoded here because
 * only a page encodes WebP: the member's photo places copied from the
 * artwork as it was, each piece in its place, and its gutter filled by its
 * kind (`chatPackGutter.ts`) so a distant mipmap never brings in a
 * neighbour's colour, nor a strip's own far edge.
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

/**
 * The piece, and what fills its gutter (`pieceDraws`), cut to its gutter.
 * Made once at its size and then copied pixel for pixel, never filtered
 * again: a strip's edge row is stretched over its gutter by repeating it,
 * and a filter there would read the rows beside it.
 */
const drawPiece = (
  context: CanvasRenderingContext2D,
  piece: IStudioChatPackPiece,
  source: TSource,
) => {
  const sized = document.createElement('canvas');
  sized.width = piece.width;
  sized.height = piece.height;
  const own = sized.getContext('2d');
  if (!own) {
    return false;
  }
  own.imageSmoothingEnabled = true;
  own.imageSmoothingQuality = 'high';
  own.drawImage(
    source.bitmap,
    source.x,
    source.y,
    source.width,
    source.height,
    0,
    0,
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
  context.imageSmoothingEnabled = false;
  pieceDraws(piece).forEach(({ from, to }) =>
    context.drawImage(
      sized,
      from.x,
      from.y,
      from.width,
      from.height,
      to.x,
      to.y,
      to.width,
      to.height,
    ),
  );
  context.restore();
  sized.width = 0;
  sized.height = 0;
  return true;
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
    const drawn = ask.pieces.every((piece, index) => {
      const source = sources[index];
      return source !== undefined && drawPiece(context, piece, source);
    });
    if (!drawn) {
      return { ok: false, reason: 'failed' };
    }
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

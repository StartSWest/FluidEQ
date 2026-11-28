/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { IStudioChatPackPiece } from 'common/studioChat';

interface IRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** One copy of (part of) a piece: from its own pixels, onto the artwork. */
export interface IPieceDraw {
  /** The part copied, in the piece's pixels at its size in the artwork. */
  from: IRect;
  /** Where it lands in the artwork; a one-row `from` is stretched down it. */
  to: IRect;
}

/**
 * What fills a piece's gutter, as copies of the piece made at its size,
 * which the window draws cut to the gutter (`chatPack.ts`).
 *
 * A tile's copies go all round it, so a mipmap past its edge reads on into
 * the same material. A strip's go across only, and above and below it its
 * own top and bottom rows are repeated: a mipmap reading past its top edge
 * then finds the sky it ends in, where a wrapped gutter put its own opaque
 * bottom rows - the dark line Neon City drew along the top of its far city
 * whenever it was drawn smaller than the panel (2026-11-28). A subject is
 * drawn once and its gutter stays clear.
 */
export const pieceDraws = (
  piece: Pick<
    IStudioChatPackPiece,
    'x' | 'y' | 'width' | 'height' | 'kind' | 'gutter'
  >,
): IPieceDraw[] => {
  const { x, y, width, height, gutter } = piece;
  const whole = { x: 0, y: 0, width, height };
  const at = (column: number, row: number) => ({
    from: whole,
    to: { x: x + column * width, y: y + row * height, width, height },
  });
  // As many copies each way as a gutter wider than the piece needs.
  const columns = Math.ceil(gutter / width);
  const rows = Math.ceil(gutter / height);
  const across = Array.from(
    { length: columns * 2 + 1 },
    (_, index) => index - columns,
  );
  if (piece.kind === 'subject') {
    return [at(0, 0)];
  }
  if (piece.kind === 'strip') {
    return across.flatMap((column) => [
      at(column, 0),
      {
        from: { x: 0, y: 0, width, height: 1 },
        to: { x: x + column * width, y: y - gutter, width, height: gutter },
      },
      {
        from: { x: 0, y: height - 1, width, height: 1 },
        to: { x: x + column * width, y: y + height, width, height: gutter },
      },
    ]);
  }
  return Array.from(
    { length: rows * 2 + 1 },
    (_, index) => index - rows,
  ).flatMap((row) => across.map((column) => at(column, row)));
};

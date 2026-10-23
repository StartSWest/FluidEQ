/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  MAX_SCENE_ARTWORK_EDGE,
  MAX_SCENE_ARTWORK_PIXELS,
} from '../../common/sceneArtwork';

/**
 * Where each piece of a scene's own art goes in its one artwork image.
 *
 * The brief has always told the member's AI to pack its pictures itself,
 * with a script; Claude in the Studio's chat runs no scripts, so FluidEQ
 * does the arithmetic, by the same rules the brief states (`aiPromptArt.ts`):
 * every tile a gutter of its own wrapped pixels (32), every subject a clear
 * margin (16), so a distant mipmap never mixes two pieces; the image within
 * ARTWORK's limits; the member's photo places left exactly where they are.
 *
 * Shelves, tallest first, on the narrowest width that holds everything in
 * the smallest image — a few dozen pieces at most, so trying every width is
 * nothing.
 */

export const TILE_GUTTER = 32;
export const SUBJECT_GUTTER = 16;

export interface IRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ILayoutPiece {
  id: string;
  width: number;
  height: number;
  /** A tile wraps into its gutter; a subject's stays clear. */
  kind: 'tile' | 'subject';
}

export interface IPlacedPiece extends IRect {
  id: string;
  wrap: boolean;
  gutter: number;
}

export type TLayout =
  | { ok: true; width: number; height: number; placed: IPlacedPiece[] }
  | { ok: false; reason: 'too-big' };

const WIDTHS = [512, 1024, 1536, 2048, 2560, 3072, 3584, 4096];

const overlaps = (a: IRect, b: IRect) =>
  a.x < b.x + b.width &&
  b.x < a.x + a.width &&
  a.y < b.y + b.height &&
  b.y < a.y + a.height;

const gutterOf = (piece: ILayoutPiece) =>
  piece.kind === 'tile' ? TILE_GUTTER : SUBJECT_GUTTER;

interface IShelves {
  /** Where the next piece on the current shelf would go. */
  x: number;
  y: number;
  /** The current shelf's height so far. */
  shelf: number;
  placed: IPlacedPiece[];
}

/**
 * Where a piece `outer` big goes from `at`: along the shelf past whatever
 * photo place is in the way, and down to the next shelf when the row runs
 * out. A row that photo places filled before anything was put on it has no
 * shelf height to step down by: it steps to where the nearest of them ends,
 * or it would try the same row for ever. Undefined when there is nowhere.
 */
const spotFrom = (
  at: { spot: IRect; shelf: number; blockedBottom: number },
  width: number,
  keep: readonly IRect[],
): { spot: IRect; shelf: number } | undefined => {
  const { spot, shelf, blockedBottom } = at;
  if (spot.x + spot.width > width) {
    const y = shelf > 0 ? spot.y + shelf : blockedBottom;
    return Number.isFinite(y)
      ? spotFrom(
          { spot: { ...spot, x: 0, y }, shelf: 0, blockedBottom: Infinity },
          width,
          keep,
        )
      : undefined;
  }
  const blocked = keep.find((rect) => overlaps(spot, rect));
  return blocked
    ? spotFrom(
        {
          spot: { ...spot, x: blocked.x + blocked.width },
          shelf,
          blockedBottom: Math.min(blockedBottom, blocked.y + blocked.height),
        },
        width,
        keep,
      )
    : { spot, shelf };
};

/** The pieces on shelves `width` wide, around `keep`; undefined if one cannot go. */
const shelve = (
  width: number,
  pieces: readonly ILayoutPiece[],
  keep: readonly IRect[],
): IPlacedPiece[] | undefined =>
  pieces.reduce<IShelves | undefined>(
    (shelves, piece) => {
      if (!shelves) {
        return undefined;
      }
      const gutter = gutterOf(piece);
      const outer = {
        width: piece.width + gutter * 2,
        height: piece.height + gutter * 2,
      };
      const found =
        outer.width > width
          ? undefined
          : spotFrom(
              {
                spot: { x: shelves.x, y: shelves.y, ...outer },
                shelf: shelves.shelf,
                blockedBottom: Infinity,
              },
              width,
              keep,
            );
      if (!found) {
        return undefined;
      }
      const { spot, shelf } = found;
      return {
        x: spot.x + spot.width,
        y: spot.y,
        shelf: Math.max(shelf, outer.height),
        placed: [
          ...shelves.placed,
          {
            id: piece.id,
            x: spot.x + gutter,
            y: spot.y + gutter,
            width: piece.width,
            height: piece.height,
            wrap: piece.kind === 'tile',
            gutter,
          },
        ],
      };
    },
    { x: 0, y: 0, shelf: 0, placed: [] },
  )?.placed;

/**
 * The layout of `pieces` around the photo places `keep`, or too big when no
 * image within ARTWORK's limits holds them.
 */
export const layoutArtwork = (
  pieces: readonly ILayoutPiece[],
  keep: readonly IRect[],
): TLayout => {
  const tallestFirst = [...pieces].sort(
    (a, b) => b.height + gutterOf(b) * 2 - (a.height + gutterOf(a) * 2),
  );
  const keptRight = Math.max(0, ...keep.map((rect) => rect.x + rect.width));
  const keptBottom = Math.max(0, ...keep.map((rect) => rect.y + rect.height));
  const fits = WIDTHS.filter((width) => width >= keptRight).flatMap((width) => {
    const placed = shelve(width, tallestFirst, keep);
    if (!placed) {
      return [];
    }
    const height = Math.max(
      1,
      keptBottom,
      ...placed.map((piece) => piece.y + piece.height + piece.gutter),
    );
    return height <= MAX_SCENE_ARTWORK_EDGE &&
      width * height <= MAX_SCENE_ARTWORK_PIXELS
      ? [{ width, height, placed }]
      : [];
  });
  // The smallest image; between two the same size, the squarer.
  const best = fits.reduce<(typeof fits)[number] | undefined>(
    (chosen, fit) =>
      !chosen ||
      fit.width * fit.height < chosen.width * chosen.height ||
      (fit.width * fit.height === chosen.width * chosen.height &&
        Math.max(fit.width, fit.height) < Math.max(chosen.width, chosen.height))
        ? fit
        : chosen,
    undefined,
  );
  return best ? { ok: true, ...best } : { ok: false, reason: 'too-big' };
};

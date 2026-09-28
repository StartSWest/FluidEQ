/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * What one of FluidEQ's own looks hands the engine each frame, beside the
 * music every scene is given (`sceneGl.ts`).
 *
 * The looks drawn on the GPU are laid out where the 2D ones always were — the
 * reading eased by the look's attack and release, the pieces laid from the
 * style editor's Pieces and Gap, the peaks held (`sceneViews/`) — and only
 * their painting moved: that is a few hundred numbers a frame, where the
 * painting was every pixel of the plot. So the layout travels as a small
 * float texture and a handful of vectors, and the look's shader paints from
 * them. A member's scene never declares these, and is handed nothing.
 */

/** `uLook[]`: the look's own vectors, whose meaning each look states. */
export const LOOK_VECTORS = 16;
/** `uInk[]`: the colour stops a look is painted in, at most. */
export const LOOK_INKS = 8;

export interface IEngineLookInput {
  /**
   * The look this is laid out for. A program is handed only its own look's
   * layout: in the frame after a look is changed the input is still the old
   * look's, and read by the new look's shader it is a picture of nothing.
   */
  style: string;
  /** RGBA floats, `width` texels a row and `rows` rows (`uLookData`). */
  data: Float32Array;
  width: number;
  rows: number;
  /** `LOOK_VECTORS` vec4s (`uLook`). */
  vectors: Float32Array;
  /** `LOOK_INKS` RGB stops, 0..1 (`uInk`), of which `inkCount` are used. */
  inks: Float32Array;
  inkCount: number;
  /**
   * The second reading's stops, the same way (`uInkMate`): a measuring
   * view's right channel, its side, its before-curve. Unused by the rest.
   */
  mateInks: Float32Array;
  mateInkCount: number;
  /**
   * How strongly the look's lit shapes bloom into the air around them, 0 for
   * none: the shader's `uLookPass` 1 draws those shapes on a small target that
   * is blurred and added back over the picture (`lookGl.ts`), as the 2D looks
   * bloom (`sceneBloom.ts`).
   */
  bloom: number;
  /**
   * Round sprites drawn over the finished picture, in order — sparks, dots,
   * motes: `SPRITE_FLOATS` numbers each (`lookSprites.ts`), `spriteCount` of
   * them. A particle is a point on the GPU, where a shader would have had to
   * look at every particle for every pixel.
   */
  sprites: Float32Array;
  spriteCount: number;
  /**
   * How many of the sprites, from the first, are drawn UNDER the picture —
   * scenery the look's own shapes stand in front of, like a sky's stars —
   * rather than over it.
   */
  spritesUnder: number;
  /** A picture the engine keeps from frame to frame, where the look has one. */
  history?: IEngineLookHistory;
  /** Free-drawn lines the look's shader reads as coverage, where it has any. */
  lines?: IEngineLookLines;
  /** Strokes in their own colours the look lays over its picture, if any. */
  strokes?: IEngineLookStrokes;
}

/**
 * Lines through points that go anywhere — a goniometer's cloud — which a
 * shader asking every segment about every pixel cannot afford. They are
 * drawn first, each segment as a quad, into a target the size of the
 * picture (`uLookLines`), keeping at each pixel the most any segment covers
 * it at each of up to four widths: so the lines are one shape however often
 * they cross, as a canvas strokes one path, and the look's shader paints the
 * coverages in its own colours.
 */
export interface IEngineLookLines {
  /**
   * `LINE_FLOATS` per point: x, y in CSS pixels, 1 where a new line starts,
   * and which of the widths the segment ending here is kept at — the sum of
   * 1, 2, 4 and 8 for the first to the fourth, 0 for all of them — so one
   * set of lines can hold strokes a canvas paints apart.
   */
  points: Float32Array;
  count: number;
  /**
   * The widths coverage is kept at, in CSS pixels: red, green, blue and,
   * where there is a fourth, alpha.
   */
  widths:
    | readonly [number, number, number]
    | readonly [number, number, number, number];
}

export const LINE_FLOATS = 4;
/** The most points a frame draws, and how many a row of texels holds. */
export const MAX_LINE_POINTS = 4096;
export const LINE_POINTS_PER_ROW = 1024;

/**
 * Strokes that each carry their own colour, width and ends — a burst of a
 * firework's sparks — drawn first into a target the look's shader lays
 * over its picture where the page would have stroked them (`uLookStrokes`).
 * Each pixel keeps the most any stroke put there, colour by colour
 * (premultiplied), which is what a canvas painting them back to front
 * gives wherever the later ones are the brighter: the coolest, faintest
 * piece of a spark first and its white-hot head last. Each copy of the
 * drawing is kept apart, stacked in the target, so a mirrored copy's
 * strokes are laid down where that copy is painted.
 */
export interface IEngineLookStrokes {
  /**
   * `STROKE_FLOATS` per point: x, y in CSS pixels; 1 where a new line
   * starts, plus 2 where the segment ending here has round ends, plus 4 for
   * the second copy; the segment's width; then its colour, straight, and
   * how solid.
   */
  points: Float32Array;
  count: number;
}

export const STROKE_FLOATS = 8;
/** The most points a frame draws, and how many a row of texels holds. */
export const MAX_STROKE_POINTS = 16384;
export const STROKE_POINTS_PER_ROW = 1024;

/**
 * A scrolling picture the engine keeps on the GPU (`uLookHistory`) — the
 * spectrogram's — handed over a row at a time rather than whole: the whole
 * ring is a few megabytes, and a frame adds at most a few rows to it.
 *
 * Counted, not sent once: a frame the engine does not draw is never seen by
 * it, so what travels is how many rows each strip has printed since it began
 * and the newest row, and the engine prints every row it has not seen yet
 * from that — each with the newest reading, which is what the page's own
 * canvas prints on a frame that catches up after a stall.
 */
export interface IEngineLookHistory {
  /** Which picture: a new one starts the engine's copy again, empty. */
  key: string;
  /** Texels a row, rows a strip, and strips. */
  width: number;
  rows: number;
  strips: number;
  /** Rows each strip has printed since it began. */
  printed: number[];
  /** Each strip's newest row, strip after strip, RGBA floats. */
  latest: Float32Array;
}

/**
 * A sprite's numbers, three texels of them: where it stands and half its
 * width and height, in CSS pixels; its colour, straight (not premultiplied),
 * and how solid; how soft its edge — 0 hard, 1 a glow falling from its
 * middle to nothing at its rim — and whether it is a rectangle rather than a
 * disc (an ellipse, when its half-width and half-height differ).
 */
export const SPRITE_FLOATS = 12;
/**
 * The most sprites a frame draws, and how many a row of texels holds: three
 * texels each, so a row is 768 wide, well inside the 2048 every WebGL2 GPU
 * must allow a texture.
 */
export const MAX_SPRITES = 2048;
export const SPRITES_PER_ROW = 256;

/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * WHAT A SCENE KEEPS IN VIEW ON ANY SHAPE OF SCREEN (Ivan, 2026-09-28: "let
 * say I am on mobile ... it needs to automatically move the scene so that
 * important part is on the view; each viz needs to have that shift
 * coordinates for different views; user won't configure this, this is part
 * of how the visualizers are built").
 *
 * A scene is composed for a shape - its whole picture seen at a width to its
 * height of `narrowest` or more - with its important part at `focus`, in the
 * uv of that picture. On a panel narrower than that (a phone held upright, a
 * narrow column) the picture is drawn at the same scale and slid across so
 * the focus stays in view, as close to the middle as the picture's own edges
 * allow; on a panel wider than `widest`, when the scene gives one, the same
 * is done up and down. Between the two nothing moves: the graph and a
 * desktop draw the scene exactly as its author made it.
 *
 * Done by the engine for every scene alike, never by the listener: the
 * picture is framed as a larger panel around the one on screen (the same
 * `view` the Backdrop widens a scene with, `sceneView.ts`), so a flat scene
 * and a 3D world move the same way and a scene needs no code of its own.
 *
 * NO IMPORTS, on purpose: the signing function vendors this file into Deno
 * as it is, so what the server signs and what the app plays are the same
 * bytes. The server's deploy flattens every module into one file, so a
 * helper here takes a name no other vendored module uses.
 */

export interface ISceneFraming {
  /** The point that must stay in view: x, y in the uv of the whole picture. */
  focus: readonly [number, number];
  /** The narrowest shape (width / height) the whole picture is composed for. */
  narrowest: number;
  /** Past this shape the picture is framed up and down; absent, never. */
  widest?: number;
}

/** A phone held upright is about 0.46; a shape narrower than any screen. */
export const MIN_FRAMING_ASPECT = 0.25;
/** A strip wider than any panel FluidEQ draws a scene in. */
export const MAX_FRAMING_ASPECT = 12;
/** What a scene that gives no narrowest shape is taken to be composed for. */
export const DEFAULT_FRAMING_NARROWEST = 16 / 9;
/** How near two shapes are to count as one (`framedPanel`). */
const SAME_SHAPE = 0.001;

const isFramingRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const framingUnit = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isFinite(value)
    ? Math.min(1, Math.max(0, value))
    : undefined;

const shape = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) && value > 0
    ? Math.min(MAX_FRAMING_ASPECT, Math.max(MIN_FRAMING_ASPECT, value))
    : undefined;

/**
 * `pack.json`'s `framing`, kept in range rather than refused, like a camera:
 * a focus outside the picture is its nearest edge. Nothing usable is no
 * framing at all - the scene plays as it always did.
 */
export const readSceneFraming = (raw: unknown): ISceneFraming | undefined => {
  if (
    !isFramingRecord(raw) ||
    !Array.isArray(raw.focus) ||
    raw.focus.length !== 2
  ) {
    return undefined;
  }
  const x = framingUnit(raw.focus[0]);
  const y = framingUnit(raw.focus[1]);
  if (x === undefined || y === undefined) {
    return undefined;
  }
  const narrowest = shape(raw.narrowest) ?? DEFAULT_FRAMING_NARROWEST;
  const widest = shape(raw.widest);
  return {
    focus: [x, y],
    narrowest,
    ...(widest !== undefined && widest > narrowest ? { widest } : {}),
  };
};

/** `[left, bottom, width, height]`: a panel's rectangle on its canvas. */
export type TFramingRect = readonly [number, number, number, number];

/**
 * Where the whole picture stands, given the panel on screen (`panel`, as a
 * fraction of a canvas `width` by `height` pixels): the panel itself where
 * its shape needs nothing, or a larger panel round it, slid so the focus is
 * in view. Its uv is the picture's, and the panel on screen shows part of it.
 */
export const framedPanel = (
  panel: TFramingRect,
  width: number,
  height: number,
  framing: ISceneFraming,
): TFramingRect => {
  const [left, bottom, across, up] = panel;
  const pixelsAcross = across * width;
  const pixelsUp = up * height;
  if (pixelsAcross <= 0 || pixelsUp <= 0) {
    return panel;
  }
  const aspect = pixelsAcross / pixelsUp;
  const [focusX, focusY] = framing.focus;
  // A shape within a thousandth of the one composed for is that shape: 16:9
  // is written 1.7778 in a pack, and a 1280 by 720 panel is 1.77777..., which
  // framed by a rounding error would take the framed path for nothing.
  if (aspect < framing.narrowest * (1 - SAME_SHAPE)) {
    // The picture at the panel's height, as wide as it was composed; the
    // panel shows `seen` of it, as near centred on the focus as it can be.
    const wide = (framing.narrowest * pixelsUp) / width;
    const seen = across / wide;
    const start = Math.min(1 - seen, Math.max(0, focusX - seen / 2));
    return [left - start * wide, bottom, wide, up];
  }
  if (
    framing.widest !== undefined &&
    aspect > framing.widest * (1 + SAME_SHAPE)
  ) {
    const tall = pixelsAcross / framing.widest / height;
    const seen = up / tall;
    const start = Math.min(1 - seen, Math.max(0, focusY - seen / 2));
    return [left, bottom - start * tall, across, tall];
  }
  return panel;
};

/**
 * A point given in the panel's uv (the pointer, a tap, the wave's band),
 * in the whole picture's uv once it is framed as `picture`.
 */
export const framedPoint = (
  panel: TFramingRect,
  picture: TFramingRect,
  u: number,
  v: number,
): [number, number] => [
  (panel[0] + u * panel[2] - picture[0]) / picture[2],
  (panel[1] + v * panel[3] - picture[1]) / picture[3],
];

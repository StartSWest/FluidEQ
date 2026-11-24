/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { readStored, removeStored, writeStored } from '../utils/graphStorage';
import {
  type IHeightLimits,
  type IMenuBand,
  type IMenuRoom,
  MENU_MARGIN,
  reachOf,
  restBottom,
  restTop,
  type TEdgeLean,
  type TMenuFrame,
} from '../widgets/menuFrame';

/**
 * The look picker's window size and place: what a drag of one of its grips
 * or a step of the arrow keys makes of it, and how it is remembered.
 *
 * Where it stands is the reader's too now (Ivan, 2026-11-23), not only its
 * size: under the look select, over it, or reaching past it on both sides,
 * so the window can be laid over the graph where the reader wants it rather
 * than always hanging from the select.
 */

/**
 * The remembered window, `{ width, above, below }` (`TMenuReach`). It took
 * over from `SIZE_KEY`, which held `<width>x<height>` for a window that
 * always hung from its select; that one is read once, as a window below.
 */
export const WINDOW_KEY = 'fluideq.lookPicker.window';
export const SIZE_KEY = 'fluideq.lookPicker.size';

/** The size it has always opened at, before anybody sized it. */
export const DEFAULT_WIDTH = 880;
export const DEFAULT_HEIGHT = 600;

/**
 * The smallest window is the one the narrowest app window (720px) opened it
 * at, which the layout was drawn for: the rail, then a name, its mark, a
 * maker and a version side by side (Kind goes first, `_lookPickerTiles.scss`).
 * At 600 the name and the maker were down to three letters each. The largest
 * is three screens of pictures, past which a picker is a page.
 */
export const MIN_WIDTH = 700;
export const MIN_HEIGHT = 400;
export const MAX_WIDTH = 1440;
export const MAX_HEIGHT = 1000;

const HEIGHTS: IHeightLimits = { min: MIN_HEIGHT, max: MAX_HEIGHT };

/**
 * One press of an arrow on a grip: the step the app's other splitters take
 * (`KaraokePaneSplitter`), so every resizable edge here moves alike.
 */
export const KEY_STEP = 24;

export type TGrip =
  | 'left'
  | 'right'
  | 'top'
  | 'bottom'
  | 'top-left'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-right';

export const DEFAULT_FRAME: TMenuFrame = {
  width: DEFAULT_WIDTH,
  nudge: 0,
  above: null,
  below: DEFAULT_HEIGHT,
};

const clampSize = (value: number, low: number, high: number) =>
  Math.min(high, Math.max(low, value));

/** `lo` gives way to `hi`: the window's edge wins over the smallest size. */
const clampEdge = (value: number, lo: number, hi: number) =>
  Math.max(Math.min(lo, hi), Math.min(hi, value));

const isLength = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

/** A one-sided window's height, held to the sizes it may have. */
const oneSide = (value: number) => clampSize(value, MIN_HEIGHT, MAX_HEIGHT);

const parseWindow = (text: string): TMenuFrame | undefined => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    // Somebody else's text under our name: the first size is the answer.
    return undefined;
  }
  if (!isRecord(parsed) || !isLength(parsed.width) || parsed.width === 0) {
    return undefined;
  }
  const width = clampSize(parsed.width, MIN_WIDTH, MAX_WIDTH);
  const above = isLength(parsed.above) ? parsed.above : null;
  const below = isLength(parsed.below) ? parsed.below : null;
  if (above !== null && below !== null) {
    return {
      width,
      nudge: 0,
      above: Math.min(above, MAX_HEIGHT),
      below: Math.min(below, MAX_HEIGHT),
    };
  }
  if (above !== null) {
    return { width, nudge: 0, above: oneSide(above), below: null };
  }
  return below === null
    ? undefined
    : { width, nudge: 0, above: null, below: oneSide(below) };
};

const parseSize = (text: string): TMenuFrame | undefined => {
  const [width, height] = text.split('x').map(Number);
  return Number.isFinite(width) &&
    Number.isFinite(height) &&
    width > 0 &&
    height > 0
    ? {
        width: clampSize(width, MIN_WIDTH, MAX_WIDTH),
        nudge: 0,
        above: null,
        below: oneSide(height),
      }
    : undefined;
};

/**
 * The window it opens as. The sideways nudge is not kept: where it stands
 * across is its select's, right-aligned, and a side dragged outwards moves
 * that side alone for as long as the picker is on the page.
 */
export const readFrame = (): TMenuFrame => {
  const stored = readStored(WINDOW_KEY);
  const old = stored === null ? readStored(SIZE_KEY) : null;
  return (
    (stored === null ? undefined : parseWindow(stored)) ??
    (old === null ? undefined : parseSize(old)) ??
    DEFAULT_FRAME
  );
};

export const writeFrame = (frame: TMenuFrame) => {
  const round = (value: number | null) =>
    value === null ? null : Math.round(value);
  writeStored(
    WINDOW_KEY,
    JSON.stringify({
      width: Math.round(frame.width),
      above: round(frame.above),
      below: round(frame.below),
    }),
  );
  removeStored(SIZE_KEY);
};

export const forgetFrame = () => {
  removeStored(WINDOW_KEY);
  removeStored(SIZE_KEY);
};

/** Where things stood when a resize began, all in window coordinates. */
export interface IResizeStart {
  /** The window's own rectangle. */
  rect: { left: number; right: number; top: number; bottom: number };
  /** The select's band (`bandOf`), which the window's edges are kept off. */
  band: IMenuBand;
  /** The select's right edge, which the window's is measured from. */
  anchorRight: number;
  /** The part of the app window the picker may stand in, top to bottom. */
  room: IMenuRoom;
  /** The app window's width. */
  viewWidth: number;
}

/**
 * The window after its `grip` has moved by `dx`, `dy` from where it was at
 * the start. A side moves sideways, held between the smallest and largest
 * widths and inside the app window; the top and the bottom move as
 * `restTop` and `restBottom` let them, so either can go past the select to
 * its other side. `lean` is a keyboard step's direction (`TEdgeLean`).
 */
export const resizeFrame = (
  frame: TMenuFrame,
  grip: TGrip,
  start: IResizeStart,
  dx: number,
  dy: number,
  lean?: TEdgeLean,
): TMenuFrame => {
  const { rect, band, room } = start;
  let { left, right, top, bottom } = rect;
  if (grip.includes('left')) {
    left = clampEdge(
      rect.left + dx,
      Math.max(MENU_MARGIN, rect.right - MAX_WIDTH),
      rect.right - MIN_WIDTH,
    );
  }
  if (grip.includes('right')) {
    right = clampEdge(
      rect.right + dx,
      rect.left + MIN_WIDTH,
      Math.min(start.viewWidth - MENU_MARGIN, rect.left + MAX_WIDTH),
    );
  }
  if (grip.includes('top')) {
    top = restTop(rect.top + dy, rect.bottom, band, room, HEIGHTS, lean);
  }
  if (grip.includes('bottom')) {
    bottom = restBottom(rect.bottom + dy, rect.top, band, room, HEIGHTS, lean);
  }
  const sideways = grip.includes('left') || grip.includes('right');
  const upright = grip.includes('top') || grip.includes('bottom');
  const across = sideways
    ? { width: right - left, nudge: right - start.anchorRight }
    : { width: frame.width, nudge: frame.nudge };
  return upright
    ? { ...across, ...reachOf(top, bottom, band) }
    : { ...frame, ...across };
};

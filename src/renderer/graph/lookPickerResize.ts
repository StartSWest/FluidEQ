/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { readStored, removeStored, writeStored } from '../utils/graphStorage';
import {
  dragFarEdge,
  type IHeightLimits,
  type IMenuBand,
  type IMenuFrame,
  type IMenuRoom,
  MENU_MARGIN,
  stepFarEdge,
  type TMenuSide,
} from '../widgets/menuFrame';

/**
 * The look picker's window size and side: what a drag of one of its grips
 * or a step of the arrow keys makes of it, and how it is remembered.
 *
 * Which side of the look select it opens on is the reader's now, not only
 * its size (Ivan, 2026-11-23: "it shows above or below depending on what the
 * user intends"): the far edge dragged back across the select flips it.
 */

/**
 * The remembered window, `{ width, side, height }`. It took over from
 * `SIZE_KEY`, which held `<width>x<height>` for a window that always hung
 * under its select; that one is read once, as a window below. A value of
 * any other shape here - the reverted window that could cover its select
 * wrote `{ width, above, below }` under this name for a day - opens at the
 * first size.
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

export const DEFAULT_FRAME: IMenuFrame = {
  width: DEFAULT_WIDTH,
  nudge: 0,
  side: 'down',
  height: DEFAULT_HEIGHT,
};

const clampSize = (value: number, low: number, high: number) =>
  Math.min(high, Math.max(low, value));

/** `lo` gives way to `hi`: the window's edge wins over the smallest size. */
const clampEdge = (value: number, lo: number, hi: number) =>
  Math.max(Math.min(lo, hi), Math.min(hi, value));

const isSize = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value > 0;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const parseWindow = (text: string): IMenuFrame | undefined => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    // Somebody else's text under our name: the first size is the answer.
    return undefined;
  }
  if (
    !isRecord(parsed) ||
    !isSize(parsed.width) ||
    !isSize(parsed.height) ||
    (parsed.side !== 'up' && parsed.side !== 'down')
  ) {
    return undefined;
  }
  return {
    width: clampSize(parsed.width, MIN_WIDTH, MAX_WIDTH),
    nudge: 0,
    side: parsed.side,
    height: clampSize(parsed.height, MIN_HEIGHT, MAX_HEIGHT),
  };
};

const parseSize = (text: string): IMenuFrame | undefined => {
  const [width, height] = text.split('x').map(Number);
  return isSize(width) && isSize(height)
    ? {
        width: clampSize(width, MIN_WIDTH, MAX_WIDTH),
        nudge: 0,
        side: 'down',
        height: clampSize(height, MIN_HEIGHT, MAX_HEIGHT),
      }
    : undefined;
};

/**
 * The window it opens as. The sideways nudge is not kept: where it stands
 * across is its select's, right-aligned, and a side dragged outwards moves
 * that side alone for as long as the picker is on the page.
 */
export const readFrame = (): IMenuFrame => {
  const stored = readStored(WINDOW_KEY);
  const old = stored === null ? readStored(SIZE_KEY) : null;
  return (
    (stored === null ? undefined : parseWindow(stored)) ??
    (old === null ? undefined : parseSize(old)) ??
    DEFAULT_FRAME
  );
};

export const writeFrame = (frame: IMenuFrame) => {
  writeStored(
    WINDOW_KEY,
    JSON.stringify({
      width: Math.round(frame.width),
      side: frame.side,
      height: Math.round(frame.height),
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
  /** The side of its select it stood on. */
  side: TMenuSide;
  /** The select's band (`bandOf`), which the window never covers. */
  band: IMenuBand;
  /** The select's right edge, which the window's is measured from. */
  anchorRight: number;
  /** The part of the app window the picker may stand in, top to bottom. */
  room: IMenuRoom;
  /** The app window's width. */
  viewWidth: number;
}

/** The far edge's grip on each side: the edge away from the select. */
export const farEdge = (side: TMenuSide): 'top' | 'bottom' =>
  side === 'up' ? 'top' : 'bottom';

const sideways = (
  grip: TGrip,
  start: IResizeStart,
  dx: number,
): { width: number; nudge: number } | undefined => {
  const { rect } = start;
  let { left, right } = rect;
  if (grip.includes('left')) {
    left = clampEdge(
      rect.left + dx,
      Math.max(MENU_MARGIN, rect.right - MAX_WIDTH),
      rect.right - MIN_WIDTH,
    );
  } else if (grip.includes('right')) {
    right = clampEdge(
      rect.right + dx,
      rect.left + MIN_WIDTH,
      Math.min(start.viewWidth - MENU_MARGIN, rect.left + MAX_WIDTH),
    );
  } else {
    return undefined;
  }
  return { width: right - left, nudge: right - start.anchorRight };
};

/**
 * The window after `grip` has been dragged by `dx`, `dy` from where it was
 * at the start. A side moves sideways, held between the smallest and largest
 * widths and inside the app window. The far edge (or a far corner) follows
 * the pointer up and down (`dragFarEdge`), flipping the window to the
 * select's other side once the pointer is past the select's middle; it is
 * whichever of top and bottom faced away from the select when the drag
 * began, so the grip that holds the pointer keeps moving the far edge after
 * a flip.
 */
export const dragFrame = (
  frame: IMenuFrame,
  grip: TGrip,
  start: IResizeStart,
  dx: number,
  dy: number,
): IMenuFrame => {
  const across = sideways(grip, start, dx) ?? {
    width: frame.width,
    nudge: frame.nudge,
  };
  const far = farEdge(start.side);
  if (!grip.startsWith(far)) {
    return { ...frame, ...across };
  }
  const edge = (far === 'top' ? start.rect.top : start.rect.bottom) + dy;
  return {
    ...across,
    ...dragFarEdge(edge, start.side, start.band, start.room, HEIGHTS),
  };
};

/**
 * One press of an arrow on a focused edge: a side moves by `delta` across,
 * the far edge by `delta` up or down (`stepFarEdge`), from where the window
 * stands now.
 */
export const stepFrame = (
  frame: IMenuFrame,
  edge: 'top' | 'bottom' | 'left' | 'right',
  start: IResizeStart,
  delta: number,
): IMenuFrame => {
  if (edge === 'left' || edge === 'right') {
    return dragFrame(frame, edge, start, delta, 0);
  }
  if (edge !== farEdge(start.side)) {
    return frame;
  }
  const current = {
    side: start.side,
    height: start.rect.bottom - start.rect.top,
  };
  return {
    width: frame.width,
    nudge: frame.nudge,
    ...stepFarEdge(current, delta, start.band, start.room, HEIGHTS),
  };
};

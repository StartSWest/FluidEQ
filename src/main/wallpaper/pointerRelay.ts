/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { MouseInputEvent } from 'electron';
import type { IWallpaperWheel } from '../../common/wallpaper';

/**
 * What the desktop helper says the mouse did over its monitor's bare desktop
 * (`native/wallpaper/pointer.h`), in that monitor's physical pixels from its
 * top-left corner: `buttons` held as a page numbers them (1 left, 2 right,
 * 4 middle), `button` the one pressed or let go (0 left, 1 middle, 2 right),
 * `delta` the wheel in Windows' units (120 a notch, positive away from the
 * hand).
 */
export type TWallpaperPointer =
  | {
      kind: 'move';
      x: number;
      y: number;
      ctrl: boolean;
      buttons: number;
    }
  | {
      kind: 'down' | 'up';
      x: number;
      y: number;
      ctrl: boolean;
      buttons: number;
      button: number;
    }
  | {
      kind: 'wheel';
      x: number;
      y: number;
      ctrl: boolean;
      buttons: number;
      delta: number;
    }
  | { kind: 'leave' };

/**
 * One record, read as untrusted like every line from the helper: anything not
 * exactly a record it writes is nothing. Coordinates are bounded by any
 * monitor's size; a press reaches past the monitor's edge while it is held.
 */
const RECORD =
  /^pointer:(move|down|up|wheel) (-?\d{1,6}) (-?\d{1,6}) ([01]) ([0-7])(?: (-?\d{1,6}))?$/;

export const parsePointerRecord = (
  line: string,
): TWallpaperPointer | undefined => {
  if (line === 'pointer:leave') {
    return { kind: 'leave' };
  }
  const match = RECORD.exec(line);
  if (!match) {
    return undefined;
  }
  const [, kind, xText, yText, ctrlText, buttonsText, extraText] = match;
  const base = {
    x: Number(xText),
    y: Number(yText),
    ctrl: ctrlText === '1',
    buttons: Number(buttonsText),
  };
  const extra = extraText === undefined ? undefined : Number(extraText);
  if (kind === 'move') {
    return extra === undefined ? { kind, ...base } : undefined;
  }
  if (kind === 'wheel') {
    return extra === undefined || extra === 0
      ? undefined
      : { kind, ...base, delta: extra };
  }
  if (kind !== 'down' && kind !== 'up') {
    return undefined;
  }
  return extra !== undefined && extra >= 0 && extra <= 2
    ? { kind, ...base, button: extra }
    : undefined;
};

/** What a page's `deltaY` is for one notch of the wheel, as Chromium has it. */
const PIXELS_PER_NOTCH = 100;
/** Windows' units for one notch (`WHEEL_DELTA`). */
const WHEEL_DELTA = 120;

/** Each bit of a page's `buttons`, and the modifier that says it is held. */
const HELD: readonly (readonly [
  number,
  'leftbuttondown' | 'rightbuttondown' | 'middlebuttondown',
])[] = [
  [1, 'leftbuttondown'],
  [2, 'rightbuttondown'],
  [4, 'middlebuttondown'],
];

const BUTTONS: readonly ['left', 'middle', 'right'] = [
  'left',
  'middle',
  'right',
];

/**
 * What the page is handed for a record: real mouse input for everything but
 * the wheel, so the page's own pointer events, capture and clicks are the
 * browser's and its scene's hands work exactly as on the graph; the wheel as
 * a message of its own (`WALLPAPER.wheel`). `scale` is the monitor's, from
 * physical pixels to the page's; `last` is where the pointer was, which a
 * leave is said at.
 */
export type TPointerDelivery =
  { input: MouseInputEvent } | { wheel: IWallpaperWheel } | undefined;

export const pointerDelivery = (
  record: TWallpaperPointer,
  scale: number,
  last: { x: number; y: number },
): TPointerDelivery => {
  if (record.kind === 'leave') {
    return { input: { type: 'mouseLeave', x: last.x, y: last.y } };
  }
  const ratio = scale > 0 ? scale : 1;
  const x = Math.round(record.x / ratio);
  const y = Math.round(record.y / ratio);
  if (record.kind === 'wheel') {
    return {
      wheel: {
        x,
        y,
        deltaY: (-record.delta * PIXELS_PER_NOTCH) / WHEEL_DELTA,
        ctrlKey: record.ctrl,
      },
    };
  }
  const modifiers: NonNullable<MouseInputEvent['modifiers']> = [];
  if (record.ctrl) {
    modifiers.push('control');
  }
  // The page's `buttons` come from these, and a move with none held ends a
  // press the page thought was still down (`sceneInteraction.ts`).
  HELD.forEach(([bit, modifier]) => {
    if (Math.floor(record.buttons / bit) % 2 === 1) {
      modifiers.push(modifier);
    }
  });
  if (record.kind === 'move') {
    return { input: { type: 'mouseMove', x, y, modifiers } };
  }
  return {
    input: {
      type: record.kind === 'down' ? 'mouseDown' : 'mouseUp',
      x,
      y,
      button: BUTTONS[record.button],
      clickCount: 1,
      modifiers,
    },
  };
};

/** @jest-environment node */
/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  parsePointerRecord,
  pointerDelivery,
} from '../../../main/wallpaper/pointerRelay';

/**
 * What main makes of the desktop helper's mouse records
 * (`native/wallpaper/pointer.h`): only records it writes, and for each the
 * input a page hears — real mouse input in the page's own pixels, and the
 * wheel as a message of its own.
 */
describe('the mouse records the desktop helper writes', () => {
  it('reads each kind it writes', () => {
    expect(parsePointerRecord('pointer:move 100 200 0 0')).toEqual({
      kind: 'move',
      x: 100,
      y: 200,
      ctrl: false,
      buttons: 0,
    });
    expect(parsePointerRecord('pointer:down 5 6 1 1 0')).toEqual({
      kind: 'down',
      x: 5,
      y: 6,
      ctrl: true,
      buttons: 1,
      button: 0,
    });
    expect(parsePointerRecord('pointer:up -40 7 0 0 2')).toEqual({
      kind: 'up',
      x: -40,
      y: 7,
      ctrl: false,
      buttons: 0,
      button: 2,
    });
    expect(parsePointerRecord('pointer:wheel 1 2 1 0 -120')).toEqual({
      kind: 'wheel',
      x: 1,
      y: 2,
      ctrl: true,
      buttons: 0,
      delta: -120,
    });
    expect(parsePointerRecord('pointer:leave')).toEqual({ kind: 'leave' });
  });

  it('reads nothing that is not exactly one of them', () => {
    [
      'pointer:move 1 2 0',
      'pointer:move 1 2 0 0 5',
      'pointer:down 1 2 0 1',
      'pointer:down 1 2 0 1 3',
      'pointer:wheel 1 2 0 0',
      'pointer:wheel 1 2 0 0 0',
      'pointer:move 1 2 2 0',
      'pointer:move 1 2 0 8',
      'pointer:move 1234567 2 0 0',
      'pointer:move 1.5 2 0 0',
      'pointer:click 1 2 0 0 0',
      'pointer:leave ',
      ' pointer:move 1 2 0 0',
      'active',
    ].forEach((line) => expect(parsePointerRecord(line)).toBeUndefined());
  });
});

describe('what a page is handed for each record', () => {
  const last = { x: 9, y: 8 };

  it('is a move in the page’s pixels, with Ctrl and the held buttons', () => {
    const record = parsePointerRecord('pointer:move 300 150 1 5');
    expect(record && pointerDelivery(record, 1.5, last)).toEqual({
      input: {
        type: 'mouseMove',
        x: 200,
        y: 100,
        modifiers: ['control', 'leftbuttondown', 'middlebuttondown'],
      },
    });
  });

  it('is a press and a release of the button the helper named', () => {
    const down = parsePointerRecord('pointer:down 10 20 0 2 2');
    expect(down && pointerDelivery(down, 1, last)).toEqual({
      input: {
        type: 'mouseDown',
        x: 10,
        y: 20,
        button: 'right',
        clickCount: 1,
        modifiers: ['rightbuttondown'],
      },
    });
    const up = parsePointerRecord('pointer:up 10 20 0 0 1');
    expect(up && pointerDelivery(up, 1, last)).toEqual({
      input: {
        type: 'mouseUp',
        x: 10,
        y: 20,
        button: 'middle',
        clickCount: 1,
        modifiers: [],
      },
    });
  });

  // A notch away from the hand is a page's scroll up: a negative deltaY,
  // which the camera reads as moving in (`zoomSceneCamera`).
  it('is the wheel as a page’s deltaY, 100 a notch, with the sign a page uses', () => {
    const away = parsePointerRecord('pointer:wheel 40 60 1 0 120');
    expect(away && pointerDelivery(away, 2, last)).toEqual({
      wheel: { x: 20, y: 30, deltaY: -100, ctrlKey: true },
    });
    const towards = parsePointerRecord('pointer:wheel 40 60 0 0 -240');
    expect(towards && pointerDelivery(towards, 2, last)).toEqual({
      wheel: { x: 20, y: 30, deltaY: 200, ctrlKey: false },
    });
  });

  it('says a leave where the pointer last was', () => {
    expect(pointerDelivery({ kind: 'leave' }, 1.25, last)).toEqual({
      input: { type: 'mouseLeave', x: 9, y: 8 },
    });
  });
});

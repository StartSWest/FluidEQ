/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The amp's height, dragged by its foot or its head (Ivan, 2026-10-25: "we
 * need to be able to resize from the top too"): the edge held follows the
 * pointer, the other stays where it is, and the distance is read on the
 * screen, where the window moving under the pointer cannot chase itself.
 */

import { fireEvent, render, screen } from '@testing-library/react';
import PlayerHeightGrip from 'renderer/player/PlayerHeightGrip';

const resizePlayerWindow = jest.fn((_height: number) => Promise.resolve());
const resizePlayerWindowFromTop = jest.fn((_height: number) => undefined);

jest.mock('renderer/player/windowModeStore', () => ({
  resizePlayerWindow: (height: number) => resizePlayerWindow(height),
  resizePlayerWindowFromTop: (height: number) =>
    resizePlayerWindowFromTop(height),
}));
jest.mock('renderer/utils/I18nContext', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

/**
 * jsdom has no `PointerEvent`, and the events Testing Library makes without
 * one carry no button, pointer or screen position: a mouse event that names
 * its pointer stands in.
 */
class TestPointerEvent extends MouseEvent {
  readonly pointerId: number;

  constructor(type: string, init: PointerEventInit = {}) {
    super(type, init);
    this.pointerId = init.pointerId ?? 0;
  }
}

beforeEach(() => {
  resizePlayerWindow.mockClear();
  resizePlayerWindowFromTop.mockClear();
  Object.defineProperty(window, 'innerHeight', {
    configurable: true,
    value: 700,
  });
  Object.defineProperty(window, 'PointerEvent', {
    configurable: true,
    value: TestPointerEvent,
  });
  // jsdom has no pointer capture either.
  HTMLElement.prototype.setPointerCapture = () => undefined;
});

/** A press on the grip, a move on the screen, and the release. */
const drag = (from: number, to: number) => {
  const grip = screen.getByRole('separator', { name: 'player.heightGrip' });
  fireEvent.pointerDown(grip, { button: 0, pointerId: 1, screenY: from });
  fireEvent.pointerMove(grip, { pointerId: 1, screenY: to });
  fireEvent.pointerUp(grip, { pointerId: 1, screenY: to });
};

describe('the amp’s height grips', () => {
  it('grow the amp by its foot as far as the pointer goes down', () => {
    render(<PlayerHeightGrip edge="bottom" />);
    drag(800, 860);
    expect(resizePlayerWindow).toHaveBeenLastCalledWith(760);
    expect(resizePlayerWindowFromTop).not.toHaveBeenCalled();
  });

  it('grow the amp by its head as far as the pointer goes up, its foot staying put', () => {
    render(<PlayerHeightGrip edge="top" />);
    drag(100, -20);
    expect(resizePlayerWindowFromTop).toHaveBeenLastCalledWith(820);
    // And shorten it as far as the pointer goes down.
    drag(100, 250);
    expect(resizePlayerWindowFromTop).toHaveBeenLastCalledWith(550);
    expect(resizePlayerWindow).not.toHaveBeenCalled();
  });

  it('take no press but the main button, and no other pointer’s move', () => {
    render(<PlayerHeightGrip edge="bottom" />);
    const grip = screen.getByRole('separator', { name: 'player.heightGrip' });
    fireEvent.pointerDown(grip, { button: 2, pointerId: 1, screenY: 800 });
    fireEvent.pointerMove(grip, { pointerId: 1, screenY: 900 });
    fireEvent.pointerUp(grip, { pointerId: 1, screenY: 900 });
    expect(resizePlayerWindow).not.toHaveBeenCalled();
    fireEvent.pointerDown(grip, { button: 0, pointerId: 1, screenY: 800 });
    fireEvent.pointerMove(grip, { pointerId: 2, screenY: 900 });
    fireEvent.pointerUp(grip, { pointerId: 1, screenY: 800 });
    expect(resizePlayerWindow).not.toHaveBeenCalled();
  });
});

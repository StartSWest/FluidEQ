/** @jest-environment node */
/* FluidEQ — GPL-3.0-or-later */

import { EventEmitter } from 'events';
import type { BrowserWindow, Point } from 'electron';
import watchMacTitlebar from '../../../main/macTitlebarFrames';
import placeMacTrafficLights from '../../../main/macTrafficLights';

jest.mock('../../../main/macTitlebarFrames', () => jest.fn());
const watch = jest.mocked(watchMacTitlebar);

const setup = () => {
  let actual:
    { x: number; y: number; height: number; hidden: boolean } | undefined = {
    x: 8,
    y: 21,
    height: 14,
    hidden: false,
  };
  let changed: () => void = () => undefined;
  const native = { read: jest.fn(() => actual), stop: jest.fn() };
  watch.mockImplementation((_window, notify) => {
    changed = notify;
    return native;
  });
  const window = Object.assign(new EventEmitter(), {
    isDestroyed: jest.fn(() => false),
    isFullScreen: jest.fn(() => false),
    isSimpleFullScreen: jest.fn(() => false),
    setWindowButtonPosition: jest.fn((position: Point) => {
      actual = { ...position, height: 14, hidden: false };
      // AppKit synchronously notifies observers for our own placement too.
      changed();
    }),
  });
  const place = (position: Point = { x: 8, y: 21 }) =>
    placeMacTrafficLights(window as unknown as BrowserWindow, position);
  return {
    window,
    place,
    native,
    change: (next: typeof actual) => {
      actual = next;
      changed();
    },
    notify: () => changed(),
  };
};

beforeEach(() => jest.clearAllMocks());

it('repairs the native frame jump even when Electron and the page report unchanged geometry', () => {
  const { window, place, change, native } = setup();
  place();
  expect(window.setWindowButtonPosition).toHaveBeenCalledTimes(1);
  change({ x: 9, y: 9, height: 14, hidden: false });
  expect(window.setWindowButtonPosition).toHaveBeenCalledTimes(2);
  expect(native.read()).toEqual({ x: 8, y: 21, height: 14, hidden: false });
});

it('does nothing for stable native frames and ignores its own synchronous notifications', () => {
  const { window, place, notify, change } = setup();
  place();
  notify();
  change({ x: 8.25, y: 21.25, height: 14, hidden: false });
  expect(window.setWindowButtonPosition).toHaveBeenCalledTimes(1);
});

it('restores the latest app/player placement, with one observer for the window', () => {
  const { window, place, change } = setup();
  place();
  place({ x: 9, y: 10 });
  change({ x: 9, y: 9, height: 14, hidden: false });
  expect(window.setWindowButtonPosition).toHaveBeenLastCalledWith({
    x: 9,
    y: 10,
  });
  expect(watch).toHaveBeenCalledTimes(1);
});

it('leaves hidden or temporarily removed native buttons alone', () => {
  const { window, place, change } = setup();
  place();
  change({ x: 9, y: 9, height: 14, hidden: true });
  change(undefined);
  expect(window.setWindowButtonPosition).toHaveBeenCalledTimes(1);
  change({ x: 9, y: 9, height: 14, hidden: false });
  expect(window.setWindowButtonPosition).toHaveBeenCalledTimes(2);
});

it.each(['isFullScreen', 'isSimpleFullScreen', 'isDestroyed'] as const)(
  'does not move native controls while %s is true',
  (state) => {
    const { window, place, change } = setup();
    place();
    window[state].mockReturnValue(true);
    change({ x: 9, y: 9, height: 14, hidden: false });
    expect(window.setWindowButtonPosition).toHaveBeenCalledTimes(1);
    window[state].mockReturnValue(false);
    change({ x: 9, y: 9, height: 14, hidden: false });
    expect(window.setWindowButtonPosition).toHaveBeenCalledTimes(2);
  },
);

it('releases the native observer when the window closes', () => {
  const { window, place, native } = setup();
  place();
  window.emit('closed');
  expect(native.stop).toHaveBeenCalledTimes(1);
  expect(window.listenerCount('closed')).toBe(0);
});

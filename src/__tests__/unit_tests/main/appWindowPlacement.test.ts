/** @jest-environment node */
import type { BrowserWindow } from 'electron';

const AREA = { x: 0, y: 0, width: 2560, height: 1392 };
const APP = { x: 120, y: 100, width: 1600, height: 1000 };
const AMP = { x: 800, y: 200, width: 480, height: 900 };

jest.mock('electron', () => ({
  screen: { getDisplayMatching: () => ({ workArea: AREA }) },
}));

// eslint-disable-next-line import/first -- install the native screen boundary first
import { appPlacementFromWindow } from '../../../main/appWindowPlacement';

const windowAtApp = () => ({
  getBounds: () => APP,
  getNormalBounds: () => APP,
  isMaximized: () => false,
  isMinimized: () => false,
  isVisible: () => true,
});

it('saves the normal app rectangle when the window is maximized', () => {
  const win = {
    ...windowAtApp(),
    getBounds: () => AREA,
    isMaximized: () => true,
  };
  expect(appPlacementFromWindow(win as unknown as BrowserWindow, {})).toEqual({
    ...APP,
    isMaximized: true,
  });
});

it('keeps the last app placement if Windows still reports amp-sized normal bounds', () => {
  const win = {
    ...windowAtApp(),
    getBounds: () => AREA,
    getNormalBounds: () => AMP,
    isMaximized: () => true,
  };
  expect(appPlacementFromWindow(win as unknown as BrowserWindow, APP)).toEqual({
    ...APP,
    isMaximized: true,
  });
});

it.each([
  ['a hidden startup', { isVisible: () => false }],
  ['a minimized window', { isMinimized: () => true }],
])('keeps saved maximization for %s', (_description, state) => {
  const win = { ...windowAtApp(), ...state };
  expect(
    appPlacementFromWindow(win as unknown as BrowserWindow, {
      ...APP,
      isMaximized: true,
    }),
  ).toEqual({ ...APP, isMaximized: true });
});

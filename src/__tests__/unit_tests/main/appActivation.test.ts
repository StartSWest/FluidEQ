/** @jest-environment node */
/* FluidEQ — GPL-3.0-or-later */

import type { BrowserWindow } from 'electron';
import createAppActivation from '../../../main/appActivation';

jest.mock('electron', () => ({
  app: {},
  nativeImage: {},
  Menu: {},
  Tray: jest.fn(),
}));

const setup = () => {
  const calls: string[] = [];
  const window = {
    isDestroyed: jest.fn(() => false),
    isMinimized: jest.fn(() => false),
    restore: jest.fn(() => calls.push('restore')),
    show: jest.fn(() => calls.push('show')),
    focus: jest.fn(() => calls.push('focus')),
  };
  let current: BrowserWindow | null = window as unknown as BrowserWindow;
  const createMainWindow = jest.fn(async () => {
    current = window as unknown as BrowserWindow;
  });
  const activate = createAppActivation({
    getMainWindow: () => current,
    createMainWindow,
  });
  return {
    window,
    calls,
    activate,
    createMainWindow,
    setWindow: (next: typeof current) => {
      current = next;
    },
  };
};

it('shows and focuses a hidden, existing window instead of waiting for it to become null', async () => {
  const { activate, createMainWindow, calls } = setup();
  await activate();
  expect(calls).toEqual(['show', 'focus']);
  expect(createMainWindow).not.toHaveBeenCalled();
});

it('restores a minimized window before showing it', async () => {
  const { activate, window, calls, createMainWindow } = setup();
  window.isMinimized.mockReturnValue(true);
  await activate();
  expect(calls).toEqual(['restore', 'show', 'focus']);
  expect(createMainWindow).not.toHaveBeenCalled();
});

it('recreates a genuinely closed main window, then reveals it', async () => {
  const { activate, createMainWindow, setWindow, calls } = setup();
  setWindow(null);
  await activate();
  expect(createMainWindow).toHaveBeenCalledTimes(1);
  expect(calls).toEqual(['show', 'focus']);
});

it('recreates a destroyed window instead of trying to show its stale handle', async () => {
  const { activate, window, createMainWindow, setWindow, calls } = setup();
  window.isDestroyed.mockReturnValue(true);
  createMainWindow.mockImplementation(async () => {
    setWindow(null);
  });
  await activate();
  expect(createMainWindow).toHaveBeenCalledTimes(1);
  expect(calls).toEqual([]);
});

it('coalesces repeated Dock clicks while a replacement window is loading', async () => {
  const { activate, window, createMainWindow, setWindow, calls } = setup();
  setWindow(null);
  let finish: () => void = () => undefined;
  createMainWindow.mockImplementation(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
  );
  const first = activate();
  // The factory publishes the native window before its page finishes loading.
  setWindow(window as unknown as BrowserWindow);
  const second = activate();
  expect(createMainWindow).toHaveBeenCalledTimes(1);
  expect(calls).toEqual([]);
  finish();
  await Promise.all([first, second]);
  expect(window.show).toHaveBeenCalled();
  expect(window.focus).toHaveBeenCalled();
});

it('allows another Dock click to retry a failed creation', async () => {
  const { activate, createMainWindow, setWindow, calls } = setup();
  setWindow(null);
  createMainWindow.mockRejectedValueOnce(new Error('Renderer unavailable'));
  await expect(activate()).rejects.toThrow('Renderer unavailable');
  await activate();
  expect(createMainWindow).toHaveBeenCalledTimes(2);
  expect(calls).toEqual(['show', 'focus']);
});

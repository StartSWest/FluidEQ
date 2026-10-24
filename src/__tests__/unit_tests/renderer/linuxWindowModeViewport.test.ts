/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { IWindowState } from '../../../common/windowMode';

jest.mock('react', () => ({
  useSyncExternalStore: (
    subscribe: (listener: () => void) => () => void,
    read: () => unknown,
  ) => {
    subscribe(() => undefined);
    return read();
  },
}));

it.each(['linux', 'win32'] as const)(
  'on %s, uses the right layout while the native resize reaches the viewport',
  async (platform) => {
    jest.resetModules();
    window.history.replaceState({}, '', '/');
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      value: 1200,
    });
    Object.defineProperty(window, 'innerHeight', {
      configurable: true,
      value: 850,
    });
    let nativeState: Partial<IWindowState> = {
      mode: 'app',
      zoom: 1,
      contentSize: { width: 1200, height: 850 },
    };
    let announced: ((state: Partial<IWindowState>) => void) | undefined;
    let answer: ((mode: 'player') => void) | undefined;
    const answered = new Promise<'player'>((resolve) => {
      answer = resolve;
    });
    const requested = jest.fn(() => answered);
    Object.defineProperty(window, 'electron', {
      configurable: true,
      value: {
        platform,
        ipcRenderer: {
          on: (
            _channel: string,
            listener: (state: Partial<IWindowState>) => void,
          ) => {
            announced = listener;
            return () => undefined;
          },
          getWindowState: async () => nativeState,
          setWindowMode: requested,
          sendMessage: jest.fn(),
        },
      },
    });
    const store = jest.requireActual<
      typeof import('../../../renderer/player/windowModeStore')
    >('../../../renderer/player/windowModeStore');
    store.useWindowMode();
    const switching = store.setWindowMode('player');
    await Promise.resolve();
    nativeState = {
      mode: 'player',
      zoom: 1,
      contentSize: { width: 580, height: 850 },
    };
    // Main can announce the new mode while Chromium still has the wide
    // app viewport. Linux must not measure the player in that viewport.
    announced?.(nativeState);
    answer?.('player');
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    expect(store.useWindowMode().mode).toBe(
      platform === 'linux' ? 'app' : 'player',
    );
    Object.defineProperty(window, 'innerWidth', { value: 580 });
    window.dispatchEvent(new Event('resize'));
    await switching;
    expect(store.useWindowMode().mode).toBe('player');
    expect(requested).toHaveBeenCalledWith('player');
  },
);

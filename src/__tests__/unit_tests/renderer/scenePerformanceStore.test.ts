/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  readScenePerformance,
  resetScenePerformanceForTesting,
  setScenePerformance,
  subscribeScenePerformance,
} from '../../../renderer/utils/scenePerformanceStore';
import { forgetSettings } from '../../../renderer/utils/settingsReset';

const KEY = 'fluideq.scenePerformance';
const STANDARD_KEY = 'fluideq.standardPerformance';

const withBridge = (setScene: jest.Mock) => {
  Object.defineProperty(window, 'electron', {
    configurable: true,
    value: { ipcRenderer: { setScenePerformance: setScene } },
  });
};

describe('the visualizer drawing store', () => {
  afterEach(() => {
    window.localStorage.removeItem(KEY);
    window.localStorage.removeItem(STANDARD_KEY);
    delete (window as { electron?: unknown }).electron;
    resetScenePerformanceForTesting();
  });

  it('answers the display rate and Auto on a fresh install, for both groups', () => {
    resetScenePerformanceForTesting();
    expect(readScenePerformance()).toEqual({
      frameRate: 'display',
      quality: 'auto',
    });
    expect(readScenePerformance('standard')).toEqual({
      frameRate: 'display',
      quality: 'auto',
    });
  });

  it('keeps a change on this computer and tells its listeners', () => {
    const listener = jest.fn();
    const unsubscribe = subscribeScenePerformance(listener);
    setScenePerformance({ quality: 'balanced' });
    expect(listener).toHaveBeenCalledTimes(1);
    expect(readScenePerformance()).toEqual({
      frameRate: 'display',
      quality: 'balanced',
    });
    expect(JSON.parse(window.localStorage.getItem(KEY) ?? '{}')).toEqual({
      frameRate: 'display',
      quality: 'balanced',
    });
    // The same value again is not a change.
    setScenePerformance({ quality: 'balanced' });
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
  });

  /** Saved before the three existed: kept in the words it stood for. */
  it('reads a choice saved before Auto, Balanced and Full as the one it stood for', () => {
    window.localStorage.setItem(
      KEY,
      JSON.stringify({
        frameRate: 'sixty',
        resolution: 'performance',
        autoFloor: 0.35,
        upscaler: 'fsr',
        smoothing: 'best',
      }),
    );
    window.localStorage.setItem(
      STANDARD_KEY,
      JSON.stringify({
        frameRate: 'display',
        resolution: 'native',
        autoFloor: 0.35,
        upscaler: 'simple',
        smoothing: 'off',
      }),
    );
    resetScenePerformanceForTesting();
    expect(readScenePerformance('plus')).toEqual({
      frameRate: 'sixty',
      quality: 'balanced',
    });
    expect(readScenePerformance('standard')).toEqual({
      frameRate: 'display',
      quality: 'full',
    });
  });

  it('remembers every Standard choice across reloads without changing Plus or the desktop', () => {
    const setScene = jest.fn();
    withBridge(setScene);
    const plus = readScenePerformance('plus');
    const standard = { frameRate: 'thirty', quality: 'balanced' } as const;
    setScenePerformance(standard, 'standard');
    expect(setScene).toHaveBeenCalledTimes(1);
    expect(setScene).toHaveBeenLastCalledWith(plus);
    expect(readScenePerformance('plus')).toEqual(plus);
    resetScenePerformanceForTesting();
    expect(readScenePerformance('standard')).toEqual(standard);
    setScenePerformance({ frameRate: 'sixty', quality: 'full' }, 'plus');
    expect(readScenePerformance('standard')).toEqual(standard);
    expect(readScenePerformance('plus')).toEqual({
      frameRate: 'sixty',
      quality: 'full',
    });
  });

  it('comes back from storage, repaired', () => {
    window.localStorage.setItem(
      KEY,
      JSON.stringify({ frameRate: 'sixty', quality: 'nonsense' }),
    );
    window.localStorage.setItem(
      STANDARD_KEY,
      JSON.stringify({ frameRate: 'nonsense', quality: 'full' }),
    );
    resetScenePerformanceForTesting();
    expect(readScenePerformance()).toEqual({
      frameRate: 'sixty',
      quality: 'auto',
    });
    expect(readScenePerformance('standard')).toEqual({
      frameRate: 'display',
      quality: 'full',
    });
    window.localStorage.setItem(KEY, '{not json');
    resetScenePerformanceForTesting();
    expect(readScenePerformance()).toEqual({
      frameRate: 'display',
      quality: 'auto',
    });
  });

  /** The desktop's pages have no store of their own: main is told, once and on every change. */
  it('resets both drawing groups through Reset all settings and sends Plus defaults to the desktop after reload', () => {
    const setScene = jest.fn();
    withBridge(setScene);
    setScenePerformance({ quality: 'full' }, 'plus');
    setScenePerformance(
      { quality: 'balanced', frameRate: 'sixty' },
      'standard',
    );

    forgetSettings(window.localStorage);
    expect(window.localStorage.getItem(KEY)).toBeNull();
    expect(window.localStorage.getItem(STANDARD_KEY)).toBeNull();
    // The dialog reloads the window after forgetting settings.
    resetScenePerformanceForTesting();
    expect(readScenePerformance('standard')).toEqual({
      frameRate: 'display',
      quality: 'auto',
    });
    expect(readScenePerformance('plus')).toEqual({
      frameRate: 'display',
      quality: 'auto',
    });
    expect(setScene).toHaveBeenLastCalledWith(readScenePerformance('plus'));
  });

  it('tells main the choice on first read and on every change', () => {
    const setScene = jest.fn();
    withBridge(setScene);
    resetScenePerformanceForTesting();
    readScenePerformance();
    readScenePerformance();
    expect(setScene).toHaveBeenCalledTimes(1);
    expect(setScene).toHaveBeenLastCalledWith({
      frameRate: 'display',
      quality: 'auto',
    });
    setScenePerformance({ quality: 'full' });
    expect(setScene).toHaveBeenCalledTimes(2);
    expect(setScene).toHaveBeenLastCalledWith({
      frameRate: 'display',
      quality: 'full',
    });
  });
});

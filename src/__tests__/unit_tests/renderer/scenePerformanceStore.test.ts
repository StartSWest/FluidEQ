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

describe('the visualizer performance store', () => {
  afterEach(() => {
    window.localStorage.removeItem(KEY);
    window.localStorage.removeItem(STANDARD_KEY);
    delete (window as { electron?: unknown }).electron;
    resetScenePerformanceForTesting();
  });

  it('answers the defaults on a fresh install', () => {
    resetScenePerformanceForTesting();
    expect(readScenePerformance()).toEqual({
      frameRate: 'display',
      resolution: 'auto',
      autoFloor: 0.35,
      upscaler: 'fsr',
      smoothing: 'best',
    });
  });

  it('keeps a change on this computer and tells its listeners', () => {
    const listener = jest.fn();
    const unsubscribe = subscribeScenePerformance(listener);
    setScenePerformance({ frameRate: 'thirty' });
    expect(listener).toHaveBeenCalledTimes(1);
    expect(readScenePerformance()).toEqual({
      frameRate: 'thirty',
      resolution: 'auto',
      autoFloor: 0.35,
      upscaler: 'fsr',
      smoothing: 'best',
    });
    expect(JSON.parse(window.localStorage.getItem(KEY) ?? '{}')).toEqual({
      frameRate: 'thirty',
      resolution: 'auto',
      autoFloor: 0.35,
      upscaler: 'fsr',
      smoothing: 'best',
    });
    // The same value again is not a change.
    setScenePerformance({ frameRate: 'thirty' });
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
  });

  it('starts Standard at full size without FSR or smoothing, independently of saved Plus choices', () => {
    window.localStorage.setItem(
      KEY,
      JSON.stringify({ resolution: 'performance', smoothing: 'best' }),
    );
    resetScenePerformanceForTesting();
    expect(readScenePerformance('standard')).toEqual({
      frameRate: 'display',
      resolution: 'native',
      autoFloor: 0.35,
      upscaler: 'simple',
      smoothing: 'off',
    });
    expect(readScenePerformance('plus')).toMatchObject({
      resolution: 'performance',
      smoothing: 'best',
    });
  });

  it('remembers every Standard choice across reloads without changing Plus or the desktop', () => {
    const setScene = jest.fn();
    withBridge(setScene);
    const plus = readScenePerformance('plus');
    const standard = {
      frameRate: 'thirty',
      resolution: 'balanced',
      autoFloor: 0.85,
      upscaler: 'fsr',
      smoothing: 'best',
    } as const;
    setScenePerformance(standard, 'standard');
    expect(setScene).toHaveBeenCalledTimes(1);
    expect(setScene).toHaveBeenLastCalledWith(plus);
    expect(readScenePerformance('plus')).toEqual(plus);
    resetScenePerformanceForTesting();
    expect(readScenePerformance('standard')).toEqual(standard);
    setScenePerformance({ frameRate: 'sixty', smoothing: 'off' }, 'plus');
    expect(readScenePerformance('standard')).toEqual(standard);
    expect(readScenePerformance('plus')).toMatchObject({
      frameRate: 'sixty',
      smoothing: 'off',
    });
  });

  it('repairs damaged Standard settings using Standard defaults', () => {
    window.localStorage.setItem(
      STANDARD_KEY,
      JSON.stringify({ frameRate: 'sixty', smoothing: 'invalid' }),
    );
    resetScenePerformanceForTesting();
    expect(readScenePerformance('standard')).toEqual({
      frameRate: 'sixty',
      resolution: 'native',
      autoFloor: 0.35,
      upscaler: 'simple',
      smoothing: 'off',
    });
    window.localStorage.setItem(STANDARD_KEY, '{not json');
    resetScenePerformanceForTesting();
    expect(readScenePerformance('standard')).toMatchObject({
      frameRate: 'display',
      resolution: 'native',
      upscaler: 'simple',
      smoothing: 'off',
    });
  });

  it('comes back from storage, repaired', () => {
    window.localStorage.setItem(
      KEY,
      JSON.stringify({ frameRate: 'sixty', resolution: 'nonsense' }),
    );
    resetScenePerformanceForTesting();
    expect(readScenePerformance()).toEqual({
      frameRate: 'sixty',
      resolution: 'auto',
      autoFloor: 0.35,
      upscaler: 'fsr',
      smoothing: 'best',
    });
    window.localStorage.setItem(KEY, '{not json');
    resetScenePerformanceForTesting();
    expect(readScenePerformance()).toEqual({
      frameRate: 'display',
      resolution: 'auto',
      autoFloor: 0.35,
      upscaler: 'fsr',
      smoothing: 'best',
    });
  });

  /** The desktop's pages have no store of their own: main is told, once and on every change. */
  it('resets both drawing groups through Reset all settings and sends Plus defaults to the desktop after reload', () => {
    const setScene = jest.fn();
    withBridge(setScene);
    setScenePerformance(
      { resolution: 'performance', smoothing: 'off' },
      'plus',
    );
    setScenePerformance(
      { resolution: 'quality', smoothing: 'best', upscaler: 'fsr' },
      'standard',
    );

    forgetSettings(window.localStorage);
    expect(window.localStorage.getItem(KEY)).toBeNull();
    expect(window.localStorage.getItem(STANDARD_KEY)).toBeNull();
    // The dialog reloads the window after forgetting settings.
    resetScenePerformanceForTesting();
    expect(readScenePerformance('standard')).toEqual({
      frameRate: 'display',
      resolution: 'native',
      autoFloor: 0.35,
      upscaler: 'simple',
      smoothing: 'off',
    });
    expect(readScenePerformance('plus')).toEqual({
      frameRate: 'display',
      resolution: 'auto',
      autoFloor: 0.35,
      upscaler: 'fsr',
      smoothing: 'best',
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
      resolution: 'auto',
      autoFloor: 0.35,
      upscaler: 'fsr',
      smoothing: 'best',
    });
    setScenePerformance({ resolution: 'native' });
    expect(setScene).toHaveBeenCalledTimes(2);
    expect(setScene).toHaveBeenLastCalledWith({
      frameRate: 'display',
      resolution: 'native',
      autoFloor: 0.35,
      upscaler: 'fsr',
      smoothing: 'best',
    });
  });
});

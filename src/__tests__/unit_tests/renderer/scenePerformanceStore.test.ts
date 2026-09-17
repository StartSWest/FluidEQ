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

const KEY = 'fluideq.scenePerformance';

const withBridge = (setScene: jest.Mock) => {
  Object.defineProperty(window, 'electron', {
    configurable: true,
    value: { ipcRenderer: { setScenePerformance: setScene } },
  });
};

describe('the visualizer performance store', () => {
  afterEach(() => {
    window.localStorage.removeItem(KEY);
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
      smoothing: 'fast',
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
      smoothing: 'fast',
    });
    expect(JSON.parse(window.localStorage.getItem(KEY) ?? '{}')).toEqual({
      frameRate: 'thirty',
      resolution: 'auto',
      autoFloor: 0.35,
      upscaler: 'fsr',
      smoothing: 'fast',
    });
    // The same value again is not a change.
    setScenePerformance({ frameRate: 'thirty' });
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
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
      smoothing: 'fast',
    });
    window.localStorage.setItem(KEY, '{not json');
    resetScenePerformanceForTesting();
    expect(readScenePerformance()).toEqual({
      frameRate: 'display',
      resolution: 'auto',
      autoFloor: 0.35,
      upscaler: 'fsr',
      smoothing: 'fast',
    });
  });

  /** The desktop's pages have no store of their own: main is told, once and on every change. */
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
      smoothing: 'fast',
    });
    setScenePerformance({ resolution: 'native' });
    expect(setScene).toHaveBeenCalledTimes(2);
    expect(setScene).toHaveBeenLastCalledWith({
      frameRate: 'display',
      resolution: 'native',
      autoFloor: 0.35,
      upscaler: 'fsr',
      smoothing: 'fast',
    });
  });
});

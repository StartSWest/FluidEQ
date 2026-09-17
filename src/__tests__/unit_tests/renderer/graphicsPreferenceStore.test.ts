/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  readGraphicsPreference,
  resetGraphicsPreferenceForTesting,
  setGraphicsPreference,
  subscribeGraphicsPreference,
} from '../../../renderer/utils/graphicsPreferenceStore';

const flush = () =>
  new Promise<void>((resolve) => {
    queueMicrotask(resolve);
  });

describe('the graphics card choice, as the window sees it', () => {
  afterEach(() => {
    delete (window as { electron?: unknown }).electron;
    resetGraphicsPreferenceForTesting();
  });

  it('means nothing until main has answered, and asks main once', async () => {
    const graphicsPreference = jest.fn(async () => ({
      chosen: 'high',
      atLaunch: 'auto',
      supported: true,
    }));
    Object.defineProperty(window, 'electron', {
      configurable: true,
      value: { ipcRenderer: { graphicsPreference } },
    });
    expect(readGraphicsPreference()).toEqual({
      chosen: 'auto',
      atLaunch: 'auto',
      supported: false,
    });
    readGraphicsPreference();
    await flush();
    expect(graphicsPreference).toHaveBeenCalledTimes(1);
    expect(readGraphicsPreference()).toEqual({
      chosen: 'high',
      atLaunch: 'auto',
      supported: true,
    });
  });

  it('shows what main saved and tells its listeners', async () => {
    const setGraphics = jest.fn(async (gpu: string) => ({
      chosen: gpu,
      atLaunch: 'auto',
      supported: true,
    }));
    Object.defineProperty(window, 'electron', {
      configurable: true,
      value: {
        ipcRenderer: {
          graphicsPreference: jest.fn(async () => ({
            chosen: 'auto',
            atLaunch: 'auto',
            supported: true,
          })),
          setGraphicsPreference: setGraphics,
        },
      },
    });
    const listener = jest.fn();
    subscribeGraphicsPreference(listener);
    await flush();
    setGraphicsPreference('high');
    await flush();
    expect(setGraphics).toHaveBeenCalledWith('high');
    expect(readGraphicsPreference().chosen).toBe('high');
    expect(listener).toHaveBeenCalled();
  });

  it('stays at nothing where the window has no bridge', async () => {
    expect(readGraphicsPreference().supported).toBe(false);
    setGraphicsPreference('high');
    await flush();
    expect(readGraphicsPreference().chosen).toBe('auto');
  });
});

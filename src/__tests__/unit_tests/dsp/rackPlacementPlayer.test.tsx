/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The Library player's side of where the rack runs: its own copy stands aside
 * while the FluidEQ Engine is off, and it says when it is playing so the
 * engine's copy can stand aside for it.
 */

import { act, renderHook, waitFor } from '@testing-library/react';
import { DSP_DEFAULTS, type IDspSettings } from 'common/dsp/chain';
import { encodeChainSettings } from 'common/dsp/chainWire';
import type {
  INativeBackendBridge,
  INativeBackendController,
} from 'renderer/dsp/nativeBackend';
import { readRackGate, resetRackGate } from 'renderer/dsp/rackPlacement';
import {
  readDspOutputSafetyEnabled,
  setDspNativeState,
  setDspRackGate,
} from 'renderer/dsp/store';
import {
  useNativeBackend,
  useNativeMirror,
} from 'renderer/dsp/useNativeBackend';

let hostChains: number[][];

const installHost = () => {
  const yes = () => Promise.resolve(true);
  const bridge: INativeBackendBridge = {
    startDspHost: () => Promise.resolve({ state: 'ready' }),
    stopDspHost: () => Promise.resolve({ state: 'stopped' }),
    openDspHostDevice: yes,
    closeDspHostDevice: yes,
    applyDspHostChain: (values) => {
      hostChains.push([...values]);
      return Promise.resolve(true);
    },
    loadDspHostDeck: yes,
    playDspHost: yes,
    pauseDspHost: yes,
    seekDspHostDeck: yes,
    selectDspHostDeck: yes,
    unloadDspHostDeck: yes,
    crossfadeDspHost: yes,
    setDspHostTrackGains: yes,
    setDspHostCrossfadeTable: yes,
    setDspHostVolume: yes,
    setDspHostNoiseProfile: yes,
  };
  (window as unknown as { electron?: { ipcRenderer?: unknown } }).electron = {
    ipcRenderer: bridge,
  };
};

const settings: IDspSettings = {
  ...DSP_DEFAULTS,
  enabled: true,
  maximizer: { ...DSP_DEFAULTS.maximizer, enabled: true },
};

const encoded = (of: IDspSettings) =>
  encodeChainSettings(of, {
    outputSafetyEnabled: readDspOutputSafetyEnabled(),
  });

beforeEach(() => {
  hostChains = [];
  resetRackGate();
  installHost();
  act(() => setDspNativeState('idle'));
});

afterEach(() => {
  act(() => setDspNativeState('idle'));
  delete (window as unknown as { electron?: unknown }).electron;
});

/** What the host holds now: the last chain it was handed. */
const hostHolds = () => hostChains[hostChains.length - 1];

describe('the player’s copy of the rack', () => {
  it('stands aside while FluidEQ is switched off, and comes back after', async () => {
    act(() => setDspRackGate({ engine: 'fluid' }));
    renderHook(() => useNativeBackend(settings));
    // Positive control: engaged with the rack as the page has it.
    await waitFor(() => expect(hostHolds()).toEqual(encoded(settings)));

    act(() => setDspRackGate({ eqEnabled: false }));
    await waitFor(() =>
      expect(hostHolds()).toEqual(encoded({ ...settings, enabled: false })),
    );

    act(() => setDspRackGate({ eqEnabled: true }));
    await waitFor(() => expect(hostHolds()).toEqual(encoded(settings)));
  });

  it('never holds the rack while the engine is not running', async () => {
    act(() => setDspRackGate({ engine: 'fluid', engineOff: true }));
    renderHook(() => useNativeBackend(settings));
    await waitFor(() => expect(hostChains.length).toBeGreaterThan(0));
    // Not merely the last one: the host must not be engaged with the rack
    // and have it taken away afterwards.
    hostChains.forEach((chain) =>
      expect(chain).toEqual(encoded({ ...settings, enabled: false })),
    );
  });

  it('keeps its rack under Equalizer APO with FluidEQ switched off', async () => {
    act(() => setDspRackGate({ engine: 'apo', eqEnabled: false }));
    renderHook(() => useNativeBackend(settings));
    await waitFor(() => expect(hostChains.length).toBeGreaterThan(0));
    hostChains.forEach((chain) => expect(chain).toEqual(encoded(settings)));
  });
});

describe('the player saying it is the sound', () => {
  const controller = {
    transport: {
      load: () => Promise.resolve(true),
      unload: () => Promise.resolve(true),
      play: () => Promise.resolve(true),
      pause: () => Promise.resolve(true),
      seek: () => Promise.resolve(true),
      select: () => Promise.resolve(true),
      crossfade: () => Promise.resolve(true),
      setCrossfadeTable: () => Promise.resolve(true),
      setTrackGains: () => Promise.resolve(true),
      setNoiseProfile: () => Promise.resolve(true),
      setVolume: () => Promise.resolve(true),
    },
  } as unknown as INativeBackendController;
  const state = (isPlaying: boolean) => ({
    mediaPath: 'C:/music/track.flac',
    isPlaying,
    positionMs: 0,
    volume: 1,
  });

  it('while it plays through its own engine, and not after', () => {
    const { rerender, unmount } = renderHook(
      ({ playing }: { playing: boolean }) =>
        useNativeMirror(controller, [], state(playing)),
      { initialProps: { playing: true } },
    );
    expect(readRackGate().libraryAudible).toBe(true);

    rerender({ playing: false });
    expect(readRackGate().libraryAudible).toBe(false);

    rerender({ playing: true });
    expect(readRackGate().libraryAudible).toBe(true);
    unmount();
    expect(readRackGate().libraryAudible).toBe(false);
  });

  it('not while it plays through its media elements', () => {
    // A host that failed leaves the elements audible with no rack of their
    // own, so the engine must keep its copy.
    renderHook(() => useNativeMirror(undefined, [], state(true)));
    expect(readRackGate().libraryAudible).toBe(false);
  });
});

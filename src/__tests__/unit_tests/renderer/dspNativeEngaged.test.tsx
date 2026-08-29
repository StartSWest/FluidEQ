/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * What the TypeScript chain stands down for, and what it must not stand down
 * for.
 *
 * This covers one defect, and it is the defect that made shipping the native
 * engine as the default unsafe. The worklet was told to stand down whenever the
 * native backend was SELECTED, which is the same thing as it running right up
 * until the host fails to start — and then it is the opposite. A missing
 * binary, an unsupported platform, a spawn that is refused: each leaves the
 * selection at `native`, the host absent, and the worklet standing down for an
 * engine that is not there. The whole rack is bypassed and the user hears their
 * track with no EQ, no compressor and no limiter, with nothing on screen to say
 * why.
 *
 * It was invisible while the switch was a development toy, because a developer
 * who notices flips it back. It becomes every user's experience the moment the
 * default changes, which is what this file exists to prevent.
 */
import { act, renderHook, waitFor } from '@testing-library/react';
import {
  INativeBackendBridge,
  createNativeBackendController,
} from '../../../renderer/dsp/nativeBackend';
import { useNativeBackend } from '../../../renderer/dsp/useNativeBackend';
import {
  readDspNativeEngaged,
  readDspNativeState,
  setDspNativeState,
} from '../../../renderer/dsp/store';
import { DSP_DEFAULTS } from '../../../common/dsp/chain';

/** A bridge that answers everything, with `startDspHost` left to the caller. */
const bridgeWith = (
  startDspHost: INativeBackendBridge['startDspHost'],
): INativeBackendBridge => {
  const yes = () => Promise.resolve(true);
  return {
    startDspHost,
    stopDspHost: () => Promise.resolve({ state: 'stopped' }),
    openDspHostDevice: yes,
    closeDspHostDevice: yes,
    applyDspHostChain: yes,
    loadDspHostDeck: yes,
    playDspHost: yes,
    pauseDspHost: yes,
    seekDspHostDeck: yes,
    selectDspHostDeck: yes,
    unloadDspHostDeck: yes,
    crossfadeDspHost: yes,
    setDspHostTrackGains: yes,
    setDspHostVolume: yes,
  };
};

/**
 * The preload bridge, installed on `window` the way the hook reads it.
 *
 * `useNativeBackend` deliberately looks the bridge up through a widening rather
 * than taking it as an argument, because in the app there is exactly one and
 * threading it through the player would be a parameter that is never anything
 * else. That means a test has to put one where it looks.
 */
const installBridge = (bridge: INativeBackendBridge | undefined): void => {
  const target = window as unknown as { electron?: { ipcRenderer?: unknown } };
  if (!bridge) {
    delete target.electron;
    return;
  }
  target.electron = { ipcRenderer: bridge };
};

describe('what the TypeScript chain stands down for', () => {
  beforeEach(() => {
    setDspNativeState('idle');
    installBridge(undefined);
  });

  afterEach(() => {
    installBridge(undefined);
    setDspNativeState('idle');
  });

  it('reports engaged once the host has actually come up', async () => {
    installBridge(bridgeWith(() => Promise.resolve({ state: 'ready' })));

    renderHook(() => useNativeBackend(DSP_DEFAULTS));

    await waitFor(() => expect(readDspNativeEngaged()).toBe(true));
  });

  /**
   * The regression, and the reason for the whole file.
   *
   * A host that does not start must leave this false, because false is what
   * keeps the worklet processing. Selecting the native backend is not evidence
   * that anything native is running.
   */
  it('stays disengaged when the host cannot start, so the rack keeps running', async () => {
    installBridge(bridgeWith(() => Promise.resolve({ state: 'failed' })));

    renderHook(() => useNativeBackend(DSP_DEFAULTS));

    // Given time to get it wrong: the failure resolves a promise, so an
    // assertion on the next tick would pass before the answer had arrived.
    await waitFor(() => expect(readDspNativeEngaged()).toBe(false));
    await Promise.resolve();
    expect(readDspNativeEngaged()).toBe(false);
  });

  /** A rejection is a failure to start by another name. */
  it('stays disengaged when starting the host rejects', async () => {
    installBridge(bridgeWith(() => Promise.reject(new Error('no host'))));

    renderHook(() => useNativeBackend(DSP_DEFAULTS));

    await waitFor(() => expect(readDspNativeEngaged()).toBe(false));
  });

  /** No preload at all — the same answer, by a shorter route. */
  it('stays disengaged when there is no bridge to reach a host through', async () => {
    renderHook(() => useNativeBackend(DSP_DEFAULTS));

    await waitFor(() => expect(readDspNativeEngaged()).toBe(false));
  });

  /**
   * The positive control for the three checks above.
   *
   * Every one of them asserts `false`, which is also what a store that could
   * never be set would report, and what a hook that silently did nothing would
   * leave behind. This proves the flag is reachable in the first place, so
   * "still false" means the failure was handled rather than that nothing ran.
   */
  it('can be moved at all, so the assertions above mean something', () => {
    expect(readDspNativeEngaged()).toBe(false);
    setDspNativeState('engaged');
    expect(readDspNativeEngaged()).toBe(true);
    setDspNativeState('idle');
    expect(readDspNativeEngaged()).toBe(false);
  });

  /** Unmounting hands the audio back, whatever it was doing before. */
  it('disengages when the engine is torn down', async () => {
    installBridge(bridgeWith(() => Promise.resolve({ state: 'ready' })));

    const view = renderHook(() => useNativeBackend(DSP_DEFAULTS));
    await waitFor(() => expect(readDspNativeEngaged()).toBe(true));

    view.unmount();
    expect(readDspNativeEngaged()).toBe(false);
  });
});

describe('the controller behind it', () => {
  /**
   * `engage` reporting false is the fact the hook is built on, so it is worth
   * pinning here rather than only where it is consumed.
   */
  it('refuses to engage on a host that is not ready', async () => {
    const controller = createNativeBackendController(
      bridgeWith(() => Promise.resolve({ state: 'failed' })),
    );
    expect(await controller.engage(DSP_DEFAULTS, true)).toBe(false);
  });

  it('engages on a host that is', async () => {
    const controller = createNativeBackendController(
      bridgeWith(() => Promise.resolve({ state: 'ready' })),
    );
    expect(await controller.engage(DSP_DEFAULTS, true)).toBe(true);
  });
});

/**
 * Nothing may touch the host until it has finished coming up.
 *
 * Reported from a real listening session: switching to native went silent, and
 * only ever on the FIRST switch — after that it worked. That shape is the
 * signature of a race, not a broken feature.
 *
 * The controller was published the instant the effect assigned it, while
 * `engage` was still spawning the process, waiting for the handshake, pushing
 * the chain and opening the device. The mirror took that as its cue to mute the
 * elements and start issuing load, select and play at a host with no endpoint
 * open. The TypeScript chain had already stood down, so neither engine was
 * making sound. It only happened once because `disengage` leaves the process
 * running, so every later engage resolved fast enough to hide the window.
 */
describe('the controller is not handed out early', () => {
  beforeEach(() => {
    setDspNativeState('idle');
    installBridge(undefined);
  });

  afterEach(() => {
    installBridge(undefined);
    setDspNativeState('idle');
  });

  it('withholds the controller until the host has finished engaging', async () => {
    let release: (value: { state: string }) => void = () => undefined;
    const pending = new Promise<{ state: string }>((resolve) => {
      release = resolve;
    });
    installBridge(bridgeWith(() => pending));

    const view = renderHook(() => useNativeBackend(DSP_DEFAULTS));

    /**
     * The re-render is the whole reproduction, and leaving it out made this
     * test pass against the bug it was written for.
     *
     * `controllerRef` is assigned in the effect, and assigning a ref schedules
     * no render — so a hook that is never re-rendered keeps reporting the
     * `undefined` from its first pass whether the gate is there or not. The
     * defect only becomes visible when something else renders the tree while
     * `engage` is still in flight, which in the running app is guaranteed:
     * `LibraryPlayerContext` re-renders on every position tick, four times a
     * second, and the mirror is built from whatever the hook returns then.
     */
    await Promise.resolve();
    view.rerender();
    expect(view.result.current).toBeUndefined();

    await act(async () => {
      release({ state: 'ready' });
      await pending;
    });

    // The positive control for the assertion above: if the controller were
    // never published at all, the first check would pass for the wrong reason.
    await waitFor(() => expect(view.result.current).toBeDefined());
  });

  /** A host that never becomes ready never gets a mirror at all. */
  it('never hands out a controller for a host that failed', async () => {
    installBridge(bridgeWith(() => Promise.resolve({ state: 'failed' })));

    const view = renderHook(() => useNativeBackend(DSP_DEFAULTS));

    await waitFor(() => expect(readDspNativeState()).toBe('failed'));
    expect(view.result.current).toBeUndefined();
  });
});

/**
 * Telling "has not tried yet" apart from "tried and failed".
 *
 * The boolean above cannot, and that is not a hypothetical: the engine lives
 * inside `LibraryPlayerProvider`, which only mounts once the Library has been
 * opened. Before that there is no host and no failure either, so a notice keyed
 * to `!engaged` would sit on screen announcing a broken audio engine on a
 * machine where nothing had been asked to start yet. `TDspEngineState` in the
 * same store carries a comment saying exactly this, because the boolean version
 * of THAT flag shipped and told users their audio had failed when it had not.
 */
describe('idle is not the same as failed', () => {
  beforeEach(() => {
    setDspNativeState('idle');
    installBridge(undefined);
  });

  afterEach(() => {
    installBridge(undefined);
    setDspNativeState('idle');
  });

  it('stays idle before anything has been attempted', () => {
    expect(readDspNativeState()).toBe('idle');
  });

  /** The state that earns the notice, and the only one that does. */
  it('reports failed when the host was asked for and did not arrive', async () => {
    installBridge(bridgeWith(() => Promise.resolve({ state: 'failed' })));

    renderHook(() => useNativeBackend(DSP_DEFAULTS));

    await waitFor(() => expect(readDspNativeState()).toBe('failed'));
  });

  /** A rejection is a host that did not arrive, by another route. */
  it('reports failed when starting the host rejects', async () => {
    installBridge(bridgeWith(() => Promise.reject(new Error('no host'))));

    renderHook(() => useNativeBackend(DSP_DEFAULTS));

    await waitFor(() => expect(readDspNativeState()).toBe('failed'));
  });

  /**
   * No preload is NOT a failure, and this is the case the three states exist
   * for. Nothing was attempted, so there is nothing for a user to act on and no
   * notice to show — a packaged app always has its preload, so this is a test
   * renderer or a window still coming up.
   */
  it('stays idle when there is no bridge, rather than crying failure', async () => {
    renderHook(() => useNativeBackend(DSP_DEFAULTS));

    await waitFor(() => expect(readDspNativeEngaged()).toBe(false));
    expect(readDspNativeState()).toBe('idle');
  });

  /** Engaging then tearing down returns to idle, not to failed. */
  it('returns to idle on teardown, so no notice is left behind', async () => {
    installBridge(bridgeWith(() => Promise.resolve({ state: 'ready' })));

    const view = renderHook(() => useNativeBackend(DSP_DEFAULTS));
    await waitFor(() => expect(readDspNativeState()).toBe('engaged'));

    view.unmount();
    expect(readDspNativeState()).toBe('idle');
  });
});

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
  setDspBackend,
  setDspNativeEngaged,
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
    setDspNativeEngaged(false);
    setDspBackend('typescript');
    installBridge(undefined);
  });

  afterEach(() => {
    installBridge(undefined);
    setDspBackend('typescript');
    setDspNativeEngaged(false);
  });

  it('reports engaged once the host has actually come up', async () => {
    installBridge(bridgeWith(() => Promise.resolve({ state: 'ready' })));
    setDspBackend('native');

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
    setDspBackend('native');

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
    setDspBackend('native');

    renderHook(() => useNativeBackend(DSP_DEFAULTS));

    await waitFor(() => expect(readDspNativeEngaged()).toBe(false));
  });

  /** No preload at all — the same answer, by a shorter route. */
  it('stays disengaged when there is no bridge to reach a host through', async () => {
    setDspBackend('native');

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
    setDspNativeEngaged(true);
    expect(readDspNativeEngaged()).toBe(true);
    setDspNativeEngaged(false);
    expect(readDspNativeEngaged()).toBe(false);
  });

  /** Unmounting hands the audio back, whatever it was doing before. */
  it('disengages when the engine is torn down', async () => {
    installBridge(bridgeWith(() => Promise.resolve({ state: 'ready' })));
    setDspBackend('native');

    const view = renderHook(() => useNativeBackend(DSP_DEFAULTS));
    await waitFor(() => expect(readDspNativeEngaged()).toBe(true));

    view.unmount();
    expect(readDspNativeEngaged()).toBe(false);
  });

  /** And so does switching back to the TypeScript engine on purpose. */
  it('disengages when the backend is switched away', async () => {
    installBridge(bridgeWith(() => Promise.resolve({ state: 'ready' })));
    setDspBackend('native');

    const view = renderHook(() => useNativeBackend(DSP_DEFAULTS));
    await waitFor(() => expect(readDspNativeEngaged()).toBe(true));

    // Inside `act`, because the store notifies a mounted hook synchronously
    // and React is entitled to complain about a render it did not schedule.
    act(() => setDspBackend('typescript'));
    view.rerender();
    await waitFor(() => expect(readDspNativeEngaged()).toBe(false));
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

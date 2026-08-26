/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { act, renderHook, waitFor } from '@testing-library/react';
import { DSP_DEFAULTS } from '../../../common/dsp/chain';
import { useDspEngine } from '../../../renderer/dsp/useDspEngine';

interface IFakeNode {
  connect: jest.Mock;
  disconnect: jest.Mock;
}

const node = (): IFakeNode => ({ connect: jest.fn(), disconnect: jest.fn() });

interface IHarness {
  source: IFakeNode;
  destination: IFakeNode;
  createMediaElementSource: jest.Mock;
  addModule: jest.Mock;
  resume: jest.Mock;
}

/**
 * Stand in for `window.AudioContext` and `AudioWorkletNode`.
 *
 * jsdom has neither, which is the reason the graph builder is typed
 * structurally in the first place. Installing fakes here lets the ordering
 * rules below — the ones that decide whether a player goes mute — be asserted
 * without a browser.
 */
const installAudio = (
  overrides: { addModuleFails?: boolean; resumeFails?: boolean } = {},
): IHarness => {
  const source = node();
  const destination = node();
  const createMediaElementSource = jest.fn(() => source);
  const addModule = jest.fn(() =>
    overrides.addModuleFails
      ? Promise.reject(new Error('module blocked'))
      : Promise.resolve(),
  );
  const resume = jest.fn(() =>
    overrides.resumeFails
      ? Promise.reject(new Error('not allowed to start'))
      : Promise.resolve(),
  );

  Object.defineProperty(window, 'AudioContext', {
    configurable: true,
    writable: true,
    value: jest.fn(() => ({
      sampleRate: 48_000,
      destination,
      audioWorklet: { addModule },
      // What Chrome hands back for a context built without a user gesture,
      // which is exactly the case the resume-on-play listener exists for.
      state: 'suspended',
      resume,
      createMediaElementSource,
      createGain: () => ({ ...node(), gain: { value: 1 } }),
      createWaveShaper: () => ({ ...node(), curve: null }),
      createBiquadFilter: () => ({
        ...node(),
        type: 'allpass',
        frequency: { value: 0 },
      }),
      createAnalyser: () => ({
        ...node(),
        fftSize: 0,
        smoothingTimeConstant: 0,
        frequencyBinCount: 1_024,
        getFloatFrequencyData: () => undefined,
      }),
    })),
  });
  Object.defineProperty(window, 'AudioWorkletNode', {
    configurable: true,
    writable: true,
    value: jest.fn(() => ({ ...node(), port: { postMessage: jest.fn() } })),
  });

  return { source, destination, createMediaElementSource, addModule, resume };
};

/**
 * Enough of an audio element to be listened to.
 *
 * `fire` replays whatever the hook registered, which is how the resume-on-play
 * behaviour is tested without a real media element or a real gesture.
 */
const element = () => {
  const listeners = new Map<string, (() => void)[]>();
  const fake = {
    addEventListener: (type: string, handler: () => void) => {
      listeners.set(type, [...(listeners.get(type) ?? []), handler]);
    },
    removeEventListener: (type: string, handler: () => void) => {
      listeners.set(
        type,
        (listeners.get(type) ?? []).filter((one) => one !== handler),
      );
    },
    fire: (type: string) => {
      (listeners.get(type) ?? []).forEach((handler) => handler());
    },
    listenerCount: (type: string) => (listeners.get(type) ?? []).length,
  };
  return fake as unknown as HTMLAudioElement & {
    fire: (type: string) => void;
    listenerCount: (type: string) => number;
  };
};

describe('useDspEngine', () => {
  let consoleError: jest.SpyInstance;

  beforeEach(() => {
    consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleError.mockRestore();
    Reflect.deleteProperty(window, 'AudioContext');
    Reflect.deleteProperty(window, 'AudioWorkletNode');
  });

  it('stays inactive when there is no element', () => {
    installAudio();
    const { result } = renderHook(() => useDspEngine([], DSP_DEFAULTS));
    expect(result.current.active).toBe(false);
  });

  it('never touches the element when Web Audio is unavailable', () => {
    const harness = installAudio();
    Reflect.deleteProperty(window, 'AudioContext');
    const { result } = renderHook(() =>
      useDspEngine([element()], DSP_DEFAULTS),
    );
    expect(result.current.active).toBe(false);
    expect(harness.createMediaElementSource).not.toHaveBeenCalled();
  });

  it('POSITIVE CONTROL: becomes active when everything succeeds', async () => {
    installAudio();
    const { result } = renderHook(() =>
      useDspEngine([element()], DSP_DEFAULTS),
    );
    await waitFor(() => expect(result.current.active).toBe(true));
  });

  /**
   * The ordering rule that keeps a failure from muting the player.
   *
   * `createMediaElementSource` cannot be undone — once called, the graph is
   * the element's only route to the speakers. So every step that can fail has
   * to run first, and these two tests are what hold that ordering in place.
   */
  it('leaves the element alone when the worklet module will not load', async () => {
    const harness = installAudio({ addModuleFails: true });
    const { result } = renderHook(() =>
      useDspEngine([element()], DSP_DEFAULTS),
    );
    await waitFor(() => expect(harness.addModule).toHaveBeenCalled());
    expect(result.current.active).toBe(false);
    expect(harness.createMediaElementSource).not.toHaveBeenCalled();
  });

  it('leaves the element alone when the context will not resume', async () => {
    const harness = installAudio({ resumeFails: true });
    const { result } = renderHook(() =>
      useDspEngine([element()], DSP_DEFAULTS),
    );
    await waitFor(() => expect(harness.resume).toHaveBeenCalled());
    expect(result.current.active).toBe(false);
    expect(harness.createMediaElementSource).not.toHaveBeenCalled();
  });

  /**
   * The safety net for the one step that cannot be ordered away.
   *
   * On unmount the graph goes, but the element is still captured — so it must
   * be wired straight to the destination or it plays into nothing.
   */
  it('routes the captured element straight out when torn down', async () => {
    const harness = installAudio();
    const { result, unmount } = renderHook(() =>
      useDspEngine([element()], DSP_DEFAULTS),
    );
    await waitFor(() => expect(result.current.active).toBe(true));
    act(() => unmount());
    expect(harness.source.connect).toHaveBeenLastCalledWith(
      harness.destination,
    );
  });

  it('captures the element only once across re-renders', async () => {
    const harness = installAudio();
    const target = element();
    const { result, rerender } = renderHook(
      ({ settings }) => useDspEngine([target], settings),
      { initialProps: { settings: DSP_DEFAULTS } },
    );
    await waitFor(() => expect(result.current.active).toBe(true));
    rerender({
      settings: {
        ...DSP_DEFAULTS,
        exciter: { ...DSP_DEFAULTS.exciter, enabled: true },
      },
    });
    expect(harness.createMediaElementSource).toHaveBeenCalledTimes(1);
  });

  /**
   * The restart bug.
   *
   * Reported as: after restarting the app, pressing play on the track that was
   * already loaded gave no sound and a transport that did not move, while
   * choosing a different track worked and returning to the first one then
   * worked too.
   *
   * The context is built during mount, before any user gesture exists, so
   * Chrome leaves it suspended and the `resume()` inside `start` has nothing
   * to act on. `createMediaElementSource` has by then captured the element,
   * and a captured element's only route to the speakers is the graph — so a
   * suspended graph stalls the element itself, which is why the seek froze
   * rather than simply running silently.
   */
  it('resumes a suspended context when playback starts', async () => {
    const harness = installAudio();
    const target = element();
    const { result } = renderHook(() => useDspEngine([target], DSP_DEFAULTS));
    await waitFor(() => expect(result.current.active).toBe(true));
    const beforePlay = harness.resume.mock.calls.length;

    act(() => target.fire('play'));

    expect(harness.resume.mock.calls.length).toBeGreaterThan(beforePlay);
  });

  it('stops listening for play once the engine is torn down', async () => {
    installAudio();
    const target = element();
    const { result, unmount } = renderHook(() =>
      useDspEngine([target], DSP_DEFAULTS),
    );
    await waitFor(() => expect(result.current.active).toBe(true));
    expect(target.listenerCount('play')).toBe(1);
    act(() => unmount());
    expect(target.listenerCount('play')).toBe(0);
  });
});

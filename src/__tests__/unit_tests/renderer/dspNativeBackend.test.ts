/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { DSP_DEFAULTS } from '../../../common/dsp/chain';
import { CHAIN_PARAM_LEAD } from '../../../common/dsp/chainWire';
import {
  INativeBackendBridge,
  createNativeBackendController,
} from '../../../renderer/dsp/nativeBackend';

/** A bridge that records the order it was called in, which is the point. */
const recordingBridge = (overrides: Partial<INativeBackendBridge> = {}) => {
  const calls: string[] = [];
  const record =
    <T>(name: string, result: T) =>
    (...args: unknown[]) => {
      // The first argument only when it is a scalar. `applyDspHostChain` takes
      // an array of a hundred-odd numbers, and a log line carrying all of them
      // is a diff nobody can read when the assertion fails.
      const first = args[0];
      calls.push(typeof first === 'number' ? `${name}(${first})` : name);
      return Promise.resolve(result);
    };
  const bridge: INativeBackendBridge = {
    startDspHost: record('start', { state: 'ready' }),
    stopDspHost: record('stop', { state: 'stopped' }),
    openDspHostDevice: record('open', true),
    closeDspHostDevice: record('close', true),
    applyDspHostChain: record('chain', true),
    loadDspHostDeck: record('load', true),
    playDspHost: record('play', true),
    pauseDspHost: record('pause', true),
    seekDspHostDeck: record('seek', true),
    selectDspHostDeck: record('select', true),
    unloadDspHostDeck: record('unload', true),
    crossfadeDspHost: record('crossfade', true),
    setDspHostTrackGains: record('gains', true),
    ...overrides,
  };
  return { bridge, calls };
};

describe('the native backend controller', () => {
  /**
   * The chain before the device, and it is an ordering rather than a taste.
   *
   * A device opened first has already produced a block by the time the chain
   * arrives, so the first thing a listener hears when they flip the switch is
   * the engine at defaults — flat, and for one buffer only, which is exactly
   * long enough to sound like a click and short enough to be unreproducible.
   */
  it('hands over the chain before it opens the device', async () => {
    const { bridge, calls } = recordingBridge();
    const controller = createNativeBackendController(bridge);

    expect(await controller.engage(DSP_DEFAULTS, true)).toBe(true);
    expect(calls).toEqual(['start', 'chain', 'open']);
  });

  it('sends the chain in the layout the host decodes', async () => {
    const sent: number[][] = [];
    const { bridge } = recordingBridge({
      applyDspHostChain: (values) => {
        sent.push([...values]);
        return Promise.resolve(true);
      },
    });
    const controller = createNativeBackendController(bridge);
    await controller.engage(DSP_DEFAULTS, true);

    expect(sent).toHaveLength(1);
    expect(sent[0].length).toBeGreaterThanOrEqual(CHAIN_PARAM_LEAD);
    expect(sent[0][CHAIN_PARAM_LEAD - 1]).toBe(DSP_DEFAULTS.eq.bands.length);
  });

  it('carries the output-safety A/B into the chain it sends', async () => {
    const sent: number[][] = [];
    const { bridge } = recordingBridge({
      applyDspHostChain: (values) => {
        sent.push([...values]);
        return Promise.resolve(true);
      },
    });
    const controller = createNativeBackendController(bridge);
    await controller.engage(DSP_DEFAULTS, false);

    expect(sent[0][1]).toBe(0);
  });

  describe('when the host will not come up', () => {
    /**
     * A failure has to stay a branch, not become a throw.
     *
     * The TypeScript chain is still there and still works, so the caller's
     * fallback should be an `if` rather than a `catch` — and the supervisor
     * has already reported the reason as a diagnostic.
     */
    it('reports false rather than throwing, and opens no device', async () => {
      const { bridge, calls } = recordingBridge({
        startDspHost: () => Promise.resolve({ state: 'failed' }),
      });
      const controller = createNativeBackendController(bridge);

      expect(await controller.engage(DSP_DEFAULTS, true)).toBe(false);
      expect(calls).not.toContain('open');
    });

    it('does not open a device when the chain was refused', async () => {
      const { bridge, calls } = recordingBridge({
        applyDspHostChain: () => Promise.resolve(false),
      });
      const controller = createNativeBackendController(bridge);

      expect(await controller.engage(DSP_DEFAULTS, true)).toBe(false);
      expect(calls).not.toContain('open');
    });
  });

  describe('disengaging', () => {
    /**
     * Both decks are emptied before the device closes.
     *
     * A deck still holding a track is a decoder thread still reading a file
     * and two seconds of audio still in a ring, for a backend nobody is
     * listening to. Switching back and forth without this leaves one of each
     * behind every time.
     */
    it('empties both decks, stops, and only then releases the endpoint', async () => {
      const { bridge, calls } = recordingBridge();
      const controller = createNativeBackendController(bridge);
      await controller.engage(DSP_DEFAULTS, true);
      calls.length = 0;

      await controller.disengage();

      expect(calls).toEqual(['unload(0)', 'unload(1)', 'pause', 'close']);
    });

    it('does nothing when it was never engaged', async () => {
      const { bridge, calls } = recordingBridge();
      const controller = createNativeBackendController(bridge);

      await controller.disengage();

      expect(calls).toEqual([]);
    });

    it('is idempotent, so a double switch does not close twice', async () => {
      const { bridge, calls } = recordingBridge();
      const controller = createNativeBackendController(bridge);
      await controller.engage(DSP_DEFAULTS, true);
      await controller.disengage();
      calls.length = 0;

      await controller.disengage();

      expect(calls).toEqual([]);
    });
  });

  describe('updating a knob', () => {
    it('pushes the chain again while engaged', async () => {
      const { bridge, calls } = recordingBridge();
      const controller = createNativeBackendController(bridge);
      await controller.engage(DSP_DEFAULTS, true);
      calls.length = 0;

      expect(await controller.update(DSP_DEFAULTS, true)).toBe(true);
      expect(calls).toEqual(['chain']);
    });

    /**
     * A knob turned while the switch is on TypeScript must not start a process.
     *
     * Without this, moving any control would spawn the host and open an audio
     * endpoint for an engine nobody selected — which wakes the DAC and puts
     * its noise floor into the room for no reason a user could name.
     */
    it('does nothing at all when the backend is not engaged', async () => {
      const { bridge, calls } = recordingBridge();
      const controller = createNativeBackendController(bridge);

      expect(await controller.update(DSP_DEFAULTS, true)).toBe(false);
      expect(calls).toEqual([]);
    });
  });

  it('passes the transport straight through', async () => {
    const { bridge, calls } = recordingBridge();
    const controller = createNativeBackendController(bridge);

    await controller.transport.load(1, 'C:/music/track.wav');
    await controller.transport.play();
    await controller.transport.seek(1, 12.5);
    await controller.transport.crossfade(0, 2000, 0);
    await controller.transport.setTrackGains(-6, 1.5);
    await controller.transport.pause();

    expect(calls).toEqual([
      'load(1)',
      'play',
      'seek(1)',
      'crossfade(0)',
      'gains(-6)',
      'pause',
    ]);
  });
});

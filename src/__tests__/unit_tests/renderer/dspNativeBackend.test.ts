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
    setDspHostCrossfadeTable: record('crossfadeTable', true),
    setDspHostVolume: record('volume', true),
    setDspHostNoiseProfile: record('noiseProfile', true),
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

    expect(await controller.engage(DSP_DEFAULTS)).toBe(true);
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
    await controller.engage(DSP_DEFAULTS);

    expect(sent).toHaveLength(1);
    expect(sent[0].length).toBeGreaterThanOrEqual(CHAIN_PARAM_LEAD);
    expect(sent[0][CHAIN_PARAM_LEAD - 1]).toBe(DSP_DEFAULTS.eq.bands.length);
  });

  describe('when the host will not come up', () => {
    /**
     * A failure has to stay a branch, not become a throw.
     *
     * Browser playback still works without the rack, so the caller handles this
     * as a branch and keeps the media elements audible. The supervisor has
     * already reported the reason as a diagnostic.
     */
    it('reports false rather than throwing, and opens no device', async () => {
      const { bridge, calls } = recordingBridge({
        startDspHost: () => Promise.resolve({ state: 'failed' }),
      });
      const controller = createNativeBackendController(bridge);

      expect(await controller.engage(DSP_DEFAULTS)).toBe(false);
      expect(calls).not.toContain('open');
    });

    it('does not open a device when the chain was refused', async () => {
      const { bridge, calls } = recordingBridge({
        applyDspHostChain: () => Promise.resolve(false),
      });
      const controller = createNativeBackendController(bridge);

      expect(await controller.engage(DSP_DEFAULTS)).toBe(false);
      expect(calls).not.toContain('open');
      expect(calls).toContain('stop');
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
      await controller.engage(DSP_DEFAULTS);
      calls.length = 0;

      await controller.disengage();

      expect(calls).toEqual([
        'unload(0)',
        'unload(1)',
        'pause',
        'close',
        'stop',
      ]);
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
      await controller.engage(DSP_DEFAULTS);
      await controller.disengage();
      calls.length = 0;

      await controller.disengage();

      expect(calls).toEqual([]);
    });

    it('still kills the process when an earlier cleanup step fails', async () => {
      const { bridge, calls } = recordingBridge({
        unloadDspHostDeck: () => Promise.reject(new Error('deck already gone')),
      });
      const controller = createNativeBackendController(bridge);
      await controller.engage(DSP_DEFAULTS);
      calls.length = 0;

      await controller.disengage();

      expect(calls).toContain('close');
      expect(calls).toContain('stop');
    });
  });

  describe('updating a knob', () => {
    it('pushes the chain again while engaged', async () => {
      const { bridge, calls } = recordingBridge();
      const controller = createNativeBackendController(bridge);
      await controller.engage(DSP_DEFAULTS);
      calls.length = 0;

      expect(await controller.update(DSP_DEFAULTS)).toBe(true);
      expect(calls).toEqual(['chain']);
    });

    /**
     * A settings update before engagement must not start a process.
     *
     * Without this, moving any control would spawn the host and open an audio
     * endpoint before the Library needs it — which wakes the DAC and puts its
     * noise floor into the room for no reason a user could name.
     */
    it('does nothing at all when the backend is not engaged', async () => {
      const { bridge, calls } = recordingBridge();
      const controller = createNativeBackendController(bridge);

      expect(await controller.update(DSP_DEFAULTS)).toBe(false);
      expect(calls).toEqual([]);
    });
  });

  /**
   * A speaker dragged round the Room asks for a push a frame, and preparing a
   * room costs the host up to a quarter of a second. Queued one behind
   * another, the sound went on walking the path of a pointer that had been
   * let go. One push is with the host, one waits holding the newest settings,
   * and nothing here is decided by a clock: every gate below is a promise the
   * test opens by hand.
   */
  describe('many updates while one is with the host', () => {
    /** A host whose answers wait to be given, in the order it was asked. */
    const gatedBridge = () => {
      const sizes: number[] = [];
      const gates: Array<(applied: boolean | Error) => void> = [];
      const { bridge, calls } = recordingBridge({
        applyDspHostChain: (values) => {
          // The room's size rides the chain, so it names which settings a
          // push carried: the third of the room's scalars.
          sizes.push(values[CHAIN_PARAM_LEAD - 45 + 2]);
          return new Promise<boolean>((resolve, reject) => {
            gates.push((applied) =>
              applied instanceof Error ? reject(applied) : resolve(applied),
            );
          });
        },
      });
      return { bridge, calls, sizes, gates };
    };
    const sized = (sizeM: number) => ({
      ...DSP_DEFAULTS,
      room: { ...DSP_DEFAULTS.room, sizeM },
    });
    /** Until the host has been asked `count` times, however many turns that is. */
    const asked = async (sizes: number[], count: number) => {
      while (sizes.length < count) {
        // eslint-disable-next-line no-await-in-loop -- each turn of the queue
        // is the thing being waited on; there is nothing to run in parallel.
        await Promise.resolve();
      }
    };
    const engaged = async () => {
      const gated = gatedBridge();
      const controller = createNativeBackendController(gated.bridge);
      const engaging = controller.engage(sized(3));
      await asked(gated.sizes, 1);
      gated.gates[0](true);
      expect(await engaging).toBe(true);
      return { ...gated, controller };
    };

    it('sends the first, then only the newest of everything asked meanwhile', async () => {
      const { controller, sizes, gates } = await engaged();
      const first = controller.update(sized(4));
      await asked(sizes, 2);
      // Blocked: the host has the first. Six more positions of the dial.
      const replaced = [5, 6, 7, 8, 9, 10].map((sizeM) =>
        controller.update(sized(sizeM)),
      );
      gates[1](true);
      expect(await first).toBe(true);
      await asked(sizes, 3);
      gates[2](true);
      // Every caller is answered by the push that carried its settings or
      // newer ones: true means the host holds a chain at least that new.
      expect(await Promise.all(replaced)).toEqual(Array(6).fill(true));
      // Engage's 3, the first 4, and the last 10. Nothing between.
      expect(sizes).toEqual([3, 4, 10]);
    });

    it('queues afresh once the waiting push has started, so the last value always goes', async () => {
      const { controller, sizes, gates } = await engaged();
      const first = controller.update(sized(4));
      await asked(sizes, 2);
      const second = controller.update(sized(5));
      gates[1](true);
      await first;
      await asked(sizes, 3);
      // The 5 is with the host now; a 6 asked here must not be lost in it.
      const third = controller.update(sized(6));
      gates[2](true);
      await second;
      await asked(sizes, 4);
      gates[3](true);
      expect(await third).toBe(true);
      expect(sizes).toEqual([3, 4, 5, 6]);
    });

    it('tells everyone who was waiting on a push that failed, and carries on', async () => {
      const { controller, sizes, gates } = await engaged();
      const first = controller.update(sized(4));
      await asked(sizes, 2);
      const waiting = [
        controller.update(sized(5)),
        controller.update(sized(6)),
      ];
      gates[1](true);
      await first;
      await asked(sizes, 3);
      gates[2](new Error('the host went away'));
      await expect(waiting[0]).rejects.toThrow('the host went away');
      await expect(waiting[1]).rejects.toThrow('the host went away');
      // Not wedged: the next update is sent like any other.
      const next = controller.update(sized(7));
      await asked(sizes, 4);
      gates[3](true);
      expect(await next).toBe(true);
      expect(sizes).toEqual([3, 4, 6, 7]);
    });

    /**
     * Disengage is a barrier. An update asked for after it must not slip into
     * a push that was queued before it — it belongs to the far side, where
     * the backend is no longer engaged and there is nothing to update.
     */
    it('lets nothing asked after a disengage be sent before it', async () => {
      const { controller, sizes, gates, calls } = await engaged();
      const first = controller.update(sized(4));
      await asked(sizes, 2);
      const waiting = controller.update(sized(5));
      const leaving = controller.disengage();
      const late = controller.update(sized(9));
      gates[1](true);
      await first;
      await asked(sizes, 3);
      gates[2](true);
      expect(await waiting).toBe(true);
      await leaving;
      expect(await late).toBe(false);
      expect(sizes).toEqual([3, 4, 5]);
      expect(calls.slice(-1)).toEqual(['stop']);
    });

    /**
     * Two controllers command one host, in the order they asked. The first
     * one's waiting push keeps its place ahead of the second's engage, and
     * nothing of the first's is sent once the second has taken over.
     */
    it('keeps its place against a second controller, and sends nothing stale after it', async () => {
      const { controller, bridge, sizes, gates } = await engaged();
      const first = controller.update(sized(4));
      await asked(sizes, 2);
      const waiting = controller.update(sized(5));
      const leaving = controller.disengage();
      const successor = createNativeBackendController(bridge);
      const taking = successor.engage(sized(11));
      const stale = controller.update(sized(8));
      gates[1](true);
      await first;
      await asked(sizes, 3);
      gates[2](true);
      await waiting;
      await leaving;
      await asked(sizes, 4);
      gates[3](true);
      expect(await taking).toBe(true);
      expect(await stale).toBe(false);
      expect(sizes).toEqual([3, 4, 5, 11]);
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

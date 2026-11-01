/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The Library player's native host, brought up and let go by the core
 * (`main/libraryPlayer/hostEngine.ts`): the order it starts in, what a
 * failure leaves, how a rack dragged round is pushed, and a song put back
 * after the host moved to a new output. The cases the window's controller
 * was held to travel with it.
 */
import {
  createHostEngine,
  type IHostClock,
  type IHostClockFrame,
  type IHostEngineEvents,
  type IHostPort,
  type THostEngineState,
} from '../../../main/libraryPlayer/hostEngine';
import type { IHostDeckWant } from '../../../main/libraryPlayer/hostDeckTypes';

const drain = async (): Promise<void> => {
  for (let turn = 0; turn < 64; turn += 1) {
    // eslint-disable-next-line no-await-in-loop -- draining is sequential.
    await Promise.resolve();
  }
};

const portSpy = (overrides: Partial<IHostPort> = {}) => {
  const calls: string[] = [];
  let telemetry: ((frame: IHostClockFrame) => void) | undefined;
  const ok = (call: string) => () => {
    calls.push(call);
    return Promise.resolve(true);
  };
  const port: IHostPort = {
    start: ok('start'),
    stop: () => {
      calls.push('stop');
      return Promise.resolve();
    },
    applyChain: (values) => {
      calls.push(`chain(${values.join(',')})`);
      return Promise.resolve(true);
    },
    openDevice: ok('open'),
    closeDevice: ok('close'),
    setVolume: (volume) => {
      calls.push(`volume(${volume})`);
      return Promise.resolve(true);
    },
    setTrackGains: (input, master) => {
      calls.push(`gains(${input},${master})`);
      return Promise.resolve(true);
    },
    setNoiseProfile: (values) => {
      calls.push(values ? 'noise' : 'noise(none)');
      return Promise.resolve(true);
    },
    transport: {
      loadFor: (purpose, path, start) => {
        calls.push(`loadFor(${purpose},${path},${start})`);
        return Promise.resolve(purpose === 'handoff' ? 0 : undefined);
      },
      unload: (deck) => {
        calls.push(`unload(${deck})`);
        return Promise.resolve(true);
      },
      play: ok('play'),
      pause: ok('pause'),
      seek: (deck, seconds) => {
        calls.push(`seek(${deck},${seconds})`);
        return Promise.resolve(true);
      },
      select: (deck) => {
        calls.push(`select(${deck})`);
        return Promise.resolve(true);
      },
      crossfade: ok('crossfade'),
      setCrossfadeTable: ok('table'),
    },
    onTelemetry: (listener) => {
      telemetry = listener;
      return () => {
        telemetry = undefined;
      };
    },
    ...overrides,
  };
  return { port, calls, send: (frame: IHostClockFrame) => telemetry?.(frame) };
};

const eventsSpy = (
  wantAfterReopen: () => IHostDeckWant = () => ({
    mediaPath: undefined,
    isPlaying: false,
    positionMs: 0,
  }),
) => {
  const states: THostEngineState[] = [];
  const clocks: IHostClock[] = [];
  const events: IHostEngineEvents = {
    onState: (state) => states.push(state),
    onClock: (clock) => clocks.push(clock),
    onOwnership: () => undefined,
    onRefused: () => undefined,
    onActive: () => undefined,
    preparePlayback: () => Promise.resolve(),
    finishPlayback: () => Promise.resolve(),
    wantAfterReopen,
  };
  return { events, states, clocks };
};

const frame = (overrides: Partial<IHostClockFrame> = {}): IHostClockFrame => ({
  deviceGeneration: 1,
  activeDeck: 0,
  deckState: 1,
  deckPositionSeconds: 2.5,
  deckDurationSeconds: 180,
  ...overrides,
});

describe('bringing the host up', () => {
  it('hands over the rack before it opens the device, then turns the level up once', async () => {
    const { port, calls } = portSpy();
    const { events, states } = eventsSpy();
    const engine = createHostEngine(port, events);
    engine.pushChain([1, 2, 3]).catch(() => undefined);
    engine.setEngaged(true);
    await drain();
    expect(calls).toEqual(['start', 'chain(1,2,3)', 'open', 'volume(1)']);
    expect(states).toEqual(['engaging', 'engaged']);
    expect(engine.state()).toBe('engaged');
  });

  it('opens no device and stops the process when the rack is refused', async () => {
    const { port, calls } = portSpy({
      applyChain: () => {
        calls.push('chain');
        return Promise.resolve(false);
      },
    });
    const { events, states } = eventsSpy();
    const engine = createHostEngine(port, events);
    engine.pushChain([1]).catch(() => undefined);
    engine.setEngaged(true);
    await drain();
    expect(calls).toEqual(['start', 'chain', 'stop']);
    expect(states).toEqual(['engaging', 'failed']);
  });

  it('fails without trying a device when the process will not start', async () => {
    const { port, calls } = portSpy({
      start: () => {
        calls.push('start');
        return Promise.resolve(false);
      },
    });
    const { events, states } = eventsSpy();
    const engine = createHostEngine(port, events);
    engine.pushChain([1]).catch(() => undefined);
    engine.setEngaged(true);
    await drain();
    expect(calls).toEqual(['start', 'stop']);
    expect(states[states.length - 1]).toBe('failed');
  });

  it('is not asked again on every change once it has failed', async () => {
    const { port, calls } = portSpy({
      start: () => {
        calls.push('start');
        return Promise.reject(new Error('no host'));
      },
    });
    const { events } = eventsSpy();
    const engine = createHostEngine(port, events);
    engine.pushChain([1]).catch(() => undefined);
    engine.setEngaged(true);
    await drain();
    engine.setEngaged(true);
    engine.sync({ mediaPath: 'C:/a.wav', isPlaying: true, positionMs: 0 });
    await drain();
    expect(calls.filter((call) => call === 'start')).toHaveLength(1);
    // The next real ask after it was let go tries again.
    engine.setEngaged(false);
    engine.setEngaged(true);
    await drain();
    expect(calls.filter((call) => call === 'start')).toHaveLength(2);
  });

  it('plays the song it was asked for once it is up', async () => {
    const { port, calls } = portSpy();
    const { events } = eventsSpy();
    const engine = createHostEngine(port, events);
    engine.sync({ mediaPath: 'C:/a.wav', isPlaying: true, positionMs: 0 });
    engine.pushChain([1]).catch(() => undefined);
    engine.setEngaged(true);
    await drain();
    expect(calls).toContain('loadFor(handoff,C:/a.wav,0)');
    expect(calls).toContain('play');
  });
});

describe('letting the host go', () => {
  it('empties both decks, pauses, closes the device and only then stops', async () => {
    const { port, calls } = portSpy();
    const { events, states } = eventsSpy();
    const engine = createHostEngine(port, events);
    engine.pushChain([1]).catch(() => undefined);
    engine.setEngaged(true);
    await drain();
    calls.length = 0;
    engine.setEngaged(false);
    await drain();
    // The deck's own release asks for the same as it lets go; what matters is
    // that the device closes after the decks are empty and the process last.
    expect(calls.slice(-5)).toEqual([
      'unload(0)',
      'unload(1)',
      'pause',
      'close',
      'stop',
    ]);
    expect(states[states.length - 1]).toBe('idle');
  });

  it('does nothing to a host that was never up', async () => {
    const { port, calls } = portSpy();
    const { events } = eventsSpy();
    const engine = createHostEngine(port, events);
    await engine.close();
    expect(calls).toEqual([]);
  });

  it('still stops the process when an earlier step fails', async () => {
    const { port, calls } = portSpy({
      closeDevice: () => Promise.reject(new Error('gone')),
    });
    const { events } = eventsSpy();
    const engine = createHostEngine(port, events);
    engine.pushChain([1]).catch(() => undefined);
    engine.setEngaged(true);
    await drain();
    await engine.close();
    expect(calls[calls.length - 1]).toBe('stop');
  });
});

describe('the rack, pushed while the host is up', () => {
  it('waits for the host when it is not up, and goes in first when it comes up', async () => {
    const { port, calls } = portSpy();
    const { events } = eventsSpy();
    const engine = createHostEngine(port, events);
    await expect(engine.pushChain([7])).resolves.toBe(false);
    expect(calls).toEqual([]);
    engine.setEngaged(true);
    await drain();
    expect(calls.slice(0, 2)).toEqual(['start', 'chain(7)']);
  });

  it('sends the first, then only the newest of everything asked meanwhile', async () => {
    let answer: (applied: boolean) => void = () => undefined;
    let held = false;
    const { port, calls } = portSpy({
      applyChain: (values) => {
        calls.push(`chain(${values.join(',')})`);
        if (held) {
          return new Promise((resolve) => {
            answer = resolve;
          });
        }
        return Promise.resolve(true);
      },
    });
    const { events } = eventsSpy();
    const engine = createHostEngine(port, events);
    engine.pushChain([0]).catch(() => undefined);
    engine.setEngaged(true);
    await drain();
    calls.length = 0;
    held = true;
    const first = engine.pushChain([1]);
    await drain();
    const second = engine.pushChain([2]);
    const third = engine.pushChain([3]);
    held = false;
    answer(true);
    await expect(first).resolves.toBe(true);
    await expect(second).resolves.toBe(true);
    await expect(third).resolves.toBe(true);
    expect(calls).toEqual(['chain(1)', 'chain(3)']);
  });
});

describe('the song played, through a new output', () => {
  it('rebuilds the decks and cues the song again when the host reopens', async () => {
    const want: IHostDeckWant = {
      mediaPath: 'C:/a.wav',
      isPlaying: true,
      positionMs: 61_000,
    };
    const { port, calls, send } = portSpy();
    const { events } = eventsSpy(() => want);
    const engine = createHostEngine(port, events);
    engine.pushChain([1]).catch(() => undefined);
    engine.sync({ ...want, positionMs: 0 });
    engine.setEngaged(true);
    await drain();
    send(frame({ deviceGeneration: 1 }));
    calls.length = 0;
    // The host followed the default output: a new generation, every deck empty.
    send(frame({ deviceGeneration: 2, deckState: 0 }));
    await drain();
    expect(calls).toContain('loadFor(handoff,C:/a.wav,61)');
    expect(calls).toContain('play');
  });

  it('cues nothing again for frames of the same output', async () => {
    const { port, calls, send } = portSpy();
    const { events } = eventsSpy();
    const engine = createHostEngine(port, events);
    engine.pushChain([1]).catch(() => undefined);
    engine.setEngaged(true);
    await drain();
    calls.length = 0;
    send(frame());
    send(frame({ deckPositionSeconds: 3 }));
    await drain();
    expect(calls).toEqual([]);
  });
});

describe('the clock', () => {
  it('reads the deck the host plays, in milliseconds', async () => {
    const { port, send } = portSpy();
    const { events, clocks } = eventsSpy();
    const engine = createHostEngine(port, events);
    engine.pushChain([1]).catch(() => undefined);
    engine.setEngaged(true);
    await drain();
    send(frame({ deckState: 2, activeDeck: 1 }));
    expect(clocks[clocks.length - 1]).toEqual({
      hasSource: true,
      positionMs: 2_500,
      durationMs: 180_000,
      ended: true,
      activeDeck: 1,
    });
    send(frame({ deckState: 0 }));
    expect(clocks[clocks.length - 1]?.hasSource).toBe(false);
  });

  it('stops reading when the host is let go', async () => {
    const { port, send } = portSpy();
    const { events, clocks } = eventsSpy();
    const engine = createHostEngine(port, events);
    engine.pushChain([1]).catch(() => undefined);
    engine.setEngaged(true);
    await drain();
    engine.setEngaged(false);
    await drain();
    const before = clocks.length;
    send(frame());
    expect(clocks).toHaveLength(before);
  });
});

describe('a song’s levels', () => {
  it('reach the host only while it is up', async () => {
    const { port, calls } = portSpy();
    const { events } = eventsSpy();
    const engine = createHostEngine(port, events);
    engine.setTrackGains(-3, 1);
    engine.setNoiseProfile(undefined);
    expect(calls).toEqual([]);
    engine.pushChain([1]).catch(() => undefined);
    engine.setEngaged(true);
    await drain();
    calls.length = 0;
    engine.setTrackGains(-3, 1);
    engine.setNoiseProfile(undefined);
    await drain();
    expect(calls).toEqual(['gains(-3,1)', 'noise(none)']);
  });
});

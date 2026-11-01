/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The host's two decks brought to what the core's Library player wants
 * (`main/libraryPlayer/hostDeck.ts`). The cases are the window mirror's,
 * which this is a port of, without the hidden elements it kept beside the
 * host: a file the host cannot open is now handed back to the player.
 */
import { DSP_DEFAULTS, TCrossfadeCurve } from '../../../common/dsp/chain';
import {
  CROSSFADE_TABLE_POINTS,
  crossfadeShapeTable,
} from '../../../common/dsp/crossfadeShape';
import createHostDeck from '../../../main/libraryPlayer/hostDeck';
import type {
  IHostDeckTransport,
  IHostDeckWant,
} from '../../../main/libraryPlayer/hostDeckTypes';

const FADE = {
  durationMs: 4_000,
  curve: 'equalPower' as TCrossfadeCurve,
  shape: DSP_DEFAULTS.crossfade.shape,
};

/** Every continuation the deck has queued, however long the chain is. */
const drain = async (): Promise<void> => {
  for (let turn = 0; turn < 64; turn += 1) {
    // eslint-disable-next-line no-await-in-loop -- draining is sequential.
    await Promise.resolve();
  }
};

/** Records what was asked of the host; the handoff deck is `handoffDeck`. */
const transportSpy = (
  overrides: Partial<IHostDeckTransport> = {},
  handoffDeck = 0,
) => {
  const calls: string[] = [];
  const ok = (call: string) => {
    calls.push(call);
    return Promise.resolve(true);
  };
  const transport: IHostDeckTransport = {
    loadFor: (purpose, path, startSeconds) => {
      calls.push(`loadFor(${purpose},${path},${startSeconds})`);
      return Promise.resolve(purpose === 'handoff' ? handoffDeck : undefined);
    },
    unload: (deck) => ok(`unload(${deck})`),
    play: () => ok('play'),
    pause: () => ok('pause'),
    seek: (deck, seconds) => ok(`seek(${deck},${seconds})`),
    select: (deck) => ok(`select(${deck})`),
    crossfade: (deck, durationMs, curve) =>
      ok(`crossfade(${deck},${durationMs},${curve})`),
    setCrossfadeTable: (values) => ok(`table(${values.length})`),
    preparePlayback: () => {
      calls.push('prepare');
      return Promise.resolve();
    },
    finishPlayback: () => {
      calls.push('finish');
      return Promise.resolve();
    },
    ...overrides,
  };
  const events = {
    owns: [] as boolean[],
    refused: [] as [string, boolean][],
    active: [] as (string | undefined)[],
  };
  const deck = createHostDeck(transport, {
    onOwnership: (owns) => events.owns.push(owns),
    onRefused: (path, resume) => events.refused.push([path, resume]),
    onActive: (path) => events.active.push(path),
  });
  return { deck, calls, events };
};

const want = (
  mediaPath: string | undefined,
  overrides: Partial<IHostDeckWant> = {},
): IHostDeckWant => ({
  mediaPath,
  isPlaying: true,
  positionMs: 0,
  ...overrides,
});

describe('a song onto the host', () => {
  it('loads, selects, prepares and plays, in that order', async () => {
    const { deck, calls, events } = transportSpy();
    deck.sync(want('C:/a.wav'));
    await drain();
    // A select or a play against an empty deck is silence, and the rack's
    // place is settled before the transport starts.
    expect(calls).toEqual([
      'loadFor(handoff,C:/a.wav,0)',
      'select(0)',
      'prepare',
      'play',
    ]);
    expect(events.owns).toEqual([true]);
    expect(events.active).toEqual(['C:/a.wav']);
  });

  it('cues a song taken over part way where the player says', async () => {
    const { deck, calls } = transportSpy();
    deck.sync(want('C:/a.wav', { positionMs: 92_000 }));
    await drain();
    expect(calls).toContain('loadFor(handoff,C:/a.wav,92)');
  });

  it('starts the next song at its beginning, not where the last one was', async () => {
    const { deck, calls } = transportSpy();
    deck.sync(want('C:/a.wav', { positionMs: 92_000 }));
    await drain();
    calls.length = 0;
    deck.sync(want('C:/b.wav', { positionMs: 92_000 }));
    await drain();
    expect(calls).toContain('loadFor(handoff,C:/b.wav,0)');
    expect(calls.filter((call) => call.startsWith('seek'))).toEqual([]);
  });

  it('leaves a song cued while paused stopped, and plays it on Play', async () => {
    const { deck, calls } = transportSpy();
    deck.sync(want('C:/a.wav', { isPlaying: false }));
    await drain();
    expect(calls).not.toContain('play');
    expect(calls).toContain('pause');
    calls.length = 0;
    deck.sync(want('C:/a.wav'));
    await drain();
    expect(calls).toEqual(['prepare', 'play']);
  });
});

describe('while a song plays', () => {
  const running = async () => {
    const spy = transportSpy();
    spy.deck.sync(want('C:/a.wav'));
    await drain();
    spy.calls.length = 0;
    return spy;
  };

  it('follows pause and play', async () => {
    const { deck, calls } = await running();
    deck.sync(want('C:/a.wav', { isPlaying: false }));
    deck.sync(want('C:/a.wav'));
    await drain();
    expect(calls).toEqual(['pause', 'finish', 'prepare', 'play']);
  });

  it('seeks the deck the song is on, and says the host took it', async () => {
    const { deck, calls } = await running();
    await expect(deck.seek(120_000)).resolves.toBe(true);
    expect(calls).toEqual(['seek(0,120)']);
  });

  it('sends only the newest of the seeks waiting behind a busy host', async () => {
    let answer: (applied: boolean) => void = () => undefined;
    const spy = transportSpy({
      seek: (deck, seconds) => {
        spy.calls.push(`seek(${deck},${seconds})`);
        // The first seek is still on its way when the next two are asked.
        return seconds === 10
          ? new Promise<boolean>((resolve) => {
              answer = resolve;
            })
          : Promise.resolve(true);
      },
    });
    spy.deck.sync(want('C:/a.wav'));
    await drain();
    spy.calls.length = 0;
    const first = spy.deck.seek(10_000);
    const second = spy.deck.seek(20_000);
    const third = spy.deck.seek(30_000);
    await expect(second).resolves.toBe(false);
    answer(true);
    await expect(first).resolves.toBe(true);
    await expect(third).resolves.toBe(true);
    expect(spy.calls).toEqual(['seek(0,10)', 'seek(0,30)']);
  });

  it('drops a seek asked of the song before when the song changes', async () => {
    const { deck, calls } = transportSpy({
      // The load is slow: the seek is still waiting when the song changes.
      loadFor: () =>
        new Promise<number | undefined>(() => {
          // Never answers: the load is still on its way.
        }),
    });
    deck.sync(want('C:/a.wav'));
    const seek = deck.seek(30_000);
    deck.sync(want('C:/b.wav'));
    await expect(seek).resolves.toBe(false);
    expect(calls.filter((call) => call.startsWith('seek'))).toEqual([]);
  });

  it('loads the next song when the queue moves on', async () => {
    const { deck, calls } = await running();
    deck.sync(want('C:/b.wav'));
    await drain();
    expect(calls).toEqual(['loadFor(handoff,C:/b.wav,0)', 'select(0)', 'play']);
  });

  it('empties both decks when the queue empties, and says the host has nothing', async () => {
    const { deck, calls, events } = await running();
    deck.sync(want(undefined, { isPlaying: false }));
    await drain();
    // Both, because a fade leaves the previous track on the other deck.
    expect(calls).toEqual(['unload(0)', 'unload(1)', 'finish']);
    expect(events.owns).toEqual([true, false]);
    expect(events.active).toEqual(['C:/a.wav', undefined]);
  });

  it('plays a song cued after the decks were emptied, once asked to', async () => {
    const { deck, calls } = await running();
    deck.sync(want(undefined, { isPlaying: false }));
    await drain();
    deck.sync(want('C:/b.wav', { isPlaying: false }));
    await drain();
    calls.length = 0;
    deck.sync(want('C:/b.wav'));
    await drain();
    expect(calls).toContain('play');
  });
});

describe('a file the host cannot open', () => {
  it('is handed back to the player, both decks emptied, with what the listener wanted', async () => {
    const { deck, calls, events } = transportSpy({
      loadFor: () => Promise.resolve(undefined),
    });
    deck.sync(want('C:/song.xyz'));
    await drain();
    expect(events.refused).toEqual([['C:/song.xyz', true]]);
    expect(calls).toEqual(['unload(0)', 'unload(1)', 'finish']);
    expect(events.owns).not.toContain(true);
  });

  it('says paused when the listener was paused', async () => {
    const { deck, events } = transportSpy({
      loadFor: () => Promise.resolve(undefined),
    });
    deck.sync(want('C:/song.xyz', { isPlaying: false }));
    await drain();
    expect(events.refused).toEqual([['C:/song.xyz', false]]);
  });

  it('is not played when preparing the start fails', async () => {
    const { deck, calls, events } = transportSpy({
      preparePlayback: () => Promise.reject(new Error('no rack')),
    });
    deck.sync(want('C:/a.wav'));
    await drain();
    expect(calls).not.toContain('play');
    expect(events.refused).toEqual([['C:/a.wav', true]]);
  });

  it('is asked of the host again once another song was chosen', async () => {
    let readable = false;
    const { deck, calls } = transportSpy({
      loadFor: (_purpose, path) => {
        calls.push(`loadFor(${path})`);
        return Promise.resolve(readable ? 0 : undefined);
      },
    });
    deck.sync(want('C:/bad.xyz'));
    await drain();
    readable = true;
    deck.sync(want('C:/good.wav'));
    await drain();
    expect(calls).toContain('loadFor(C:/good.wav)');
    expect(calls).toContain('play');
  });
});

describe('the fade from one song to the next', () => {
  const playing = async (handoffDeck = 1) => {
    const spy = transportSpy({}, handoffDeck);
    spy.deck.sync(want('C:/a.wav'));
    await drain();
    spy.calls.length = 0;
    return spy;
  };
  const fadeTo = (
    deck: ReturnType<typeof transportSpy>['deck'],
    path: string,
    overrides: Partial<NonNullable<IHostDeckWant['transition']>> = {},
  ) =>
    deck.sync(
      want(path, { transition: { ...FADE, startPositionMs: 0, ...overrides } }),
    );

  it('fades to the deck the host put the song on', async () => {
    const { deck, calls, events } = await playing();
    fadeTo(deck, 'C:/b.wav');
    await drain();
    expect(calls).toEqual([
      'loadFor(handoff,C:/b.wav,0)',
      'crossfade(1,4000,0)',
    ]);
    expect(events.active).toEqual(['C:/a.wav', 'C:/b.wav']);
  });

  it('cues the incoming song at its music, in the load itself', async () => {
    const { deck, calls } = await playing();
    fadeTo(deck, 'C:/b.wav', { startPositionMs: 2_500 });
    await drain();
    expect(calls[0]).toBe('loadFor(handoff,C:/b.wav,2.5)');
    expect(calls.filter((call) => call.startsWith('seek'))).toEqual([]);
  });

  it('sends each curve as its own index', async () => {
    const { deck, calls } = await playing();
    fadeTo(deck, 'C:/b.wav', { curve: 'linear' });
    await drain();
    expect(calls).toContain('crossfade(1,4000,2)');
  });

  it('sends the drawn shape before the load of the fade that uses it', async () => {
    const tables: number[][] = [];
    const spy = transportSpy(
      {
        setCrossfadeTable: (values) => {
          tables.push([...values]);
          spy.calls.push(`table(${values.length})`);
          return Promise.resolve(true);
        },
      },
      1,
    );
    spy.deck.sync(want('C:/a.wav'));
    await drain();
    spy.calls.length = 0;
    const shape = { ...DSP_DEFAULTS.crossfade.shape };
    fadeTo(spy.deck, 'C:/b.wav', { curve: 'custom', shape });
    await drain();
    expect(spy.calls.slice(0, 2)).toEqual([
      `table(${CROSSFADE_TABLE_POINTS * 2})`,
      'loadFor(handoff,C:/b.wav,0)',
    ]);
    expect(tables[0]).toEqual([
      ...crossfadeShapeTable(shape, false),
      ...crossfadeShapeTable(shape, true),
    ]);
  });

  it('sends no table for the built-in curves', async () => {
    const { deck, calls } = await playing();
    fadeTo(deck, 'C:/b.wav', { curve: 'smooth' });
    await drain();
    expect(calls.some((call) => call.startsWith('table'))).toBe(false);
  });

  it('cuts instead when the player is paused', async () => {
    const { deck, calls } = await playing();
    deck.sync(
      want('C:/b.wav', {
        isPlaying: false,
        transition: { ...FADE, startPositionMs: 0 },
      }),
    );
    await drain();
    expect(calls.some((call) => call.startsWith('crossfade'))).toBe(false);
    expect(calls).toContain('select(1)');
  });

  it('hands the incoming song back, playing, when the host cannot open it', async () => {
    const spy = transportSpy(
      {
        loadFor: (_purpose, path) =>
          Promise.resolve(path === 'C:/a.wav' ? 0 : undefined),
      },
      0,
    );
    spy.deck.sync(want('C:/a.wav'));
    await drain();
    fadeTo(spy.deck, 'C:/b.xyz');
    await drain();
    expect(spy.events.refused).toEqual([['C:/b.xyz', true]]);
  });

  it('addresses a later seek to the deck the fade landed on', async () => {
    // The first song on deck 0, the fade onto deck 1: a seek sent to the deck
    // the first song started on would move the one fading out.
    const decks = [0, 1];
    const { deck, calls } = transportSpy({
      loadFor: () => Promise.resolve(decks.shift()),
    });
    deck.sync(want('C:/a.wav'));
    await drain();
    fadeTo(deck, 'C:/b.wav');
    await drain();
    calls.length = 0;
    await deck.seek(30_000);
    expect(calls).toEqual(['seek(1,30)']);
  });
});

describe('the next song, readied by the host', () => {
  it('is named once, with its lead-in, while the current song plays', async () => {
    const { deck, calls } = transportSpy();
    const next = { path: 'C:/b.wav', startPositionMs: 1_500 };
    deck.sync(want('C:/a.wav', { upcoming: next }));
    await drain();
    deck.sync(want('C:/a.wav', { upcoming: next, positionMs: 250 }));
    await drain();
    expect(calls.filter((call) => call.startsWith('loadFor(spare'))).toEqual([
      'loadFor(spare,C:/b.wav,1.5)',
    ]);
  });

  it('cuts to it from its lead-in on a press of Next', async () => {
    const { deck, calls } = transportSpy();
    deck.sync(
      want('C:/a.wav', {
        upcoming: { path: 'C:/b.wav', startPositionMs: 1_500 },
      }),
    );
    await drain();
    calls.length = 0;
    deck.sync(want('C:/b.wav'));
    await drain();
    expect(calls[0]).toBe('loadFor(handoff,C:/b.wav,1.5)');
  });

  it('is never the song playing — repeat one restarts in place', async () => {
    const { deck, calls } = transportSpy();
    deck.sync(
      want('C:/a.wav', { upcoming: { path: 'C:/a.wav', startPositionMs: 0 } }),
    );
    await drain();
    expect(calls.some((call) => call.startsWith('loadFor(spare'))).toBe(false);
  });

  it('is not named before the host holds the song playing', async () => {
    const { deck, calls } = transportSpy({
      loadFor: (purpose) => {
        calls.push(`loadFor(${purpose})`);
        return Promise.resolve(undefined);
      },
    });
    deck.sync(
      want('C:/a.xyz', { upcoming: { path: 'C:/b.wav', startPositionMs: 0 } }),
    );
    await drain();
    expect(calls).not.toContain('loadFor(spare)');
  });

  it('names the new one when the queue moves on to something else', async () => {
    const { deck, calls } = transportSpy();
    deck.sync(
      want('C:/a.wav', { upcoming: { path: 'C:/b.wav', startPositionMs: 0 } }),
    );
    await drain();
    deck.sync(
      want('C:/a.wav', { upcoming: { path: 'C:/c.wav', startPositionMs: 0 } }),
    );
    await drain();
    expect(calls.filter((call) => call.startsWith('loadFor(spare'))).toEqual([
      'loadFor(spare,C:/b.wav,0)',
      'loadFor(spare,C:/c.wav,0)',
    ]);
  });
});

/**
 * The host's two decks as `player.cpp` and the host run them: a load for a
 * handoff lands where the HOST decides — the free deck, or inside a fade the
 * deck it is heading for — and a load onto a deck in a running fade points
 * the fade at the new song. The next song is only named, and goes onto the
 * free deck when there is one, which while a fade runs is when it ends.
 */
const hostModel = () => {
  const decks: (string | undefined)[] = [undefined, undefined];
  const calls: string[] = [];
  let active = 0;
  let incoming = 0;
  let fading = false;
  let spare: string | undefined;
  const other = (deck: number) => (deck === 0 ? 1 : 0);
  const ok = (call: string) => {
    calls.push(call);
    return Promise.resolve(true);
  };
  const readySpare = () => {
    if (spare !== undefined && !fading) {
      decks[other(active)] = spare;
      calls.push(`readied(${other(active)},${spare})`);
      spare = undefined;
    }
  };
  const transport: IHostDeckTransport = {
    loadFor: (purpose, path) => {
      calls.push(`loadFor(${purpose},${path})`);
      if (purpose === 'spare') {
        spare = path;
        readySpare();
        return Promise.resolve(undefined);
      }
      const deck = fading ? incoming : other(active);
      decks[deck] = path;
      if (fading) {
        incoming = deck;
        active = other(deck);
      }
      return Promise.resolve(deck);
    },
    unload: (deck) => {
      decks[deck] = undefined;
      spare = undefined;
      return ok(`unload(${deck})`);
    },
    play: () => ok('play'),
    pause: () => ok('pause'),
    seek: (deck, seconds) => ok(`seek(${deck},${seconds})`),
    select: (deck) => {
      active = deck;
      incoming = deck;
      fading = false;
      readySpare();
      return ok(`select(${deck})`);
    },
    crossfade: (to, durationMs) => {
      calls.push(`crossfade(${to})`);
      if (!fading && to !== active) {
        incoming = to;
        fading = durationMs > 0;
        if (!fading) {
          active = to;
        }
      }
      return Promise.resolve(true);
    },
    setCrossfadeTable: () => ok('table'),
    preparePlayback: () => Promise.resolve(),
    finishPlayback: () => Promise.resolve(),
  };
  const deck = createHostDeck(transport, {
    onOwnership: () => undefined,
    onRefused: () => undefined,
    onActive: () => undefined,
  });
  return {
    deck,
    calls,
    decks,
    finishFade: () => {
      if (fading) {
        active = incoming;
        fading = false;
      }
      readySpare();
    },
    heard: () => decks[fading ? incoming : active],
  };
};

/**
 * Next pressed again before the fade from the last press has finished (Ivan,
 * 2026-09-23: "crossfading still when switching too fast gets lost with the
 * file that it needs to play").
 */
describe('skipping again inside an overlap', () => {
  const playing = async () => {
    const host = hostModel();
    host.deck.sync(want('C:/a.mp3'));
    await drain();
    return host;
  };
  const skipTo = (host: ReturnType<typeof hostModel>, path: string) =>
    host.deck.sync(want(path, { transition: { ...FADE, startPositionMs: 0 } }));

  it('lands on the song chosen last, not the one skipped past', async () => {
    const host = await playing();
    skipTo(host, 'C:/b.mp3');
    await drain();
    skipTo(host, 'C:/c.mp3');
    await drain();
    host.finishFade();
    expect(host.heard()).toBe('C:/c.mp3');
  });

  it('keeps the song it is leaving on its own deck, fading out', async () => {
    const host = await playing();
    skipTo(host, 'C:/b.mp3');
    await drain();
    skipTo(host, 'C:/c.mp3');
    await drain();
    expect([...host.decks].sort()).toEqual(['C:/a.mp3', 'C:/c.mp3']);
  });

  it('lands a burst of presses on the last one, never opening those skipped', async () => {
    const host = await playing();
    skipTo(host, 'C:/b.mp3');
    skipTo(host, 'C:/c.mp3');
    skipTo(host, 'C:/d.mp3');
    await drain();
    host.finishFade();
    expect(host.heard()).toBe('C:/d.mp3');
    expect(host.calls.some((call) => call.includes('c.mp3'))).toBe(false);
  });

  it('lands a skip after the fade has finished as a fade from the new song', async () => {
    const host = await playing();
    skipTo(host, 'C:/b.mp3');
    await drain();
    host.finishFade();
    skipTo(host, 'C:/c.mp3');
    await drain();
    expect([...host.decks].sort()).toEqual(['C:/b.mp3', 'C:/c.mp3']);
    host.finishFade();
    expect(host.heard()).toBe('C:/c.mp3');
  });

  it('never readies the next song onto a deck still fading out', async () => {
    const host = await playing();
    skipTo(host, 'C:/b.mp3');
    await drain();
    for (let positionMs = 250; positionMs <= 1_000; positionMs += 250) {
      host.deck.sync(
        want('C:/b.mp3', {
          positionMs,
          transition: { ...FADE, startPositionMs: 0 },
          upcoming: { path: 'C:/c.mp3', startPositionMs: 0 },
        }),
      );
      // eslint-disable-next-line no-await-in-loop -- one tick at a time.
      await drain();
    }
    expect([...host.decks].sort()).toEqual(['C:/a.mp3', 'C:/b.mp3']);
    host.finishFade();
    expect(host.heard()).toBe('C:/b.mp3');
    expect([...host.decks].sort()).toEqual(['C:/b.mp3', 'C:/c.mp3']);
  });

  it('asks for the fade before starting a stopped host', async () => {
    const host = hostModel();
    host.deck.sync(want('C:/a.mp3', { isPlaying: false }));
    await drain();
    host.calls.length = 0;
    skipTo(host, 'C:/b.mp3');
    await drain();
    expect(host.calls.map((call) => call.replace(/\(\d\)$/, '(deck)'))).toEqual(
      ['loadFor(handoff,C:/b.mp3)', 'crossfade(deck)', 'play'],
    );
  });
});

describe('letting the host go', () => {
  it('stops, empties both decks, and does nothing after', async () => {
    const spy = transportSpy({
      // A seek on its way, so the next one waits behind it.
      seek: (deck, seconds) => {
        spy.calls.push(`seek(${deck},${seconds})`);
        return new Promise<boolean>(() => {
          // Never answers: the seek is still on its way.
        });
      },
    });
    const { deck, calls, events } = spy;
    deck.sync(want('C:/a.wav'));
    await drain();
    deck.seek(1_000).catch(() => undefined);
    await drain();
    calls.length = 0;
    const waiting = deck.seek(5_000);
    deck.release();
    await drain();
    await expect(waiting).resolves.toBe(false);
    expect(calls).toEqual(['pause', 'finish', 'unload(0)', 'unload(1)']);
    expect(events.owns).toEqual([true, false]);
    calls.length = 0;
    deck.sync(want('C:/b.wav'));
    await drain();
    expect(calls).toEqual([]);
    await expect(deck.seek(1_000)).resolves.toBe(false);
  });
});

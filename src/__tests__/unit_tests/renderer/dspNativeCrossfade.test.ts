/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The crossfade, which is the one thing the mirror cannot do by shadowing.
 *
 * Every other job the mirror has is driven by state the player hands it: a
 * path, a play flag, a position. A crossfade is an event with a duration and a
 * curve, and there is no state for the mirror to notice — so the player has to
 * call it. Until it did, the native engine cut between tracks while its own
 * crossfader, written and tested in C++, was never reached from the app at all.
 */
import { DSP_DEFAULTS, TCrossfadeCurve } from '../../../common/dsp/chain';
import {
  CROSSFADE_TABLE_POINTS,
  crossfadeShapeTable,
  ICrossfadeShape,
} from '../../../common/dsp/crossfadeShape';
import { INativeBackendController } from '../../../renderer/dsp/nativeBackend';
import createNativeMirror from '../../../renderer/dsp/nativeMirror';

/** Records the deck each transport call was addressed to, which is the point. */
const controllerSpy = (overrides: Record<string, unknown> = {}) => {
  const calls: string[] = [];
  const ok =
    (name: string) =>
    (...args: unknown[]) => {
      const first = args[0];
      calls.push(args.length > 0 ? `${name}(${String(first)})` : name);
      return Promise.resolve(true);
    };
  const controller = {
    engage: () => Promise.resolve(true),
    disengage: () => Promise.resolve(),
    update: () => Promise.resolve(true),
    transport: {
      load: ok('load'),
      // Deck 1 for a track about to be heard, as a host with a track on deck
      // 0 would answer; no deck for the next track, readied when one is free.
      loadFor: (purpose: string, _path: string, startSeconds: number) => {
        calls.push(`loadFor(${purpose},${startSeconds})`);
        return Promise.resolve(purpose === 'handoff' ? 1 : undefined);
      },
      unload: ok('unload'),
      play: () => {
        calls.push('play');
        return Promise.resolve(true);
      },
      pause: () => {
        calls.push('pause');
        return Promise.resolve(true);
      },
      seek: (deck: number, seconds: number) => {
        calls.push(`seek(${deck},${seconds})`);
        return Promise.resolve(true);
      },
      select: ok('select'),
      setVolume: ok('setVolume'),
      crossfade: ok('crossfade'),
      setCrossfadeTable: (values: readonly number[]) => {
        // Logged by length rather than by value: the point of the call is that
        // a whole table went before the fade, and 128 numbers in a name make
        // every other expectation in this file unreadable.
        calls.push(`setCrossfadeTable(${values.length})`);
        return Promise.resolve(true);
      },
      setTrackGains: ok('gains'),
      ...overrides,
    },
  } as unknown as INativeBackendController;
  return { controller, calls };
};

/** Just enough of a media element for the mirror, which only touches `muted`. */
const fakeElement = (): HTMLMediaElement =>
  ({ muted: false }) as unknown as HTMLMediaElement;

/** Let every already-resolved promise in the chain run to completion. */
const settle = async (): Promise<void> => {
  for (let turn = 0; turn < 8; turn += 1) {
    // eslint-disable-next-line no-await-in-loop -- draining is sequential.
    await Promise.resolve();
  }
};

/**
 * A track change, driven the way the app drives one.
 *
 * The player does not call a crossfade method — it sets the new track, React
 * re-renders, and the mirror sees the change on the next sync. Driving these
 * tests any other way would be testing a path the app does not take, which is
 * exactly how the previous version passed while the feature was broken.
 */
const handoffTo = async (
  mirror: ReturnType<typeof createNativeMirror>,
  mediaPath: string,
  durationMs: number,
  curve: TCrossfadeCurve,
  shape: ICrossfadeShape = DSP_DEFAULTS.crossfade.shape,
  startPositionMs = 0,
) => {
  mirror.sync({
    mediaPath,
    isPlaying: true,
    positionMs: 0,
    transition: { durationMs, curve, shape, startPositionMs },
  });
  await settle();
};

/** A mirror with a track already cued on deck zero, and the log cleared. */
const withTrackCued = async (overrides: Record<string, unknown> = {}) => {
  const { controller, calls } = controllerSpy(overrides);
  const element = fakeElement();
  const mirror = createNativeMirror(controller, [element]);
  mirror.sync({
    mediaPath: 'C:/a.mp3',
    isPlaying: true,
    positionMs: 0,
  });
  await settle();
  calls.length = 0;
  return { mirror, calls, element };
};

describe('the mirrored crossfade', () => {
  it('fades to the deck the host put the track on', async () => {
    const { mirror, calls } = await withTrackCued();

    await handoffTo(mirror, 'C:/b.mp3', 4000, 'equalPower');

    expect(calls).toEqual(['loadFor(handoff,0)', 'crossfade(1)']);
  });

  it('cues the incoming lead-in in the load, before that deck is heard', async () => {
    const { mirror, calls } = await withTrackCued();

    await handoffTo(
      mirror,
      'C:/b.mp3',
      4000,
      'equalPower',
      DSP_DEFAULTS.crossfade.shape,
      750,
    );

    expect(calls).toEqual(['loadFor(handoff,0.75)', 'crossfade(1)']);
  });

  /**
   * Whichever deck that is. Only the host knows whether its fade is over, so
   * the mirror no longer alternates: it goes where it is told.
   */
  it('follows the deck the host answers, not one of its own', async () => {
    const { mirror, calls } = await withTrackCued({
      loadFor: () => Promise.resolve(0),
    });

    await handoffTo(mirror, 'C:/b.mp3', 4000, 'equalPower');

    expect(calls).toEqual(['crossfade(0)']);
  });

  /**
   * The race, and the reason the claim is published before the first await.
   *
   * The player's position tick keeps running through a handoff and calls
   * `sync` with the incoming track — which is already the current one by then.
   * Had the mirror not already recorded that it is handling this file, that
   * tick reads a track change, treats it as a cue, and reloads the OUTGOING
   * deck with the incoming file: a hard cut over the top of the fade, with both
   * decks holding the same song.
   *
   * Not a window that can be waited out. It is a question of which fact is
   * published first, which is why the fix contains no timer and must not.
   */
  it('ignores the position tick that lands mid-handoff', async () => {
    const { mirror, calls } = await withTrackCued();

    // The sync that starts the handoff, not awaited: the load is in flight.
    mirror.sync({
      mediaPath: 'C:/b.mp3',
      isPlaying: true,
      positionMs: 0,
      transition: {
        durationMs: 4000,
        curve: 'equalPower',
        shape: DSP_DEFAULTS.crossfade.shape,
      },
    });
    // And the very next position tick, carrying the same new track, while that
    // load has not come back yet.
    mirror.sync({
      mediaPath: 'C:/b.mp3',
      isPlaying: true,
      positionMs: 120,
      transition: {
        durationMs: 4000,
        curve: 'equalPower',
        shape: DSP_DEFAULTS.crossfade.shape,
      },
    });
    await settle();

    // One load and one fade: the tick is the same track, not a second change,
    // and certainly not a cut over the top of the fade.
    expect(calls).toEqual(['loadFor(handoff,0)', 'crossfade(1)']);
  });

  /**
   * The positive control for the check above.
   *
   * `not.toContain` passes just as happily when nothing ran at all, so the same
   * tick OUTSIDE a handoff has to produce exactly the call the test above
   * asserts is absent. Without this, deleting the mirror's cue path entirely
   * would leave both tests green.
   */
  it('does cue a track change that is not a handoff, so that check means something', async () => {
    const { mirror, calls } = await withTrackCued();

    mirror.sync({
      mediaPath: 'C:/b.mp3',
      isPlaying: true,
      positionMs: 0,
    });
    await settle();

    expect(calls).toEqual(['loadFor(handoff,0)', 'select(1)', 'play']);
  });

  /** The curve reaches the host as the index the wire is defined in terms of. */
  it('sends each curve as its own index', async () => {
    const sent: number[] = [];
    const { mirror } = await withTrackCued({
      crossfade: (_deck: number, _durationMs: number, curveIndex: number) => {
        sent.push(curveIndex);
        return Promise.resolve(true);
      },
    });

    await handoffTo(mirror, 'C:/b.mp3', 1000, 'equalPower');
    await handoffTo(mirror, 'C:/c.mp3', 1000, 'smooth');
    await handoffTo(mirror, 'C:/d.mp3', 1000, 'linear');
    await handoffTo(mirror, 'C:/e.mp3', 1000, 'custom');

    expect(sent).toEqual([0, 1, 2, 3]);
  });

  /**
   * The shape has to land BEFORE the fade that uses it.
   *
   * The host holds a pending table and promotes it when a fade starts, so a
   * table sent after the crossfade command would take effect one track change
   * late — the fade the user just drew would run on the shape before it.
   */
  it('sends the shape before the fade that uses it', async () => {
    const { mirror, calls } = await withTrackCued();

    await handoffTo(mirror, 'C:/b.mp3', 1000, 'custom');

    const table = calls.findIndex((call) =>
      call.startsWith('setCrossfadeTable'),
    );
    const fade = calls.findIndex((call) => call.startsWith('crossfade'));
    expect(table).toBeGreaterThanOrEqual(0);
    expect(fade).toBeGreaterThan(table);
    expect(calls[table]).toBe(
      `setCrossfadeTable(${CROSSFADE_TABLE_POINTS * 2})`,
    );
  });

  /**
   * And only for Custom. The other three are closed forms the host already
   * has; sending a table for them would be 128 doubles per track change to
   * say nothing, and would overwrite the shape the user drew.
   */
  it('sends no table for the built-in curves', async () => {
    const { mirror, calls } = await withTrackCued();

    await handoffTo(mirror, 'C:/b.mp3', 1000, 'equalPower');
    await handoffTo(mirror, 'C:/c.mp3', 1000, 'smooth');
    await handoffTo(mirror, 'C:/d.mp3', 1000, 'linear');

    expect(
      calls.filter((call) => call.startsWith('setCrossfadeTable')),
    ).toHaveLength(0);
  });

  /** The dragged shape reaches the host, not the default one. */
  it('sends the shape the user actually drew', async () => {
    const sent: number[][] = [];
    const { mirror } = await withTrackCued({
      setCrossfadeTable: (values: readonly number[]) => {
        sent.push([...values]);
        return Promise.resolve(true);
      },
    });
    const dragged = {
      outgoing: [
        { at: 0.2, gain: 0.95 },
        { at: 0.4, gain: 0.85 },
        { at: 0.6, gain: 0.2 },
        { at: 0.8, gain: 0.05 },
      ],
      incoming: [
        { at: 0.2, gain: 0.05 },
        { at: 0.4, gain: 0.2 },
        { at: 0.6, gain: 0.85 },
        { at: 0.8, gain: 0.95 },
      ],
    };

    await handoffTo(mirror, 'C:/b.mp3', 1000, 'custom', dragged);

    expect(sent).toHaveLength(1);
    expect(sent[0]).toEqual([
      ...crossfadeShapeTable(dragged, false),
      ...crossfadeShapeTable(dragged, true),
    ]);
  });

  /**
   * A file the native decoder cannot open hands the sound back, as everywhere
   * else in this file. Sitting in silence while claiming to be the native
   * engine is the worst of the available options.
   */
  it('gives the elements their sound back when the incoming file will not load', async () => {
    let first = true;
    const { mirror, calls, element } = await withTrackCued({
      loadFor: () => {
        const answer = first ? 1 : undefined;
        first = false;
        return Promise.resolve(answer);
      },
    });
    expect(element.muted).toBe(true);

    await handoffTo(mirror, 'C:/b.mp3', 4000, 'equalPower');
    expect(element.muted).toBe(false);
    // And the host is left silent, the track being left included, rather
    // than playing under the elements' copy of the new one.
    expect(calls).toEqual(['unload(0)', 'unload(1)']);
  });

  /** Fading to what is already playing is not a fade. */
  it('refuses a crossfade to the track already on the audible deck', async () => {
    const { mirror, calls } = await withTrackCued();

    await handoffTo(mirror, 'C:/a.mp3', 4000, 'equalPower');
    expect(calls).toHaveLength(0);
  });

  /** Both decks are released, not just the audible one. */
  it('unloads both decks on release', async () => {
    const { mirror, calls } = await withTrackCued();

    await handoffTo(mirror, 'C:/b.mp3', 4000, 'equalPower');
    calls.length = 0;
    mirror.release(true);
    await settle();

    expect(calls).toContain('unload(0)');
    expect(calls).toContain('unload(1)');
  });

  /**
   * After a fade, the deck that matters is the new one.
   *
   * A seek addressed to the deck that just faded out is inaudible and looks
   * exactly like a seek that did nothing — the kind of fault that gets blamed
   * on the scrubber.
   */
  it('addresses a later seek to the deck the fade landed on', async () => {
    const { mirror, calls } = await withTrackCued();

    await handoffTo(mirror, 'C:/b.mp3', 4000, 'equalPower');
    calls.length = 0;

    mirror.seek(90_000);
    await settle();

    expect(calls.some((call) => call.startsWith('seek(1,'))).toBe(true);
  });
});

/**
 * The listener's fader, which reached nothing at all until it was mirrored.
 *
 * The elements are muted while the native engine is audible, and volume lives
 * on the element — so the control moved and the sound did not change. Not a
 * subtlety: the whole feature was missing on the engine that is now the
 * default.
 */
/**
 * The next track, named to the host, which readies it on its free deck.
 *
 * The mirror used to load it itself, and had to guess from a clock when the
 * deck still fading out was free; the host knows, so it is told once and
 * waits for itself.
 */
describe('the next track, readied by the host', () => {
  const FADE = { durationMs: 2_000, curve: 'equalPower' as TCrossfadeCurve };
  const upcomingTick = (mirror: ReturnType<typeof createNativeMirror>) =>
    mirror.sync({
      mediaPath: 'C:/a.mp3',
      isPlaying: true,
      positionMs: 5_000,
      upcoming: { path: 'C:/b.mp3', startPositionMs: 300 },
    });

  it('is named once, with its lead-in, while the current track plays', async () => {
    const { mirror, calls } = await withTrackCued();

    upcomingTick(mirror);
    await settle();
    expect(calls).toEqual(['loadFor(spare,0.3)']);

    // Said once: the next tick asks for nothing.
    calls.length = 0;
    upcomingTick(mirror);
    await settle();
    expect(calls).toEqual([]);
  });

  it('fades to it through the same load, which the host answers as readied', async () => {
    const { mirror, calls } = await withTrackCued();
    upcomingTick(mirror);
    await settle();
    calls.length = 0;

    await handoffTo(
      mirror,
      'C:/b.mp3',
      FADE.durationMs,
      FADE.curve,
      undefined,
      300,
    );

    expect(calls).toEqual(['loadFor(handoff,0.3)', 'crossfade(1)']);
  });

  it('cuts to it from its lead-in on a press of Next', async () => {
    const { mirror, calls } = await withTrackCued();
    upcomingTick(mirror);
    await settle();
    calls.length = 0;

    // A cut, not a fade: the new track arrives with no transition, and starts
    // where it was readied rather than in its leading silence.
    mirror.sync({ mediaPath: 'C:/b.mp3', isPlaying: true, positionMs: 0 });
    await settle();

    expect(calls).toEqual(['loadFor(handoff,0.3)', 'select(1)', 'play']);
  });

  it('is named during a fade too, the waiting being the host’s', async () => {
    const { mirror, calls } = await withTrackCued();
    await handoffTo(
      mirror,
      'C:/b.mp3',
      FADE.durationMs,
      FADE.curve,
      undefined,
      300,
    );
    calls.length = 0;

    const ticks = [800, 1_500, 2_300];
    for (let tick = 0; tick < ticks.length; tick += 1) {
      mirror.sync({
        mediaPath: 'C:/b.mp3',
        isPlaying: true,
        positionMs: ticks[tick],
        upcoming: { path: 'C:/c.mp3', startPositionMs: 0 },
      });
      // eslint-disable-next-line no-await-in-loop -- one tick at a time.
      await settle();
    }
    expect(calls).toEqual(['loadFor(spare,0)']);
  });

  it('names the new one when the queue moves on to something else', async () => {
    const { mirror, calls } = await withTrackCued();
    upcomingTick(mirror);
    await settle();
    calls.length = 0;

    mirror.sync({
      mediaPath: 'C:/a.mp3',
      isPlaying: true,
      positionMs: 5_250,
      upcoming: { path: 'C:/c.mp3', startPositionMs: 0 },
    });
    await settle();

    expect(calls).toEqual(['loadFor(spare,0)']);
  });
});

describe('the level the host plays at', () => {
  it('is full, said once when the mirror is built, and never moved after', async () => {
    const { controller, calls } = controllerSpy();
    const mirror = createNativeMirror(controller, [fakeElement()]);
    await settle();
    expect(calls).toEqual(['setVolume(1)']);

    calls.length = 0;
    mirror.sync({ mediaPath: 'C:/a.mp3', isPlaying: true, positionMs: 0 });
    await settle();
    mirror.sync({ mediaPath: 'C:/a.mp3', isPlaying: true, positionMs: 10 });
    await settle();
    mirror.sync({ mediaPath: 'C:/b.mp3', isPlaying: true, positionMs: 0 });
    await settle();
    // The fader beside the player is the computer's (`useSystemFader`); the
    // host has nothing of its own to be moved.
    expect(calls.filter((call) => call.startsWith('setVolume'))).toHaveLength(
      0,
    );
  });
});

/**
 * The host's two decks as `player.cpp` and the host run them.
 *
 * The spy above records what was asked; this answers the way the host would,
 * which is what a skip inside an overlap needs to be tested at all. A load for
 * a handoff lands where the HOST decides — the free deck, or inside a fade the
 * deck it is heading for, the quieter early on — and a load onto a deck in a
 * running fade points the fade at the new track, the other deck becoming the
 * one faded out of (`retarget`). A fade asked for again to the deck it is
 * already heading for keeps going; one back to the deck being left is
 * ignored. The next track is only named, and goes onto the free deck when
 * there is one — which, while a fade runs, is when it ends.
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
  const controller = {
    engage: () => Promise.resolve(true),
    disengage: () => Promise.resolve(),
    update: () => Promise.resolve(true),
    transport: {
      load: (deck: number, path: string) => {
        decks[deck] = path;
        return ok(`load(${deck},${path})`);
      },
      loadFor: (purpose: 'handoff' | 'spare', path: string) => {
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
      unload: (deck: number) => {
        decks[deck] = undefined;
        spare = undefined;
        return ok(`unload(${deck})`);
      },
      play: () => ok('play'),
      pause: () => ok('pause'),
      seek: (deck: number, seconds: number) => ok(`seek(${deck},${seconds})`),
      select: (deck: number) => {
        active = deck;
        incoming = deck;
        fading = false;
        readySpare();
        return ok(`select(${deck})`);
      },
      crossfade: (to: number, durationMs: number) => {
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
      setTrackGains: () => ok('gains'),
      setNoiseProfile: () => ok('noise'),
      setVolume: () => ok('volume'),
    },
  } as unknown as INativeBackendController;
  return {
    controller,
    calls,
    decks,
    /** The running fade reaches its end, which is when the host promotes. */
    finishFade: () => {
      if (fading) {
        active = incoming;
        fading = false;
      }
      readySpare();
    },
    /** The track the listener is left with once any fade has run out. */
    heard: () => decks[fading ? incoming : active],
  };
};

/** Every continuation the mirror has queued, however long the chain is. */
const drain = async (): Promise<void> => {
  for (let turn = 0; turn < 64; turn += 1) {
    // eslint-disable-next-line no-await-in-loop -- draining is sequential.
    await Promise.resolve();
  }
};

const FADE = {
  durationMs: 4_000,
  curve: 'equalPower' as TCrossfadeCurve,
  shape: DSP_DEFAULTS.crossfade.shape,
};

/**
 * Next pressed again before the fade from the last press has finished.
 *
 * Ivan, 2026-09-23: "crossfading still when switching too fast gets lost with
 * the file that it needs to play". The mirror took the deck for each handoff
 * by alternating, but the host's active deck is the one it fades OUT of until
 * the fade ends: a second skip inside the overlap loaded the new track over
 * the deck still fading out and asked for a fade to it, which the host refuses
 * as a fade to itself — so the fade in flight finished on the track skipped
 * past, and that is what played while the player showed the one chosen.
 */
describe('skipping again inside an overlap', () => {
  const playing = async (host: ReturnType<typeof hostModel>) => {
    const mirror = createNativeMirror(host.controller, [fakeElement()]);
    mirror.sync({ mediaPath: 'C:/a.mp3', isPlaying: true, positionMs: 0 });
    await drain();
    return mirror;
  };
  const skipTo = (
    mirror: ReturnType<typeof createNativeMirror>,
    mediaPath: string,
  ) =>
    mirror.sync({
      mediaPath,
      isPlaying: true,
      positionMs: 0,
      transition: { ...FADE, startPositionMs: 0 },
    });

  it('lands on the track chosen last, not the one skipped past', async () => {
    const host = hostModel();
    const mirror = await playing(host);

    skipTo(mirror, 'C:/b.mp3');
    await drain();
    skipTo(mirror, 'C:/c.mp3');
    await drain();
    host.finishFade();

    expect(host.heard()).toBe('C:/c.mp3');
  });

  it('keeps the track it is leaving on its own deck, fading out', async () => {
    const host = hostModel();
    const mirror = await playing(host);

    skipTo(mirror, 'C:/b.mp3');
    await drain();
    skipTo(mirror, 'C:/c.mp3');
    await drain();

    // The fade out of a is still running on its deck; only the track it was
    // fading INTO has changed.
    expect([...host.decks].sort()).toEqual(['C:/a.mp3', 'C:/c.mp3']);
  });

  it('lands a burst of presses on the last one', async () => {
    const host = hostModel();
    const mirror = await playing(host);

    // No turn of the event loop between them: each press arrives while the
    // one before it is still talking to the host.
    skipTo(mirror, 'C:/b.mp3');
    skipTo(mirror, 'C:/c.mp3');
    skipTo(mirror, 'C:/d.mp3');
    await drain();
    host.finishFade();

    expect(host.heard()).toBe('C:/d.mp3');
    // And the tracks skipped past before the host got to them never cost a
    // file open at all.
    expect(host.calls.some((call) => call.includes('c.mp3'))).toBe(false);
  });

  it('lands a skip after the fade has finished as a fade from the new track', async () => {
    const host = hostModel();
    const mirror = await playing(host);

    skipTo(mirror, 'C:/b.mp3');
    await drain();
    host.finishFade();
    skipTo(mirror, 'C:/c.mp3');
    await drain();

    // Out of b, which is now the active deck, into the one a left free.
    expect([...host.decks].sort()).toEqual(['C:/b.mp3', 'C:/c.mp3']);
    host.finishFade();
    expect(host.heard()).toBe('C:/c.mp3');
  });

  it('never readies the next track onto a deck still fading out', async () => {
    const host = hostModel();
    const mirror = await playing(host);

    skipTo(mirror, 'C:/b.mp3');
    await drain();
    // Ticks through the overlap, each naming the track after b.
    for (let positionMs = 250; positionMs <= 1_000; positionMs += 250) {
      mirror.sync({
        mediaPath: 'C:/b.mp3',
        isPlaying: true,
        positionMs,
        transition: { ...FADE, startPositionMs: 0 },
        upcoming: { path: 'C:/c.mp3', startPositionMs: 0 },
      });
      // eslint-disable-next-line no-await-in-loop -- one tick at a time.
      await drain();
    }

    expect([...host.decks].sort()).toEqual(['C:/a.mp3', 'C:/b.mp3']);
    host.finishFade();
    expect(host.heard()).toBe('C:/b.mp3');
    // And once the fade is over it is there, on the deck the fade left.
    expect([...host.decks].sort()).toEqual(['C:/b.mp3', 'C:/c.mp3']);
  });

  /**
   * Picked with the player paused and crossfade on: the host is started only
   * after the fade is asked for, so the fade is asked for while nothing is
   * heard — and the host makes that one the new track coming in alone.
   */
  it('asks for the fade before starting a stopped host', async () => {
    const host = hostModel();
    const mirror = createNativeMirror(host.controller, [fakeElement()]);
    mirror.sync({ mediaPath: 'C:/a.mp3', isPlaying: false, positionMs: 0 });
    await drain();
    host.calls.length = 0;

    skipTo(mirror, 'C:/b.mp3');
    await drain();

    expect(host.calls.map((call) => call.replace(/\(\d\)$/, '(deck)'))).toEqual(
      ['loadFor(handoff,C:/b.mp3)', 'crossfade(deck)', 'play'],
    );
  });
});

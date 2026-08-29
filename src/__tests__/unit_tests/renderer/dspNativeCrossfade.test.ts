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
import { INativeBackendController } from '../../../renderer/dsp/nativeBackend';
import { createNativeMirror } from '../../../renderer/dsp/nativeMirror';

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

/** A mirror with a track already cued on deck zero, and the log cleared. */
const withTrackCued = async (overrides: Record<string, unknown> = {}) => {
  const { controller, calls } = controllerSpy(overrides);
  const element = fakeElement();
  const mirror = createNativeMirror(controller, [element]);
  mirror.sync({
    mediaPath: 'C:/a.mp3',
    isPlaying: true,
    positionMs: 0,
    volume: 1,
  });
  await settle();
  calls.length = 0;
  return { mirror, calls, element };
};

describe('the mirrored crossfade', () => {
  it('fades to the other deck rather than reloading the one in use', async () => {
    const { mirror, calls } = await withTrackCued();

    expect(await mirror.crossfade('C:/b.mp3', 4000, 'equalPower')).toBe(true);

    // Deck one, because deck zero is the one currently audible.
    expect(calls).toContain('load(1)');
    expect(calls).toContain('crossfade(1)');
  });

  /** And back again, so a third track does not land on the deck still playing. */
  it('alternates decks across successive handoffs', async () => {
    const { mirror, calls } = await withTrackCued();

    await mirror.crossfade('C:/b.mp3', 4000, 'equalPower');
    calls.length = 0;
    await mirror.crossfade('C:/c.mp3', 4000, 'equalPower');

    expect(calls).toContain('load(0)');
    expect(calls).toContain('crossfade(0)');
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

    const fading = mirror.crossfade('C:/b.mp3', 4000, 'equalPower');
    // Exactly the tick the player emits here: the new track, still carrying
    // the old position, before the fade has resolved.
    mirror.sync({
      mediaPath: 'C:/b.mp3',
      isPlaying: true,
      positionMs: 120,
      volume: 1,
    });
    await fading;
    await settle();

    // Reloading the outgoing deck is the whole bug.
    expect(calls).not.toContain('load(0)');
    expect(calls).not.toContain('select(0)');
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
      volume: 1,
    });
    await settle();

    expect(calls).toContain('load(0)');
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

    await mirror.crossfade('C:/b.mp3', 1000, 'equalPower');
    await mirror.crossfade('C:/c.mp3', 1000, 'smooth');
    await mirror.crossfade('C:/d.mp3', 1000, 'linear');

    expect(sent).toEqual([0, 1, 2]);
  });

  /**
   * A file the native decoder cannot open hands the sound back, as everywhere
   * else in this file. Sitting in silence while claiming to be the native
   * engine is the worst of the available options.
   */
  it('gives the elements their sound back when the incoming file will not load', async () => {
    let first = true;
    const { mirror, element } = await withTrackCued({
      load: () => {
        const answer = first;
        first = false;
        return Promise.resolve(answer);
      },
    });
    expect(element.muted).toBe(true);

    expect(await mirror.crossfade('C:/b.mp3', 4000, 'equalPower')).toBe(false);
    expect(element.muted).toBe(false);
  });

  /** Fading to what is already playing is not a fade. */
  it('refuses a crossfade to the track already on the audible deck', async () => {
    const { mirror, calls } = await withTrackCued();

    expect(await mirror.crossfade('C:/a.mp3', 4000, 'equalPower')).toBe(false);
    expect(calls).toHaveLength(0);
  });

  /** Both decks are released, not just the audible one. */
  it('unloads both decks on release', async () => {
    const { mirror, calls } = await withTrackCued();

    await mirror.crossfade('C:/b.mp3', 4000, 'equalPower');
    calls.length = 0;
    mirror.release();
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

    await mirror.crossfade('C:/b.mp3', 4000, 'equalPower');
    calls.length = 0;

    // A jump far past the drift threshold, which is what makes it a seek.
    mirror.sync({
      mediaPath: 'C:/b.mp3',
      isPlaying: true,
      positionMs: 90_000,
      volume: 1,
    });
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
describe('the mirrored volume', () => {
  it('tells the host the fader position on the first sync', async () => {
    const { controller, calls } = controllerSpy();
    const mirror = createNativeMirror(controller, [fakeElement()]);

    mirror.sync({
      mediaPath: 'C:/a.mp3',
      isPlaying: true,
      positionMs: 0,
      volume: 0.4,
    });
    await settle();

    expect(calls).toContain('setVolume(0.4)');
  });

  it('sends it again when it moves', async () => {
    const { mirror, calls } = await withTrackCued();

    mirror.sync({
      mediaPath: 'C:/a.mp3',
      isPlaying: true,
      positionMs: 10,
      volume: 0.25,
    });
    await settle();

    expect(calls).toContain('setVolume(0.25)');
  });

  /**
   * And stays quiet when it has not, because this runs on every position tick —
   * four times a second, for the life of the track.
   */
  it('says nothing on a tick where the fader did not move', async () => {
    const { mirror, calls } = await withTrackCued();

    mirror.sync({
      mediaPath: 'C:/a.mp3',
      isPlaying: true,
      positionMs: 10,
      volume: 1,
    });
    await settle();
    calls.length = 0;
    mirror.sync({
      mediaPath: 'C:/a.mp3',
      isPlaying: true,
      positionMs: 20,
      volume: 1,
    });
    await settle();

    expect(calls.filter((call) => call.startsWith('setVolume'))).toHaveLength(
      0,
    );
  });

  /** A track change must not swallow a fader move made in the same tick. */
  it('sends the fader even on the tick that changes track', async () => {
    const { mirror, calls } = await withTrackCued();

    mirror.sync({
      mediaPath: 'C:/b.mp3',
      isPlaying: true,
      positionMs: 0,
      volume: 0.6,
    });
    await settle();

    expect(calls).toContain('setVolume(0.6)');
  });
});

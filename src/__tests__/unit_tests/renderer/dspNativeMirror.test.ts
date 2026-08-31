/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { INativeBackendController } from '../../../renderer/dsp/nativeBackend';
import { createNativeMirror } from '../../../renderer/dsp/nativeMirror';

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
      seek: (_deck: number, seconds: number) => {
        calls.push(`seek(${seconds})`);
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
/**
 * Enough of an element to be paused and resumed, which it has to be.
 *
 * This used to be `{ muted: false }` and nothing else. Once the mirror started
 * standing the elements down, `pause()` was missing on it — and the throw went
 * straight into the `.catch` that `sync` wraps every cue in, so the suite
 * carried on reporting green for a call that never happened. A stub thin
 * enough to hide the behaviour under test is worse than no stub.
 */
const fakeElement = (): HTMLMediaElement => {
  const element = {
    muted: false,
    paused: false,
    play: () => {
      element.paused = false;
      return Promise.resolve();
    },
    pause: () => {
      element.paused = true;
    },
  };
  return element as unknown as HTMLMediaElement;
};

const settle = () =>
  new Promise((resolve) => {
    setTimeout(resolve, 0);
  });

describe('the native mirror', () => {
  /**
   * Muted on engaging, and not yet paused.
   *
   * The order is the point. Engaging only means the host is available; it has
   * no track until a deck is loaded, and an element paused before that is
   * silence with nothing taking over. It is stood down once the host actually
   * holds the file — see the cue tests below.
   */
  it('mutes the elements when it takes over, without pausing them yet', () => {
    const { controller } = controllerSpy();
    const elements = [fakeElement(), fakeElement()];

    createNativeMirror(controller, elements);

    expect(elements.every((element) => element.muted)).toBe(true);
    expect(elements.some((element) => element.paused)).toBe(false);
  });

  it('stops the element decoding once the host holds the track', async () => {
    /**
     * The reason the element was kept running is gone.
     *
     * It stayed muted-but-playing because the clock the player read hung off
     * it. The host reports its deck's position, duration and state now, so a
     * running element is only the same file being decoded a second time for
     * numbers nobody reads.
     */
    const { controller } = controllerSpy();
    const element = fakeElement();
    const mirror = createNativeMirror(controller, [element]);

    mirror.sync({
      mediaPath: 'C:/music/one.wav',
      isPlaying: true,
      positionMs: 0,
      volume: 1,
    });
    await settle();

    expect(element.paused).toBe(true);
    expect(element.muted).toBe(true);
  });

  it('hands the sound back, running, when the host cannot open the file', async () => {
    /**
     * The fallback, and it has to be audible rather than merely unmuted.
     *
     * A previous track the host COULD read will have left this element stood
     * down, so unmuting alone gives a deck that looks audible and is silent.
     * This is the path every file takes on a platform whose native decoder and
     * device backend are not written yet.
     */
    let readable = true;
    const { controller } = controllerSpy({
      load: () => Promise.resolve(readable),
    });
    const element = fakeElement();
    const mirror = createNativeMirror(controller, [element]);

    // A track the host can read, which is what stands the element down.
    mirror.sync({
      mediaPath: 'C:/music/one.wav',
      isPlaying: true,
      positionMs: 0,
      volume: 1,
    });
    await settle();
    expect(element.paused).toBe(true);

    readable = false;
    mirror.sync({
      mediaPath: 'C:/music/unreadable.xyz',
      isPlaying: true,
      positionMs: 0,
      volume: 1,
    });
    await settle();

    expect(element.muted).toBe(false);
    expect(element.paused).toBe(false);
  });

  it('gives the elements their sound back when released', () => {
    const { controller } = controllerSpy();
    const elements = [fakeElement(), fakeElement()];
    const mirror = createNativeMirror(controller, elements);

    mirror.release();

    expect(elements.every((element) => element.muted)).toBe(false);
  });

  it('restores whatever the element was, not a hard false', () => {
    // A track the user muted themselves stays muted when the switch flips
    // back. Forcing it audible would be the A/B unmuting their music.
    const { controller } = controllerSpy();
    const element = fakeElement();
    element.muted = true;
    const mirror = createNativeMirror(controller, [element]);

    mirror.release();

    expect(element.muted).toBe(true);
  });

  it('loads, selects and plays when a track is cued', async () => {
    const { controller, calls } = controllerSpy();
    const mirror = createNativeMirror(controller, [fakeElement()]);

    mirror.sync({
      mediaPath: 'C:/music/one.wav',
      isPlaying: true,
      positionMs: 0,
      volume: 1,
    });
    await settle();

    // The fader is sent first and is not part of the ordering under test; what
    // matters is that the deck is loaded before it is selected and only then
    // played, because a select or a play against an empty deck is silence.
    expect(calls.filter((call) => !call.startsWith('setVolume'))).toEqual([
      'load(0)',
      'select(0)',
      'play',
    ]);
  });

  it('resumes at the position the element was already at', async () => {
    // The switch can be flipped mid-track. Starting the native deck at zero
    // would restart the song, which is the most obvious possible bug.
    const { controller, calls } = controllerSpy();
    const mirror = createNativeMirror(controller, [fakeElement()]);

    mirror.sync({
      mediaPath: 'C:/music/one.wav',
      isPlaying: true,
      positionMs: 92_000,
      volume: 1,
    });
    await settle();

    expect(calls).toContain('seek(92)');
  });

  it('starts a new track at its beginning, not where the last one was', async () => {
    /**
     * The path and the position reach `sync` from two different sources — the
     * queue and the element's clock — and on the tick that changes the track
     * they disagree: the path is already the new song while the position is
     * still the outgoing one's. Cueing at that number loaded the incoming
     * track and seeked it to where the previous one had been, which was heard
     * as a song starting in the middle with the seek bar reading zero.
     */
    const { controller, calls } = controllerSpy();
    const mirror = createNativeMirror(controller, [fakeElement()]);

    // Engaged mid-song: nothing was loaded, so this position IS real.
    mirror.sync({
      mediaPath: 'C:/music/one.wav',
      isPlaying: true,
      positionMs: 92_000,
      volume: 1,
    });
    await settle();
    calls.length = 0;

    // The track changes, and the position has not caught up yet.
    mirror.sync({
      mediaPath: 'C:/music/two.wav',
      isPlaying: true,
      positionMs: 92_000,
      volume: 1,
    });
    await settle();

    expect(calls).toContain('load(0)');
    expect(calls.filter((call) => call.startsWith('seek'))).toEqual([]);
  });

  describe('while a track plays', () => {
    const running = async () => {
      const spy = controllerSpy();
      const mirror = createNativeMirror(spy.controller, [fakeElement()]);
      mirror.sync({
        mediaPath: 'C:/music/one.wav',
        isPlaying: true,
        positionMs: 0,
        volume: 1,
      });
      await settle();
      spy.calls.length = 0;
      return { ...spy, mirror };
    };

    /**
     * A position tick that changed nothing sends nothing.
     *
     * The element reports four times a second. A mirror that seeked on each
     * one would empty the read-ahead ring four times a second, which is a
     * stutter rather than playback.
     */
    it('says nothing on an ordinary tick', async () => {
      const { calls, mirror } = await running();

      mirror.sync({
        mediaPath: 'C:/music/one.wav',
        isPlaying: true,
        positionMs: 250,
        volume: 1,
      });
      mirror.sync({
        mediaPath: 'C:/music/one.wav',
        isPlaying: true,
        positionMs: 500,
        volume: 1,
      });
      await settle();

      expect(calls).toEqual([]);
    });

    /**
     * The bug this file exists to keep out, and it was shipped once.
     *
     * "Drift" used to be measured against the PREVIOUS reading rather than
     * against where the element should be by now — so it was really measuring
     * how long the render took to arrive. A renderer that stalled for six
     * hundred milliseconds looked exactly like a listener dragging the
     * scrubber, and the answer to that is a seek, and a seek empties the
     * read-ahead ring.
     *
     * Which made it feed itself: under load the renders come further apart,
     * so it seeks more often, so it drops out more. It crackled worst on the
     * machine that could least afford it, which is also the machine somebody
     * would blame the native engine for.
     */
    /**
     * The bug this file exists to keep out, and it was shipped once.
     *
     * "Drift" used to be measured against the PREVIOUS reading rather than
     * against where the element should be by now — so it really measured how
     * long the render took to arrive. A renderer that stalled for six hundred
     * milliseconds looked exactly like a listener dragging the scrubber, and
     * the answer to that is a seek, and a seek empties the read-ahead ring.
     *
     * Which made it feed itself: under load the renders come further apart, so
     * it seeks more often, so it drops out more. It crackled worst on the
     * machine that could least afford it — which is also the machine somebody
     * would blame the native engine for.
     */
    it('says nothing when a render arrives late', async () => {
      // Installed before the mirror starts, so the baseline recorded at cue
      // time sits on the same clock the assertions move.
      const clock = jest.spyOn(performance, 'now');
      clock.mockReturnValue(1_000);
      const { calls, mirror } = await running();

      // Six hundred milliseconds of real time, and the element advanced by
      // exactly that much. Nothing jumped; the tick was simply late.
      clock.mockReturnValue(1_600);
      mirror.sync({
        mediaPath: 'C:/music/one.wav',
        isPlaying: true,
        positionMs: 600,
        volume: 1,
      });
      await settle();

      expect(calls).toEqual([]);
      clock.mockRestore();
    });

    /**
     * Paused, the element's position does not advance — so neither should the
     * expectation. Crediting elapsed wall time while stopped would make every
     * resume after a long pause look like a jump backwards.
     */
    it('does not credit elapsed time while paused', async () => {
      const clock = jest.spyOn(performance, 'now');
      clock.mockReturnValue(1_000);
      const { calls, mirror } = await running();

      mirror.sync({
        mediaPath: 'C:/music/one.wav',
        isPlaying: false,
        positionMs: 0,
        volume: 1,
      });
      calls.length = 0;

      clock.mockReturnValue(31_000);
      mirror.sync({
        mediaPath: 'C:/music/one.wav',
        isPlaying: false,
        positionMs: 0,
        volume: 1,
      });
      await settle();

      expect(calls).toEqual([]);
      clock.mockRestore();
    });

    it('seeks when the listener jumps', async () => {
      const { calls, mirror } = await running();

      mirror.sync({
        mediaPath: 'C:/music/one.wav',
        isPlaying: true,
        positionMs: 120_000,
        volume: 1,
      });
      await settle();

      expect(calls).toEqual(['seek(120)']);
    });

    it('follows pause and play', async () => {
      const { calls, mirror } = await running();

      mirror.sync({
        mediaPath: 'C:/music/one.wav',
        isPlaying: false,
        positionMs: 100,
        volume: 1,
      });
      mirror.sync({
        mediaPath: 'C:/music/one.wav',
        isPlaying: true,
        positionMs: 200,
        volume: 1,
      });
      await settle();

      expect(calls).toEqual(['pause', 'play']);
    });

    it('loads the next track when the queue advances', async () => {
      const { calls, mirror } = await running();

      mirror.sync({
        mediaPath: 'C:/music/two.wav',
        isPlaying: true,
        positionMs: 0,
        volume: 1,
      });
      await settle();

      expect(calls).toEqual(['load(0)', 'select(0)', 'play']);
    });

    it('unloads when the queue empties', async () => {
      const { calls, mirror } = await running();

      mirror.sync({
        mediaPath: undefined,
        isPlaying: false,
        positionMs: 0,
        volume: 1,
      });
      await settle();

      expect(calls).toEqual(['unload(0)']);
    });
  });

  /**
   * The whole sequence that silenced the engine, because no smaller one does.
   *
   * Reported as: play from the library, go to Karaoke, come back to the
   * library — and the native engine is heard no more, with the deck loaded and
   * selected and nothing throwing anywhere.
   *
   * `playing` is what `sync` compares against to decide whether to send a
   * transport command. Set only on the branch that started playback, it
   * survived as true across a cue that never played, and then agreed with the
   * `isPlaying` that arrived a moment later — so no play was ever sent.
   *
   * Every step matters. The second cue has to arrive with `isPlaying` false,
   * which is what really happens: the track changes on the render before the
   * element fires `play`. Collapse that and the test passes against the bug.
   */
  it('plays a track cued after an unload, once the element starts', async () => {
    const { controller, calls } = controllerSpy();
    const element = fakeElement();
    const mirror = createNativeMirror(controller, [element]);

    // Playing from the library.
    mirror.sync({
      mediaPath: 'C:/music/one.wav',
      isPlaying: true,
      positionMs: 0,
      volume: 1,
    });
    await settle();

    // Karaoke takes over: the library has no track, so the deck is emptied.
    mirror.sync({
      mediaPath: undefined,
      isPlaying: false,
      positionMs: 0,
      volume: 1,
    });
    await settle();
    calls.length = 0;

    // Back to the library. The track is set a render before the element has
    // fired `play`, so this cue is not yet playing.
    mirror.sync({
      mediaPath: 'C:/music/two.wav',
      isPlaying: false,
      positionMs: 0,
      volume: 1,
    });
    await settle();

    // And now the element starts, which is the tick that has to reach the host.
    mirror.sync({
      mediaPath: 'C:/music/two.wav',
      isPlaying: true,
      positionMs: 0,
      volume: 1,
    });
    await settle();

    expect(calls).toContain('play');
  });

  /**
   * The positive control for the test above: the same run, asserted on the
   * host rather than on the flag, so "it sent play" cannot be satisfied by a
   * mirror that sends play at every opportunity.
   */
  it('does not play a deck cued while the player is paused', async () => {
    const { controller, calls } = controllerSpy();
    const element = fakeElement();
    const mirror = createNativeMirror(controller, [element]);

    mirror.sync({
      mediaPath: 'C:/music/one.wav',
      isPlaying: false,
      positionMs: 0,
      volume: 1,
    });
    await settle();

    expect(calls).not.toContain('play');
    expect(calls).toContain('pause');
  });

  /**
   * A format the native decoder cannot read yet — every compressed one, today.
   *
   * The element is still playing it, muted. Sitting there in silence while
   * claiming to be the native engine is the worst of the three options; the
   * honest one is to hand the sound back and let the TypeScript path be heard.
   */
  it('unmutes the element when the host refuses the file', async () => {
    const { controller } = controllerSpy({
      load: () => Promise.resolve(false),
    });
    const element = fakeElement();
    const mirror = createNativeMirror(controller, [element]);

    mirror.sync({
      mediaPath: 'C:/music/song.mp3',
      isPlaying: true,
      positionMs: 0,
      volume: 1,
    });
    await settle();

    expect(element.muted).toBe(false);
  });
});

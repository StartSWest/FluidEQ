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

const settle = () =>
  new Promise((resolve) => {
    setTimeout(resolve, 0);
  });

describe('the native mirror', () => {
  /**
   * Muted, never paused, and the distinction is the whole design.
   *
   * Pausing the element would stop the clock the entire player reads from:
   * position, the end-of-track event, the crossfade's cue point and the
   * queue's advance all hang off it. Muted, every one of those keeps working
   * and only the sound moves to the other engine.
   */
  it('mutes the elements rather than pausing them', () => {
    const { controller } = controllerSpy();
    const elements = [fakeElement(), fakeElement()];

    createNativeMirror(controller, elements);

    expect(elements.every((element) => element.muted)).toBe(true);
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
    });
    await settle();

    expect(calls).toEqual(['load(0)', 'select(0)', 'play']);
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
    });
    await settle();

    expect(calls).toContain('seek(92)');
  });

  describe('while a track plays', () => {
    const running = async () => {
      const spy = controllerSpy();
      const mirror = createNativeMirror(spy.controller, [fakeElement()]);
      mirror.sync({
        mediaPath: 'C:/music/one.wav',
        isPlaying: true,
        positionMs: 0,
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
      });
      mirror.sync({
        mediaPath: 'C:/music/one.wav',
        isPlaying: true,
        positionMs: 500,
      });
      await settle();

      expect(calls).toEqual([]);
    });

    /**
     * The bug this file exists to keep out, and it was shipped once.
     *
     * "Drift" used to be measured against the PREVIOUS reading rather than
     * against where the element should be by now â so it was really measuring
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
     * against where the element should be by now â so it really measured how
     * long the render took to arrive. A renderer that stalled for six hundred
     * milliseconds looked exactly like a listener dragging the scrubber, and
     * the answer to that is a seek, and a seek empties the read-ahead ring.
     *
     * Which made it feed itself: under load the renders come further apart, so
     * it seeks more often, so it drops out more. It crackled worst on the
     * machine that could least afford it â which is also the machine somebody
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
      });
      await settle();

      expect(calls).toEqual([]);
      clock.mockRestore();
    });

    /**
     * Paused, the element's position does not advance â so neither should the
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
      });
      calls.length = 0;

      clock.mockReturnValue(31_000);
      mirror.sync({
        mediaPath: 'C:/music/one.wav',
        isPlaying: false,
        positionMs: 0,
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
      });
      mirror.sync({
        mediaPath: 'C:/music/one.wav',
        isPlaying: true,
        positionMs: 200,
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
      });
      await settle();

      expect(calls).toEqual(['load(0)', 'select(0)', 'play']);
    });

    it('unloads when the queue empties', async () => {
      const { calls, mirror } = await running();

      mirror.sync({ mediaPath: undefined, isPlaying: false, positionMs: 0 });
      await settle();

      expect(calls).toEqual(['unload(0)']);
    });
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
    });
    await settle();

    expect(element.muted).toBe(false);
  });
});

/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The mirror says which file the host's clock is about.
 *
 * Telemetry names no file, so between a change of track and the host having
 * the new one its position is the song before's. The player judged the new
 * song's end by it, and handed over at once (Ivan, 2026-11-24); it now asks
 * the mirror (`onClockTrack`) whose clock it is reading.
 */
import { DSP_DEFAULTS } from '../../../common/dsp/chain';
import { INativeBackendController } from '../../../renderer/dsp/nativeBackend';
import createNativeMirror from '../../../renderer/dsp/nativeMirror';

/** A host whose loads can be held, to look at the moment between. */
const heldHost = () => {
  const held = new Map<string, () => void>();
  let readable = true;
  const ok = () => Promise.resolve(true);
  const controller = {
    engage: ok,
    disengage: () => Promise.resolve(),
    update: ok,
    transport: {
      load: ok,
      loadFor: (purpose: string, path: string) => {
        if (purpose !== 'handoff') {
          return Promise.resolve(undefined);
        }
        const deck = readable ? 0 : undefined;
        if (!path.includes('held')) {
          return Promise.resolve(deck);
        }
        return new Promise<number | undefined>((resolve) => {
          held.set(path, () => resolve(deck));
        });
      },
      unload: ok,
      play: ok,
      pause: ok,
      seek: ok,
      select: ok,
      setVolume: ok,
      crossfade: ok,
      setTrackGains: ok,
    },
  } as unknown as INativeBackendController;
  return {
    controller,
    release: (path: string) => held.get(path)?.(),
    refuse: () => {
      readable = false;
    },
  };
};

const element = (): HTMLMediaElement =>
  ({
    muted: false,
    paused: false,
    play: () => Promise.resolve(),
    pause: () => undefined,
  }) as unknown as HTMLMediaElement;

/** Every file the mirror names, and a wait for the next one. */
const clockTold = () => {
  const told: (string | undefined)[] = [];
  let waiting: ((path: string | undefined) => void) | undefined;
  return {
    told,
    onClockTrack: (path: string | undefined) => {
      told.push(path);
      const wake = waiting;
      waiting = undefined;
      wake?.(path);
    },
    next: () =>
      new Promise<string | undefined>((resolve) => {
        waiting = resolve;
      }),
  };
};

describe('the file the host clock is about', () => {
  it('is named once the host holds the track, and taken back while the next one loads', async () => {
    const host = heldHost();
    const clock = clockTold();
    const mirror = createNativeMirror(host.controller, [element()], undefined, {
      onClockTrack: clock.onClockTrack,
    });

    const first = clock.next();
    mirror.sync({ mediaPath: 'C:/one.mp3', isPlaying: true, positionMs: 0 });
    expect(await first).toBe('C:/one.mp3');

    // Pressed: the host still plays one.mp3 while two is on its way.
    const between = clock.next();
    mirror.sync({
      mediaPath: 'C:/held-two.mp3',
      isPlaying: true,
      positionMs: 0,
    });
    expect(await between).toBeUndefined();

    const arrived = clock.next();
    host.release('C:/held-two.mp3');
    expect(await arrived).toBe('C:/held-two.mp3');
    expect(clock.told).toEqual(['C:/one.mp3', undefined, 'C:/held-two.mp3']);
  });

  it('is the incoming file of a fade once the host has started the fade', async () => {
    const host = heldHost();
    const clock = clockTold();
    const mirror = createNativeMirror(host.controller, [element()], undefined, {
      onClockTrack: clock.onClockTrack,
    });
    const first = clock.next();
    mirror.sync({ mediaPath: 'C:/one.mp3', isPlaying: true, positionMs: 0 });
    expect(await first).toBe('C:/one.mp3');

    const transition = {
      durationMs: DSP_DEFAULTS.crossfade.durationMs,
      curve: DSP_DEFAULTS.crossfade.curve,
      shape: DSP_DEFAULTS.crossfade.shape,
    };
    const between = clock.next();
    mirror.sync({
      mediaPath: 'C:/held-two.mp3',
      isPlaying: true,
      positionMs: 0,
      transition,
    });
    expect(await between).toBeUndefined();
    const arrived = clock.next();
    host.release('C:/held-two.mp3');
    expect(await arrived).toBe('C:/held-two.mp3');
  });

  it('is none once the mirror lets the host go', async () => {
    const host = heldHost();
    const clock = clockTold();
    const mirror = createNativeMirror(host.controller, [element()], undefined, {
      onClockTrack: clock.onClockTrack,
    });
    const first = clock.next();
    mirror.sync({ mediaPath: 'C:/one.mp3', isPlaying: true, positionMs: 0 });
    expect(await first).toBe('C:/one.mp3');

    mirror.release(false);
    expect(clock.told).toEqual(['C:/one.mp3', undefined]);
  });

  it('is taken back when the host cannot open the next file', async () => {
    const host = heldHost();
    const clock = clockTold();
    let refused: () => void = () => undefined;
    const wasRefused = new Promise<void>((resolve) => {
      refused = resolve;
    });
    const mirror = createNativeMirror(host.controller, [element()], undefined, {
      onClockTrack: clock.onClockTrack,
      onTrackRefused: () => refused(),
    });
    const first = clock.next();
    mirror.sync({ mediaPath: 'C:/one.mp3', isPlaying: true, positionMs: 0 });
    expect(await first).toBe('C:/one.mp3');

    host.refuse();
    mirror.sync({ mediaPath: 'C:/bad.mp3', isPlaying: true, positionMs: 0 });
    await wasRefused;
    // The elements play it, on a clock of their own.
    expect(clock.told).toEqual(['C:/one.mp3', undefined]);
  });
});

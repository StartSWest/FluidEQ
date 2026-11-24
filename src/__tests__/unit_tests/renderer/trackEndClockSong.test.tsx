/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * An end is judged from a clock that is the playing song's.
 *
 * Ivan, 2026-11-24: on the album page he pressed "It's Gonna Be Me" while
 * another song of the album played, and the player started "Track 6", an
 * untagged file from elsewhere in the library. His stored queue said what
 * happened: the pressed song, then the ten songs Keep playing draws under a
 * queue of one, at position 1 — moved on before the album's list arrived.
 * The press moves the queue at once and the clock only once the song is
 * loaded, so for that moment the host still reported the song before at 4:10;
 * read as the pressed song's (3:11) it was past its end, and the player
 * handed over to what stood next.
 */
import { renderHook } from '@testing-library/react';
import { DSP_DEFAULTS, type IDspSettings } from 'common/dsp/chain';
import type { ILibraryQueue } from 'common/library/queue';
import type { ILibraryProgrammeEdges } from 'common/library/types';
import useTrackEnd from 'renderer/library/player/useTrackEnd';
import { hostClockTrackOf } from 'renderer/library/player/usePlayerEngine';

type TOptions = Parameters<typeof useTrackEnd>[0];

const PRESSED = "It's Gonna Be Me";
const DRAWN = 'Track 6';
const BEFORE = 'This I Promise You';

/** The press, and what Keep playing drew under it. */
const queue: ILibraryQueue = {
  trackIds: [PRESSED, DRAWN, 'drawn 2', 'drawn 3'],
  order: [0, 1, 2, 3],
  position: 0,
  repeat: 'off',
  isShuffled: false,
};

const crossfading: IDspSettings = {
  ...DSP_DEFAULTS,
  enabled: true,
  crossfade: { ...DSP_DEFAULTS.crossfade, enabled: true },
};

/** "It's Gonna Be Me" is 3:11, its music measured to end at 3:09. */
const pressedEdges = { endMs: 189_000 } as ILibraryProgrammeEdges;

interface IClock {
  positionMs: number;
  durationMs: number;
  hostEnded?: boolean;
  /** The song the host's clock is about, as the mirror says. */
  hostClockTrackId?: string;
}

const setUp = ({
  hostOwns,
  elementSong = PRESSED,
}: {
  hostOwns: boolean;
  /** The song the loader last tagged the element with. */
  elementSong?: string;
}) => {
  const element = { currentTime: 0 } as unknown as HTMLAudioElement;
  const setQueue = jest.fn();
  const options = (clock: IClock): TOptions => ({
    queueRef: { current: queue },
    setQueue,
    setIsPlaying: jest.fn(),
    setRetainWhenHidden: jest.fn(),
    trackIdRef: { current: PRESSED },
    audioElementRef: { current: element },
    endedTrackRef: { current: undefined },
    naturalCrossfadeTrackRef: { current: undefined },
    programmeEdgesRef: { current: new Map([[element, pressedEdges]]) },
    hostOwnsTransportRef: { current: hostOwns },
    seekHost: jest.fn(),
    hostEnded: clock.hostEnded ?? false,
    hostClockTrackId: clock.hostClockTrackId,
    elementTrackRef: { current: new Map([[element, elementSong]]) },
    dspSettings: crossfading,
    publishedPositionMs: clock.positionMs,
    publishedDurationMs: clock.durationMs,
  });
  // No duration yet: nothing to judge an end by.
  const start: IClock = { positionMs: 0, durationMs: 0 };
  const hook = renderHook((clock: IClock) => useTrackEnd(options(clock)), {
    initialProps: start,
  });
  return { setQueue, hook };
};

/** The song before, 4:10 into its 4:45, as the host reports it. */
const before = (overrides: Partial<IClock> = {}): IClock => ({
  positionMs: 250_000,
  durationMs: 285_000,
  ...overrides,
});

const handedOverTo = (setQueue: jest.Mock): string | undefined => {
  const { calls } = setQueue.mock;
  const [next] = calls[calls.length - 1] ?? [];
  const moved = next as ILibraryQueue | undefined;
  return moved ? moved.trackIds[moved.order[moved.position] ?? -1] : undefined;
};

describe('the hand-over before a song ends', () => {
  it('waits while the host still reports the song before the press', () => {
    const { setQueue, hook } = setUp({ hostOwns: true });
    hook.rerender(before());
    // The next frames, still about the song before.
    hook.rerender(before({ positionMs: 250_250 }));
    hook.rerender(before({ positionMs: 250_500 }));
    expect(setQueue).not.toHaveBeenCalled();
  });

  it('hands over once the host has the song and it reaches its end (the control)', () => {
    const { setQueue, hook } = setUp({ hostOwns: true });
    hook.rerender({
      positionMs: 120_000,
      durationMs: 191_000,
      hostClockTrackId: PRESSED,
    });
    expect(setQueue).not.toHaveBeenCalled();
    hook.rerender({
      positionMs: 187_500,
      durationMs: 191_000,
      hostClockTrackId: PRESSED,
    });
    expect(handedOverTo(setQueue)).toBe(DRAWN);
  });

  it('waits while the element is still the song before, until the loader has it', () => {
    const { setQueue, hook } = setUp({ hostOwns: false, elementSong: BEFORE });
    hook.rerender(before());
    hook.rerender(before({ positionMs: 250_250 }));
    expect(setQueue).not.toHaveBeenCalled();
  });

  it('hands over on the element when its clock is the song’s (the control)', () => {
    const { setQueue, hook } = setUp({ hostOwns: false });
    hook.rerender({ positionMs: 120_000, durationMs: 191_000 });
    expect(setQueue).not.toHaveBeenCalled();
    hook.rerender({ positionMs: 187_500, durationMs: 191_000 });
    expect(handedOverTo(setQueue)).toBe(DRAWN);
  });
});

describe('the end the host reports', () => {
  it('is not the pressed song’s while the host is on the song before', () => {
    const { setQueue, hook } = setUp({ hostOwns: true });
    hook.rerender(before({ positionMs: 285_000, hostEnded: true }));
    expect(setQueue).not.toHaveBeenCalled();
  });

  it('moves on when the song playing ends (the control)', () => {
    const { setQueue, hook } = setUp({ hostOwns: true });
    hook.rerender({
      positionMs: 191_000,
      durationMs: 191_000,
      hostEnded: true,
      hostClockTrackId: PRESSED,
    });
    expect(handedOverTo(setQueue)).toBe(DRAWN);
  });
});

describe('the song the host clock is about', () => {
  const pressed = { id: PRESSED, path: 'C:/Music/02 It’s Gonna Be Me.mp3' };

  it('is the player’s song once the mirror has its file there', () => {
    expect(hostClockTrackOf(pressed.path, pressed)).toBe(PRESSED);
  });

  it('is none while the mirror is on another file or none', () => {
    expect(
      hostClockTrackOf('C:/Music/06 This I Promise You.mp3', pressed),
    ).toBeUndefined();
    expect(hostClockTrackOf(undefined, pressed)).toBeUndefined();
    expect(hostClockTrackOf(pressed.path, undefined)).toBeUndefined();
  });
});

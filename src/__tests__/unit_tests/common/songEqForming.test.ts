/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { FilterTypeEnum, ISmartEqSettings } from 'common/constants';
import { buildSongIdentity } from 'common/songIdentity';
import {
  SONG_EQ_SETTLE_MS,
  ISongEqRecorderState,
  TSongEqEffect,
  TSongEqEvent,
  getInitialRecorderState,
  reduceSongEq,
} from 'common/songEqRecorder';

/**
 * The curve Smart correction puts on while it measures a song is that
 * song's own (Ivan, 2026-11-27: "continue to apply the EQ while measuring").
 *
 * A song with nothing kept starts flat (2026-11-26), and the lookup that
 * says so lands after the song's two-second settle — by when the first steps
 * of its own curve are on. Read as the last song's curve, they were taken off
 * there: a jump to flat two seconds into every song, then the walk again.
 */

const layerOf = (gain: number): ISmartEqSettings => ({
  filters: {
    'smart-1000': {
      id: 'smart-1000',
      frequency: 1000,
      gain,
      quality: 1.4,
      type: FilterTypeEnum.PK,
    },
  },
});

const songA = buildSongIdentity('library', 'a', 'Song A', 'Artist');
const songB = buildSongIdentity('library', 'b', 'Song B', 'Artist');
if (!songA || !songB) {
  throw new Error('test fixtures produced no identity');
}

const run = (
  start: ISongEqRecorderState,
  steps: Array<[number, TSongEqEvent]>,
): { state: ISongEqRecorderState; effects: TSongEqEffect[] } => {
  let state = start;
  const effects: TSongEqEffect[] = [];
  steps.forEach(([now, event]) => {
    const [next, produced] = reduceSongEq(state, event, now);
    state = next;
    effects.push(...produced);
  });
  return { state, effects };
};

const armed = (): ISongEqRecorderState => ({
  ...getInitialRecorderState(),
  deviceId: 'device-a',
  isSaveOn: true,
  isAutoEqRunning: true,
  isSongsOn: true,
});

const applied = (effects: TSongEqEffect[]) =>
  effects.filter((effect) => effect.kind === 'applyLayer');

/** Song A playing, its first step on at one second, then its lookup. */
const firstSecondsOf = (step: TSongEqEvent): Array<[number, TSongEqEvent]> => [
  [0, { kind: 'nowPlaying', identity: songA, isPlaying: true }],
  [1000, step],
  [SONG_EQ_SETTLE_MS + 1, { kind: 'tick' }],
  [SONG_EQ_SETTLE_MS + 2, { kind: 'matched', identity: songA }],
];

describe('the curve forming for a song', () => {
  it('stays on when the song’s lookup finds nothing kept', () => {
    const forming = run(
      armed(),
      firstSecondsOf({
        kind: 'forming',
        layer: layerOf(1.5),
        songKey: songA.key,
      }),
    );
    expect(applied(forming.effects)).toEqual([]);
    expect(forming.state.liveLayer).toEqual(layerOf(1.5));

    // The control: the same layer written as an ordinary own write is the
    // last song's for all the lookup knows, and goes.
    const written = run(
      armed(),
      firstSecondsOf({ kind: 'ownWrite', layer: layerOf(1.5) }),
    );
    expect(applied(written.effects)).toEqual([
      { kind: 'applyLayer', settings: undefined },
    ]);
  });

  it('is another song’s for the next song’s lookup', () => {
    const { effects, state } = run(armed(), [
      [0, { kind: 'nowPlaying', identity: songA, isPlaying: true }],
      [500, { kind: 'forming', layer: layerOf(1.5), songKey: songA.key }],
      // Skipped before it settled: nothing closes, the curve is still on.
      [900, { kind: 'nowPlaying', identity: songB, isPlaying: true }],
      [900 + SONG_EQ_SETTLE_MS + 1, { kind: 'tick' }],
      [900 + SONG_EQ_SETTLE_MS + 2, { kind: 'matched', identity: songB }],
    ]);
    expect(applied(effects)).toEqual([
      { kind: 'applyLayer', settings: undefined },
    ]);
    expect(state.liveLayer).toBeUndefined();
  });

  it('stays the song’s own through a pause in its first seconds', () => {
    // The pause drops a session that never settled; the curve forming is
    // still this song's when it plays on and is looked up.
    const { effects } = run(armed(), [
      [0, { kind: 'nowPlaying', identity: songA, isPlaying: true }],
      [800, { kind: 'forming', layer: layerOf(1), songKey: songA.key }],
      [1200, { kind: 'nowPlaying', identity: songA, isPlaying: false }],
      [5000, { kind: 'nowPlaying', identity: songA, isPlaying: true }],
      [5000 + SONG_EQ_SETTLE_MS + 1, { kind: 'tick' }],
      [5000 + SONG_EQ_SETTLE_MS + 2, { kind: 'matched', identity: songA }],
    ]);
    expect(applied(effects)).toEqual([]);
  });

  it('is taken off at the song’s end, as a measured one is', () => {
    const forming = run(armed(), [
      [0, { kind: 'nowPlaying', identity: songA, isPlaying: true }],
      [SONG_EQ_SETTLE_MS + 1, { kind: 'tick' }],
      [5000, { kind: 'forming', layer: layerOf(2), songKey: songA.key }],
      [9000, { kind: 'closing' }],
    ]);
    expect(applied(forming.effects)).toEqual([
      { kind: 'applyLayer', settings: undefined },
    ]);
    expect(forming.state.liveLayer).toBeUndefined();
    expect(forming.state.formingKey).toBeUndefined();

    // The control: an own write that was not this song's forming is left,
    // as it always was.
    const written = run(armed(), [
      [0, { kind: 'nowPlaying', identity: songA, isPlaying: true }],
      [SONG_EQ_SETTLE_MS + 1, { kind: 'tick' }],
      [5000, { kind: 'ownWrite', layer: layerOf(2) }],
      [9000, { kind: 'closing' }],
    ]);
    expect(applied(written.effects)).toEqual([]);
  });

  it('is forgotten with the automatic mode', () => {
    const { effects } = run(armed(), [
      [0, { kind: 'nowPlaying', identity: songA, isPlaying: true }],
      [SONG_EQ_SETTLE_MS + 1, { kind: 'tick' }],
      [5000, { kind: 'forming', layer: layerOf(2), songKey: songA.key }],
      // Switched off, the engine takes its layer off itself.
      [6000, { kind: 'autoEqChanged', isRunning: false }],
      [6001, { kind: 'ownWrite', layer: undefined }],
      [9000, { kind: 'closing' }],
    ]);
    // Nothing more to take off at the end: the layer is already gone.
    expect(applied(effects)).toEqual([]);
  });
});

/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import { FilterTypeEnum, ISmartEqSettings } from 'common/constants';
import { buildSongIdentity, ISongIdentity } from 'common/songIdentity';
import {
  SONG_EQ_MIN_LISTENED_MS,
  SONG_EQ_SETTLE_MS,
  SONG_EQ_SUSPEND_GRACE_MS,
  ISongEqRecorderState,
  TSongEqEffect,
  TSongEqEvent,
  getInitialRecorderState,
  reduceSongEq,
} from 'common/songEqRecorder';

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

/** Drive a list of events through the reducer, collecting every effect. */
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
  liveLayer: layerOf(2),
});

/** Play `identity` for `ms`, ticking once a second, then stop. */
const play = (
  identity: ISongIdentity,
  ms: number,
  from = 0,
): Array<[number, TSongEqEvent]> => {
  const steps: Array<[number, TSongEqEvent]> = [
    [from, { kind: 'nowPlaying', identity, isPlaying: true }],
  ];
  for (let at = 1000; at <= ms; at += 1000) {
    steps.push([from + at, { kind: 'tick' }]);
  }
  return steps;
};

describe('songEqRecorder', () => {
  it('saves nothing for a song skipped after ninety seconds', () => {
    const { effects } = run(armed(), [
      ...play(songA, 90_000),
      [90_001, { kind: 'nowPlaying', identity: songB, isPlaying: true }],
    ]);
    expect(effects.filter((effect) => effect.kind === 'commit')).toHaveLength(
      0,
    );
    expect(
      effects.filter((effect) => effect.kind === 'checkpoint'),
    ).toHaveLength(0);
  });

  it('saves a song played for over two minutes', () => {
    // THE POSITIVE CONTROL. Without it the test above passes against a reducer
    // that never saves anything, which is precisely how the separation packing
    // bug got through a perfect-looking null test.
    const { effects } = run(armed(), [
      ...play(songA, 130_000),
      [130_001, { kind: 'nowPlaying', identity: songB, isPlaying: true }],
    ]);
    const commits = effects.filter((effect) => effect.kind === 'commit');
    expect(commits).toHaveLength(1);
    expect(commits[0]).toMatchObject({ deviceId: 'device-a' });
  });

  it('checkpoints the moment two minutes are reached, before the song ends', () => {
    const { effects } = run(armed(), play(songA, 125_000));
    const checkpoints = effects.filter(
      (effect) => effect.kind === 'checkpoint',
    );
    expect(checkpoints).toHaveLength(1);
  });

  it('ignores a track that never settles', () => {
    // Clicking through a queue. Nothing is recorded and, more importantly,
    // nothing is applied — every match is a config write and a reload.
    const { effects } = run(armed(), [
      [0, { kind: 'nowPlaying', identity: songA, isPlaying: true }],
      [500, { kind: 'nowPlaying', identity: songB, isPlaying: true }],
      [1000, { kind: 'nowPlaying', identity: songA, isPlaying: true }],
    ]);
    expect(effects.filter((effect) => effect.kind === 'lookup')).toHaveLength(
      0,
    );
  });

  it('looks a song up once it has settled', () => {
    // Positive control for the test above.
    const { effects } = run(armed(), [
      [0, { kind: 'nowPlaying', identity: songA, isPlaying: true }],
      [SONG_EQ_SETTLE_MS + 1, { kind: 'tick' }],
    ]);
    expect(effects.filter((effect) => effect.kind === 'lookup')).toHaveLength(
      1,
    );
  });

  it('does not count time while playback is stopped', () => {
    const steps: Array<[number, TSongEqEvent]> = [
      ...play(songA, 60_000),
      [60_001, { kind: 'nowPlaying', identity: songA, isPlaying: false }],
      // Half an hour paused.
      [1_860_000, { kind: 'nowPlaying', identity: songA, isPlaying: true }],
      [1_860_001, { kind: 'nowPlaying', identity: songB, isPlaying: true }],
    ];
    const { effects } = run(armed(), steps);
    expect(effects.filter((effect) => effect.kind === 'commit')).toHaveLength(
      0,
    );
  });

  it('resumes a suspended session that comes back inside the grace', () => {
    const { state } = run(armed(), [
      ...play(songA, 60_000),
      [60_001, { kind: 'nowPlaying', identity: songA, isPlaying: false }],
      [70_000, { kind: 'nowPlaying', identity: songA, isPlaying: true }],
    ]);
    expect(state.session?.phase).toBe('recording');
    expect(state.session?.listenedMs).toBeGreaterThanOrEqual(60_000);
  });

  it('closes a session suspended past the grace', () => {
    const { state } = run(armed(), [
      ...play(songA, 130_000),
      [130_001, { kind: 'nowPlaying', identity: songA, isPlaying: false }],
      [130_002 + SONG_EQ_SUSPEND_GRACE_MS, { kind: 'tick' }],
    ]);
    expect(state.session).toBeUndefined();
  });

  it('applies a match and restores the previous layer at the end', () => {
    const entry = {
      settings: layerOf(9),
      title: 'Song A',
      plays: 1,
      updatedAt: 1,
    };
    const { effects } = run(armed(), [
      [0, { kind: 'nowPlaying', identity: songA, isPlaying: true }],
      [SONG_EQ_SETTLE_MS + 1, { kind: 'tick' }],
      [SONG_EQ_SETTLE_MS + 2, { kind: 'matched', identity: songA, entry }],
      [
        SONG_EQ_SETTLE_MS + 3,
        { kind: 'nowPlaying', identity: songB, isPlaying: true },
      ],
    ]);
    const applied = effects.filter((effect) => effect.kind === 'applyLayer');
    // Once to lend the saved curve, once to hand back what was there before.
    expect(applied).toHaveLength(2);
    expect(applied[0]).toMatchObject({ settings: entry.settings });
    expect(applied[1]).toMatchObject({ settings: layerOf(2) });
  });

  it('raises the notice on a match', () => {
    const entry = {
      settings: layerOf(9),
      title: 'Song A',
      plays: 1,
      updatedAt: 1,
    };
    const { effects } = run(armed(), [
      [0, { kind: 'nowPlaying', identity: songA, isPlaying: true }],
      [SONG_EQ_SETTLE_MS + 1, { kind: 'tick' }],
      [SONG_EQ_SETTLE_MS + 2, { kind: 'matched', identity: songA, entry }],
    ]);
    expect(effects.filter((effect) => effect.kind === 'notice')).toHaveLength(
      1,
    );
  });

  it('drops the loan when something else writes the layer', () => {
    // A manual Smart EQ run, a preset load, a profile switch. Each is a
    // decision the user made, and this feature does not undo decisions.
    const entry = {
      settings: layerOf(9),
      title: 'Song A',
      plays: 1,
      updatedAt: 1,
    };
    const { effects } = run(armed(), [
      [0, { kind: 'nowPlaying', identity: songA, isPlaying: true }],
      [SONG_EQ_SETTLE_MS + 1, { kind: 'tick' }],
      [SONG_EQ_SETTLE_MS + 2, { kind: 'matched', identity: songA, entry }],
      [SONG_EQ_SETTLE_MS + 3, { kind: 'layerChanged', layer: layerOf(-4) }],
      [
        SONG_EQ_SETTLE_MS + 4,
        { kind: 'nowPlaying', identity: songB, isPlaying: true },
      ],
    ]);
    const applied = effects.filter((effect) => effect.kind === 'applyLayer');
    // Only the lend. Nothing was handed back.
    expect(applied).toHaveLength(1);
  });

  it('still saves a session whose loan was dropped', () => {
    // Dropping the loan stops the restore, not the save. A curve measured by
    // hand over a playing track is a better answer for that song.
    const { effects } = run(armed(), [
      ...play(songA, 130_000),
      [130_001, { kind: 'layerChanged', layer: layerOf(-4) }],
      [130_002, { kind: 'nowPlaying', identity: songB, isPlaying: true }],
    ]);
    expect(effects.filter((effect) => effect.kind === 'commit')).toHaveLength(
      1,
    );
  });

  it('records nothing while the tick is off', () => {
    const { effects } = run({ ...armed(), isSaveOn: false }, [
      ...play(songA, 130_000),
      [130_001, { kind: 'nowPlaying', identity: songB, isPlaying: true }],
    ]);
    expect(effects.filter((effect) => effect.kind === 'commit')).toHaveLength(
      0,
    );
  });

  it('still matches and applies while the tick is off', () => {
    // The tick governs recording only. Untick it and the app stops learning
    // new songs; it does not stop using the ones it knows.
    const { effects } = run({ ...armed(), isSaveOn: false }, [
      [0, { kind: 'nowPlaying', identity: songA, isPlaying: true }],
      [SONG_EQ_SETTLE_MS + 1, { kind: 'tick' }],
    ]);
    expect(effects.filter((effect) => effect.kind === 'lookup')).toHaveLength(
      1,
    );
  });

  it('commits under the output it was learned on when the device changes', () => {
    const { effects } = run(armed(), [
      ...play(songA, 130_000),
      [130_001, { kind: 'deviceChanged', deviceId: 'device-b' }],
    ]);
    const commits = effects.filter((effect) => effect.kind === 'commit');
    expect(commits).toHaveLength(1);
    expect(commits[0]).toMatchObject({ deviceId: 'device-a' });
  });

  it('commits on the way out', () => {
    const { effects } = run(armed(), [
      ...play(songA, 130_000),
      [130_001, { kind: 'closing' }],
    ]);
    expect(effects.filter((effect) => effect.kind === 'commit')).toHaveLength(
      1,
    );
  });

  it('saves at the threshold and not one millisecond under it', () => {
    // The rule is `listened >= SONG_EQ_MIN_LISTENED_MS`, so exactly the
    // threshold saves. Both sides are pinned because an off-by-one here is a
    // feature that silently never fires.
    const under = run(armed(), [
      ...play(songA, SONG_EQ_MIN_LISTENED_MS - 2000),
      [SONG_EQ_MIN_LISTENED_MS - 1, { kind: 'closing' }],
    ]);
    expect(
      under.effects.filter((effect) => effect.kind === 'commit'),
    ).toHaveLength(0);

    const at = run(armed(), [
      ...play(songA, SONG_EQ_MIN_LISTENED_MS - 2000),
      [SONG_EQ_MIN_LISTENED_MS, { kind: 'closing' }],
    ]);
    expect(
      at.effects.filter((effect) => effect.kind === 'commit'),
    ).toHaveLength(1);
  });

  it("does not carry one song's curve into the next after a pause", () => {
    // The grace close hands the loan back as an EFFECT. Anything that forgets
    // to move `liveLayer` with it commits song A's borrowed curve under song
    // B's key — and a minute's pause is all it takes to get there.
    const entry = {
      settings: layerOf(9),
      title: 'Song A',
      plays: 1,
      updatedAt: 1,
    };
    const { effects } = run(armed(), [
      [0, { kind: 'nowPlaying', identity: songA, isPlaying: true }],
      [SONG_EQ_SETTLE_MS + 1, { kind: 'tick' }],
      [SONG_EQ_SETTLE_MS + 2, { kind: 'matched', identity: songA, entry }],
      [3000, { kind: 'nowPlaying', identity: songA, isPlaying: false }],
      [3001 + SONG_EQ_SUSPEND_GRACE_MS, { kind: 'tick' }],
      ...play(songB, 130_000, 70_000),
      [210_000, { kind: 'closing' }],
    ]);
    const commits = effects.filter((effect) => effect.kind === 'commit');
    expect(commits).toHaveLength(1);
    expect(commits[0]).toMatchObject({ layer: layerOf(2) });
  });

  it('ignores a lookup that answers after the track has changed', () => {
    // `lookup` is a store read the shell answers later. Skip tracks between
    // the lookup and its answer and, without the identity check, the answer
    // for song A would be applied to song B and reported as a match for it.
    const entry = {
      settings: layerOf(9),
      title: 'Song A',
      plays: 1,
      updatedAt: 1,
    };
    const { effects } = run(armed(), [
      [0, { kind: 'nowPlaying', identity: songA, isPlaying: true }],
      [SONG_EQ_SETTLE_MS + 1, { kind: 'tick' }],
      [
        SONG_EQ_SETTLE_MS + 2,
        { kind: 'nowPlaying', identity: songB, isPlaying: true },
      ],
      [SONG_EQ_SETTLE_MS + 3, { kind: 'matched', identity: songA, entry }],
    ]);
    expect(
      effects.filter((effect) => effect.kind === 'applyLayer'),
    ).toHaveLength(0);
    expect(effects.filter((effect) => effect.kind === 'notice')).toHaveLength(
      0,
    );
  });

  it('recognises its own write even when the layer echoes back with keys re-ordered', () => {
    // The applied layer comes back to us round-tripped through the main
    // process — rebuilt and re-sanitised by `sanitizeSmartEqSettings` — so
    // its keys are never guaranteed to land in the same insertion order they
    // left in. `appliedLayer` and `echoedLayer` hold the same two bands with
    // the same values; only the order their keys were inserted in differs,
    // which is enough to make a `JSON.stringify` compare disagree even though
    // nothing audible changed.
    const bandLow = {
      id: 'smart-500',
      frequency: 500,
      gain: 3,
      quality: 1.4,
      type: FilterTypeEnum.PK,
    };
    const bandHigh = {
      id: 'smart-1500',
      frequency: 1500,
      gain: -2,
      quality: 1.4,
      type: FilterTypeEnum.PK,
    };
    const appliedLayer: ISmartEqSettings = {
      filters: { [bandLow.id]: bandLow, [bandHigh.id]: bandHigh },
    };
    const echoedLayer: ISmartEqSettings = {
      filters: { [bandHigh.id]: bandHigh, [bandLow.id]: bandLow },
    };
    const entry = {
      settings: appliedLayer,
      title: 'Song A',
      plays: 1,
      updatedAt: 1,
    };
    const { effects } = run(armed(), [
      [0, { kind: 'nowPlaying', identity: songA, isPlaying: true }],
      [SONG_EQ_SETTLE_MS + 1, { kind: 'tick' }],
      [SONG_EQ_SETTLE_MS + 2, { kind: 'matched', identity: songA, entry }],
      [SONG_EQ_SETTLE_MS + 3, { kind: 'layerChanged', layer: echoedLayer }],
      [
        SONG_EQ_SETTLE_MS + 4,
        { kind: 'nowPlaying', identity: songB, isPlaying: true },
      ],
    ]);
    const applied = effects.filter((effect) => effect.kind === 'applyLayer');
    // The lend, and the hand-back once the loan is recognised as surviving
    // the echo rather than dropped as a foreign write.
    expect(applied).toHaveLength(2);
    expect(applied[0]).toMatchObject({ settings: appliedLayer });
    expect(applied[1]).toMatchObject({ settings: layerOf(2) });
  });
});

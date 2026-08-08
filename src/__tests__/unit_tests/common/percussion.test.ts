/*
<AQUA: System-wide parametric audio equalizer interface>
Copyright (C) <2023>  <AQUA Dev Team>
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

import {
  IPercussionState,
  createPercussionState,
  getNearestPeakMs,
  getSpectralFlux,
  pushPercussionFrame,
} from 'common/percussion';

const BINS = 64;
const FRAME_MS = 45;
const OPTIONS = { windowMs: 4000 };

/** A steady tone: every bin holds the same level frame after frame. */
const sustained = () => new Array(BINS).fill(-20);

/** A transient: every bin jumps at once, which is what a drum looks like. */
const transient = (strength = 14) =>
  new Array(BINS).fill(-20).map((value) => value + strength);

/**
 * Run frames through and hand back the state, so each test reads as the signal
 * it is describing rather than as a loop.
 */
const play = (
  frames: number[][],
  state: IPercussionState = createPercussionState(),
  startMs = 0,
) =>
  frames.reduce(
    (current, bins, index) =>
      pushPercussionFrame(current, bins, startMs + index * FRAME_MS, OPTIONS),
    state,
  );

const peaksIn = (state: IPercussionState) =>
  state.history.filter((sample) => sample.isPeak);

describe('getSpectralFlux', () => {
  it('counts only what rose', () => {
    expect(getSpectralFlux([1, 5, 1], [1, 1, 1])).toBe(4);
  });

  it('ignores what fell, so a note ending is not a hit', () => {
    // The single detail the whole detector rests on. Absolute differences here
    // would put a spike on every note release as well as every attack.
    expect(getSpectralFlux([1, 1, 1], [1, 9, 1])).toBe(0);
  });

  it('is zero for an unchanging spectrum', () => {
    expect(getSpectralFlux([3, 3, 3], [3, 3, 3])).toBe(0);
  });
});

describe('pushPercussionFrame', () => {
  it('finds no hits in a sustained tone', () => {
    // A held chord is loud but never changes, so there is nothing to jump.
    const state = play(new Array(40).fill(sustained()));
    expect(peaksIn(state)).toHaveLength(0);
  });

  it('finds a hit where a transient actually is', () => {
    const frames = new Array(40).fill(sustained());
    frames[30] = transient();
    const state = play(frames);

    const peaks = peaksIn(state);
    expect(peaks).toHaveLength(1);
    expect(peaks[0].timeMs).toBe(30 * FRAME_MS);
  });

  it('finds one hit per drum, not three', () => {
    // A real hit smears over a frame or two. Without the refractory window the
    // tail of one kick counts as the next.
    const frames = new Array(40).fill(sustained());
    frames[20] = transient();
    frames[21] = transient(9);
    const state = play(frames);
    expect(peaksIn(state)).toHaveLength(1);
  });

  it('tracks a steady pulse', () => {
    // Eight hits, well apart. All eight should be found and none invented.
    const frames = new Array(80).fill(sustained());
    for (let beat = 1; beat <= 8; beat += 1) {
      frames[beat * 9] = transient();
    }
    const state = play(frames);
    expect(peaksIn(state)).toHaveLength(8);
  });

  it('ignores subdivisions between the beats', () => {
    // Quiet hats on the offbeats, loud kicks on the beat. Only the kicks are
    // the pulse anyone taps to, and they are all that should get through.
    const frames = new Array(80).fill(sustained());
    for (let beat = 1; beat <= 6; beat += 1) {
      frames[beat * 12] = transient(16);
      frames[beat * 12 + 6] = transient(2);
    }
    const state = play(frames);
    expect(peaksIn(state)).toHaveLength(6);
  });

  it('finds the same hits whether the music is loud or quiet', () => {
    // Everything is measured against the signal's own average, so the volume
    // knob must not change the game.
    const build = (scale: number) => {
      const frames = new Array(60).fill(sustained().map((v) => v * scale));
      [12, 24, 36, 48].forEach((index) => {
        frames[index] = transient(14).map((v) => v * scale);
      });
      return peaksIn(play(frames)).length;
    };
    expect(build(1)).toBe(build(0.4));
  });

  it('finds nothing in silence and does not amplify the floor', () => {
    const state = play(new Array(40).fill(new Array(BINS).fill(0)));
    expect(peaksIn(state)).toHaveLength(0);
    expect(state.history.every((sample) => sample.level === 0)).toBe(true);
  });

  it('keeps its history bounded however long it runs', () => {
    // This runs for as long as the dialog is open. A buffer that only grows is
    // a leak with a nice name.
    const state = play(new Array(600).fill(sustained()));
    const span =
      state.history[state.history.length - 1].timeMs - state.history[0].timeMs;
    expect(span).toBeLessThanOrEqual(OPTIONS.windowMs);
    expect(state.recentFlux.length).toBeLessThanOrEqual(32);
  });
});

describe('getNearestPeakMs', () => {
  it('returns nothing when nothing has been detected', () => {
    // Tapping into silence must not score — there was no beat to be early for.
    expect(getNearestPeakMs(createPercussionState(), 1000)).toBeUndefined();
  });

  it('finds the closest hit either side', () => {
    const frames = new Array(60).fill(sustained());
    frames[20] = transient();
    frames[40] = transient();
    const state = play(frames);

    expect(getNearestPeakMs(state, 20 * FRAME_MS + 30)).toBe(20 * FRAME_MS);
    expect(getNearestPeakMs(state, 40 * FRAME_MS - 30)).toBe(40 * FRAME_MS);
  });
});

describe('frame buffer aliasing', () => {
  it('finds nothing when the caller reuses one array for every frame', () => {
    // Not a wish — a regression guard. The detector keeps the array it is given
    // as `previous` and diffs the next frame against it, so a caller that
    // reuses ONE buffer hands it the very array it is about to overwrite. Every
    // frame then gets compared with itself, the flux is zero forever, and the
    // game sits there saying it cannot find the beat while the music plays.
    //
    // This asserts the failure exists so nobody "optimises" the caller back
    // into it: the fix is two buffers, alternating.
    const shared = new Array(BINS).fill(-20);
    let state = createPercussionState();
    for (let frame = 0; frame < 40; frame += 1) {
      const source = frame === 20 ? transient() : sustained();
      for (let bin = 0; bin < BINS; bin += 1) {
        shared[bin] = source[bin];
      }
      state = pushPercussionFrame(state, shared, frame * FRAME_MS, OPTIONS);
    }
    expect(peaksIn(state)).toHaveLength(0);
  });

  it('finds the transient when the caller alternates two buffers', () => {
    const buffers = [new Array(BINS).fill(-20), new Array(BINS).fill(-20)];
    let state = createPercussionState();
    for (let frame = 0; frame < 40; frame += 1) {
      const source = frame === 20 ? transient() : sustained();
      const target = buffers[frame % 2];
      for (let bin = 0; bin < BINS; bin += 1) {
        target[bin] = source[bin];
      }
      state = pushPercussionFrame(state, target, frame * FRAME_MS, OPTIONS);
    }
    expect(peaksIn(state)).toHaveLength(1);
  });
});

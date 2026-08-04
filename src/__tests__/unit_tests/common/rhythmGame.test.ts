/*
<AQUA: System-wide parametric audio equalizer interface>
Copyright (C) <2023>  <AQUA Dev Team>

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
  BEAT_MS,
  HIT_WINDOW_MS,
  EUPHORIA_STREAK,
  applyRhythmScore,
  getBeatOffset,
  getFlawlessScore,
  getHitMarkerPosition,
  getMissFraction,
  getStreakJoy,
  getStreakMultiplier,
  gradeRhythmOffset,
  gradeRhythmTap,
} from 'common/rhythmGame';

describe('getBeatOffset', () => {
  it('reads a tap just before the next beat as early, not very late', () => {
    // The whole reason this wraps. 580 of a 600ms beat is 20ms early for the
    // beat about to land, and a player who felt early should be told they were.
    expect(getBeatOffset(580)).toBe(-20);
  });

  it('reads a tap just after a beat as late', () => {
    expect(getBeatOffset(20)).toBe(20);
  });

  it('is zero exactly on the beat', () => {
    expect(getBeatOffset(0)).toBe(0);
    expect(getBeatOffset(BEAT_MS)).toBe(0);
  });

  it('survives phases beyond a single beat', () => {
    // Elapsed time is never taken modulo before it arrives here.
    expect(getBeatOffset(BEAT_MS * 7 + 30)).toBe(30);
    expect(getBeatOffset(BEAT_MS * 7 - 30)).toBe(-30);
  });

  it('never reports more than half a beat out', () => {
    for (let phase = 0; phase < BEAT_MS * 3; phase += 7) {
      expect(Math.abs(getBeatOffset(phase))).toBeLessThanOrEqual(BEAT_MS / 2);
    }
  });
});

describe('gradeRhythmTap', () => {
  it('scores a tap on the beat as perfect', () => {
    expect(gradeRhythmTap(0)).toMatchObject({
      verdict: 'perfect',
      points: 100,
    });
  });

  it('grades by distance, early and late alike', () => {
    expect(gradeRhythmTap(70).verdict).toBe('great');
    expect(gradeRhythmTap(BEAT_MS - 70).verdict).toBe('great');
    expect(gradeRhythmTap(150).verdict).toBe('good');
    expect(gradeRhythmTap(BEAT_MS - 150).verdict).toBe('good');
  });

  it('keeps the sign so the bar can show which side you were on', () => {
    expect(gradeRhythmTap(150).offsetMs).toBe(150);
    expect(gradeRhythmTap(BEAT_MS - 150).offsetMs).toBe(-150);
  });

  it('misses past the hit window', () => {
    expect(gradeRhythmTap(HIT_WINDOW_MS + 1).verdict).toBe('miss');
  });

  it('costs more the further out the miss was', () => {
    const near = getMissFraction(HIT_WINDOW_MS + 30);
    const far = getMissFraction(HIT_WINDOW_MS + 200);
    expect(far).toBeGreaterThan(near);
  });

  it('grades every possible tap in a beat without a gap', () => {
    for (let phase = 0; phase < BEAT_MS; phase += 1) {
      const hit = gradeRhythmTap(phase);
      expect(['perfect', 'great', 'good', 'miss']).toContain(hit.verdict);
      expect(Number.isFinite(hit.points)).toBe(true);
    }
  });

  it('leaves a genuine gap where missing is possible', () => {
    // If the hit window covered half a beat there would be no way to miss, and
    // the game would score a random masher the same as a player.
    expect(HIT_WINDOW_MS).toBeLessThan(BEAT_MS / 2);
  });
});

describe('applyRhythmScore', () => {
  const perfect = () => gradeRhythmTap(0);
  const worstMiss = () => gradeRhythmTap(BEAT_MS / 2);

  it('adds points for a hit and builds the streak', () => {
    const next = applyRhythmScore({ score: 340, streak: 0 }, perfect());
    expect(next.score).toBe(440);
    expect(next.streak).toBe(1);
  });

  it('multiplies a hit by the streak already earned', () => {
    const cold = applyRhythmScore({ score: 0, streak: 0 }, perfect());
    const hot = applyRhythmScore({ score: 0, streak: 8 }, perfect());
    expect(hot.score).toBeGreaterThan(cold.score * 2);
  });

  it('caps the multiplier so one lucky run cannot put the record away', () => {
    // Thirty-six consecutive hits to reach x10, and nothing beyond it.
    expect(getStreakMultiplier(36)).toBe(10);
    expect(getStreakMultiplier(9999)).toBe(getStreakMultiplier(36));
  });

  it('reads joy as the fraction of the way to the ceiling', () => {
    // The face is driven from this, so it has to span the whole range and stop
    // at the ends — a smile that saturates early has nothing left to say.
    expect(getStreakJoy(0)).toBe(0);
    expect(getStreakJoy(36)).toBe(1);
    expect(getStreakJoy(9999)).toBe(1);
    expect(getStreakJoy(18)).toBeCloseTo(0.5);
  });

  // The balance the game lives or dies on, asserted rather than eyeballed.
  it('guts a healthy run in three misses, from any height', () => {
    [500, 1000, 5000, 50000].forEach((start) => {
      let state = { score: start, streak: 0 };
      state = applyRhythmScore(state, worstMiss());
      state = applyRhythmScore(state, worstMiss());
      state = applyRhythmScore(state, worstMiss());
      // Under 3% left. A flat penalty could never do this at both 500 and
      // 50000, which is exactly why the cost is a fraction.
      expect(state.score).toBeLessThan(start * 0.03);
    });
  });

  it('still leaves the game winnable', () => {
    // Three misses from 1000, then a clean streak. If climbing back took
    // longer than a player's patience the game would be unwinnable, and a high
    // score nobody can beat is not a high score.
    let state = { score: 1000, streak: 0 };
    state = applyRhythmScore(state, worstMiss());
    state = applyRhythmScore(state, worstMiss());
    state = applyRhythmScore(state, worstMiss());
    const bottom = state.score;

    let taps = 0;
    while (state.score < 1000 && taps < 40) {
      state = applyRhythmScore(state, perfect());
      taps += 1;
    }
    expect(bottom).toBeLessThan(50);
    expect(taps).toBeLessThanOrEqual(12);
  });

  it('grows the streak only on a perfect, and never takes it back', () => {
    // Precision is enforced by the score, not by the multiplier. Taking the
    // streak as well put the ceiling out of reach - thirty-six consecutive
    // perfects is already a long climb, and knocking it back on every
    // near-miss meant most players never saw euphoria mode at all.
    const start = { score: 0, streak: 8 };
    expect(applyRhythmScore(start, gradeRhythmTap(0)).streak).toBe(9);
    expect(applyRhythmScore(start, gradeRhythmTap(70)).streak).toBe(8);
    expect(applyRhythmScore(start, gradeRhythmTap(150)).streak).toBe(8);
  });

  it('still reaches the ceiling for a player who slips now and then', () => {
    // The reason the streak is left alone, asserted. Two near-misses on the
    // way up must not stop anyone getting there.
    let state = { score: 0, streak: 0 };
    for (let tap = 0; tap < 40; tap += 1) {
      state = applyRhythmScore(
        state,
        tap === 10 || tap === 25 ? gradeRhythmTap(150) : perfect(),
      );
    }
    expect(getStreakMultiplier(state.streak)).toBe(10);
  });

  it('pays an imprecise hit, then takes a share back', () => {
    // Scoring nothing at all read as broken: you tap on the beat, the app says
    // GOOD, and the number drops. It pays first, so the tap feels like a hit.
    //
    // Whether that nets positive depends on the total, which is the whole
    // design — see the ceiling tests below. Here it only has to be true that
    // the share was taken.
    const start = { score: 1000, streak: 10 };
    const good = applyRhythmScore(start, gradeRhythmTap(150));
    const great = applyRhythmScore(start, gradeRhythmTap(70));
    const perfect = applyRhythmScore(start, gradeRhythmTap(0));
    expect(good.score).toBeLessThan(great.score);
    expect(great.score).toBeLessThan(perfect.score);
  });

  it('goes up, not down, when an imprecise hit lands on nothing', () => {
    // The crossover that makes the ceiling also makes the early game feel like
    // a game. From zero there is no share worth taking, so the points win.
    expect(
      applyRhythmScore({ score: 0, streak: 0 }, gradeRhythmTap(150)).score,
    ).toBeGreaterThan(0);
    expect(
      applyRhythmScore({ score: 0, streak: 0 }, gradeRhythmTap(70)).score,
    ).toBeGreaterThan(0);
  });

  it('caps a player who only ever hits good', () => {
    // Paying for imprecise hits must not reopen the door patience walked
    // through: the share still grows with the total, so this still stops.
    let state = { score: 0, streak: 0 };
    for (let tap = 0; tap < 5000; tap += 1) {
      state = applyRhythmScore(state, gradeRhythmTap(150));
    }
    expect(state.score).toBeLessThan(getFlawlessScore(10));
  });

  it('caps a player who only ever hits great', () => {
    let state = { score: 0, streak: 0 };
    for (let tap = 0; tap < 5000; tap += 1) {
      state = applyRhythmScore(state, gradeRhythmTap(70));
    }
    expect(state.score).toBeLessThan(getFlawlessScore(20));
  });

  it('costs a share of the total, so the penalty scales with the run', () => {
    // A fixed cost is eventually nothing next to a large score, which is how a
    // patient player creeps past a precise one.
    const small = applyRhythmScore(
      { score: 100, streak: 0 },
      gradeRhythmTap(150),
    );
    const large = applyRhythmScore(
      { score: 100000, streak: 0 },
      gradeRhythmTap(150),
    );
    expect(100 - small.score).toBeLessThan(100000 - large.score);
  });

  it('caps an imprecise player however long they play', () => {
    // The property the whole design exists for, simulated rather than asserted.
    //
    // Nine perfects then one good, forever. What the good takes grows with the
    // total, so it eventually equals what the nine put back and the score
    // stops climbing - no matter how many more taps follow.
    const play = (rounds: number) => {
      let state = { score: 0, streak: 0 };
      for (let round = 0; round < rounds; round += 1) {
        for (let tap = 0; tap < 9; tap += 1) {
          state = applyRhythmScore(state, perfect());
        }
        state = applyRhythmScore(state, gradeRhythmTap(150));
      }
      return state.score;
    };
    const early = play(200);
    const later = play(2000);
    // Ten times the taps buys under a percent more score: this player has
    // found their ceiling and more time cannot move it.
    expect(later).toBeLessThan(early * 1.01);
  });

  it('lets a flawless player pass any imprecise one, given the taps', () => {
    // The other half of the guarantee: no ceiling at all when nothing is
    // dropped, so precision always wins in the end.
    let sloppy = { score: 0, streak: 0 };
    for (let round = 0; round < 2000; round += 1) {
      for (let tap = 0; tap < 9; tap += 1) {
        sloppy = applyRhythmScore(sloppy, perfect());
      }
      sloppy = applyRhythmScore(sloppy, gradeRhythmTap(150));
    }

    let flawless = { score: 0, streak: 0 };
    let taps = 0;
    while (flawless.score <= sloppy.score) {
      flawless = applyRhythmScore(flawless, perfect());
      taps += 1;
      if (taps > 100000) {
        throw new Error('a flawless run should always overtake in the end');
      }
    }
    expect(flawless.score).toBeGreaterThan(sloppy.score);
  });

  it('resets the streak on a miss, so a disaster costs the multiplier too', () => {
    let state = { score: 400, streak: 6 };
    state = applyRhythmScore(state, worstMiss());
    expect(state.streak).toBe(0);
  });

  it('makes a near miss cheaper than a wild one', () => {
    const near = applyRhythmScore(
      { score: 1000, streak: 0 },
      gradeRhythmTap(HIT_WINDOW_MS + 20),
    );
    const wild = applyRhythmScore({ score: 1000, streak: 0 }, worstMiss());
    expect(near.score).toBeGreaterThan(wild.score);
  });

  it('floors at zero rather than going negative', () => {
    expect(applyRhythmScore({ score: 0, streak: 0 }, worstMiss()).score).toBe(
      0,
    );
    expect(applyRhythmScore({ score: 5, streak: 0 }, worstMiss()).score).toBe(
      0,
    );
  });

  it('charges something for a miss at the bottom, so flailing is not free', () => {
    // Without the flat component the floor becomes a safe place to mash.
    const state = applyRhythmScore({ score: 20, streak: 0 }, worstMiss());
    expect(state.score).toBe(0);
  });
});

describe('getHitMarkerPosition', () => {
  it('puts a perfect tap on the centre line', () => {
    expect(getHitMarkerPosition(0)).toBeCloseTo(0.5);
  });

  it('puts an early tap left of centre and a late one right', () => {
    expect(getHitMarkerPosition(-100)).toBeLessThan(0.5);
    expect(getHitMarkerPosition(100)).toBeGreaterThan(0.5);
  });

  it('keeps a wild tap on the bar instead of off the end', () => {
    expect(getHitMarkerPosition(-99999)).toBeGreaterThanOrEqual(0);
    expect(getHitMarkerPosition(99999)).toBeLessThanOrEqual(1);
  });
});

describe('gradeRhythmOffset', () => {
  it('grades a raw distance without any beat wrapping', () => {
    // The game grades against real audio peaks, which arrive at whatever
    // spacing the music has — there is no period to fold into.
    expect(gradeRhythmOffset(0).verdict).toBe('perfect');
    expect(gradeRhythmOffset(70).verdict).toBe('great');
    expect(gradeRhythmOffset(-150).verdict).toBe('good');
    expect(gradeRhythmOffset(400).verdict).toBe('miss');
  });

  it('does not wrap a large offset back into a hit', () => {
    // A tap two seconds from the nearest hit is a miss, not "on the beat after
    // next". Folding it through a beat length would have called it perfect.
    expect(gradeRhythmOffset(2000).verdict).toBe('miss');
    expect(Number.isFinite(gradeRhythmOffset(2000).offsetMs)).toBe(true);
  });

  it('keeps the sign so the marker can show early or late', () => {
    expect(gradeRhythmOffset(-120).offsetMs).toBe(-120);
    expect(gradeRhythmOffset(120).offsetMs).toBe(120);
  });
});

describe('getFlawlessScore', () => {
  const perfect = () => gradeRhythmTap(0);

  it('matches what the game actually pays for that many perfects', () => {
    // Derived from the scoring function rather than approximated, so it cannot
    // report a total the game would never produce — which is exactly what the
    // development shortcut would otherwise put on a share card.
    [1, 5, EUPHORIA_STREAK, 100].forEach((taps) => {
      let state = { score: 0, streak: 0 };
      for (let tap = 0; tap < taps; tap += 1) {
        state = applyRhythmScore(state, perfect());
      }
      expect(getFlawlessScore(taps)).toBe(state.score);
    });
  });

  it('is the most anyone can have in that many taps', () => {
    // Nothing but a perfect adds, and every alternative costs, so no sequence
    // of the same length can beat it.
    const taps = 20;
    let mixed = { score: 0, streak: 0 };
    for (let tap = 0; tap < taps; tap += 1) {
      mixed = applyRhythmScore(
        mixed,
        tap % 4 === 3 ? gradeRhythmTap(70) : perfect(),
      );
    }
    expect(mixed.score).toBeLessThan(getFlawlessScore(taps));
  });

  it('is worth nothing for no taps', () => {
    expect(getFlawlessScore(0)).toBe(0);
  });
});

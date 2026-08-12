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

/**
 * Scoring for the tap-in-time game in the support dialog.
 *
 * Kept here, away from React and Electron, because it is the only part of the
 * game that can be wrong in a way nobody would notice by looking at it. The bar
 * either animates or it does not; whether a 90ms miss should cost more than a
 * 60ms one is a judgement that deserves a test.
 */

/** One beat. 100bpm — brisk enough to be a game, slow enough to be hittable. */
export const BEAT_MS = 600;

/**
 * How far either side of the beat still counts as a hit.
 *
 * Beyond this the tap scores nothing and costs points. It is half the beat
 * minus a margin, so there is always a genuine gap between "late for this beat"
 * and "early for the next" — without it, every possible tap would be a hit of
 * some grade and missing would be impossible.
 */
export const HIT_WINDOW_MS = 200;

export const PERFECT_MS = 45;
export const GREAT_MS = 100;

export type RhythmVerdict = 'perfect' | 'great' | 'good' | 'miss';

export interface IRhythmHit {
  /**
   * Signed distance from the beat: negative early, positive late.
   *
   * Signed rather than absolute because the bar marks where the tap landed, and
   * a player who is consistently 80ms early learns something a player who is
   * "80ms out" does not.
   */
  offsetMs: number;
  verdict: RhythmVerdict;
  /**
   * The base value of a hit, before the streak multiplier. Zero on a miss —
   * what a miss costs depends on the score it is taken from, so that sum
   * belongs to `applyRhythmScore` rather than here.
   */
  points: number;
}

/** Awarded for a tap dead on the beat, before the streak multiplier. */
const PERFECT_POINTS = 100;
const GREAT_POINTS = 60;
const GOOD_POINTS = 25;

/**
 * A miss costs a share of everything you have, not a fixed number of points.
 *
 * A flat penalty cannot be frightening at both ends: 50 points is brutal at a
 * score of 80 and beneath notice at 3000, so a good run became unloseable
 * exactly when it started being worth something. Taking a fraction means two
 * or three misses gut a run from any height, which is the point.
 *
 * The fraction scales with how far out the tap was, because a near-miss and a
 * tap at random should not cost the same.
 */
const MIN_MISS_FRACTION = 0.45;
const MAX_MISS_FRACTION = 0.72;
/**
 * How far past the window counts as "as bad as it gets".
 *
 * Derived from what is actually reachable, not picked. No tap can be more than
 * half a beat from the nearest one, and the hit window already covers 200ms of
 * that, so 100ms past the window IS the worst case. Setting this any higher
 * just means the harshest penalty can never happen — which is how the first
 * attempt ended up costing 55% for a tap that should have cost 72%.
 */
const WORST_MISS_MS = BEAT_MS / 2 - HIT_WINDOW_MS;
/**
 * So a miss at nothing still stings. Without it the floor is a free space to
 * flail in, and mashing from zero costs the player nothing at all.
 */
const FLAT_MISS_PENALTY = 15;

/**
 * Consecutive hits multiply.
 *
 * This is what keeps the harsh penalty fair rather than merely punishing. If
 * climbing were as slow as falling is fast the game would be unwinnable, and a
 * high score nobody can beat is not a high score. A streak lets accuracy
 * compound, so a good run recovers from a disaster quickly — and it caps, so
 * one lucky stretch cannot put the record out of reach forever.
 *
 * Thirty-six consecutive hits to reach the ceiling. That is a long way, and it
 * is meant to be: the multiplier is also what the creature's face is reading,
 * so the climb has to be worth watching.
 */
const STREAK_STEP = 0.25;
const MAX_STREAK_MULTIPLIER = 10;

export const getStreakMultiplier = (streak: number) =>
  Math.min(MAX_STREAK_MULTIPLIER, 1 + Math.max(0, streak) * STREAK_STEP);

/**
 * The shortest streak that reaches the ceiling.
 *
 * Derived from the two constants above rather than written as 36, so retuning
 * the step or the ceiling cannot leave a stale number behind. Exported because
 * the development shortcut needs somewhere honest to jump to — hardcoding the
 * streak there would mean a shortcut that silently stops reaching euphoria the
 * first time either constant moves.
 */
export const EUPHORIA_STREAK = Math.ceil(
  (MAX_STREAK_MULTIPLIER - 1) / STREAK_STEP,
);

/**
 * What a run of `taps` consecutive perfect hits is worth, from nothing.
 *
 * The best any player can possibly have done in that many taps, since a
 * perfect is the only thing that adds and the multiplier only climbs on one.
 *
 * Summed rather than approximated, because the multiplier changes under it on
 * every tap — and derived from the same scoring function the game runs, so it
 * cannot report a total the game would never produce.
 */
export const getFlawlessScore = (taps: number): number => {
  let total = 0;
  for (let streak = 0; streak < taps; streak += 1) {
    total += Math.round(PERFECT_POINTS * getStreakMultiplier(streak));
  }
  return total;
};

/**
 * The streak as a plain 0-to-1 fraction of the way to the ceiling.
 *
 * The creature's face is driven from this rather than from the multiplier
 * itself, so the expression cannot drift out of step with the number on screen
 * when either is retuned — there is one source for both.
 */
export const getStreakJoy = (streak: number) =>
  (getStreakMultiplier(streak) - 1) / (MAX_STREAK_MULTIPLIER - 1);

/**
 * Where a tap fell relative to the nearest beat.
 *
 * `phaseMs` is how far into the current beat the tap landed, so it runs from 0
 * up to `beatMs`. A tap at 580 of a 600ms beat is 20ms early for the next beat,
 * not 580ms late for the last one — which is why this wraps rather than
 * subtracting.
 */
export const getBeatOffset = (phaseMs: number, beatMs = BEAT_MS) => {
  const wrapped = ((phaseMs % beatMs) + beatMs) % beatMs;
  return wrapped > beatMs / 2 ? wrapped - beatMs : wrapped;
};

/**
 * Grade a tap by how far it was from a real hit, in milliseconds.
 *
 * This is the one the game uses. Peaks come from the audio at whatever spacing
 * the music has, so there is no beat to wrap around — the distance is already
 * signed and already final. `gradeRhythmTap` below is the same grading with a
 * periodic beat folded in first.
 */
export const gradeRhythmOffset = (offsetMs: number): IRhythmHit => {
  const error = Math.abs(offsetMs);

  if (error <= PERFECT_MS) {
    return { offsetMs, verdict: 'perfect', points: PERFECT_POINTS };
  }
  if (error <= GREAT_MS) {
    return { offsetMs, verdict: 'great', points: GREAT_POINTS };
  }
  if (error <= HIT_WINDOW_MS) {
    return { offsetMs, verdict: 'good', points: GOOD_POINTS };
  }

  // `points` on a miss is not a score change — it is how bad the miss was, and
  // what it costs depends on what the player has. applyRhythmScore does that
  // arithmetic; this only says how far out they were.
  return { offsetMs, verdict: 'miss', points: 0 };
};

export const gradeRhythmTap = (
  phaseMs: number,
  beatMs = BEAT_MS,
): IRhythmHit => {
  const offsetMs = getBeatOffset(phaseMs, beatMs);
  const error = Math.abs(offsetMs);

  if (error <= PERFECT_MS) {
    return { offsetMs, verdict: 'perfect', points: PERFECT_POINTS };
  }
  if (error <= GREAT_MS) {
    return { offsetMs, verdict: 'great', points: GREAT_POINTS };
  }
  if (error <= HIT_WINDOW_MS) {
    return { offsetMs, verdict: 'good', points: GOOD_POINTS };
  }

  // `points` on a miss is not a score change — it is how bad the miss was, and
  // what it costs depends on what the player has. applyRhythmScore does that
  // arithmetic; this only says how far out they were.
  return { offsetMs, verdict: 'miss', points: 0 };
};

/**
 * How much of the score a miss takes, from 0 to 1.
 *
 * Exported so the balance can be reasoned about — and tested — without running
 * a whole game through it.
 */
export const getMissFraction = (offsetMs: number) => {
  const past = Math.max(0, Math.abs(offsetMs) - HIT_WINDOW_MS);
  const severity = Math.min(1, past / WORST_MISS_MS);
  return MIN_MISS_FRACTION + (MAX_MISS_FRACTION - MIN_MISS_FRACTION) * severity;
};

export interface IRhythmScore {
  score: number;
  /** Consecutive hits. Reset by any miss. */
  streak: number;
}

/**
 * What an imprecise hit costs, as a share of the running total.
 *
 * A SHARE, not a fixed amount, and this is the entire mechanism that makes the
 * score mean accuracy rather than endurance.
 *
 * The obvious designs all fail the same way. If great and good add points, time
 * beats precision outright — tap roughly for an hour and you pass anyone
 * flawless. If they simply add nothing, the flawless player is still only ahead
 * per-tap: the sloppy player's perfect taps keep landing, so their total still
 * climbs without limit and they pass anyone who stops playing. Even a fixed
 * penalty loses, because it is eventually small next to a large total.
 *
 * A proportional penalty changes the shape of the outcome rather than its
 * speed. Losing a share means the amount lost grows with the score, so any
 * steady rate of imprecision reaches a point where what a mistake takes equals
 * what the taps between mistakes put back — and the total stops there, however
 * long the session runs. A player who never errs has no such point and grows
 * without bound.
 *
 * So the ceiling is set by accuracy and nothing else. Someone erring every
 * other tap plateaus in the hundreds; someone erring once in a hundred
 * plateaus in the hundreds of thousands; someone who never errs has no
 * plateau. Playing longer moves nobody past their own accuracy.
 *
 * Great costs half what good does, because the difference between "slightly
 * off" and "nearly missed" is the thing the player is learning and flattening
 * it teaches nothing.
 */
const GREAT_SCORE_FRACTION = 0.12;
const GOOD_SCORE_FRACTION = 0.25;

/**
 * The running score after a tap.
 *
 * A perfect adds and climbs. Anything else adds a little and then gives back a
 * SHARE of the total, which is what makes the number describe how accurately
 * somebody played rather than how long they sat there — see the fractions
 * above for why a share and not an amount.
 *
 * Everything floors at zero: a negative score reads as a punishment rather
 * than a game, and there is nowhere to come back from.
 */
export const applyRhythmScore = (
  state: IRhythmScore,
  hit: IRhythmHit,
): IRhythmScore => {
  if (hit.verdict === 'miss') {
    const lost =
      state.score * getMissFraction(hit.offsetMs) + FLAT_MISS_PENALTY;
    return { score: Math.max(0, Math.round(state.score - lost)), streak: 0 };
  }

  // The streak is left alone. Only the total moves.
  //
  // Taking the multiplier as well was tried and it put the ceiling out of
  // reach: thirty-six consecutive perfects is already a long climb, and
  // knocking it back several steps on every near-miss meant most players never
  // saw euphoria mode at all. The score penalty is what enforces precision;
  // the multiplier is what makes the climb feel possible, and punishing the
  // same mistake twice only removed the reason to keep going.
  //
  // It costs nothing to give away, because the two do different jobs. A high
  // multiplier makes the taps between mistakes worth more, which raises where
  // this player's total settles — it does not remove the settling. Someone
  // erring one tap in ten still has a ceiling; a higher multiplier just means
  // a higher one, which is right, because they are playing well.
  if (hit.verdict !== 'perfect') {
    const fraction =
      hit.verdict === 'great' ? GREAT_SCORE_FRACTION : GOOD_SCORE_FRACTION;
    // Paid first, then taxed. The order is what makes an imprecise hit feel
    // like a hit rather than a punishment: early on, when the total is small,
    // the points beat the share and the number goes up. Later, when the total
    // is large, the share beats the points and it goes down.
    //
    // That crossover IS the ceiling, and it costs the guarantee nothing. The
    // payment is bounded — one hit's worth — while the cost grows with the
    // score, so there is still a point where they cancel and the total stops.
    // A player who never errs still has no such point.
    //
    // Scoring nothing at all was the alternative and it read as broken: you
    // tap on the beat, the app says GOOD, and the number drops. Being told
    // "good" while being punished teaches the wrong thing.
    const gained = Math.round(hit.points * getStreakMultiplier(state.streak));
    return {
      score: Math.max(0, Math.round((state.score + gained) * (1 - fraction))),
      streak: state.streak,
    };
  }

  return {
    score:
      state.score + Math.round(hit.points * getStreakMultiplier(state.streak)),
    streak: state.streak + 1,
  };
};

/**
 * Where to draw the tap on the bar, as a fraction from 0 (left edge) to 1
 * (right edge), with 0.5 being the target line.
 *
 * Anything past the hit window pins to the end rather than running off it, so a
 * wild tap still leaves a mark the player can see and learn from.
 */
export const getHitMarkerPosition = (
  offsetMs: number,
  windowMs = HIT_WINDOW_MS,
) => {
  const clamped = Math.max(-windowMs, Math.min(windowMs, offsetMs));
  return 0.5 + clamped / (windowMs * 2);
};

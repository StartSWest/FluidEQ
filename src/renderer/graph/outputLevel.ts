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
 * The output meter's arithmetic: real decibels, and how the two readings move.
 *
 * REAL dBFS, AND WHY THAT IS THE WHOLE POINT. The live trace on the graph is
 * deliberately NOT this. It is referenced to the record's own recent peak — see
 * `trackReferenceDb` in `useLiveOutputSpectrum` — so that turning the Windows
 * volume down does not flatten the curve into the floor and pretend the music
 * changed. That is the right answer for a shape and the wrong one for a level:
 * a meter whose top moves with the programme can never say "you are close to
 * clipping", because its top IS the programme. So nothing here is referenced to
 * anything but digital full scale. Zero is zero, and if the volume knob is at a
 * quarter the meter reads about twelve decibels lower, which is the truth.
 *
 * These are functions rather than a class or a hook because they are the only
 * part of the meter that can be checked without a sound card. The capture, the
 * splitter and the analysers need Windows and something playing; the conversion
 * and the ballistics need a number and a stopwatch.
 */

/**
 * The bottom of the meter, in dBFS.
 *
 * Sixty decibels is ten bits of a sixteen-bit range, and a consumer output that
 * quiet is already under the noise of the room it is playing in. Reaching
 * further down would spend the strip on numbers nothing ever visits; stopping
 * higher would peg the meter during ordinary quiet passages.
 */
export const LEVEL_FLOOR_DB = -60;
/** The top. Digital full scale, and nothing above it is representable. */
export const LEVEL_TOP_DB = 0;
/**
 * Where green becomes amber.
 *
 * The conventional digital headroom line. Broadcast alignment sits at −18 dBFS
 * and mastered peaks land somewhere between −1 and −6, so −12 is the point at
 * which "there is still plenty of room" stops being true. It is a warning, not
 * a fault: most music will touch amber, and that is fine.
 */
export const LEVEL_HOT_DB = -12;
/**
 * Where amber becomes red.
 *
 * Not zero, and that is deliberate. This reads sample peaks over a window of a
 * few tens of milliseconds, and a signal whose samples stop at −1 dBFS can
 * still exceed full scale between them — inter-sample peaks, and the overshoot
 * a lossy codec adds on the way to the speakers. By the time a sample actually
 * rails it is too late to be a warning, which is exactly the job `isClipping`
 * already does from the railed samples themselves. Red here means "there is no
 * longer any margin", and it is reached before the damage.
 */
export const LEVEL_OVER_DB = -3;

/**
 * How fast the fast reading falls, in dB per second.
 *
 * Instant on the way up and unhurried on the way down, which is what makes a
 * meter read as being driven by the music rather than as an average of it —
 * the same asymmetry `easeTowards` exists for. Forty-two decibels a second
 * crosses the whole strip in about a second and a half: quick enough that a
 * gap between tracks visibly empties it, slow enough that individual snare hits
 * do not strobe it.
 */
export const LEVEL_FALL_DB_PER_S = 42;
/**
 * How long a peak stands still before it starts coming back down.
 *
 * A meter without this cannot show a transient at all. The whole reason to look
 * at one is the hit that was over before the eye arrived, and at thirty frames
 * a second an unheld peak is a single frame — gone before it is seen. A second
 * is long enough to read a number off and short enough that the mark is still
 * describing the passage playing now.
 */
export const PEAK_HOLD_MS = 1000;
/**
 * And how fast it falls once the hold expires, in dB per second.
 *
 * Much slower than the level below it, so the two separate visibly: the bar
 * breathes with the music while the mark drifts down behind it. Matched rates
 * would keep the mark glued to the top of the bar, which is a peak-hold that
 * holds nothing.
 */
export const PEAK_FALL_DB_PER_S = 12;

/**
 * Which band of the meter a reading is in.
 *
 * `over` is also what a railed frame produces regardless of level — see
 * `levelZone`. There is one definition of clipping in this app and it lives in
 * the capture, from actual railed samples; this names the colour it wears.
 */
export type TLevelZone = 'safe' | 'hot' | 'over';

/** One channel's pair of readings, in real dBFS. */
export interface IOutputLevel {
  /** The fast one: instant attack, steady fall. */
  levelDb: number;
  /** The slow one: the loudest thing recently, held and then let go. */
  peakDb: number;
}

/** A channel's readings plus what the hold still owes it. */
export interface ILevelFollower extends IOutputLevel {
  holdRemainingMs: number;
}

/**
 * A linear sample amplitude as decibels below full scale.
 *
 * Floored rather than allowed to reach negative infinity: silence is a real
 * state that the meter has to draw, and `-Infinity` poisons every arithmetic it
 * touches on the way there. Not clamped at the top, because a level above zero
 * is a thing worth knowing about and `levelFraction` is where the drawing stops
 * caring.
 */
export const amplitudeToDb = (amplitude: number): number => {
  const magnitude = Math.abs(amplitude);
  // Written as a positive test so a NaN sample lands on the floor rather than
  // sailing through into `log10`.
  if (!(magnitude > 0)) {
    return LEVEL_FLOOR_DB;
  }
  return Math.max(LEVEL_FLOOR_DB, 20 * Math.log10(magnitude));
};

/**
 * The loudest sample in a block, as a linear amplitude.
 *
 * Peak rather than RMS. RMS says how loud something sounds and peak says
 * whether it fits, and only one of those two questions ends with distortion.
 */
export const readPeakAmplitude = (samples: ArrayLike<number>): number => {
  let peak = 0;
  for (let index = 0; index < samples.length; index += 1) {
    const magnitude = Math.abs(samples[index]);
    if (magnitude > peak) {
      peak = magnitude;
    }
  }
  return peak;
};

/** A channel that has heard nothing yet, which reads as silence. */
export const createLevelFollower = (): ILevelFollower => ({
  levelDb: LEVEL_FLOOR_DB,
  peakDb: LEVEL_FLOOR_DB,
  holdRemainingMs: 0,
});

/**
 * Move one channel's readings on by `deltaMs`, given what was just measured.
 *
 * Mutated in place and returned, because this runs per channel per tick for as
 * long as the app is open and there is nothing here worth allocating for.
 *
 * The rates are per second and the step is a real elapsed time rather than a
 * count of frames: the pump is an interval that a busy renderer will run late,
 * and a fall expressed per frame would quietly speed up and slow down with the
 * machine's load.
 */
export const advanceLevel = (
  follower: ILevelFollower,
  targetDb: number,
  deltaMs: number,
): ILevelFollower => {
  const elapsed = Math.max(0, deltaMs);
  const level = Number.isFinite(targetDb) ? targetDb : LEVEL_FLOOR_DB;

  // Instant attack. A meter that eases upward is a meter that under-reads
  // exactly the transients it exists to catch.
  if (level >= follower.levelDb) {
    follower.levelDb = level;
  } else {
    follower.levelDb = Math.max(
      level,
      follower.levelDb - (LEVEL_FALL_DB_PER_S * elapsed) / 1000,
    );
  }

  if (follower.levelDb >= follower.peakDb) {
    // A new peak, and the hold starts again from here.
    follower.peakDb = follower.levelDb;
    follower.holdRemainingMs = PEAK_HOLD_MS;
  } else if (follower.holdRemainingMs > 0) {
    follower.holdRemainingMs = Math.max(0, follower.holdRemainingMs - elapsed);
  } else {
    // Never below the bar it is marking: a peak under the current level would
    // be claiming the music was quieter than it audibly is.
    follower.peakDb = Math.max(
      follower.levelDb,
      follower.peakDb - (PEAK_FALL_DB_PER_S * elapsed) / 1000,
    );
  }

  follower.levelDb = Math.max(LEVEL_FLOOR_DB, follower.levelDb);
  follower.peakDb = Math.max(LEVEL_FLOOR_DB, follower.peakDb);
  return follower;
};

/**
 * Where a reading sits on the strip, 0 at the floor and 1 at full scale.
 *
 * Linear in decibels, which is what every meter worth reading does: a linear
 * amplitude scale spends four fifths of its height on the top twelve decibels
 * and leaves everything quieter squashed against the bottom.
 *
 * THE STYLESHEET DEPENDS ON THIS. `.output-meter__fill` paints its zones as
 * percentages of the same strip, so the colour changes exactly where
 * `LEVEL_HOT_DB` and `LEVEL_OVER_DB` say it should. A test asserts the two
 * fractions those constants produce, so moving a threshold here fails loudly
 * rather than sliding the colours away from the numbers they are named for.
 */
export const levelFraction = (db: number): number => {
  if (!Number.isFinite(db)) {
    return 0;
  }
  const span = LEVEL_TOP_DB - LEVEL_FLOOR_DB;
  return Math.max(0, Math.min(1, (db - LEVEL_FLOOR_DB) / span));
};

/**
 * The band a reading is in, and the colour that follows from it.
 *
 * `isClipping` wins outright. It is the capture's own verdict, taken from
 * samples pinned to either rail, and it is the one definition of clipping this
 * app has — a second one derived from the meter's own numbers would eventually
 * disagree with the badge above the graph and there would be no way to tell
 * which was right.
 */
export const levelZone = (db: number, isClipping: boolean): TLevelZone => {
  if (isClipping || db >= LEVEL_OVER_DB) {
    return 'over';
  }
  return db >= LEVEL_HOT_DB ? 'hot' : 'safe';
};

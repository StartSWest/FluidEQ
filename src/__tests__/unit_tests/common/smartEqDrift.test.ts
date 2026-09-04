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

import { IFilter } from 'common/constants';
import { gainAtFrequency, getTFCoefficients } from 'common/response';
import { getReferenceShape } from 'common/referenceCurve';
import { getSmartEqBands } from 'common/smartEq';
import {
  SMART_EQ_MAX_BOOST_DB,
  SMART_EQ_MAX_CUT_DB,
} from 'common/smartEqContinuous';
import { buildBalancedGains } from 'renderer/utils/autoBalance';

/**
 * WHAT THIS EXISTS TO CATCH, because it happened and nothing noticed.
 *
 * The anchor keeps a correction from changing the volume: subtract the weighted
 * mean of what is about to be applied and what is left is a change of tone. It
 * holds only while the cuts and the boosts it averages both actually happen.
 *
 * Once the presence gate could refuse a boost, they did not. A range that had
 * gone quiet asked to come up, the mean went positive, every band had that
 * positive number taken off it, and the boosts meant to pay for it were never
 * applied. Each pass took a little off the whole record and none of it came
 * back — so over an evening the correction slid toward its floor in the shape
 * of a deepening V, and the only symptom was that everything slowly got
 * quieter.
 *
 * A single pass looks perfect while that is happening. It is a fraction of a
 * decibel per pass, and both the shape and the direction are individually
 * defensible; only the accumulation is wrong. So the only test that can see it
 * is one that runs the loop for a long time and watches where it ends up.
 *
 * THE LOOP IS CLOSED HERE, and that is not a detail. `buildBalancedGains` adds
 * to the gains it is given, so feeding it a fixed spectrum measures an open
 * loop and runs away no matter what the code does — the first version of this
 * simulation did exactly that and blamed the solver. The measurement below is
 * the record PLUS whatever the layer is already applying, which is what the
 * analyser actually sees.
 */

const AXIS = Array.from(
  { length: 240 },
  (_value, index) =>
    10 **
    (Math.log10(20) + (index / 239) * (Math.log10(20000) - Math.log10(20))),
);

const bands = getSmartEqBands(undefined);

/** What the layer is doing at one frequency, so the loop can be closed. */
const layerAt = (filters: IFilter[], frequency: number) =>
  filters.reduce(
    (total, filter) =>
      total + gainAtFrequency(frequency, getTFCoefficients(filter)),
    0,
  );

/**
 * Four records that disagree with each other, which is the point.
 *
 * A loop that settles on one record and is then handed a different one has to
 * settle again — and the failure being guarded against is precisely one that
 * only shows when it does that repeatedly. Each of these pulls the correction a
 * different way, so a run through all of them cannot be satisfied by a single
 * answer sitting still.
 */
const RECORDS: Array<{ name: string; level: (frequency: number) => number }> = [
  {
    name: 'modern master',
    level: (f) => -15 * Math.log10(f) + 40,
  },
  {
    name: 'dark, no air',
    level: (f) => -19 * Math.log10(f) + 44,
  },
  {
    name: 'bright and thin',
    level: (f) => -9 * Math.log10(f) + 30,
  },
  {
    // The dangerous one: nothing below the lowest string, so the bass range is
    // silent for as long as it plays and the gate refuses to lift it.
    name: 'solo guitar',
    level: (f) =>
      f >= 82
        ? -15 * Math.log10(f) + 40
        : -15 * Math.log10(f) + 40 - 30 * Math.log2(82 / f),
  },
];

/** No boost below 200 Hz, which is what the gate says during the solo. */
const gateFor = (name: string) =>
  name === 'solo guitar'
    ? (frequency: number) => (frequency < 200 ? 0 : 1)
    : undefined;

interface IRun {
  meanDb: number[];
  spreadDb: number[];
  lowestDb: number;
}

/**
 * Play `passes` corrections, changing record every `perRecord` of them.
 *
 * Returns the level and the spread after every record, which is where a drift
 * shows: within one record the loop settles and looks fine, and it is the
 * handover to the next one that used to lose a little each time.
 */
const play = (passes: number, perRecord: number, mode: string): IRun => {
  let gains: Record<string, number> = {};
  const meanDb: number[] = [];
  const spreadDb: number[] = [];
  let lowestDb = 0;

  for (let pass = 0; pass < passes; pass += 1) {
    const record = RECORDS[Math.floor(pass / perRecord) % RECORDS.length];
    const applied = gains;
    const withGains = bands.map((band) => ({
      ...band,
      gain: applied[band.id] ?? 0,
    }));
    const measured = AXIS.map((frequency) => ({
      frequency,
      level:
        record.level(frequency) + layerAt(withGains as IFilter[], frequency),
    }));

    gains = buildBalancedGains(measured, withGains, {
      reference: getReferenceShape(mode),
      boostAllowance: gateFor(record.name),
    });

    // The layer is bounded downstream by `stepSmartEqGains` before anything is
    // written, so a simulation that leaves it unbounded is not simulating this
    // system. Applied here for the same reason the loop is closed at all.
    gains = Object.fromEntries(
      Object.entries(gains).map(([id, gain]) => [
        id,
        Math.max(-SMART_EQ_MAX_CUT_DB, Math.min(SMART_EQ_MAX_BOOST_DB, gain)),
      ]),
    );

    const settled = gains;
    const values = bands.map((band) => settled[band.id] ?? 0);
    lowestDb = Math.min(lowestDb, ...values);
    if ((pass + 1) % perRecord === 0) {
      meanDb.push(values.reduce((a, b) => a + b, 0) / values.length);
      spreadDb.push(Math.max(...values) - Math.min(...values));
    }
  }

  return { meanDb, spreadDb, lowestDb };
};

/*
 * WHAT THIS SIMULATION USED TO FIND, kept because each fix was a different
 * thing and the next defect will be too.
 *
 * Every one of these was a real, reproducible defect that no other test in
 * this repository could see, because none of the others runs the loop long
 * enough. A single pass looks correct while all of it is happening: the errors
 * are fractions of a decibel, individually defensible, and only the
 * accumulation is wrong. While they stood they were marked as expected
 * failures rather than skipped, so the suite turned red the moment one was
 * fixed and the assertion got read again.
 *
 * The level leak went first — from bounding the layer's tilt, then completely
 * once the layer's own level was zeroed. An attempt at it that very nearly
 * shipped is worth recording: re-centring the whole layer after the clamps does
 * remove the drift, and it also pushes bands past the cut limit and lifts
 * ranges the presence gate had refused — three existing tests caught it.
 *
 * The spread went last, in all four modes at once. Cycling records that
 * disagree walked every mode's V up against the clamps and left it there, and
 * the cause was a resolution mismatch rather than any single rule: the
 * measurement is smoothed an octave wide at the bottom, the bands sit a third
 * apart, and the per-band rules — rolloff, gating, the clamps — could leave a
 * band-to-band comb the octave-smoothed measurement was blind to. Every
 * record after the bass-less one inherited that comb and none could see it to
 * take it back. Smoothing the solved layer at the measurement's own width is
 * what ended it; the one-shot had also been hiding an inherited slope inside
 * its fitted reference line, which the determinism suite covers.
 */

describe('a Smart EQ loop left running all evening', () => {
  // Twenty records' worth, each held long enough to settle. At one correction
  // every twenty seconds this is well over an hour of listening.
  const PASSES = 200;
  const PER_RECORD = 10;

  /** All four, because a drift in one says nothing about the others. */
  describe.each(['smart', 'detail', 'balance', 'target'])('in %s', (mode) => {
    const run = play(PASSES, PER_RECORD, mode);

    /**
     * Averages of the settled part only, one whole lap of the records each.
     *
     * The first records of a run are the loop converging from flat, so their
     * spread is small because it has not finished moving rather than because
     * anything is right. Comparing against them measures the start-up, not the
     * drift — which is how the first version of this test failed the code for
     * behaving correctly.
     *
     * A whole lap, and not a quarter of the run: the records cycle, and the
     * bass-less one leaves a wider layer than the other three every time it
     * plays, so two windows that hold different numbers of it differ by that
     * much with nothing having drifted at all. Five entries out of twenty was
     * exactly that — one window caught the bass-less record twice, the other
     * once — and the comparison read a decibel of growth off a loop that was
     * repeating itself to the tenth.
     */
    const lap = RECORDS.length;
    const half = Math.floor(run.meanDb.length / 2);
    const mean = (values: number[]) =>
      values.reduce((a, b) => a + b, 0) / values.length;
    const settledEarly = (values: number[]) =>
      mean(values.slice(half, half + lap));
    const settledLate = (values: number[]) => mean(values.slice(-lap));

    it('does not quietly turn the record down', () => {
      // The anchor's whole promise. Every entry is the mean gain after one
      // record; if the loop is leaking level, these march downward.
      //
      // Detail is the exception and it is deliberate: it anchors on the bass
      // and lifts the mids and highs above it, so its layer HAS a positive mean
      // by design. What it must never do is the other direction.
      run.meanDb.forEach((value) => {
        expect(value).toBeGreaterThan(-1.5);
        expect(value).toBeLessThan(mode === 'detail' ? 4 : 1.5);
      });
    });

    it('is no lower at the end than it was early on', () => {
      // A slow ratchet is invisible in any single pass. Comparing the settled
      // end of the run with its settled middle says whether the evening as a
      // whole went anywhere, which no snapshot can.
      expect(settledLate(run.meanDb)).toBeGreaterThan(
        settledEarly(run.meanDb) - 0.5,
      );
    });

    it('does not grow a deeper V with every record', () => {
      // Spread is what a V looks like as a number. It may settle anywhere it
      // likes; what it may not do is be wider at the end of the evening than in
      // the middle of it.
      expect(settledLate(run.spreadDb)).toBeLessThan(
        settledEarly(run.spreadDb) + 1,
      );
    });

    it('settles on each record the same way every time round', () => {
      // The other half of "does not grow": the same four records, in the same
      // order, ten passes each, and by the second lap the loop has nothing
      // left to learn from them. The spread after any record must match the
      // spread after the same record a lap earlier, to within what the
      // rounding of the gains allows. This is the comb that used to survive
      // the bass-less record — it added a decibel to every lap, and this
      // comparison is the one that reads it directly.
      const lap = RECORDS.length;
      run.spreadDb.slice(lap * 2).forEach((value, index) => {
        expect(Math.abs(value - run.spreadDb[index + lap])).toBeLessThan(0.5);
      });
    });

    it('never drives a band near the clamps', () => {
      // Reaching the floor is how the drift announced itself on screen. Nothing
      // about these records justifies twenty decibels of anything — and once
      // the comb was gone, nothing in them justified the nine-decibel cut
      // ceiling either. Six is the deepest any mode goes on this material,
      // measured with a margin; a band sitting on the ceiling again means a
      // ratchet is back.
      expect(run.lowestDb).toBeGreaterThan(-6);
    });
  });
});

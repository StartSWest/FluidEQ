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
 * THE SAME SOUND MUST END AT THE SAME PLACE, whatever it started from.
 *
 * This is the whole promise. A correction that depends on where it began is not
 * a correction, it is a history: the same record would sound different for
 * having been played after a different one, and nothing on screen would say
 * why. Every mode makes some version of this claim — Target most loudly, since
 * "every record arrives at the same signature" is meaningless if the signature
 * depends on the previous record.
 *
 * It is also the property most easily lost by accident. Anything that clamps,
 * gates, deadbands or accumulates can make the answer path-dependent, and none
 * of those show up in a single pass. A tolerance corridor was designed, built
 * and taken back out during this feature's development for exactly this reason,
 * and it was this comparison that caught it.
 *
 * Two starting points, deliberately far apart: nothing at all, and a layer bent
 * hard in the wrong direction. If the loop is honest they converge.
 *
 * THEY DID NOT, FOR A LONG TIME, and the history is worth keeping because each
 * cause was a different thing that remembered where it started. Balance and
 * Target settled seven decibels apart until the layer's own level was zeroed —
 * the fitted intercept had been absorbing it — and the edge-rolloff rule took
 * away a bass hump both starts shared. The one-shot was the last to converge:
 * its reference is a line fitted to the measurement, the measurement carries
 * the layer, and a fitted line absorbs the layer's slope as readily as its
 * level, so a slope the layer arrived with was invisible to every pass after.
 * Fitting the line to the record with the layer's own response taken back off
 * is what closed it. With the tilt bound disabled the same comparison once
 * read 21.8 dB, so the bound was never the fix, only a cap on the damage.
 *
 * Every case is a hard failure now. Anything that reintroduces a memory —
 * a corridor, an asymmetric clamp, a fit through the output — turns this red.
 */

const AXIS = Array.from(
  { length: 240 },
  (_value, index) =>
    10 **
    (Math.log10(20) + (index / 239) * (Math.log10(20000) - Math.log10(20))),
);

const bands = getSmartEqBands(undefined);

const layerAt = (filters: IFilter[], frequency: number) =>
  filters.reduce(
    (total, filter) =>
      total + gainAtFrequency(frequency, getTFCoefficients(filter)),
    0,
  );

/** Real music rolls off below its lowest note; a straight line to 20 Hz does
 * not. Getting this wrong makes every conclusion about the bass wrong. */
const rolloff = (frequency: number) =>
  frequency >= 45 ? 0 : -24 * Math.log2(45 / frequency);

const RECORDS: Array<[string, (frequency: number) => number]> = [
  ['a modern master', (f) => -15 * Math.log10(f) + 40 + rolloff(f)],
  ['a dark one', (f) => -19 * Math.log10(f) + 46 + rolloff(f)],
  ['a bright one', (f) => -10 * Math.log10(f) + 34 + rolloff(f)],
];

/** A layer bent hard the wrong way, to start the second run from. */
const WRONG_START = (band: IFilter) => {
  if (band.frequency < 300) {
    return -7;
  }
  return band.frequency > 4000 ? 6 : -3;
};

const settle = (
  level: (frequency: number) => number,
  mode: string,
  from: (band: IFilter) => number,
) => {
  let gains: Record<string, number> = Object.fromEntries(
    bands.map((band) => [band.id, from(band)]),
  );
  for (let pass = 0; pass < 80; pass += 1) {
    const applied = gains;
    const withGains = bands.map((band) => ({
      ...band,
      gain: applied[band.id] ?? 0,
    }));
    const measured = AXIS.map((frequency) => ({
      frequency,
      level: level(frequency) + layerAt(withGains as IFilter[], frequency),
    }));
    gains = buildBalancedGains(measured, withGains, {
      reference: getReferenceShape(mode),
    });
    gains = Object.fromEntries(
      Object.entries(gains).map(([id, gain]) => [
        id,
        Math.max(-SMART_EQ_MAX_CUT_DB, Math.min(SMART_EQ_MAX_BOOST_DB, gain)),
      ]),
    );
  }
  return bands.map((band) => gains[band.id] ?? 0);
};

const PROBES = [40, 120, 1000, 6000, 15000];

/** What the settled layer does to the sound, which is what anybody hears. */
const responseOf = (gains: number[]) => {
  const filters = bands.map((band, index) => ({ ...band, gain: gains[index] }));
  return PROBES.map((hz) => layerAt(filters as IFilter[], hz));
};

describe('the same sound, from anywhere', () => {
  describe.each(['smart', 'detail', 'balance', 'target'])('in %s', (mode) => {
    describe.each(RECORDS)('on %s', (name, level) => {
      const fromFlat = settle(level, mode, () => 0);
      const fromWrong = settle(level, mode, WRONG_START);

      it(`lands in the same place whether ${name} started flat or bent`, () => {
        const a = responseOf(fromFlat);
        const b = responseOf(fromWrong);
        const worst = Math.max(
          ...a.map((value, index) => Math.abs(value - b[index])),
        );

        // A decibel and a half, at the frequencies anybody listens at. Not
        // zero: the clamps and the deadband are real and a correction that
        // approached its limit from opposite sides can legitimately stop a
        // little apart. Audibly the same record is the claim, not bit-exact.
        expect(worst).toBeLessThan(1.5);
      });

      it('is the same twice from the same start', () => {
        // Determinism in the plainer sense. Nothing here reads a clock or a
        // random number, and this is what says so — a solver that quietly
        // depended on either would be a nightmare to diagnose from a report of
        // "it sounds different sometimes".
        expect(settle(level, mode, () => 0)).toEqual(fromFlat);
      });
    });
  });

  /*
   * ARRIVING FROM ANOTHER MODE IS JUST ANOTHER STARTING POINT, and must land in
   * the same place as arriving from nothing. Switching modes deliberately keeps
   * the previous layer -- clearing it mid-room is a level jump nobody asked for
   * -- so the handover is the commonest "wrong start" there is: every mode
   * change begins from the last mode's answer.
   */
  describe('arriving from another mode', () => {
    const [, modern] = RECORDS[0];
    const MODES = ['smart', 'detail', 'balance', 'target'];
    const settledIn = Object.fromEntries(
      MODES.map((mode) => [mode, settle(modern, mode, () => 0)]),
    );

    MODES.forEach((to) => {
      MODES.filter((from) => from !== to).forEach((from) => {
        const start = settledIn[from];
        const fromPrevious = () => {
          const byId = Object.fromEntries(
            bands.map((band, index) => [band.id, start[index]]),
          );
          return (band: IFilter) => byId[band.id] ?? 0;
        };
        // Every mode's settled layer carries a slope, Detail's included, since
        // its lift is itself one — so this is the flat-vs-bent comparison
        // reached from every direction, and the one-shot is held to it too.
        it(`${from} to ${to} lands where ${to} lands from flat`, () => {
          const handed = settle(modern, to, fromPrevious());
          const clean = responseOf(settledIn[to]);
          const inherited = responseOf(handed);
          const worst = Math.max(
            ...clean.map((value, index) => Math.abs(value - inherited[index])),
          );
          expect(worst).toBeLessThan(1.5);
        });
      });
    });
  });

  /**
   * And the one that matters for Target specifically, since it is the mode
   * whose whole promise is a single signature: two DIFFERENT records must not
   * end up sounding the same, or the correction has stopped being a correction
   * and become an eraser.
   *
   * The bound on tilt is what makes this a real question rather than a
   * rhetorical one — with the tilt uncapped, Target dragged everything onto its
   * curve and this would have passed for the wrong reason.
   */
  it('does not flatten every record into the same one', () => {
    const [, modern] = RECORDS[0];
    const [, dark] = RECORDS[1];
    const outcomeOf = (level: (frequency: number) => number) => {
      const settled = responseOf(settle(level, 'target', () => 0));
      // What the listener ends up with: the record plus what was applied to it.
      return PROBES.map((hz, index) => level(hz) + settled[index]);
    };

    const a = outcomeOf(modern);
    const b = outcomeOf(dark);
    // The two records differ by four decibels per decade to begin with. They
    // should be closer after correction, and still recognisably not the same.
    const gap = Math.max(
      ...a.map((value, index) => Math.abs(value - b[index])),
    );

    expect(gap).toBeGreaterThan(1);
  });
});

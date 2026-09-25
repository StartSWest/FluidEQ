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
import { getSmartEqBands, getSmartEqLayout } from 'common/smartEq';
import { buildBalancedGains } from 'renderer/utils/autoBalance';

/**
 * THE SAME SOUND GIVES THE SAME LAYER, whatever was applied before it.
 *
 * This is the whole promise, and it is made by construction now: the solve
 * is a pure function of the measured spectrum and the mode. It used to be a
 * loop — the output was measured with the layer in it and each solve added
 * a residual to the last — and the promise then had to be won pass by pass:
 * Balance and Target settled seven decibels apart from two starting points
 * until the layer's level was zeroed, the one-shot until the fitted line
 * was taken off the layer's own slope, and with the tilt bound disabled the
 * same comparison once read 21.8 dB.
 *
 * What is pinned here is what could quietly bring a memory back: the solver
 * reading the gains of the bands it is handed, or anything in the answer
 * depending on something other than the spectrum.
 */

const AXIS = Array.from(
  { length: 240 },
  (_value, index) =>
    10 **
    (Math.log10(20) + (index / 239) * (Math.log10(20000) - Math.log10(20))),
);

const layout = getSmartEqLayout();

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

/** A layer bent hard the wrong way, to hand the solver as "the bands". */
const WRONG_START = (band: IFilter) => {
  if (band.frequency < 300) {
    return -7;
  }
  return band.frequency > 4000 ? 6 : -3;
};

const measure = (level: (frequency: number) => number) =>
  AXIS.map((frequency) => ({ frequency, level: level(frequency) }));

const solve = (
  level: (frequency: number) => number,
  mode: string,
  bands: IFilter[],
) => {
  const gains = buildBalancedGains(measure(level), bands, {
    reference: getReferenceShape(mode),
  });
  return layout.map((band) => gains[band.id] ?? 0);
};

const PROBES = [40, 120, 1000, 6000, 15000];

/** What the layer does to the sound, which is what anybody hears. */
const responseOf = (gains: number[]) => {
  const filters = layout.map((band, index) => ({
    ...band,
    gain: gains[index],
  }));
  return PROBES.map((hz) => layerAt(filters as IFilter[], hz));
};

describe('the same sound, from anywhere', () => {
  describe.each(['smart', 'detail', 'balance', 'target'])('in %s', (mode) => {
    describe.each(RECORDS)('on %s', (name, level) => {
      it('solves the same layer whatever the bands it is handed hold', () => {
        const fromNothing = solve(level, mode, getSmartEqBands(undefined));
        const fromBent = solve(
          level,
          mode,
          layout.map((band) => ({ ...band, gain: WRONG_START(band) })),
        );
        expect(fromBent).toEqual(fromNothing);
      });

      it('solves the same layer twice running', () => {
        const first = solve(level, mode, layout);
        const second = solve(level, mode, layout);
        expect(second).toEqual(first);
        expect(responseOf(second)).toEqual(responseOf(first));
      });

      it('is a layer about the record, not a memory of one', () => {
        // The one property a residual loop could never have: the answer for
        // this record is the answer, and no other record played before it
        // can move it. Solving a different record first changes nothing about
        // solving this one after.
        const other = RECORDS.find(([otherName]) => otherName !== name);
        expect(other).toBeDefined();
        solve((other as (typeof RECORDS)[number])[1], mode, layout);
        expect(solve(level, mode, layout)).toEqual(solve(level, mode, layout));
      });
    });
  });
});

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
  compressChainToLimit,
  getChainExcursion,
} from '../../../common/response';
import {
  FilterTypeEnum,
  IFiltersMap,
  MAX_GAIN,
} from '../../../common/constants';

const bandsFrom = (
  spec: Array<[frequency: number, gain: number, quality: number]>,
): IFiltersMap =>
  Object.fromEntries(
    spec.map(([frequency, gain, quality], index) => [
      `b${index}`,
      {
        id: `b${index}`,
        frequency,
        gain,
        quality,
        type: FilterTypeEnum.PK,
      },
    ]),
  );

/**
 * The shield in front of an applied reference.
 *
 * Built from the measurement that made this necessary: a Squiglink model with
 * no flat baseline to subtract from, which arrived as eleven wide cuts and took
 * the output to silence. Every band in it was inside the per-band ceiling. The
 * chain was not, and nothing was looking at the chain.
 */
describe('compressing a correction the equaliser cannot express', () => {
  // The real one, rounded: eleven overlapping -12 dB peaks at Q 0.5, which is
  // about two and a half octaves wide each, so their skirts all overlap.
  const silencer = bandsFrom([
    [53, -12, 0.5],
    [89, -12, 0.5],
    [136, -12, 0.5],
    [280, -12, 0.5],
    [530, -12, 0.5],
    [570, -12, 0.5],
    [1030, -12, 0.5],
    [2760, -12, 0.5],
    [2760, -12, 0.5],
    [7500, -12, 0.5],
    [7500, -12, 0.5],
  ]);

  it('sees the chain as extreme even though every band is legal', () => {
    Object.values(silencer).forEach((band) => {
      expect(Math.abs(band.gain)).toBeLessThanOrEqual(12);
    });
    // And yet.
    expect(getChainExcursion(Object.values(silencer))).toBeGreaterThan(40);
  });

  it('brings it inside what the equaliser can express', () => {
    const compressed = compressChainToLimit(silencer, MAX_GAIN);

    expect(getChainExcursion(Object.values(compressed))).toBeLessThanOrEqual(
      MAX_GAIN,
    );
  });

  // Compressed, not clipped. The correction gets gentler; it does not get a
  // shape nobody asked for.
  it('keeps every band in proportion to every other', () => {
    const compressed = compressChainToLimit(
      bandsFrom([
        [100, -30, 0.5],
        [1000, -15, 0.5],
        [8000, 7.5, 0.5],
      ]),
      MAX_GAIN,
    );
    const gains = Object.values(compressed).map((band) => band.gain);

    expect(gains[0] / gains[1]).toBeCloseTo(2, 5);
    expect(gains[1] / gains[2]).toBeCloseTo(-2, 5);
  });

  // A correction that was always usable must not be quietly weakened.
  it('leaves a sane reference exactly as it was', () => {
    const sane = bandsFrom([
      [60, 4, 0.7],
      [1500, -3, 1.4],
      [9000, 2.5, 1],
    ]);

    expect(compressChainToLimit(sane, MAX_GAIN)).toBe(sane);
  });

  it('has nothing to say about an empty band set', () => {
    expect(compressChainToLimit({}, MAX_GAIN)).toEqual({});
  });

  // A boost that runs away is as unusable as a cut that does, and the graph
  // and the preamp both have to survive it.
  it('bounds a chain that runs away upward too', () => {
    const shouting = bandsFrom([
      [100, 12, 0.5],
      [200, 12, 0.5],
      [400, 12, 0.5],
      [800, 12, 0.5],
    ]);

    expect(getChainExcursion(Object.values(shouting))).toBeGreaterThan(
      MAX_GAIN,
    );
    expect(
      getChainExcursion(
        Object.values(compressChainToLimit(shouting, MAX_GAIN)),
      ),
    ).toBeLessThanOrEqual(MAX_GAIN);
  });
});

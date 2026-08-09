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
 * A headphone correction published as a curve reaches APO as that curve.
 *
 * AutoEQ ships some profiles as `GraphicEQ:` points rather than as biquads. The
 * parser fits peaking filters to them as well, so the graph has a shape and the
 * bands have values — but that fit is an approximation, and for a while the
 * headphone layer wrote it instead of the curve. Nothing on screen showed the
 * difference: the editor draws the projection either way, so the only place the
 * downgrade was visible was in the file APO reads. Hence a test rather than a
 * look.
 */

import {
  AutoEqFormat,
  FilterTypeEnum,
  IFiltersMap,
  IGraphicEqPoint,
  IState,
  getDefaultState,
} from 'common/constants';
import {
  getHeadphoneFilters,
  getHeadphoneGraphicEq,
  hasHeadphoneLayer,
} from 'common/headphone';
import { stateToString } from 'main/flush';

/** The peaking projection a GraphicEQ profile carries for the editor. */
const PROJECTION: IFiltersMap = {
  low: {
    id: 'low',
    frequency: 105,
    gain: -4,
    quality: 1.41,
    type: FilterTypeEnum.PK,
  },
  high: {
    id: 'high',
    frequency: 3400,
    gain: 6,
    quality: 1.41,
    type: FilterTypeEnum.PK,
  },
};

/** The curve those bands were fitted to, at a resolution they cannot express. */
const CURVE: IGraphicEqPoint[] = [
  { frequency: 20, gain: -1.5 },
  { frequency: 105, gain: -4 },
  { frequency: 400, gain: 0.5 },
  { frequency: 3400, gain: 6 },
  { frequency: 16000, gain: -2.5 },
];

const stateWith = (headphone: IState['headphone']): IState => ({
  ...getDefaultState(),
  isEnabled: true,
  headphone,
});

describe('a headphone correction published as a graphic curve', () => {
  it('is written to APO as the curve, not as the bands fitted to it', () => {
    const config = stateToString(
      stateWith({ filters: PROJECTION, graphicEq: CURVE, intensity: 1 }),
    );

    expect(config).toContain(
      'GraphicEQ: 20 -1.5; 105 -4; 400 0.5; 3400 6; 16000 -2.5',
    );
    // And not both. The projection is the same correction a second time, so
    // writing it alongside would apply the curve twice.
    expect(config).not.toContain('Fc 3400 Hz');
  });

  it('keeps the point order the profile published', () => {
    // APO interpolates between neighbouring points, so sorting them or
    // deduplicating them would redraw the curve rather than tidy the list.
    const scrambled: IGraphicEqPoint[] = [
      { frequency: 16000, gain: -2.5 },
      { frequency: 20, gain: -1.5 },
    ];
    expect(
      getHeadphoneGraphicEq({
        filters: {},
        graphicEq: scrambled,
        intensity: 1,
      }),
    ).toEqual(scrambled);
  });

  it('still writes the bands when the profile is parametric', () => {
    const config = stateToString(
      stateWith({ filters: PROJECTION, intensity: 1 }),
    );

    expect(config).toContain('Fc 3400 Hz');
    expect(config).not.toContain('GraphicEQ:');
  });

  it('scales the curve by the strength, the way the bands are scaled', () => {
    const half = getHeadphoneGraphicEq({
      filters: PROJECTION,
      graphicEq: CURVE,
      intensity: 0.5,
    });

    // -0.75 comes back as -0.7 and -1.25 as -1.2, because `Math.round` breaks
    // ties towards positive infinity. Asserted rather than corrected: it is the
    // same rounding `getHeadphoneFilters` has always used, so the curve and the
    // bands round a halved correction identically, which is what matters.
    expect(half.map(({ gain }) => gain)).toEqual([-0.7, -2, 0.3, 3, -1.2]);
    // Rounded to a tenth like the filters are, so halving a correction cannot
    // write 2.8499999 into a file somebody may open.
    half.forEach(({ gain }) => {
      expect(Math.round(gain * 10) / 10).toBe(gain);
    });
  });

  it('disappears entirely at zero strength, curve and bands alike', () => {
    const off = { filters: PROJECTION, graphicEq: CURVE, intensity: 0 };

    expect(getHeadphoneGraphicEq(off)).toEqual([]);
    expect(getHeadphoneFilters(off)).toEqual([]);
    expect(hasHeadphoneLayer(off)).toBe(false);
    expect(stateToString(stateWith(off))).not.toContain('GraphicEQ:');
  });

  it('reserves headroom for the curve it wrote', () => {
    /*
     * The whole point of counting it. A graphic curve writes no `Filter` lines,
     * so a chain built from one contributes nothing to the filter peak — and a
     * +6 dB correction handed to APO under `Preamp: 0 dB` clips.
     */
    const config = stateToString(
      stateWith({ filters: PROJECTION, graphicEq: CURVE, intensity: 1 }),
    );

    expect(config).toContain('Preamp: -6 dB');
  });

  it('gives the headroom back when the layer is bypassed', () => {
    const bypassed: IState = {
      ...stateWith({ filters: PROJECTION, graphicEq: CURVE, intensity: 1 }),
      bypassed: ['headphone'],
    };
    const config = stateToString(bypassed);

    expect(config).not.toContain('GraphicEQ:');
    expect(config).toContain('Preamp: 0 dB');
  });

  it('stacks two curves rather than letting the louder one stand for both', () => {
    // The EQ and the headphone correction are separate APO stages, so their
    // boosts add. Reserving only the larger would under-protect by exactly the
    // smaller.
    const both: IState = {
      ...stateWith({ filters: PROJECTION, graphicEq: CURVE, intensity: 1 }),
      isFlat: false,
      eqFormat: AutoEqFormat.GRAPHIC,
      graphicEq: [
        { frequency: 60, gain: 3 },
        { frequency: 9000, gain: 0 },
      ],
    };

    expect(stateToString(both)).toContain('Preamp: -9 dB');
  });
});

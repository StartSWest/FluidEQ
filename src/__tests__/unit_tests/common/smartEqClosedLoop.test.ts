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

import { FilterTypeEnum, IFilter, IFiltersMap } from 'common/constants';
import {
  ISmartEqSettings,
  buildSmartEqSettings,
  getSmartEqBands,
  getSmartEqFilters,
} from 'common/smartEq';
import { IVoicingSettings, getVoicingFilters } from 'common/voicing';
import {
  buildBalancedGains,
  ISpectrumSample,
} from 'renderer/utils/autoBalance';
import { buildLayerTargetCurve } from 'renderer/utils/layerTargetCurve';
import {
  getCombinedLineData,
  getFilterLineData,
  getLineGainAtFrequency,
} from 'renderer/graph/utils';
import { IChartLineDataPointsById } from 'renderer/graph/ChartController';

/**
 * The Smart EQ loop, closed and run for real.
 *
 * Nothing here stands in for anything: the magnitudes come from the response
 * graph's own biquad code, the gains from the real solver, the layer from the
 * real accumulator. A run writes into the chain the next run then hears, which
 * is the only way the erosion this file exists to catch shows up at all — it
 * needs several passes before it is obvious, and every single pass looks
 * plausible on its own.
 *
 * The program material is a straight line in log-frequency, so that whatever
 * Smart EQ ends up doing is unambiguously its reading of the layers below
 * rather than a resonance it was right to remove.
 */

const asFilter = (
  filter: Pick<IFilter, 'type' | 'frequency' | 'gain' | 'quality'>,
  id: string,
): IFilter => ({ id, ...filter });

/** Combined magnitude response of a set of filters, in dB. */
const responseOf = (filters: IFilter[]) => {
  const lines: IChartLineDataPointsById = {};
  filters.forEach((filter, index) => {
    lines[String(index)] = getFilterLineData(asFilter(filter, String(index)));
  });
  return getCombinedLineData(0, lines);
};

const responseAt = (filters: IFilter[], frequency: number) =>
  getLineGainAtFrequency(responseOf(filters), frequency);

const smartEqFiltersOf = (layer: ISmartEqSettings | undefined): IFilter[] =>
  getSmartEqFilters(layer).map((filter, index) =>
    asFilter(filter, `smart-${index}`),
  );

/**
 * A published headphone correction, of the shape AutoEQ actually produces: a
 * bass shelf, a presence cut and an air lift. It lands in the user's own bands
 * — there is no separate reference layer — which is exactly why the target
 * curve has to know about them.
 */
const HEADPHONE_CORRECTION: IFiltersMap = {
  a: {
    id: 'a',
    type: FilterTypeEnum.LSC,
    frequency: 55,
    gain: 5.5,
    quality: 0.7,
  },
  b: {
    id: 'b',
    type: FilterTypeEnum.PK,
    frequency: 3000,
    gain: -5,
    quality: 1.2,
  },
  c: {
    id: 'c',
    type: FilterTypeEnum.PK,
    frequency: 6000,
    gain: 4,
    quality: 1.4,
  },
};

/** The three frequencies the correction is actually aimed at. */
const PROBE_FREQUENCIES = [55, 3000, 6000];

/** Music's own long-term tilt: an exact straight line in log-frequency, so the
 * tilt fit removes all of it and nothing else. */
const programLevel = (frequency: number) => -8 * Math.log10(frequency) + 20;

/** 320 log-spaced points from 20 Hz to 20 kHz, like the live analyser. */
const AXIS = Array.from(
  { length: 320 },
  (_value, index) =>
    10 **
    (Math.log10(20) + (index / 319) * (Math.log10(20000) - Math.log10(20))),
);

/** What the capture hears: the program, through everything APO is playing it
 * through, plus whatever the room does to it. */
const measure = (chain: IFilter[], room: IFilter[] = []): ISpectrumSample[] => {
  const response = responseOf([...room, ...chain]);
  return AXIS.map((frequency) => ({
    frequency,
    level:
      programLevel(frequency) + getLineGainAtFrequency(response, frequency),
  }));
};

interface ILoopOptions {
  bands?: IFiltersMap;
  voicing?: IVoicingSettings;
  /** Something wrong with the output that no layer put there. */
  room?: IFilter[];
  /** Leave the bands out of the goal, which is what the loop used to do. */
  omitBandsFromTarget?: boolean;
}

const chainOf = (
  options: ILoopOptions,
  layer: ISmartEqSettings | undefined,
) => [
  ...Object.values(options.bands ?? {}),
  ...getVoicingFilters(options.voicing).map((filter, index) =>
    asFilter(filter, `voicing-${index}`),
  ),
  ...smartEqFiltersOf(layer),
];

/** One press of Smart EQ, against a chain that already holds `layer`. */
const runOnce = (
  layer: ISmartEqSettings | undefined,
  options: ILoopOptions,
): ISmartEqSettings | undefined => {
  const bands = getSmartEqBands(layer);
  const gains = buildBalancedGains(
    measure(chainOf(options, layer), options.room),
    bands,
    {
      targetCurve: buildLayerTargetCurve(
        options.omitBandsFromTarget ? undefined : options.bands,
        options.voicing,
        undefined,
      ),
    },
  );
  return buildSmartEqSettings(bands, gains);
};

const runLoop = (times: number, options: ILoopOptions) => {
  let layer: ISmartEqSettings | undefined;
  for (let run = 0; run < times; run += 1) {
    layer = runOnce(layer, options);
  }
  return layer;
};

/**
 * How much of the intended correction is still audible once the Smart EQ layer
 * is stacked on top of the bands. 1 is untouched, 0 is cancelled, negative
 * means Smart EQ has inverted it.
 */
const retentionOf = (
  bands: IFiltersMap,
  layer: ISmartEqSettings | undefined,
) => {
  const intended = responseOf(Object.values(bands));
  const net = responseOf([...Object.values(bands), ...smartEqFiltersOf(layer)]);
  return PROBE_FREQUENCIES.map(
    (frequency) =>
      getLineGainAtFrequency(net, frequency) /
      getLineGainAtFrequency(intended, frequency),
  );
};

describe('the Smart EQ closed loop', () => {
  describe('a headphone correction the user applied', () => {
    it('is intact after a single run', () => {
      retentionOf(
        HEADPHONE_CORRECTION,
        runLoop(1, { bands: HEADPHONE_CORRECTION }),
      ).forEach((fraction) => {
        expect(fraction).toBeGreaterThan(0.98);
        expect(fraction).toBeLessThan(1.02);
      });
    });

    it('survives repeated runs instead of being eroded away', () => {
      // The failure this guards against is silent: the band editor goes on
      // showing the correction at full value while Smart EQ inverts it
      // underneath, and four runs is where the sign flip appears.
      retentionOf(
        HEADPHONE_CORRECTION,
        runLoop(4, { bands: HEADPHONE_CORRECTION }),
      ).forEach((fraction) => {
        expect(fraction).toBeGreaterThan(0.98);
        expect(fraction).toBeLessThan(1.02);
      });
    });

    it('leaves nothing audible to correct at all', () => {
      // The strongest statement of the same thing. With a clean program and the
      // bands accounted for there is no residual, so the layer that would be
      // written is no layer, and the chip never appears.
      expect(runLoop(4, { bands: HEADPHONE_CORRECTION })).toBeUndefined();
    });

    it('is destroyed when the bands are left out of the goal', () => {
      // The bug itself, kept executable. Without the bands in the target the
      // loop reads them as error and its fixed point is total cancellation:
      // 73% / 51% / 40% of the correction left after one run, 57% / 14% / -8%
      // after four, the air lift having turned into a cut.
      const retained = retentionOf(
        HEADPHONE_CORRECTION,
        runLoop(4, {
          bands: HEADPHONE_CORRECTION,
          omitBandsFromTarget: true,
        }),
      );

      expect(Math.max(...retained)).toBeLessThan(0.6);
      expect(Math.min(...retained)).toBeLessThan(0);
    });
  });

  describe('the layers the user chose', () => {
    it('leaves a voicing exactly where it was, run after run', () => {
      const voicing: IVoicingSettings = { profileId: 'music', intensity: 1 };
      const voicingFilters = getVoicingFilters(voicing).map((filter, index) =>
        asFilter(filter, `voicing-${index}`),
      );
      const layer = runLoop(4, { voicing });

      [55, 200, 1000, 3000, 6000, 10000].forEach((frequency) => {
        expect(
          Math.abs(
            responseAt(
              [...voicingFilters, ...smartEqFiltersOf(layer)],
              frequency,
            ) - responseAt(voicingFilters, frequency),
          ),
        ).toBeLessThan(0.2);
      });
    });

    it('does not walk away from a target that is mostly a slope', () => {
      // A bass shelf is close to a straight line over the correctable band, and
      // a straight line is the one shape the tilt fit removes entirely. Compare
      // the target against the measurement *after* the fit and that slope reads
      // as a permanent deviation no gain can satisfy: every run adds another
      // slice of it and the layer marches off until it hits the clamps. Six
      // runs is enough for that to be unmistakable.
      const shelfOnly: IFiltersMap = {
        s: {
          id: 's',
          type: FilterTypeEnum.LSC,
          frequency: 200,
          gain: 10,
          quality: 0.7,
        },
      };
      const layer = runLoop(6, { bands: shelfOnly });

      [40, 100, 1000, 10000].forEach((frequency) => {
        expect(
          Math.abs(responseAt(smartEqFiltersOf(layer), frequency)),
        ).toBeLessThan(0.5);
      });
    });
  });

  describe('something actually wrong with the output', () => {
    it('is still corrected, without wrecking the correction', () => {
      // The target must not turn Smart EQ into a no-op. An 8 dB room mode the
      // bands are not responsible for still has to be found and cut, and the
      // headphone correction has to come through it recognisable.
      const room = [
        asFilter(
          { type: FilterTypeEnum.PK, frequency: 400, gain: 8, quality: 1.4 },
          'room',
        ),
      ];
      const layer = runLoop(4, { bands: HEADPHONE_CORRECTION, room });
      const smart = smartEqFiltersOf(layer);

      // Most of the mode is gone.
      expect(responseAt(smart, 400)).toBeLessThan(-4);
      expect(responseAt([...room, ...smart], 400)).toBeLessThan(3);

      // And the correction is still there, within the couple of dB the tilt fit
      // is thrown out by a hump that size.
      const intended = responseOf(Object.values(HEADPHONE_CORRECTION));
      const net = responseOf([
        ...Object.values(HEADPHONE_CORRECTION),
        ...smart,
      ]);
      PROBE_FREQUENCIES.forEach((frequency) => {
        expect(
          Math.abs(
            getLineGainAtFrequency(net, frequency) -
              getLineGainAtFrequency(intended, frequency),
          ),
        ).toBeLessThan(2.5);
      });
      // The presence cut and the air lift keep their sign, which is the part
      // the old behaviour lost.
      expect(getLineGainAtFrequency(net, 3000)).toBeLessThan(-3);
      expect(getLineGainAtFrequency(net, 6000)).toBeGreaterThan(2);
    });
  });

  describe('the target curve', () => {
    it('is the same sum the response graph draws', () => {
      const curve = buildLayerTargetCurve(
        HEADPHONE_CORRECTION,
        undefined,
        undefined,
      );
      const graph = responseOf(Object.values(HEADPHONE_CORRECTION));

      expect(curve.length).toBe(graph.length);
      curve.forEach((point, index) => {
        expect(point.frequency).toBeCloseTo(graph[index].x, 6);
        expect(point.level).toBeCloseTo(graph[index].y, 6);
      });
    });

    it('adds the voicing on top of the bands rather than replacing them', () => {
      const voicing: IVoicingSettings = { profileId: 'music', intensity: 1 };
      const withBoth = buildLayerTargetCurve(
        HEADPHONE_CORRECTION,
        voicing,
        undefined,
      );
      const bandsOnly = buildLayerTargetCurve(
        HEADPHONE_CORRECTION,
        undefined,
        undefined,
      );
      const voicingOnly = buildLayerTargetCurve(undefined, voicing, undefined);

      expect(voicingOnly.length).toBeGreaterThan(0);
      withBoth.forEach((point, index) => {
        expect(point.level).toBeCloseTo(
          bandsOnly[index].level + voicingOnly[index].level,
          6,
        );
      });
    });

    it('ignores a band Equalizer APO could never build', () => {
      // One NaN in the sum poisons every point of the curve rather than one of
      // them, which would hand the solver a target of NaN everywhere.
      const curve = buildLayerTargetCurve(
        {
          ...HEADPHONE_CORRECTION,
          broken: {
            id: 'broken',
            type: FilterTypeEnum.PK,
            frequency: Number.NaN,
            gain: 3,
            quality: 1,
          },
        },
        undefined,
        undefined,
      );

      expect(curve.every((point) => Number.isFinite(point.level))).toBe(true);
    });

    it('is empty when there is nothing deliberate to steer towards', () => {
      expect(buildLayerTargetCurve(undefined, undefined, undefined)).toEqual(
        [],
      );
      expect(buildLayerTargetCurve({}, undefined, undefined)).toEqual([]);
    });
  });
});

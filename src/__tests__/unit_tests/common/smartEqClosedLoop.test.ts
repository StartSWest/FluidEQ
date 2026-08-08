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
  FilterTypeEnum,
  IFilter,
  IFiltersMap,
  describeBandShape,
} from 'common/constants';
import {
  ISmartEqSettings,
  buildSmartEqSettings,
  getSmartEqBands,
  getSmartEqFilters,
} from 'common/smartEq';
import { IVoicingSettings, getVoicingFilters } from 'common/voicing';
import { IDriverSettings, getDriverFilters } from 'common/driver';
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
  /**
   * Bands the AutoEQ panel wrote, as opposed to bands the user typed.
   *
   * The same map type and the same place in the chain — the difference is only
   * that a signature was recorded for these, which is what puts them in the goal
   * instead of in what gets corrected.
   */
  headset?: IFiltersMap;
  voicing?: IVoicingSettings;
  driver?: IDriverSettings;
  /** Something wrong with the output that no layer put there. */
  room?: IFilter[];
}

const chainOf = (
  options: ILoopOptions,
  layer: ISmartEqSettings | undefined,
) => [
  ...Object.values(options.bands ?? {}),
  ...Object.values(options.headset ?? {}),
  ...getVoicingFilters(options.voicing).map((filter, index) =>
    asFilter(filter, `voicing-${index}`),
  ),
  ...getDriverFilters(options.driver).map((filter, index) =>
    asFilter(filter, `driver-${index}`),
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
      // The user's own bands are NOT handed in, which is the contract this
      // whole file exists to hold the loop to. The headset ones are, through
      // the signature, which is the only thing that tells them apart. See
      // `buildLayerTargetCurve`.
      targetCurve: buildLayerTargetCurve(
        options.voicing,
        options.driver,
        options.headset ? describeBandShape(options.headset) : undefined,
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
  /*
   * WHAT THE USER'S OWN BANDS ARE, AND WHY THIS SECTION READS BACKWARDS FROM
   * WHAT IT USED TO.
   *
   * These tests once asserted the opposite: that a correction sitting in the
   * bands survived the loop untouched, because the bands were handed to the
   * solver as part of the goal. That protected a headphone correction applied
   * from the AutoEQ panel — and it did so by making Smart EQ blind to every
   * other thing in those bands, including a slider somebody had dragged to
   * -16 dB. A measurement that subtracts the damage before looking for it will
   * always report that there is none.
   *
   * So the bands are output now, not intent. Pull one and Smart EQ pulls it
   * back. A correction that must survive belongs in the driver layer, which is
   * still in the goal — and for a better reason than "the user chose it": the
   * capture is a digital loopback and cannot hear the headphone, so a
   * correction for the headphone is invisible to it and can only ever look like
   * error.
   */
  describe('a correction the user typed into the bands', () => {
    it('is read as output and flattened, not preserved', () => {
      const retained = retentionOf(
        HEADPHONE_CORRECTION,
        runLoop(4, { bands: HEADPHONE_CORRECTION }),
      );

      expect(Math.max(...retained)).toBeLessThan(0.6);
    });

    it('is already going after a single run', () => {
      // One press is enough to see it move, which is the whole point: pressing
      // the button on a chain somebody has bent should change the sound.
      const retained = retentionOf(
        HEADPHONE_CORRECTION,
        runLoop(1, { bands: HEADPHONE_CORRECTION }),
      );

      expect(Math.max(...retained)).toBeLessThan(0.95);
    });
  });

  describe('a driver correction, which the loopback cannot hear', () => {
    const driver: IDriverSettings = {
      profileId: 'dynamic-headphone',
      intensity: 1,
    };

    it('is left exactly where it was, run after run', () => {
      const driverFilters = getDriverFilters(driver).map((filter, index) =>
        asFilter(filter, `driver-${index}`),
      );
      const intended = responseOf(driverFilters);
      const layer = runLoop(4, { driver });
      const net = responseOf([...driverFilters, ...smartEqFiltersOf(layer)]);

      PROBE_FREQUENCIES.forEach((frequency) => {
        expect(getLineGainAtFrequency(net, frequency)).toBeCloseTo(
          getLineGainAtFrequency(intended, frequency),
          1,
        );
      });
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
      const layer = runLoop(6, { headset: shelfOnly });

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
      const layer = runLoop(4, { headset: HEADPHONE_CORRECTION, room });
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
    const voicing: IVoicingSettings = { profileId: 'music', intensity: 1 };
    const driver: IDriverSettings = {
      profileId: 'dynamic-headphone',
      intensity: 1,
    };

    it('is the same sum the response graph draws', () => {
      const curve = buildLayerTargetCurve(voicing, undefined);
      const graph = responseOf(
        getVoicingFilters(voicing).map((filter, index) =>
          asFilter(filter, `voicing-${index}`),
        ),
      );

      expect(curve.length).toBe(graph.length);
      curve.forEach((point, index) => {
        expect(point.frequency).toBeCloseTo(graph[index].x, 6);
        expect(point.level).toBeCloseTo(graph[index].y, 6);
      });
    });

    it('adds the driver on top of the voicing rather than replacing it', () => {
      const withBoth = buildLayerTargetCurve(voicing, driver);
      const voicingOnly = buildLayerTargetCurve(voicing, undefined);
      const driverOnly = buildLayerTargetCurve(undefined, driver);

      expect(voicingOnly.length).toBeGreaterThan(0);
      expect(driverOnly.length).toBeGreaterThan(0);
      withBoth.forEach((point, index) => {
        expect(point.level).toBeCloseTo(
          voicingOnly[index].level + driverOnly[index].level,
          6,
        );
      });
    });

    it('does not contain the user"s own bands at any strength', () => {
      // The contract, stated directly rather than inferred from the loop: there
      // is no argument to put them in, and nothing the user types into the band
      // editor can appear in what the measurement is aiming at.
      expect(buildLayerTargetCurve(undefined, undefined)).toEqual([]);
    });

    it('is empty when there is nothing deliberate to steer towards', () => {
      expect(buildLayerTargetCurve(undefined, undefined)).toEqual([]);
      expect(
        buildLayerTargetCurve({ profileId: '', intensity: 1 }, undefined),
      ).toEqual([]);
    });
  });
});

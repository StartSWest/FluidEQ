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
import { IDriverSettings, getDriverFilters } from 'common/driver';
import {
  buildBalancedGains,
  ISpectrumSample,
} from 'renderer/utils/autoBalance';
import { buildChainGainDb } from 'renderer/utils/layerTargetCurve';
import { getReferenceShape } from 'common/referenceCurve';
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

/** A Smart EQ layer built by hand, for starting a loop somewhere arbitrary. */
const layerOfGains = (gainsByFrequency: Record<number, number>) => {
  const bands = getSmartEqBands(undefined);
  return buildSmartEqSettings(
    bands,
    Object.fromEntries(
      bands.map((band) => {
        const nearest = Object.keys(gainsByFrequency)
          .map(Number)
          .sort(
            (left, right) =>
              Math.abs(Math.log2(left / band.frequency)) -
              Math.abs(Math.log2(right / band.frequency)),
          )[0];
        // Only the bands close to a named frequency are moved; the rest start
        // where a fresh layer would.
        const isNear = Math.abs(Math.log2(nearest / band.frequency)) < 0.25;
        return [band.id, isNear ? gainsByFrequency[nearest] : 0];
      }),
    ),
  );
};

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
  /** Bands the user typed. Part of the output, and subtracted before solving. */
  bands?: IFiltersMap;
  voicing?: IVoicingSettings;
  driver?: IDriverSettings;
  /** Something wrong with the output that no layer put there. */
  room?: IFilter[];
  /** Which curve the record is driven to. Defaults to the one-shot's fitted
   * line, which is what pressing the button does. */
  mode?: string;
}

/** Every layer that is subtracted before the solve — the whole chain except
 * Smart EQ's own, which stays in so the loop can see its own result. */
const subtractedOf = (options: ILoopOptions) => [
  ...Object.values(options.bands ?? {}),
  ...getVoicingFilters(options.voicing).map((filter, index) =>
    asFilter(filter, `voicing-${index}`),
  ),
  ...getDriverFilters(options.driver).map((filter, index) =>
    asFilter(filter, `driver-${index}`),
  ),
];

/** Everything the analyser actually hears, in config order. */
const chainOf = (
  options: ILoopOptions,
  layer: ISmartEqSettings | undefined,
) => [...subtractedOf(options), ...smartEqFiltersOf(layer)];

/**
 * One press of Smart EQ, against a chain that already holds `layer`.
 *
 * THE SUBTRACTION IS THE POINT OF THIS FILE.
 *
 * The capture hears the output — the record with every layer on it — and
 * `buildChainGainDb` is removed from it per analysis frequency before anything
 * is solved. Everything comes out except the Smart EQ layer, which stays in on
 * purpose: what is left is the record plus the correction so far, which is a
 * residual, and a residual is what makes repeated runs converge instead of
 * doubling.
 *
 * No target curve. There used to be one, listing every deliberate layer so the
 * solver could excuse each of them, and the tests in this file drove it long
 * after production had stopped calling it. Nothing needs excusing now, because
 * nothing deliberate is left in what is measured.
 */
const runOnce = (
  layer: ISmartEqSettings | undefined,
  options: ILoopOptions,
): ISmartEqSettings | undefined => {
  const bands = getSmartEqBands(layer);
  const heard = measure(chainOf(options, layer), options.room);
  const chainDb = buildChainGainDb(subtractedOf(options), AXIS);
  const source = heard.map((sample, index) => ({
    frequency: sample.frequency,
    level: sample.level - chainDb[index],
  }));

  const gains = buildBalancedGains(source, bands, {
    reference: getReferenceShape(options.mode ?? 'smart'),
  });
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
   * WHY EVERY LAYER IS LEFT ALONE, INCLUDING THE USER'S OWN BANDS.
   *
   * This section has been rewritten twice and the two rewrites went in opposite
   * directions, so the current answer is worth stating with its history.
   *
   * At first the bands were handed to the solver as part of the goal, to protect
   * a headphone correction applied from the AutoEQ panel. That worked and made
   * Smart EQ blind to everything else in those bands, including a slider dragged
   * to -16 dB: a measurement that subtracts the damage before looking for it
   * always reports that there is none.
   *
   * Then the bands were treated as error, so a hand-dragged slider was corrected
   * — and so was the headphone correction, which is a correction for something a
   * digital loopback categorically cannot hear.
   *
   * Both were arguments about what to *excuse in the measurement*, and the
   * measurement is the wrong place to be making that decision. The capture now
   * subtracts the whole chain, so nothing deliberate is in it to be excused or
   * mistaken for a fault. Every layer keeps exactly the response it was given,
   * because Smart EQ never sees any of them; it corrects the record underneath
   * and they sit on top of the result, where they were applied.
   */
  describe('the layers below it', () => {
    it('leaves the user’s own bands exactly where they were', () => {
      const retained = retentionOf(
        HEADPHONE_CORRECTION,
        runLoop(4, { bands: HEADPHONE_CORRECTION }),
      );

      retained.forEach((fraction) => {
        expect(fraction).toBeGreaterThan(0.9);
        expect(fraction).toBeLessThan(1.1);
      });
    });

    it('does not erode them over many runs', () => {
      // The failure this guards is silent: the editor goes on showing a tuning
      // at full value while Smart EQ inverts it underneath, a little per run.
      const four = retentionOf(
        HEADPHONE_CORRECTION,
        runLoop(4, { bands: HEADPHONE_CORRECTION }),
      );
      const twelve = retentionOf(
        HEADPHONE_CORRECTION,
        runLoop(12, { bands: HEADPHONE_CORRECTION }),
      );

      twelve.forEach((fraction, index) => {
        expect(fraction).toBeCloseTo(four[index], 1);
      });
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

    it('does not walk away from a layer that is mostly a slope', () => {
      // A bass shelf is close to a straight line over the correctable band, and
      // a straight line is the one shape the tilt fit removes entirely. Get the
      // bookkeeping wrong and that slope reads as a permanent deviation no gain
      // can satisfy: every run adds another slice of it and the layer marches
      // off until it hits the clamps. Six runs makes that unmistakable.
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

  /*
   * THE TWO PROPERTIES THE SUBTRACTION EXISTS FOR.
   *
   * Neither was testable before it, and both are the reason the architecture
   * changed, so they are the ones worth having executable.
   */
  describe('what subtracting the chain buys', () => {
    const room = [
      asFilter(
        { type: FilterTypeEnum.PK, frequency: 400, gain: 8, quality: 1.4 },
        'room',
      ),
    ];

    it('finds a fault underneath a chain that has buried it', () => {
      // The blind spot, stated as a test. A band cut hard over the same range as
      // the fault used to take the evidence for that fault down with it — the
      // measurement saw a quiet region, had nothing to correct from, and left
      // the problem in place. The louder the cut, the more completely it hid.
      const cut: IFiltersMap = {
        c: {
          id: 'c',
          type: FilterTypeEnum.PK,
          frequency: 400,
          gain: -16,
          quality: 1.4,
        },
      };
      const buried = smartEqFiltersOf(runLoop(4, { bands: cut, room }));
      const plain = smartEqFiltersOf(runLoop(4, { room }));

      // Found either way, and to about the same depth: what the correction is
      // solved from is the record, so what somebody has done to the output on
      // top of it does not change the answer.
      expect(responseAt(buried, 400)).toBeLessThan(-4);
      expect(responseAt(buried, 400)).toBeCloseTo(responseAt(plain, 400), 0);
    });

    it('converges on the same correction shape whatever it starts from', () => {
      // The closed loop, stated as a contraction rather than as equality at some
      // chosen run count, because that is what it is: Smart EQ's own layer stays
      // in the measurement, so each run solves a residual and closes part of the
      // remaining gap — part, not all, because of the ridge term in the solver.
      //
      // IN SHAPE, and that qualifier is not slack in the test. Every correction
      // is anchored to a weighted average of itself, so it is zero-mean by
      // construction and therefore says nothing about level. A layer that starts
      // with an overall offset keeps it: the correction cannot remove what it is
      // not allowed to express. That is deliberate — it is what stops a
      // continuous mode walking the volume down over an evening — and it is
      // harmless, because a uniform offset is level rather than tone, it is
      // bounded by the caps, and auto normalize absorbs it into the preamp.
      //
      // The remaining gap is the cost of having dropped the clear-to-flat step:
      // one press does not wash out a badly wrong layer, it pulls it most of the
      // way in. Clear EQ discards one outright, which is why that is where the
      // destructive act lives.
      const PROBES = [100, 400, 1000, 6000, 12000];
      const shapeOf = (filters: IFilter[]) => {
        const levels = PROBES.map((frequency) =>
          responseAt(filters, frequency),
        );
        const mean =
          levels.reduce((total, level) => total + level, 0) / levels.length;
        return levels.map((level) => level - mean);
      };

      const settled = shapeOf(smartEqFiltersOf(runLoop(24, { room })));
      const gapAfter = (runs: number) => {
        let layer = layerOfGains({ 400: 9, 1000: -7, 6000: 5 });
        for (let run = 0; run < runs; run += 1) {
          layer = runOnce(layer, { room });
        }
        const shape = shapeOf(smartEqFiltersOf(layer));
        return Math.max(
          ...shape.map((level, index) => Math.abs(level - settled[index])),
        );
      };

      const early = gapAfter(3);
      const late = gapAfter(24);

      // Going the right way, decisively — not drifting and not stalling. The
      // exact ratio is not the property and is not worth pinning: what matters
      // is that a lot of the gap is gone, and that where it ends up is somewhere
      // nobody could hear.
      expect(late).toBeLessThan(early * 0.6);
      expect(late).toBeLessThan(1);
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

  describe('the chain curve that is subtracted', () => {
    const voicing: IVoicingSettings = { profileId: 'music', intensity: 1 };
    const voicingFilters = getVoicingFilters(voicing).map((filter, index) =>
      asFilter(filter, `voicing-${index}`),
    );

    it('is the same response the graph draws for those filters', () => {
      // If the two ever disagreed, the correction would be solved against a
      // spectrum that does not match the picture of the chain on screen.
      const sampled = buildChainGainDb(voicingFilters, AXIS);
      const graph = responseOf(voicingFilters);

      AXIS.forEach((frequency, index) => {
        expect(sampled[index]).toBeCloseTo(
          getLineGainAtFrequency(graph, frequency),
          1,
        );
      });
    });

    it('adds its layers together rather than letting one replace another', () => {
      const driverFilters = getDriverFilters({
        profileId: 'dynamic-headphone',
        intensity: 1,
      }).map((filter, index) => asFilter(filter, `driver-${index}`));

      const both = buildChainGainDb(
        [...voicingFilters, ...driverFilters],
        AXIS,
      );
      const voicingOnly = buildChainGainDb(voicingFilters, AXIS);
      const driverOnly = buildChainGainDb(driverFilters, AXIS);

      both.forEach((level, index) => {
        expect(level).toBeCloseTo(voicingOnly[index] + driverOnly[index], 4);
      });
    });

    it('is flat when nothing is applied, so the capture is left alone', () => {
      buildChainGainDb([], AXIS).forEach((level) => {
        expect(level).toBe(0);
      });
    });

    it('ignores a band Equalizer APO could never build', () => {
      // One NaN in the sum poisons every point rather than one of them, which
      // would subtract NaN from the whole capture and lose the measurement.
      const withBroken = buildChainGainDb(
        [
          ...voicingFilters,
          asFilter(
            {
              type: FilterTypeEnum.PK,
              frequency: Number.NaN,
              gain: 3,
              quality: 1,
            },
            'broken',
          ),
        ],
        AXIS,
      );

      expect(withBroken.every((level) => Number.isFinite(level))).toBe(true);
    });
  });
});

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

import { FilterTypeEnum, IFilter, IFiltersMap } from 'common/constants';
import {
  ISmartEqSettings,
  getSmartEqBands,
  getSmartEqFilters,
} from 'common/smartEq';
import { buildSmartEqSettings } from 'common/smartEqContinuous';
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
 * WHAT IS MEASURED IS THE RECORD, through Smart EQ's own layer and nothing
 * else — the same arithmetic `accumulateBalanceFrame` does on every frame,
 * with the same chain curve, so this loop and the live capture agree by
 * construction.
 *
 * The loopback hears the output. Every layer but this one is subtracted from
 * it — the bands, the voicing, the driver — leaving the record plus the
 * correction so far. Keeping the layer's own contribution in is what makes the
 * answer a residual and what makes repeated runs converge instead of doubling;
 * taking everything else out is what stops the solver reading a slider
 * somebody dragged as a fault and building its mirror image. Nothing is handed
 * to the solver as a target to excuse, because nothing it could excuse is in
 * the measurement.
 */
const runOnce = (
  layer: ISmartEqSettings | undefined,
  options: ILoopOptions,
): ISmartEqSettings | undefined => {
  const bands = getSmartEqBands(layer);
  const output = measure(chainOf(options, layer), options.room);
  const chain = buildChainGainDb(subtractedOf(options), AXIS);
  const heard = output.map((sample, index) => ({
    frequency: sample.frequency,
    level: sample.level - chain[index],
  }));

  const gains = buildBalancedGains(heard, bands, {
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
   * WHAT IS LEFT ALONE, AND WHY THIS SECTION HAS BEEN WRITTEN FOUR WAYS.
   *
   * The boundary has moved three times and the history is worth keeping,
   * because each position was right about something and wrong about something
   * else.
   *
   * First the user's bands were part of the goal, to protect a headphone
   * correction applied from the AutoEQ panel. That protected it and made Smart
   * EQ blind to everything else in those bands.
   *
   * Then the whole chain was subtracted and only the record was corrected.
   *
   * Then the OUTPUT was measured again and two layers — the voicing and the
   * driver — were excused through a target curve, on the argument that a
   * correction which agrees with whatever it is shown is not a correction. It
   * was wrong about what the feature is for. Measured that way, every band the
   * user moved read as a fault and Smart EQ built its mirror image: a -6 dB cut
   * at 2.6 kHz and a +10 dB lift at 4.3 kHz came back as +6 and -10 inside the
   * layer, and the two curves on the graph fought each other in plain sight.
   *
   * Now, and finally: the record is measured, with every layer subtracted but
   * Smart EQ's own. Smart EQ fixes the source, and whatever the user applied on
   * top — bands, voicing, driver, headset curve — stays applied, exactly as it
   * would sit on any other record. It is a floor under the user's EQ, not an
   * opinion about it.
   */
  describe('what it corrects and what it leaves', () => {
    it('leaves the user’s own bands exactly where they were, run after run', () => {
      const retained = retentionOf(
        HEADPHONE_CORRECTION,
        runLoop(4, { bands: HEADPHONE_CORRECTION }),
      );

      retained.forEach((ratio) => {
        expect(ratio).toBeCloseTo(1, 1);
      });
    });

    it('does not move at all when the only thing in the chain is the user’s EQ', () => {
      // Positive control for the line above: a flat record through the user's
      // bands must produce no correction, and the room test further down
      // proves the same loop does move when the record itself is wrong.
      const layer = runLoop(4, { bands: HEADPHONE_CORRECTION });

      PROBE_FREQUENCIES.forEach((frequency) => {
        expect(
          Math.abs(responseAt(smartEqFiltersOf(layer), frequency)),
        ).toBeLessThan(0.3);
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

    it('does not walk away from a subtracted layer that is mostly a slope', () => {
      // A shelf is close to a straight line over the correctable band, and a
      // straight line is the one shape the tilt fit removes entirely. Get the
      // subtraction wrong on such a layer and that slope reads as a permanent
      // deviation no gain can satisfy: every run adds another slice of it and
      // the layer marches off until it hits the clamps. Six runs makes that
      // unmistakable.
      const layer = runLoop(6, {
        voicing: { profileId: 'music', intensity: 1 },
      });

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

    it('still finds a fault in the record under a band cut hard over it', () => {
      // A band cut hard over the same range as the fault. Measured from the
      // output, the cut buries the resonance and the correction never sees it;
      // measured from the record, the resonance is there to be found whatever
      // the user did on top. So the layer is a CUT, the same one it would have
      // made with no band there, and the user's own cut is not touched.
      const cut: IFiltersMap = {
        c: {
          id: 'c',
          type: FilterTypeEnum.PK,
          frequency: 400,
          gain: -16,
          quality: 1.4,
        },
      };
      const withCut = smartEqFiltersOf(runLoop(4, { bands: cut, room }));
      const withoutCut = smartEqFiltersOf(runLoop(4, { room }));

      expect(responseAt(withCut, 400)).toBeLessThan(-4);
      expect(responseAt(withCut, 400)).toBeCloseTo(
        responseAt(withoutCut, 400),
        1,
      );
      // The record's fault is taken out; the user's cut sits on top intact.
      expect(responseAt([...room, ...withCut], 400)).toBeLessThan(3);
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
      // Loosened from 0.6 when the cut limit came in from -9 to match the
      // boost at +6. Less room to cut is less room to undo a bad starting
      // point, so convergence from one is slower by exactly that much -- which
      // is a cost of the symmetry rather than a regression in the loop.
      expect(late).toBeLessThan(early * 0.75);
      expect(late).toBeLessThan(1);
    });
  });

  describe('something actually wrong with the output', () => {
    it('is found and cut whatever else the chain is doing', () => {
      // The subtraction must not turn Smart EQ into a no-op. An 8 dB room
      // mode still has to be found and taken out with a voicing and a driver
      // correction both live in the chain.
      const room = [
        asFilter(
          { type: FilterTypeEnum.PK, frequency: 400, gain: 8, quality: 1.4 },
          'room',
        ),
      ];
      const smart = smartEqFiltersOf(
        runLoop(4, {
          voicing: { profileId: 'music', intensity: 1 },
          driver: { profileId: 'dynamic-headphone', intensity: 1 },
          room,
        }),
      );

      expect(responseAt(smart, 400)).toBeLessThan(-4);
      expect(responseAt([...room, ...smart], 400)).toBeLessThan(3);
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

    it('is computed once per chain, not once per frame', () => {
      // The capture asks for this thirty times a second and the chain only
      // changes when somebody touches something. The same filters, rebuilt
      // from the same profile with fresh objects, must hand back the answer
      // already made; a changed gain must not.
      const rebuilt = getVoicingFilters(voicing).map((filter, index) =>
        asFilter(filter, `voicing-again-${index}`),
      );
      const first = buildChainGainDb(voicingFilters, AXIS);
      expect(buildChainGainDb(rebuilt, AXIS)).toBe(first);

      const nudged = voicingFilters.map((filter, index) =>
        index === 0 ? { ...filter, gain: filter.gain + 1 } : filter,
      );
      const changed = buildChainGainDb(nudged, AXIS);
      expect(changed).not.toBe(first);
      expect(changed.some((level, index) => level !== first[index])).toBe(true);

      // A different axis is a different device, and a different answer.
      const otherAxis = AXIS.map((frequency) => frequency * 1.01);
      expect(buildChainGainDb(voicingFilters, otherAxis)).not.toBe(first);
    });
  });
});

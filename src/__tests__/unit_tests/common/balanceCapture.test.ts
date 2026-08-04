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
  FIXED_BAND_FREQUENCIES,
  FilterTypeEnum,
  FixedBandSizeEnum,
  IFilter,
} from 'common/constants';
import {
  BALANCE_FRAME_INTERVAL_MS,
  IBalanceFrame,
  IBalanceReport,
  MAX_LISTEN_MS,
  MIN_LISTEN_MS,
  accumulateBalanceFrame,
  buildBalanceProgress,
  buildBalanceResult,
  buildBalancedGains,
  createAxisCells,
  createBalanceCaptureState,
  createBalanceRegions,
  describeBalanceProgress,
  describeBalanceResult,
  evaluateBalanceCapture,
  filterShapeAt,
  formatBalanceFrequency,
  isBalanceCheckDue,
  readAbsoluteLevels,
  shouldFinishBalanceCapture,
} from 'renderer/utils/autoBalance';

/* --- harness ----------------------------------------------------------- */

/** 320 log-spaced points from 20 Hz to 20 kHz, like the live analyser. */
const AXIS = Array.from(
  { length: 320 },
  (_value, index) =>
    10 **
    (Math.log10(20) + (index / 319) * (Math.log10(20000) - Math.log10(20))),
);

type LevelAt = (frequency: number, frameIndex: number) => number;

const buildFrame = (frameIndex: number, levelAt: LevelAt): IBalanceFrame => {
  const levels = new Float64Array(AXIS.length);
  let peakDb = -Infinity;
  AXIS.forEach((frequency, index) => {
    const level = levelAt(frequency, frameIndex);
    levels[index] = level;
    if (Number.isFinite(level) && level > peakDb) {
      peakDb = level;
    }
  });
  return {
    levels,
    peakDb,
    timestampMs: frameIndex * BALANCE_FRAME_INTERVAL_MS,
  };
};

/** Drives the accumulator exactly the way the hook's pump does. */
const runCapture = (levelAt: LevelAt, frameCount: number) => {
  const state = createBalanceCaptureState(AXIS);
  let report: IBalanceReport | undefined;
  let framesFed = 0;

  for (let index = 0; index < frameCount; index += 1) {
    accumulateBalanceFrame(state, buildFrame(index, levelAt));
    framesFed += 1;
    if (isBalanceCheckDue(state)) {
      report = evaluateBalanceCapture(state);
      if (shouldFinishBalanceCapture(report)) {
        break;
      }
    }
  }

  return { state, report: report ?? evaluateBalanceCapture(state), framesFed };
};

const FRAMES_PER_SECOND = Math.round(1000 / BALANCE_FRAME_INTERVAL_MS);
const seconds = (value: number) => value * FRAMES_PER_SECOND + 1;

/* --- signal generators ------------------------------------------------- */

/** Pink-ish full-band music: -20 dBFS at 20 Hz falling ~8 dB per decade. */
const fullRange = (frequency: number) =>
  -20 - 8 * (Math.log10(frequency) - Math.log10(20));

/** Same, but brick-walled above 8 kHz like a lossy podcast encode. */
const podcast = (frequency: number) =>
  frequency > 8000 ? -96 : fullRange(frequency);

/** Room tone: below the frame-acceptance gate entirely. */
const nearSilence = () => -78;

/** A broad +9 dB resonance at 1 kHz riding on the normal tilt. */
const withResonance = (frequency: number) =>
  fullRange(frequency) +
  9 * Math.exp(-(Math.log2(frequency / 1000) ** 2) / 0.5);

const band = (frequency: number, gain = 0): IFilter => ({
  id: `b${frequency}`,
  frequency,
  gain,
  quality: 1,
  type: FilterTypeEnum.PK,
});

const TEN_BAND = [32, 64, 125, 250, 500, 1000, 2000, 4000, 8000, 16000].map(
  (frequency) => band(frequency),
);

/* --- suites ------------------------------------------------------------ */

describe('balance capture', () => {
  describe('regions', () => {
    it('spans exactly the correctable band with nine labelled regions', () => {
      const regions = createBalanceRegions(AXIS);
      expect(regions).toHaveLength(9);
      expect(regions[0].lowFrequency).toBe(35);
      expect(regions[regions.length - 1].highFrequency).toBe(15000);
      expect(regions.map((region) => region.label)).toContain('air');
    });

    it('drops regions the axis cannot reach', () => {
      // A 16 kHz-Nyquist axis has no points in the top region.
      const narrow = AXIS.filter((frequency) => frequency <= 8000);
      const labels = createBalanceRegions(narrow).map((r) => r.label);
      expect(labels).not.toContain('air');
      expect(labels).toContain('mids');
    });
  });

  // The whole point of the rewrite: a clock is not evidence.
  describe('Suite A - coverage accounting', () => {
    it('gives silence no coverage and no listened time however long it runs', () => {
      const { state, report } = runCapture(nearSilence, seconds(20));
      expect(state.acceptedFrames).toBe(0);
      expect(state.listenedMs).toBe(0);
      expect(report.coverage).toBe(0);
      expect(report.status).toBe('listening');
      expect(shouldFinishBalanceCapture(report)).toBe(false);
    });

    it('never lets a stalled tick claim more than three frames of listening', () => {
      const state = createBalanceCaptureState(AXIS);
      accumulateBalanceFrame(state, buildFrame(0, fullRange));
      accumulateBalanceFrame(state, {
        ...buildFrame(1, fullRange),
        // Renderer starved for a minute.
        timestampMs: 60000,
      });
      expect(state.listenedMs).toBeLessThanOrEqual(
        BALANCE_FRAME_INTERVAL_MS * 3,
      );
    });

    it('reports the weakest region, not the average', () => {
      const { report } = runCapture(podcast, seconds(12));
      const air = report.regions.find((region) => region.label === 'air');
      expect(air?.confidence).toBe(0);
      expect(report.coverage).toBe(0);
      expect(report.meanCoverage).toBeGreaterThan(0.5);
      expect(report.weakest?.label).toBe('air');
    });
  });

  describe('Suite B - stopping rule', () => {
    it('refuses to stop before the minimum listen time', () => {
      const { report } = runCapture(fullRange, seconds(2));
      expect(report.listenedMs).toBeLessThan(MIN_LISTEN_MS);
      expect(report.status).toBe('listening');
    });

    it('stops with full coverage on steady full-range material', () => {
      const { report, state } = runCapture(fullRange, seconds(30));
      expect(report.status).toBe('ready');
      expect(report.coverage).toBeGreaterThanOrEqual(0.9);
      expect(report.isConverged).toBe(true);
      expect(state.listenedMs).toBeGreaterThanOrEqual(MIN_LISTEN_MS);
      // Adaptive, not a fixed timer: it must not burn the whole ceiling.
      expect(state.listenedMs).toBeLessThan(MAX_LISTEN_MS);
    });

    it('gives up as partial on a band-limited source instead of waiting forever', () => {
      const { report } = runCapture(podcast, seconds(45));
      expect(report.status).toBe('partial');
      expect(report.coverage).toBeLessThan(0.9);
      expect(shouldFinishBalanceCapture(report)).toBe(true);
    });

    // The heart of "wait until you have heard enough": how long it listens is
    // a property of the material, not of a timer.
    it('listens far longer for noisy content than for steady content', () => {
      const restless: LevelAt = (frequency, frameIndex) =>
        fullRange(frequency) + 12 * Math.sin(frameIndex / 3 + frequency / 900);

      const steady = runCapture(fullRange, seconds(60));
      const noisy = runCapture(restless, seconds(60));

      expect(steady.report.status).toBe('ready');
      expect(noisy.report.status).toBe('ready');
      expect(noisy.report.listenedMs).toBeGreaterThan(
        steady.report.listenedMs * 3,
      );
      expect(noisy.report.listenedMs).toBeLessThanOrEqual(MAX_LISTEN_MS);
    });

    it('stops at the ceiling even if nothing ever settles', () => {
      const state = createBalanceCaptureState(AXIS);
      accumulateBalanceFrame(state, buildFrame(0, fullRange));
      // Nothing converged and no coverage, but the budget is spent.
      state.listenedMs = MAX_LISTEN_MS;
      const report = evaluateBalanceCapture(state);
      expect(report.isConverged).toBe(false);
      expect(report.status).toBe('partial');
      expect(shouldFinishBalanceCapture(report)).toBe(true);
    });

    it('reports a goal met on the last allowed frame as ready, not partial', () => {
      // The backstop must not downgrade a genuinely good measurement.
      const { state } = runCapture(fullRange, seconds(30));
      state.listenedMs = MAX_LISTEN_MS;
      expect(evaluateBalanceCapture(state).status).toBe('ready');
    });
  });

  describe('Suite C - power averaging', () => {
    it('averages energy, not decibels, so bursts are not under-read', () => {
      // Alternating loud and quiet frames of the same shape. The power mean of
      // 0 dB and -20 dB is -3.0 dB; the dB mean would be -10 dB.
      const alternating: LevelAt = (frequency, frameIndex) =>
        fullRange(frequency) + (frameIndex % 2 === 0 ? 0 : -20);
      const { report } = runCapture(alternating, seconds(8));

      const at1k = report.samples.reduce((best, sample) =>
        Math.abs(sample.frequency - 1000) < Math.abs(best.frequency - 1000)
          ? sample
          : best,
      );
      const reference = report.samples.reduce((best, sample) =>
        Math.abs(sample.frequency - 500) < Math.abs(best.frequency - 500)
          ? sample
          : best,
      );
      // Shape is preserved regardless of the level swing: 1 kHz sits the same
      // distance below 500 Hz as the generator says it should.
      const expected =
        fullRange(at1k.frequency) - fullRange(reference.frequency);
      expect(at1k.level - reference.level).toBeCloseTo(expected, 1);
    });

    it('power-averages every FFT bin in a cell rather than sampling one', () => {
      const cells = createAxisCells(AXIS, 48000, 4096);
      const covered = new Set<number>();
      cells.forEach((cell) => {
        for (let bin = cell.firstBin; bin <= cell.lastBin; bin += 1) {
          covered.add(bin);
        }
      });

      // What nearest-bin sampling used to see.
      const binWidth = 48000 / 4096;
      const nearest = new Set(
        AXIS.map((frequency) => Math.round(frequency / binWidth)),
      );

      // Every bin from the bottom of the axis to the top is now read; the only
      // ones left out are above 20 kHz, which the axis does not reach.
      expect(covered.size).toBeGreaterThan(1600);
      expect(covered.size).toBeGreaterThan(nearest.size * 7);
      expect(cells[0].firstBin).toBeGreaterThanOrEqual(1);

      // Cells tile without gaps, so no energy falls between them.
      cells.slice(1).forEach((cell, index) => {
        expect(cell.firstBin).toBeLessThanOrEqual(cells[index].lastBin + 1);
      });

      // A cell holding one loud bin among quiet ones reports the mean power,
      // not the peak and not the nearest bin.
      const data = new Float32Array(2048).fill(-60);
      data[1500] = 0;
      const out = new Float64Array(AXIS.length);
      readAbsoluteLevels(data, cells, out);
      const cellIndex = cells.findIndex(
        (cell) => cell.firstBin <= 1500 && cell.lastBin >= 1500,
      );
      const width = cells[cellIndex].lastBin - cells[cellIndex].firstBin + 1;
      expect(width).toBeGreaterThan(1);
      expect(out[cellIndex]).toBeLessThan(0);
      expect(out[cellIndex]).toBeGreaterThan(-60);
    });
  });

  describe('Suite D - per-band confidence', () => {
    it('marks a heard region confident and an unheard region not', () => {
      const { report } = runCapture(podcast, seconds(12));
      const mids = report.regions.find((region) => region.label === 'mids');
      const air = report.regions.find((region) => region.label === 'air');
      expect(mids?.isCovered).toBe(true);
      expect(air?.isCovered).toBe(false);
      expect(air?.weight).toBe(0);
    });

    it('keeps every sample finite even where nothing was heard', () => {
      const { report } = runCapture(podcast, seconds(12));
      report.samples.forEach((sample) => {
        expect(Number.isFinite(sample.level)).toBe(true);
        expect(Number.isFinite(sample.confidence ?? 1)).toBe(true);
      });
      expect(report.samples).toHaveLength(AXIS.length);
    });
  });

  // The single most important guarantee: never produce a confident correction
  // from data that was never measured.
  describe('Suite E - never-heard bands', () => {
    it('leaves bands above a band-limited source exactly where they were', () => {
      const { report } = runCapture(podcast, seconds(45));
      const filters = [
        band(1000, 0),
        band(4000, 0),
        band(10000, 3.5),
        band(16000, -2),
      ];
      const gains = buildBalancedGains(report.samples, filters);

      expect(gains.b10000).toBe(3.5);
      expect(gains.b16000).toBe(-2);
    });

    it('refuses to correct at all when nothing was heard', () => {
      const { report } = runCapture(nearSilence, seconds(20));
      expect(buildBalancedGains(report.samples, TEN_BAND)).toEqual({});
    });

    it('refuses when the trusted span is too narrow to separate tilt from resonance', () => {
      // Only the presence region has any energy.
      const narrow = (frequency: number) =>
        frequency > 700 && frequency < 1600 ? -18 : -96;
      const { report } = runCapture(narrow, seconds(20));
      expect(buildBalancedGains(report.samples, TEN_BAND)).toEqual({});
    });

    it('refuses when the trusted span misses the midrange anchors', () => {
      // Wide span, but entirely above the midrange.
      const trebleOnly = (frequency: number) =>
        frequency > 2000 ? fullRange(frequency) : -96;
      const { report } = runCapture(trebleOnly, seconds(20));
      expect(buildBalancedGains(report.samples, TEN_BAND)).toEqual({});
    });

    it('still corrects the range it did hear', () => {
      const resonantPodcast = (frequency: number) =>
        frequency > 8000 ? -96 : withResonance(frequency);
      const { report } = runCapture(resonantPodcast, seconds(45));
      const gains = buildBalancedGains(report.samples, TEN_BAND);

      expect(Object.keys(gains).length).toBeGreaterThan(0);
      expect(gains.b1000).toBeLessThan(-1);
      expect(gains.b16000).toBe(0);
    });
  });

  describe('Suite F - frames to gains', () => {
    it('cuts a measured resonance and leaves the tilt alone', () => {
      const { report } = runCapture(withResonance, seconds(30));
      expect(report.status).toBe('ready');

      const gains = buildBalancedGains(report.samples, TEN_BAND);
      expect(gains.b1000).toBeLessThan(-1.5);
      expect(Math.abs(gains.b64)).toBeLessThan(Math.abs(gains.b1000));
      expect(Math.abs(gains.b8000)).toBeLessThan(Math.abs(gains.b1000));
    });

    it('barely moves a source that is already a clean tilt', () => {
      const { report } = runCapture(fullRange, seconds(30));
      const gains = buildBalancedGains(report.samples, TEN_BAND);
      Object.entries(gains).forEach(([id, gain]) => {
        // 16 kHz is out of the correctable band and holds at 0 either way.
        expect(Math.abs(gain)).toBeLessThan(id === 'b16000' ? 0.1 : 1.2);
      });
    });

    it('integrates onto existing gains so a second run converges', () => {
      const { report } = runCapture(withResonance, seconds(30));
      const first = buildBalancedGains(report.samples, TEN_BAND);

      // Re-measuring an output that is now flat must hold the correction, not
      // undo it: the capture is a loopback of the already-corrected signal.
      const corrected = TEN_BAND.map((filter) =>
        band(filter.frequency, first[filter.id] ?? 0),
      );
      const flat = runCapture(fullRange, seconds(30));
      const second = buildBalancedGains(flat.report.samples, corrected);

      expect(second.b1000).toBeCloseTo(first.b1000, 0);
    });
  });

  // Smart EQ: steer the output toward a chosen voicing instead of merely
  // flattening it back onto its own tilt.
  describe('Suite H - target curve', () => {
    it('drives the output toward the target, not toward flat', () => {
      const { report } = runCapture(fullRange, seconds(30));

      // A bass shelf: +5 dB below ~100 Hz, tapering off above it.
      const target = report.samples.map((sample) => ({
        frequency: sample.frequency,
        level: 5 / (1 + (sample.frequency / 100) ** 2),
      }));

      const neutral = buildBalancedGains(report.samples, TEN_BAND);
      const voiced = buildBalancedGains(report.samples, TEN_BAND, {
        targetCurve: target,
      });

      // Without a target this source is already correct, so nothing moves.
      expect(Math.abs(neutral.b64)).toBeLessThan(1.2);
      // With the target the low bands are pushed up relative to the rest.
      //
      // By the target's *shape*, not by its slope. A straight line in
      // log-frequency is exactly what the tilt fit removes from the
      // measurement, so a target is followed only in as far as it departs from
      // one — which is the only self-consistent reading, since the layer the
      // target describes is already playing and already in the capture. Asking
      // for its slope on top of that is asking for a deviation no gain can ever
      // satisfy, and the loop answers by walking off in a straight line.
      expect(voiced.b64).toBeGreaterThan(neutral.b64 + 0.7);
      expect(voiced.b64).toBeGreaterThan(voiced.b4000);
    });

    it('is not driven by a target that is a pure slope', () => {
      // The same statement from the other side, and the reason the loop stays
      // put: a target that is nothing but a tilt asks for nothing, because the
      // tilt is the one thing Smart EQ never corrects.
      const { report } = runCapture(fullRange, seconds(30));
      const slope = report.samples.map((sample) => ({
        frequency: sample.frequency,
        level: -6 * Math.log10(sample.frequency) + 12,
      }));

      const neutral = buildBalancedGains(report.samples, TEN_BAND);
      const tilted = buildBalancedGains(report.samples, TEN_BAND, {
        targetCurve: slope,
      });

      Object.entries(tilted).forEach(([id, gain]) => {
        expect(gain).toBeCloseTo(neutral[id], 1);
      });
    });

    it('is unchanged by an empty target curve', () => {
      const { report } = runCapture(withResonance, seconds(30));
      expect(
        buildBalancedGains(report.samples, TEN_BAND, { targetCurve: [] }),
      ).toEqual(buildBalancedGains(report.samples, TEN_BAND));
    });

    it('still refuses to correct regions it never heard', () => {
      const { report } = runCapture(podcast, seconds(45));
      const target = report.samples.map((sample) => ({
        frequency: sample.frequency,
        level: 6,
      }));
      const filters = [band(1000, 0), band(10000, 2.5), band(16000, -1)];
      const gains = buildBalancedGains(report.samples, filters, {
        targetCurve: target,
      });

      // A target must not become a licence to move a band that was not measured.
      expect(gains.b10000).toBe(2.5);
      expect(gains.b16000).toBe(-1);
    });
  });

  // Bands overlap. Solving them jointly is what stops a dense layout applying
  // the same correction three or four times over.
  describe('Suite I - band density', () => {
    const layoutOf = (size: FixedBandSizeEnum) =>
      FIXED_BAND_FREQUENCIES[size].map((frequency) => band(frequency));

    /** Combined dB response of a solved layout at one frequency. */
    const summedResponseAt = (
      filters: IFilter[],
      gains: Record<string, number>,
      frequency: number,
    ) =>
      filters.reduce(
        (total, filter) =>
          total + (gains[filter.id] ?? 0) * filterShapeAt(filter, frequency),
        0,
      );

    it('applies the same total correction whatever the band count', () => {
      const { report } = runCapture(withResonance, seconds(30));

      // Every layout with a usable centre near the resonance should land on
      // the same total cut. Adding bands must buy resolution, not more gain —
      // stacking overlapping bells is exactly the bug this guards.
      const totals = [
        FixedBandSizeEnum.TEN,
        FixedBandSizeEnum.FIFTEEN,
        FixedBandSizeEnum.THIRTY_ONE,
      ].map((size) => {
        const filters = layoutOf(size);
        return summedResponseAt(
          filters,
          buildBalancedGains(report.samples, filters),
          1000,
        );
      });

      totals.forEach((total) => expect(total).toBeLessThan(-2));
      const smallest = Math.min(...totals.map(Math.abs));
      const largest = Math.max(...totals.map(Math.abs));
      expect(largest / smallest).toBeLessThan(1.2);
    });

    it('under-corrects on a six-band layout, which has no centre to work with', () => {
      // Not a defect: the nearest six-band centres are 500 Hz and 1.5 kHz, so
      // a narrow 1 kHz resonance is simply not reachable. Documented so a
      // future change that "fixes" it by over-driving the neighbours fails.
      const { report } = runCapture(withResonance, seconds(30));
      const sparse = layoutOf(FixedBandSizeEnum.SIX);
      const dense = layoutOf(FixedBandSizeEnum.TEN);

      const sparseTotal = summedResponseAt(
        sparse,
        buildBalancedGains(report.samples, sparse),
        1000,
      );
      const denseTotal = summedResponseAt(
        dense,
        buildBalancedGains(report.samples, dense),
        1000,
      );

      expect(sparseTotal).toBeLessThan(0);
      expect(Math.abs(sparseTotal)).toBeLessThan(Math.abs(denseTotal));
    });

    it('spreads the correction across neighbours instead of spiking one band', () => {
      const { report } = runCapture(withResonance, seconds(30));
      const ten = layoutOf(FixedBandSizeEnum.TEN);
      const dense = layoutOf(FixedBandSizeEnum.THIRTY_ONE);

      const tenGains = buildBalancedGains(report.samples, ten);
      const denseGains = buildBalancedGains(report.samples, dense);

      const peak = (gains: Record<string, number>) =>
        Math.max(...Object.values(gains).map(Math.abs));

      // Each of the 31 bands carries less than any single one of the 10 does,
      // because they are sharing the same total correction.
      expect(peak(denseGains)).toBeLessThan(peak(tenGains));
    });

    it('keeps a dense layout smooth - no alternating boost/cut comb', () => {
      const { report } = runCapture(withResonance, seconds(30));
      const filters = layoutOf(FixedBandSizeEnum.THIRTY_ONE);
      const gains = buildBalancedGains(report.samples, filters);

      // Walk the bands in frequency order and count sign flips. An
      // unregularised solve produces a +/- comb; a sane one changes direction
      // only a handful of times across the whole spectrum.
      const ordered = filters
        .map((filter) => gains[filter.id] ?? 0)
        .filter((gain) => Math.abs(gain) > 0.15);
      let flips = 0;
      for (let index = 1; index < ordered.length; index += 1) {
        if (Math.sign(ordered[index]) !== Math.sign(ordered[index - 1])) {
          flips += 1;
        }
      }
      expect(flips).toBeLessThanOrEqual(4);
    });

    it('never exceeds the per-band limits at any density', () => {
      const { report } = runCapture(withResonance, seconds(30));
      [
        FixedBandSizeEnum.SIX,
        FixedBandSizeEnum.TEN,
        FixedBandSizeEnum.FIFTEEN,
        FixedBandSizeEnum.THIRTY_ONE,
      ].forEach((size) => {
        const gains = buildBalancedGains(report.samples, layoutOf(size));
        Object.values(gains).forEach((gain) => {
          expect(gain).toBeLessThanOrEqual(6);
          expect(gain).toBeGreaterThanOrEqual(-9);
        });
      });
    });
  });

  describe('Suite G - reporting', () => {
    it('describes a full-range result', () => {
      const { report } = runCapture(fullRange, seconds(30));
      expect(describeBalanceResult(buildBalanceResult(report))).toBe(
        'Balanced - full range',
      );
    });

    it('names the measured range for a partial result', () => {
      const { report } = runCapture(podcast, seconds(45));
      const text = describeBalanceResult(buildBalanceResult(report));
      expect(text).toMatch(/^Balanced - .+ to .+ only$/);
      expect(text).not.toContain('undefined');
      expect(text).not.toContain('NaN');
    });

    it('formats frequencies the way a listener reads them', () => {
      expect(formatBalanceFrequency(35)).toBe('35 Hz');
      expect(formatBalanceFrequency(1120)).toBe('1.1 kHz');
      expect(formatBalanceFrequency(8960)).toBe('9 kHz');
      expect(formatBalanceFrequency(15000)).toBe('15 kHz');
    });

    // The graph draws these, so an empty list means an invisible measurement.
    it('carries per-region coverage for the graph overlay', () => {
      const { report } = runCapture(podcast, seconds(6));
      const progress = buildBalanceProgress(report, 0, {
        isSilent: false,
        isPaused: false,
      });

      const last = progress.regions[progress.regions.length - 1];
      expect(progress.regions).toHaveLength(9);
      expect(progress.regions[0].lowFrequency).toBe(35);
      expect(last.label).toBe('air');
      // Ordered low to high so the overlay can map them straight onto the axis.
      progress.regions.slice(1).forEach((region, index) => {
        expect(region.lowFrequency).toBeGreaterThan(
          progress.regions[index].lowFrequency,
        );
      });
      // The band-limited top is visibly empty; the midrange is not.
      expect(last.confidence).toBe(0);
      expect(
        progress.regions.find((region) => region.label === 'mids')?.confidence,
      ).toBeGreaterThan(0);
    });

    it('keeps progress monotone and names what is missing', () => {
      // Short enough that the capture is still running: a finished report
      // reports 100% by definition.
      const { report } = runCapture(podcast, seconds(6));
      expect(report.status).toBe('listening');
      const progress = buildBalanceProgress(report, 40, {
        isSilent: false,
        isPaused: false,
      });
      // Coverage is 0 for a band-limited source, but the bar must not go
      // backwards from 40%.
      expect(progress.percent).toBe(40);
      expect(progress.percent).toBeLessThanOrEqual(99);
      expect(describeBalanceProgress(progress)).toBe(
        'Listening 40% - needs air',
      );
    });

    it('prefers the paused message over the silent one', () => {
      const { report } = runCapture(fullRange, seconds(6));
      const paused = buildBalanceProgress(report, 0, {
        isSilent: true,
        isPaused: true,
      });
      expect(describeBalanceProgress(paused)).toBe('Paused - resume to finish');

      const silent = buildBalanceProgress(report, 0, {
        isSilent: true,
        isPaused: false,
      });
      expect(describeBalanceProgress(silent)).toBe('Paused - no sound playing');
    });

    it('says it is settling once every region is covered', () => {
      const settling = buildBalanceProgress(
        {
          coverage: 0.97,
          isConverged: false,
          status: 'listening',
          weakest: { label: 'air' },
          listenedMs: 5000,
          regions: [],
        } as unknown as IBalanceReport,
        90,
        { isSilent: false, isPaused: false },
      );
      expect(describeBalanceProgress(settling)).toBe(
        'Listening 97% - settling',
      );
    });
  });
});

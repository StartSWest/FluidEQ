/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The DSP EQ page's live spectrum: how fast it rises and falls, that it moves
 * in every frame a screen draws whatever the screen's rate, and that an
 * engine from before it is drawn as it comes (`dspEqSpectrum.ts`).
 */
import {
  ANALYSIS_BINS,
  ANALYSIS_EQ_DETAIL_BINS,
  ANALYSIS_EQ_DETAIL_WINDOW,
} from '../../../common/dsp/analysisWire';
import {
  createEqSpectrum,
  EQ_SPECTRUM_LONGEST_STEP_MS,
  EQ_SPECTRUM_POINTS,
  followSpectrum,
} from '../../../renderer/dsp/dspEqSpectrum';
import type {
  IDspAnalyser,
  IDspLiveSpectrum,
} from '../../../renderer/dsp/store';

const FRAME_60 = 1000 / 60;
const powerAt = (db: number) => 10 ** (db / 10);

/** One point eased `steps` times by `elapsedMs` each, from `fromDb` to `toDb`. */
const eased = (
  fromDb: number,
  toDb: number | undefined,
  steps: number,
  elapsedMs: number,
): number => {
  const held = Float64Array.of(powerAt(fromDb));
  const target = Float64Array.of(toDb === undefined ? 0 : powerAt(toDb));
  const out = new Float64Array(1);
  for (let step = 0; step < steps; step += 1) {
    followSpectrum(held, target, elapsedMs, out);
  }
  return out[0];
};

describe('how the spectrum moves', () => {
  it('rises to a hit within two frames of a 60 Hz screen', () => {
    expect(eased(-80, -20, 1, FRAME_60)).toBeGreaterThan(-21.5);
    expect(eased(-80, -20, 2, FRAME_60)).toBeGreaterThan(-20.5);
  });

  it('falls 24 dB a second', () => {
    // A 125 ms half-life in power: eight halvings, 24.08 dB.
    expect(-20 - eased(-20, undefined, 60, FRAME_60)).toBeCloseTo(24.08, 1);
  });

  it('rises and falls at the same speed on a screen of any rate', () => {
    [120, 144, 240].forEach((hz) => {
      // A second of falling, in that screen's frames.
      expect(eased(-20, undefined, hz, 1000 / hz)).toBeCloseTo(
        eased(-20, undefined, 60, FRAME_60),
        6,
      );
    });
    [120, 240].forEach((hz) => {
      // Two 60 Hz frames of rising, in that screen's frames.
      expect(eased(-80, -20, hz / 30, 1000 / hz)).toBeCloseTo(
        eased(-80, -20, 2, FRAME_60),
        6,
      );
    });
  });

  it('holds a steady level exactly', () => {
    expect(eased(-30, -30, 50, FRAME_60)).toBeCloseTo(-30, 9);
  });

  it('draws the reading as it is after a gap, not a long fall', () => {
    expect(eased(-80, -20, 1, EQ_SPECTRUM_LONGEST_STEP_MS + 50)).toBeCloseTo(
      -20,
      9,
    );
    // Control: a step as long as the gap allows still eases — two half-lives
    // of falling, 6 dB — rather than dropping to silence.
    expect(eased(-20, undefined, 1, EQ_SPECTRUM_LONGEST_STEP_MS)).toBeCloseTo(
      -26.02,
      1,
    );
  });
});

/** An analyser holding flat bins at `db`, and its long window flat too. */
const analyserAt = (
  db: number,
  live?: Omit<IDspLiveSpectrum, 'detail'> & { detailDb?: number },
): IDspAnalyser & { reads: number } => {
  const bins = new Float32Array(ANALYSIS_BINS).fill(db);
  const analyser = {
    reads: 0,
    frequencyBinCount: ANALYSIS_BINS,
    getFloatFrequencyData: (target: Float32Array) => {
      analyser.reads += 1;
      target.set(bins);
    },
    live: live && {
      generation: live.generation,
      detailWindow: live.detailWindow,
      detail:
        live.detailDb === undefined
          ? undefined
          : new Float32Array(ANALYSIS_EQ_DETAIL_BINS).fill(live.detailDb),
    },
  };
  return analyser;
};

/** The level drawn at the middle of the plot. */
const middleOf = (levels: Float64Array) =>
  levels[Math.floor(levels.length / 2)];

describe('the spectrum the page draws', () => {
  let clock = 0;
  beforeEach(() => {
    clock = 1000;
    jest.spyOn(performance, 'now').mockImplementation(() => clock);
  });
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("draws an older engine's frames as they come", () => {
    const spectrum = createEqSpectrum();
    const loud = middleOf(spectrum.read(analyserAt(-30), 48000).levels);
    clock += FRAME_60;
    const quiet = middleOf(spectrum.read(analyserAt(-90), 48000).levels);
    // Its engine smoothed them already; a second smoothing here would lag.
    expect(loud - quiet).toBeCloseTo(60, 6);
  });

  it('eases toward a new measurement in every frame until the next one', () => {
    const spectrum = createEqSpectrum();
    const live = { detailWindow: ANALYSIS_EQ_DETAIL_WINDOW };
    spectrum.read(
      analyserAt(-90, { ...live, generation: 1, detailDb: -90 }),
      48000,
    );
    const loud = analyserAt(-30, { ...live, generation: 2, detailDb: -30 });
    const drawn: number[] = [];
    for (let frame = 0; frame < 4; frame += 1) {
      clock += 1000 / 240;
      drawn.push(middleOf(spectrum.read(loud, 48000).levels));
    }
    // Every frame of a 240 Hz screen moves, and none overshoots.
    drawn.forEach((level, index) => {
      expect(level).toBeGreaterThan(index === 0 ? -90 : drawn[index - 1]);
      expect(level).toBeLessThan(-29.99);
    });
    // The measurement is read once; the frames between only ease.
    expect(loud.reads).toBe(1);
  });

  it('carries its motion across the first long window arriving', () => {
    const spectrum = createEqSpectrum();
    const live = { detailWindow: ANALYSIS_EQ_DETAIL_WINDOW };
    const first = spectrum.read(
      analyserAt(-40, { ...live, generation: 1 }),
      48000,
    );
    expect(first.levels).toHaveLength(EQ_SPECTRUM_POINTS);
    clock += FRAME_60;
    const second = spectrum.read(
      analyserAt(-40, { ...live, generation: 2, detailDb: -40 }),
      48000,
    );
    // The same points and the same drawing, so nothing restarts.
    expect(second).toBe(first);
    expect(second.levels).toHaveLength(EQ_SPECTRUM_POINTS);
  });
});

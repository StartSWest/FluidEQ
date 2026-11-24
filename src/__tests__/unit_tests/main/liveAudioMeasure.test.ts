/** @jest-environment node */

/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { FilterTypeEnum, getDefaultState } from '../../../common/constants';
import {
  ANALYSIS_BINS,
  ANALYSIS_EQ_DETAIL_BINS,
  ANALYSIS_EQ_DETAIL_WINDOW,
  type IHostAnalysis,
} from '../../../common/dsp/analysisWire';
import { computeMeasurementDelta } from '../../../main/tuningAgent/acousticDiagnostics';
import { evaluateEffectiveCurve } from '../../../main/tuningAgent/eqResponse';
import { summarizeLiveAudio } from '../../../main/tuningAgent/liveAudioMeasure';

const makeFrame = (overrides: Partial<IHostAnalysis> = {}): IHostAnalysis => {
  const eq = new Float32Array(ANALYSIS_BINS).fill(-24);
  const detail = new Float32Array(ANALYSIS_EQ_DETAIL_BINS).fill(-24);
  return {
    sequence: 1,
    spectra: { eq },
    correlation: 0.85,
    peaks: [0.5, 0.45],
    bandAmounts: [],
    bandLevels: [],
    exciterBands: [0, 0, 0],
    exciterOrganic: 0,
    maximizerReductionDb: -1.2,
    dimensionGuard: 1,
    master: {
      autoHeadroomReductionDb: -0.5,
      autoHeadroomTruePeakDb: -1.4,
    },
    normalizer: {
      inputPeaks: [0.5, 0.45],
      outputPeaks: [0.5, 0.45],
      appliedGainDb: -2.0,
    },
    loudness: {
      momentaryLufs: -13.5,
      shortTermLufs: -14.1,
      integratedLufs: -14.4,
      rangeLu: 7.2,
    },
    denoise: {
      reductionDb: -0.8,
      noiseFloorDb: -62,
      clicksRepaired: 2,
      voiceUnderruns: 0,
      profileReady: false,
      voiceModelLoaded: true,
      floorBandsDb: [],
      hissReductionBandsDb: [],
    },
    bassForge: { inputDb: [], outputDb: [] },
    bassPunch: { transientGainDb: 1.5, sustainGainDb: -0.5, duckGainDb: -0.2 },
    deEsser: {
      reductionDb: -3.4,
      frequencyHz: 6800,
      confidence: 0.9,
      centre: 0.8,
      shape: 0.7,
      onset: 0.6,
      sibilanceDb: 4.5,
      bandHz: [],
      bandLevelDb: [],
      bandThresholdDb: [],
      bandCutDb: [],
    },
    eqLive: {
      detailWindow: ANALYSIS_EQ_DETAIL_WINDOW,
      detail,
    },
    ...overrides,
  };
};

describe('summarizeLiveAudio acoustic telemetry', () => {
  it('computes 7-band spectral balance and relative tilt accurately', () => {
    const sampleRate = 48_000;
    const flat = makeFrame();
    const flatReport = summarizeLiveAudio(
      [{ sampleRate, frame: flat }],
      'engine',
    );
    expect(flatReport.hasSignal).toBe(true);
    expect(flatReport.headroom.clippingRisk).toBe(false);
    expect(flatReport.spectralBalance).toHaveLength(7);
    flatReport.spectralBalance.forEach((region) => {
      expect(region.levelDb).toBeCloseTo(-24, 0);
      expect(region.relativeToMidDb).toBeCloseTo(0, 0);
    });

    const bassHeavy = makeFrame();
    const detail = bassHeavy.eqLive?.detail;
    if (detail) {
      const binHz = sampleRate / ANALYSIS_EQ_DETAIL_WINDOW;
      for (let i = 0; i < detail.length; i += 1) {
        const hz = i * binHz;
        if (hz >= 60 && hz <= 250) {
          detail[i] = -15;
        }
      }
    }
    const bassReport = summarizeLiveAudio(
      [{ sampleRate, frame: bassHeavy }],
      'engine',
    );
    const bassRegion = bassReport.spectralBalance.find((r) => r.id === 'bass');
    expect(bassRegion?.relativeToMidDb).toBeGreaterThan(7);
  });

  it('flags clipping risk when peaks or true peak approach 0 dBFS', () => {
    const hot = makeFrame({
      peaks: [0.99, 0.95],
      master: { autoHeadroomReductionDb: -7.5, autoHeadroomTruePeakDb: 0.1 },
    });
    const report = summarizeLiveAudio(
      [{ sampleRate: 48_000, frame: hot }],
      'engine',
      {
        gainDb: -4.25,
        enabled: true,
        active: true,
      },
    );
    expect(report.headroom.clippingRisk).toBe(true);
    expect(report.headroom.engineAutoPreampDb).toBe(-4.25);
    expect(report.headroom.engineAutoPreampActive).toBe(true);
    expect(report.stages.deEsser?.frequencyHz).toBe(6800);
    expect(report.stages.deEsser?.maxReductionDb).toBe(-3.4);
  });

  it('reports hasSignal=false when peaks, loudness, and spectrum are below silence floor', () => {
    const silent = makeFrame({
      spectra: { eq: new Float32Array(ANALYSIS_BINS).fill(-120) },
      eqLive: undefined,
      peaks: [0, 0],
      loudness: {
        momentaryLufs: -120,
        shortTermLufs: -120,
        integratedLufs: -120,
        rangeLu: 0,
      },
    });
    const report = summarizeLiveAudio(
      [{ sampleRate: 48_000, frame: silent }],
      'library',
    );
    expect(report.source).toBe('library');
    expect(report.hasSignal).toBe(false);
  });

  it('falls back to denoise input spectrum when the DSP rack is off', () => {
    const denoiseBins = new Float32Array(ANALYSIS_BINS).fill(-26);
    const rackOffFrame = makeFrame({
      spectra: { denoise: denoiseBins },
      eqLive: undefined,
      peaks: [0, 0],
      loudness: {
        momentaryLufs: -120,
        shortTermLufs: -120,
        integratedLufs: -120,
        rangeLu: 0,
      },
    });
    const report = summarizeLiveAudio(
      [{ sampleRate: 48_000, frame: rackOffFrame }],
      'engine',
    );
    expect(report.hasSignal).toBe(true);
    expect(
      report.spectralBalance.find((r) => r.id === 'mid')?.levelDb,
    ).toBeCloseTo(-26, 0);
  });

  it('produces 15-band ISO detail, observations, and before/after measurement deltas', () => {
    const before = summarizeLiveAudio(
      [{ sampleRate: 48_000, frame: makeFrame() }],
      'engine',
    );
    const brighter = makeFrame({
      loudness: {
        momentaryLufs: -12,
        shortTermLufs: -13,
        integratedLufs: -14,
        rangeLu: 6,
      },
    });
    const { eq } = brighter.spectra;
    if (eq) {
      const binHz = 48_000 / (ANALYSIS_BINS * 2);
      for (let i = 0; i < eq.length; i += 1) {
        if (i * binHz >= 4000) {
          eq[i] = -18;
        }
      }
    }
    const after = summarizeLiveAudio(
      [{ sampleRate: 48_000, frame: brighter }],
      'engine',
    );
    expect(before.isoBands).toHaveLength(15);
    expect(before.observations.length).toBeGreaterThan(0);
    expect(before.dynamicsSummary.crestFactorDb).toBeGreaterThan(0);
    const delta = computeMeasurementDelta(before, after);
    expect(delta.momentaryLufsDb).toBeGreaterThan(1);
    expect(delta.spectralDeltaDb.presence).toBeGreaterThan(4);
  });

  it('evaluates composite effective EQ curve across main EQ, tone, and layer bypasses', () => {
    const state = getDefaultState();
    state.filters = {
      b1: {
        id: 'b1',
        type: FilterTypeEnum.PK,
        frequency: 1000,
        gain: 4,
        quality: 1.4,
      },
    };
    state.tone = { bass: 3, mid: 0, treble: -2 };
    const curve = evaluateEffectiveCurve(state);
    expect(curve.frequenciesHz).toHaveLength(15);
    expect(curve.totalDb['1000Hz']).toBeGreaterThan(3);
    expect(curve.totalDb['63Hz']).toBeGreaterThan(1.5);
    expect(curve.byLayer.mainEq).toBeDefined();
    expect(curve.byLayer.tone).toBeDefined();

    state.bypassed = ['tone'];
    const bypassedTone = evaluateEffectiveCurve(state);
    expect(bypassedTone.byLayer.tone).toBeUndefined();
    expect(bypassedTone.totalDb['63Hz']).toBeLessThan(curve.totalDb['63Hz']);
  });
});

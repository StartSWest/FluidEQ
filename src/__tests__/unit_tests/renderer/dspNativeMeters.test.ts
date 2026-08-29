/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Handing the panel's graphs between the two engines, and handing them back.
 *
 * The second half is what this file is really for. Registering the native
 * analysers is the obvious job and it worked first time; releasing them is the
 * one that shipped broken. Clearing a slot on release looks equivalent to
 * returning it and is not, because the worklet registers its `AnalyserNode`s
 * exactly once — when the audio graph is built — and never again. So an emptied
 * slot stays empty for the life of that engine, and switching back to the
 * TypeScript chain gave sound with dead graphs.
 *
 * Which is the complaint that started the work, reintroduced by the fix for it.
 */
import {
  INativeMetersBridge,
  createNativeMeters,
} from '../../../renderer/dsp/nativeMeters';
import {
  ANALYSIS_BINS,
  IHostAnalysis,
  TAnalysisStage,
} from '../../../common/dsp/analysisWire';
import {
  IDspAnalyser,
  readDspAnalyser,
  setDspAnalyser,
} from '../../../renderer/dsp/store';

/** Stands in for the worklet's `AnalyserNode`, which a test cannot build. */
const workletAnalyser = (marker: number): IDspAnalyser => ({
  frequencyBinCount: ANALYSIS_BINS,
  getFloatFrequencyData: (target: Float32Array) => target.fill(marker),
});

const analysisFrame = (
  stages: readonly TAnalysisStage[],
  value = -42,
): IHostAnalysis => {
  const spectra: Partial<Record<TAnalysisStage, Float32Array>> = {};
  stages.forEach((stage) => {
    spectra[stage] = new Float32Array(ANALYSIS_BINS).fill(value);
  });
  return {
    sequence: 1,
    spectra,
    scatter: new Float32Array(8),
    correlation: 0.5,
    peaks: [0.25, 0.5],
    bandAmounts: [],
    bandLevels: [],
    exciterBands: [0, 0, 0],
    exciterOrganic: 0,
  };
};

const fakeBridge = () => {
  let listener: ((frame: IHostAnalysis) => void) | undefined;
  const enabled: boolean[] = [];
  const bridge: INativeMetersBridge = {
    setDspHostAnalysis: (next) => {
      enabled.push(next);
      return Promise.resolve(true);
    },
    onDspHostAnalysis: (next) => {
      listener = next;
      return () => {
        listener = undefined;
      };
    },
  };
  return {
    bridge,
    enabled,
    send: (frame: IHostAnalysis) => listener?.(frame),
    listening: () => listener !== undefined,
  };
};

const STAGES: readonly TAnalysisStage[] = ['exciter', 'eq', 'master'];

describe('handing the graphs to the native engine', () => {
  beforeEach(() => {
    STAGES.forEach((stage) => setDspAnalyser(stage, undefined));
  });

  afterEach(() => {
    STAGES.forEach((stage) => setDspAnalyser(stage, undefined));
  });

  it('asks the host to start measuring', () => {
    const { bridge, enabled } = fakeBridge();
    createNativeMeters(bridge, ANALYSIS_BINS);
    expect(enabled).toEqual([true]);
  });

  it('registers an analyser for each stage the host reports', () => {
    const { bridge, send } = fakeBridge();
    createNativeMeters(bridge, ANALYSIS_BINS);

    send(analysisFrame(['eq', 'master']));

    expect(readDspAnalyser('eq')).toBeDefined();
    expect(readDspAnalyser('master')).toBeDefined();
    // Not invented for a stage that sent nothing.
    expect(readDspAnalyser('exciter')).toBeUndefined();
  });

  it('serves the bins the host sent', () => {
    const { bridge, send } = fakeBridge();
    createNativeMeters(bridge, ANALYSIS_BINS);
    send(analysisFrame(['eq'], -33));

    const target = new Float32Array(ANALYSIS_BINS);
    readDspAnalyser('eq')?.getFloatFrequencyData(target);
    expect(target[0]).toBeCloseTo(-33, 5);
    expect(target[ANALYSIS_BINS - 1]).toBeCloseTo(-33, 5);
  });

  /**
   * The regression, and the reason for the file.
   *
   * The worklet's analyser has to be reading the graphs again the moment the
   * native engine lets go — not on the next engine restart, which may never
   * come.
   */
  it('gives each slot back to whoever held it', () => {
    const worklet = workletAnalyser(-7);
    setDspAnalyser('eq', worklet);
    setDspAnalyser('master', worklet);

    const { bridge, send } = fakeBridge();
    const meters = createNativeMeters(bridge, ANALYSIS_BINS);
    send(analysisFrame(['eq', 'master']));
    expect(readDspAnalyser('eq')).not.toBe(worklet);

    meters.release();

    expect(readDspAnalyser('eq')).toBe(worklet);
    expect(readDspAnalyser('master')).toBe(worklet);
  });

  /**
   * The positive control for the check above.
   *
   * `toBe(worklet)` would also pass if the native meters had never taken the
   * slot in the first place, so the swap itself has to be observable — and it
   * is asserted mid-test above. This pins the other end: a slot that was empty
   * before must be empty after, rather than left holding a stale native
   * analyser that still answers and freezes the graph on its last frame.
   */
  it('leaves a slot empty if it was empty before', () => {
    const { bridge, send } = fakeBridge();
    const meters = createNativeMeters(bridge, ANALYSIS_BINS);
    send(analysisFrame(['eq']));
    expect(readDspAnalyser('eq')).toBeDefined();

    meters.release();

    expect(readDspAnalyser('eq')).toBeUndefined();
  });

  it('stops listening and tells the host to stop measuring', () => {
    const { bridge, enabled, listening } = fakeBridge();
    const meters = createNativeMeters(bridge, ANALYSIS_BINS);
    expect(listening()).toBe(true);

    meters.release();

    expect(listening()).toBe(false);
    expect(enabled).toEqual([true, false]);
  });

  /** A frame with a different bin count is ignored rather than half-applied. */
  it('refuses a spectrum that is not the size it registered for', () => {
    const { bridge, send } = fakeBridge();
    createNativeMeters(bridge, ANALYSIS_BINS);
    send(analysisFrame(['eq'], -20));

    const wrong = analysisFrame(['eq']);
    wrong.spectra.eq = new Float32Array(16).fill(-99);
    send(wrong);

    const target = new Float32Array(ANALYSIS_BINS);
    readDspAnalyser('eq')?.getFloatFrequencyData(target);
    // Still the last good frame, not the short one and not zeros.
    expect(target[0]).toBeCloseTo(-20, 5);
  });
});

/**
 * Switching the DSP off and on again, which empties the slots underneath.
 *
 * `clearDspAnalysers` runs whenever the Web Audio graph is disposed, and that
 * happens every time the whole DSP is switched off — an ordinary thing to do.
 * The meters used to claim their slot once, so after that they held a live
 * analyser nothing was reading: every graph stayed blank while the host went on
 * measuring and sending, which looked from the outside like the engine never
 * came back.
 */
describe('when the slots are emptied underneath', () => {
  beforeEach(() => {
    STAGES.forEach((stage) => setDspAnalyser(stage, undefined));
  });

  afterEach(() => {
    STAGES.forEach((stage) => setDspAnalyser(stage, undefined));
  });

  it('takes its slot back after the graph was torn down', () => {
    const { bridge, send } = fakeBridge();
    createNativeMeters(bridge, ANALYSIS_BINS);
    send(analysisFrame(['eq']));
    expect(readDspAnalyser('eq')).toBeDefined();

    // Exactly what turning the DSP off does.
    STAGES.forEach((stage) => setDspAnalyser(stage, undefined));
    expect(readDspAnalyser('eq')).toBeUndefined();

    // The host has not stopped; the next frame arrives as it always would.
    send(analysisFrame(['eq'], -18));

    expect(readDspAnalyser('eq')).toBeDefined();
    const target = new Float32Array(ANALYSIS_BINS);
    readDspAnalyser('eq')?.getFloatFrequencyData(target);
    expect(target[0]).toBeCloseTo(-18, 5);
  });

  /**
   * And gives back whoever holds it NOW, not whoever held it first.
   *
   * The TypeScript graph registers its own analysers when it rebuilds. If the
   * meters kept the holder they displaced on their very first frame, release
   * would hand the slot to an analyser two teardowns out of date.
   */
  it('returns the slot to the holder it actually displaced', () => {
    const first = workletAnalyser(-1);
    setDspAnalyser('eq', first);

    const { bridge, send } = fakeBridge();
    const meters = createNativeMeters(bridge, ANALYSIS_BINS);
    send(analysisFrame(['eq']));

    // The graph is torn down and rebuilt, registering a different analyser.
    const rebuilt = workletAnalyser(-2);
    setDspAnalyser('eq', rebuilt);
    send(analysisFrame(['eq']));
    expect(readDspAnalyser('eq')).not.toBe(rebuilt);

    meters.release();

    expect(readDspAnalyser('eq')).toBe(rebuilt);
  });
});

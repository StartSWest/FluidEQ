/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { act, render } from '@testing-library/react';
import type { ISmartEqSettings } from 'common/constants';
import { ANALYSIS_BINS } from 'common/dsp/analysisWire';
import type { IHostAnalysis } from 'common/dsp/analysisWire';
import { describeSmartEqLayer } from 'common/smartEq';
import SmartEqEngine from 'renderer/SmartEqEngine';
import { getSmartEqPreview } from 'renderer/utils/smartEqPreview';
import { cancelSmartEq, runSmartEq } from 'renderer/utils/smartEqRun';
import { LIVE_STEP_DB, heardDistance } from 'renderer/utils/smartEqLiveApply';

/**
 * Smart correction put on while it measures, beside the same measurement
 * with nothing put on until the end (Ivan, 2026-11-27: "continue to apply
 * the EQ while measuring, not at the end, without affecting the take").
 *
 * The take is the same record heard to the same moment, so the hold lands at
 * the same frame with the same curve; the curve walks in a step at a time
 * before it and nothing moves after it. Equalizer APO, which does not fade a
 * write, is the end-only control: one write, at the hold. The tap here is the
 * host's rack input, which the engine's EQ is downstream of on the machine —
 * that is what makes the take independent of what is put on, and what this
 * proves is that nothing in the app's own path reads it back.
 */

type TEngine = 'fluid' | 'apo';

let mockEngine: TEngine = 'fluid';
let mockLayer: ISmartEqSettings | undefined;
const mockLayerListeners = new Set<() => void>();
const mockWrites: Array<{
  frame: number;
  layer: ISmartEqSettings | undefined;
}> = [];
const mockHeld: Array<{ frame: number; layer: ISmartEqSettings }> = [];
const mockFrame = { at: 0 };

const mockSetLayer = (layer: ISmartEqSettings | undefined) => {
  mockLayer = layer;
  mockLayerListeners.forEach((listener) => listener());
};

// The layer the window holds, as a store, through the Smart layer's own
// context (`fluidEqSmartEq.ts`): what is written shows, and the next step is
// taken from it.
jest.mock('renderer/utils/fluidEqSmartEq', () => {
  const { useSyncExternalStore } = jest.requireActual('react');
  return {
    useFluidEqSmartEq: () =>
      useSyncExternalStore(
        (listener: () => void) => {
          mockLayerListeners.add(listener);
          return () => mockLayerListeners.delete(listener);
        },
        () => mockLayer,
      ),
  };
});
jest.mock('renderer/utils/FluidEqContext', () => ({
  useFluidEqContext: () => ({
    setSmartEq: mockSetLayer,
    getBandSetGeneration: () => 0,
    bypassed: [],
  }),
}));
jest.mock('renderer/utils/I18nContext', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
jest.mock('renderer/utils/equalizerApi', () => ({
  setSmartEq: (layer: ISmartEqSettings | undefined) => {
    mockWrites.push({ frame: mockFrame.at, layer });
    return Promise.resolve();
  },
}));
jest.mock('renderer/audio/songEqSession', () => ({
  noteSmartEqWrite: () => undefined,
  noteSmartEqForming: () => undefined,
  noteSmartEqHeld: (layer: ISmartEqSettings) => {
    mockHeld.push({ frame: mockFrame.at, layer });
  },
  isSongSoundLent: () => false,
}));
jest.mock('renderer/utils/audioEngineContext', () => ({
  useCurrentEngine: () => mockEngine,
}));
jest.mock('renderer/audio/nowPlayingIdentity', () => ({
  useNowPlayingIdentity: () => ({ identity: { key: 'song' }, isPlaying: true }),
}));
jest.mock('renderer/audio/playbackOwner', () => ({
  usePlaybackOwner: () => 'library',
}));
jest.mock('renderer/audio/transportSource', () => ({
  useLastPlayingOwner: () => 'library',
}));
/** A running mode by default; Measure once where a case says so. */
const mockMode = { isOnce: false };
jest.mock('renderer/utils/continuousEq', () => ({
  useContinuousEq: () => !mockMode.isOnce,
  setContinuousEq: () => undefined,
}));

let deliver: ((frame: IHostAnalysis) => void) | undefined;
let now = 0;
const FRAME_MS = (ANALYSIS_BINS * 2 * 1000) / 48000;

/**
 * A record the presence lines know — flat to 80 Hz, then 11 dB a decade
 * down — with a hollow in the mids for the correction to fill, `dipDb`
 * deep, moving a few decibels from window to window.
 */
const windowOf = (index: number, dipDb: number): Float32Array => {
  const bins = new Float32Array(ANALYSIS_BINS);
  const movement = 4 * Math.sin(index * 4.1414);
  for (let bin = 0; bin < ANALYSIS_BINS; bin += 1) {
    const frequency = Math.max(20, (bin * 48000) / (ANALYSIS_BINS * 2));
    const noise = Math.sin(index * 12.9898 + bin * 78.233) * 1.5;
    const dip = frequency >= 500 && frequency <= 2500 ? dipDb : 0;
    bins[bin] =
      -20 -
      11 * Math.log10(Math.max(frequency, 80) / 80) +
      noise +
      movement +
      dip;
  }
  return bins;
};

/** `count` windows of the record from window `start`, a frame apart. */
const deliverFrames = (start: number, count: number, dipDb: number) => {
  for (let index = start; index < start + count; index += 1) {
    mockFrame.at = index;
    now += FRAME_MS;
    deliver?.({
      sequence: index,
      spectra: { denoise: windowOf(index, dipDb) },
      correlation: 1,
      peaks: [0.5, 0.5],
    } as unknown as IHostAnalysis);
  }
};

interface IPlay {
  writes: Array<{ frame: number; layer: ISmartEqSettings | undefined }>;
  held: { frame: number; layer: ISmartEqSettings } | undefined;
  /** The take as the graph was told it: every range's evidence at the hold. */
  take: string;
  /** What plays at the end, the whole record heard. */
  playing: ISmartEqSettings | undefined;
}

const SECONDS = 75;

const play = async (
  engine: TEngine,
  {
    dipDb = -6,
    intensity,
    fluidFrom,
  }: {
    dipDb?: number;
    intensity?: number;
    /** The frame from which the FluidEQ Engine is the one chosen. */
    fluidFrom?: number;
  } = {},
): Promise<IPlay> => {
  mockEngine = engine;
  // Every play on the same clock from zero: the take is compared to the
  // last bit, and timestamps that only round differently would differ there.
  now = 0;
  mockLayer = intensity === undefined ? undefined : { filters: {}, intensity };
  mockWrites.length = 0;
  mockHeld.length = 0;
  let take = '';
  const { unmount, rerender } = render(<SmartEqEngine />);
  await act(async () => {
    for (let tick = 0; tick < 4; tick += 1) {
      // eslint-disable-next-line no-await-in-loop
      await Promise.resolve();
    }
  });
  const total = Math.round((SECONDS * 1000) / FRAME_MS);
  const perBatch = Math.round(500 / FRAME_MS);
  for (let start = 0; start < total; start += perBatch) {
    if (fluidFrom !== undefined && start + perBatch > fluidFrom) {
      // The engine changes, and the window draws with the new one.
      mockEngine = 'fluid';
      rerender(<SmartEqEngine />);
    }
    // A batch is half a second of music, and between batches the window
    // draws and the writes settle, as they do between checkpoints.
    // eslint-disable-next-line no-await-in-loop
    await act(async () => {
      deliverFrames(start, perBatch, dipDb);
      await Promise.resolve();
    });
    if (!take && getSmartEqPreview().phase === 'held') {
      take = JSON.stringify(getSmartEqPreview().regions);
    }
  }
  const played: IPlay = {
    writes: [...mockWrites],
    held: mockHeld[0],
    take,
    playing: mockLayer,
  };
  unmount();
  return played;
};

const sameLayer = (
  a: ISmartEqSettings | undefined,
  b: ISmartEqSettings | undefined,
) =>
  describeSmartEqLayer(a) === describeSmartEqLayer(b) &&
  heardDistance(a, b) === 0;

beforeEach(() => {
  deliver = undefined;
  now = 0;
  mockMode.isOnce = false;
  jest.spyOn(performance, 'now').mockImplementation(() => now);
  Object.defineProperty(window, 'electron', {
    configurable: true,
    value: {
      ipcRenderer: {
        setDspHostAnalysis: () => Promise.resolve(true),
        onDspHostAnalysis: (listener: (frame: IHostAnalysis) => void) => {
          deliver = listener;
          return () => {
            deliver = undefined;
          };
        },
      },
    },
  });
});

afterEach(() => {
  jest.restoreAllMocks();
});

// Each case plays a record through the real measurement, most of them twice:
// 2.4 to 4.5 s on a quiet machine, which Jest's 5 s default failed whenever
// the machine was busy (2026-11-27).
jest.setTimeout(30000);

describe('Smart correction put on while it measures', () => {
  it('holds the same take at the same moment as end-only, and lands on its curve', async () => {
    const endOnly = await play('apo');
    const live = await play('fluid');

    // The control's shape: held, one write, at the hold, of the held curve.
    expect(endOnly.held).toBeDefined();
    expect(endOnly.writes).toHaveLength(1);
    expect(endOnly.writes[0].frame).toBe(endOnly.held?.frame);
    expect(sameLayer(endOnly.writes[0].layer, endOnly.held?.layer)).toBe(true);

    // The take: the same frame, the same evidence, the same curve.
    expect(live.held?.frame).toBe(endOnly.held?.frame);
    expect(live.take).toBe(endOnly.take);
    expect(live.held?.layer.filters).toEqual(endOnly.held?.layer.filters);

    // It came in while it was measured...
    const heldAt = live.held?.frame ?? 0;
    const before = live.writes.filter(({ frame }) => frame < heldAt);
    expect(before.length).toBeGreaterThan(3);
    // ...a step at a time, the walk after the hold included...
    let from: ISmartEqSettings | undefined;
    live.writes.forEach(({ layer }) => {
      expect(heardDistance(from, layer)).toBeLessThanOrEqual(LIVE_STEP_DB);
      from = layer;
    });
    // ...and the last word is the take's curve, exactly, with nothing after.
    const last = live.writes[live.writes.length - 1];
    expect(sameLayer(last.layer, endOnly.held?.layer)).toBe(true);
    expect(sameLayer(live.playing, endOnly.held?.layer)).toBe(true);
    expect(last.frame - heldAt).toBeLessThan(Math.round(3000 / FRAME_MS));
  });

  it('walks the take in on the music when it lands far from what plays', async () => {
    const endOnly = await play('apo');
    const heldAt = endOnly.held?.frame ?? 0;
    // Nothing put on while it listened, and the FluidEQ Engine chosen in the
    // half second the hold lands in: the take's curve lands far from flat.
    const switched = await play('apo', { fluidFrom: heldAt });
    expect(heardDistance(undefined, endOnly.held?.layer)).toBeGreaterThan(
      3 * LIVE_STEP_DB,
    );

    // The take is untouched by any of it.
    expect(switched.held?.frame).toBe(heldAt);
    expect(switched.take).toBe(endOnly.take);

    // It walked in, a step at a time...
    const walked = switched.writes.filter(({ frame }) => frame >= heldAt);
    expect(walked.length).toBeGreaterThan(3);
    let from: ISmartEqSettings | undefined;
    switched.writes.forEach(({ layer }) => {
      expect(heardDistance(from, layer)).toBeLessThanOrEqual(LIVE_STEP_DB);
      from = layer;
    });
    // ...each on the next half second of music, never sooner...
    const halfSecond = Math.ceil(500 / FRAME_MS);
    walked.slice(1).forEach(({ frame }, index) => {
      expect(frame - walked[index].frame).toBeGreaterThanOrEqual(halfSecond);
    });
    // ...and the last word is the take's curve, exactly.
    expect(
      sameLayer(walked[walked.length - 1].layer, endOnly.held?.layer),
    ).toBe(true);
    expect(sameLayer(switched.playing, endOnly.held?.layer)).toBe(true);
  });

  it('can tell two records apart (positive control)', async () => {
    const hollow = await play('apo');
    const shallower = await play('apo', { dipDb: -3 });
    expect(hollow.held).toBeDefined();
    expect(shallower.held).toBeDefined();
    expect(sameLayer(hollow.held?.layer, shallower.held?.layer)).toBe(false);
    expect(shallower.take).not.toBe(hollow.take);
  });

  it('writes nothing while it measures a correction the strength leaves unheard', async () => {
    const unheard = await play('fluid', { intensity: 0 });
    const endOnly = await play('apo', { intensity: 0 });
    expect(unheard.writes).toHaveLength(0);
    // The take is the take, whatever is heard of it.
    expect(unheard.held?.frame).toBe(endOnly.held?.frame);
    expect(unheard.take).toBe(endOnly.take);
    expect(unheard.held?.layer.filters).toEqual(endOnly.held?.layer.filters);
    // The control: at full strength the same engine does write as it goes.
    const heard = await play('fluid');
    expect(heard.writes.length).toBeGreaterThan(3);
  });
});

describe('Measure once put on while it measures', () => {
  /** Press Measure once and play `seconds` of the record under it. */
  const pressAndPlay = async (seconds: number) => {
    mockMode.isOnce = true;
    mockEngine = 'fluid';
    mockLayer = undefined;
    mockWrites.length = 0;
    mockHeld.length = 0;
    const view = render(<SmartEqEngine />);
    await act(async () => {
      runSmartEq();
      for (let tick = 0; tick < 4; tick += 1) {
        // eslint-disable-next-line no-await-in-loop
        await Promise.resolve();
      }
    });
    const perBatch = Math.round(500 / FRAME_MS);
    const total = Math.round((seconds * 1000) / FRAME_MS);
    for (let start = 0; start < total; start += perBatch) {
      // eslint-disable-next-line no-await-in-loop
      await act(async () => {
        deliverFrames(start, perBatch, -6);
        await Promise.resolve();
      });
    }
    return view;
  };

  it('puts the sound back as it found it when cancelled', async () => {
    // Inside the one-shot's first four seconds, which it always listens.
    const { unmount } = await pressAndPlay(3.5);
    // The control: still measuring, and its correction was coming in.
    expect(mockHeld).toHaveLength(0);
    expect(mockWrites.length).toBeGreaterThan(1);
    expect(heardDistance(undefined, mockLayer)).toBeGreaterThan(LIVE_STEP_DB);

    await act(async () => {
      cancelSmartEq();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockLayer).toBeUndefined();
    expect(mockWrites[mockWrites.length - 1].layer).toBeUndefined();
    unmount();
  });
});

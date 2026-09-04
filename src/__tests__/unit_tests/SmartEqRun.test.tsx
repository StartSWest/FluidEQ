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

import '@testing-library/jest-dom';
import { useState } from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  FilterTypeEnum,
  IFilter,
  IFiltersMap,
  ISmartEqSettings,
} from 'common/constants';
import { describeSmartEqLayer, getSmartEqLayout } from 'common/smartEq';
import { buildSmartEqSettings } from 'common/smartEqContinuous';
import {
  BALANCE_REGION_EDGES,
  BALANCE_REGION_LABELS,
  ISpectrumSample,
} from 'renderer/utils/autoBalance';
import {
  IBalanceReport,
  IBalanceResult,
} from 'renderer/utils/autoBalanceCapture';

import MainContent from 'renderer/MainContent';
import SmartEqEngine from 'renderer/SmartEqEngine';
import { setSmartEqMode } from 'renderer/utils/smartEqMode';
import {
  noteSmartEqLayerReplaced,
  setSmartEqListening,
  setSmartEqRunning,
  setSmartEqStatus,
} from 'renderer/utils/smartEqRun';

/**
 * A Smart EQ run takes tens of seconds, and the world does not hold still for
 * it. These are the writes that arrive while it is listening: the chip's clear
 * button, and a profile load that replaces every layer at once. Both used to be
 * overwritten by the run still in flight, because it read the layer once at the
 * start and never looked again.
 *
 * The run does not live in the EQ page any more — `SmartEqEngine` hosts it,
 * above the tabs — so these render the pair the way `App` does: the engine that
 * measures, and the panel whose button asks it to. The last test in the file is
 * about why they were separated at all.
 */

/* --- the world the run reads ------------------------------------------- */

const mockLive: {
  filters: IFiltersMap;
  smartEq: ISmartEqSettings | undefined;
} = { filters: {}, smartEq: undefined };

const mockSetSmartEqState = jest.fn((next?: ISmartEqSettings) => {
  mockLive.smartEq = next;
});

/** Enough of the capture's options to see which session is which, and to
 * hand a continuous one its checkpoints. */
interface ICaptureOptions {
  signal: AbortSignal;
  isContinuous?: boolean;
  onReport?: (report: IBalanceReport) => number[] | void;
}

/** Resolves the pending capture, so a run can be held open mid-listen. */
let mockFinishCapture: ((result: IBalanceResult) => void) | undefined;
const mockCaptureBalanceProfile = jest.fn(
  (_options: ICaptureOptions) =>
    new Promise<IBalanceResult>((resolve) => {
      mockFinishCapture = resolve;
    }),
);

const mockSetSmartEqApi = jest.fn(
  async (_settings?: ISmartEqSettings) => undefined,
);

jest.mock('renderer/utils/FluidEqContext', () => ({
  ...jest.requireActual('renderer/utils/FluidEqContext'),
  useFluidEqContext: () => ({
    filters: mockLive.filters,
    isLoading: false,
    isBlockingError: false,
    dispatchFilter: jest.fn(),
    setGlobalError: jest.fn(),
    setPreAmp: jest.fn(),
    selectedFilterId: '',
    setSelectedFilterId: jest.fn(),
    selectedFilterIds: [],
    setSelectedFilterIds: jest.fn(),
    nextFilterSelection: jest.fn(() => []),
    toggleFilterSelection: jest.fn(),
    hoveredFilterId: '',
    setHoveredFilterId: jest.fn(),
    convolution: undefined,
    voicing: undefined,
    driver: undefined,
    smartEq: mockLive.smartEq,
    setSmartEq: mockSetSmartEqState,
    // Nothing switched off. The band editor reads this to decide whether the
    // bands it is drawing are actually being applied, so it has to be an array.
    bypassed: [],
    getBandSetGeneration: () => 0,
  }),
}));

jest.mock('renderer/audio/LiveAudioContext', () => ({
  useLiveAudioControl: () => ({
    captureBalanceProfile: mockCaptureBalanceProfile,
    isActive: true,
  }),
  // This factory replaces the whole module, so an export it does not list is
  // `undefined` — and the engine calls this one on every render.
  useLiveAudioCapture: () => undefined,
}));

jest.mock('renderer/utils/equalizerApi', () => ({
  addEqualizerSlider: jest.fn(),
  clearGains: jest.fn(),
  removeEqualizerSlider: jest.fn(),
  setFrequency: jest.fn(),
  setFixedBand: jest.fn(),
  setGain: jest.fn(),
  setQuality: jest.fn(),
  // Called through rather than passed by reference: the factory is hoisted
  // above the declaration, so only a lazy read of it works.
  setSmartEq: (settings?: ISmartEqSettings) => mockSetSmartEqApi(settings),
  setType: jest.fn(),
}));

jest.mock('renderer/components/VoicingQuickPick', () => () => null);
jest.mock('renderer/components/ActiveLayers', () => () => null);
jest.mock('renderer/components/FrequencyBand', () => () => null);

// The reveal animates the result; it plays no part in deciding it, and its
// timers only make these tests slower.
jest.mock('renderer/utils/bandReveal', () => ({
  planBandReveal: () => undefined,
  revealBands: jest.fn(),
}));

/* --- harness ------------------------------------------------------------ */

const band = (id: string, frequency: number, gain: number): IFilter => ({
  id,
  frequency,
  gain,
  quality: 1,
  type: FilterTypeEnum.PK,
});

const layerOf = (gainsByFrequency: Record<number, number>) =>
  buildSmartEqSettings(
    getSmartEqLayout(),
    Object.fromEntries(
      getSmartEqLayout().map((layerBand) => [
        layerBand.id,
        gainsByFrequency[layerBand.frequency] ?? 0,
      ]),
    ),
  );

/** Profile A's accumulated correction, and profile B's. */
const LAYER_A = layerOf({ 63: 6 });
const LAYER_B = layerOf({ 63: -4 });

/** A measured spectrum with a resonance, so the solver has something to say. */
const SAMPLES: ISpectrumSample[] = Array.from(
  { length: 320 },
  (_value, index) => {
    const frequency =
      10 **
      (Math.log10(20) + (index / 319) * (Math.log10(20000) - Math.log10(20)));
    return {
      frequency,
      level: 8 * Math.exp(-((Math.log2(frequency / 200) / 0.5) ** 2)),
    };
  },
);

const RESULT: IBalanceResult = {
  samples: SAMPLES,
  status: 'ready',
  lowFrequency: 35,
  highFrequency: 15000,
  // Empty on purpose. This file is about the run control — who may start a
  // measurement and when — rather than about what a correction decides, and an
  // empty range list earns no boost anywhere, so nothing here can come to
  // depend on a gain.
  regions: [],
};

/**
 * One continuous checkpoint, every range heard and trusted, over `samples`.
 *
 * Trusted throughout so the loop has no reason to decline: what these tests
 * are about is what the loop does with an answer, not whether it has one.
 * The live levels sit above every presence line, so no range is gated.
 */
const reportOf = (samples: ISpectrumSample[]): IBalanceReport => {
  const regions = BALANCE_REGION_LABELS.map((label, index) => ({
    label,
    lowFrequency: BALANCE_REGION_EDGES[index],
    highFrequency: BALANCE_REGION_EDGES[index + 1],
    centreFrequency: Math.sqrt(
      BALANCE_REGION_EDGES[index] * BALANCE_REGION_EDGES[index + 1],
    ),
    levelDb: 0,
    liveDb: 15,
    typicalDb: 15,
    weight: 100,
    standardErrorDb: 0.1,
    confidence: 1,
    isCovered: true,
  }));
  return {
    samples: samples.map((sample) => ({ ...sample, confidence: 1 })),
    regions,
    coverage: 1,
    meanCoverage: 1,
    weakest: regions[0],
    listenedMs: 60000,
    frames: 1000,
    isConverged: false,
    isStalled: false,
    isBandLimited: false,
    status: 'ready',
  };
};

/**
 * An output already on Balance's own line — eleven decibels a decade, no bumps
 * — which is the one thing that mode has no reason to touch. Flat would not
 * do: a flat output is too bright for a held slope, and the loop would be
 * right to tilt it.
 */
const REFERENCE_SAMPLES: ISpectrumSample[] = SAMPLES.map((sample) => ({
  frequency: sample.frequency,
  level: -11 * Math.log10(sample.frequency / 1000),
}));

/**
 * A curve of the kind a song's memory hands back: modest, in the middle, and
 * one the loop itself could have made. A lone six-decibel bass band is not —
 * the solve's own bounds on level and tilt would pull that in on sight, which
 * is correct and is not what these tests are about.
 */
const REMEMBERED = layerOf({ 1000: 2, 1250: 2 });

let rerenderHost: () => void = () => undefined;
let showEqPanel: (isShown: boolean) => void = () => undefined;

/**
 * The app's arrangement, in miniature.
 *
 * The engine is mounted unconditionally, as `App` mounts it — outside the tab
 * switch. The panel is the tab, and can be taken away without taking the
 * measurement with it, which is the property the last test checks.
 */
const Harness = () => {
  const [, setTick] = useState(0);
  const [isPanelShown, setIsPanelShown] = useState(true);
  rerenderHost = () => setTick((value) => value + 1);
  showEqPanel = setIsPanelShown;
  return (
    <>
      <SmartEqEngine />
      {isPanelShown && <MainContent />}
    </>
  );
};

const startRun = async () => {
  const user = userEvent.setup();
  render(<Harness />);
  await user.click(
    screen.getByRole('button', { name: 'Smart EQ from live output' }),
  );
  await waitFor(() => expect(mockCaptureBalanceProfile).toHaveBeenCalled());
};

/** Somebody else writes the state while the capture is still listening. */
const writeMidCapture = async (next: () => void) => {
  await act(async () => {
    next();
    rerenderHost();
  });
};

const completeCapture = async () => {
  await act(async () => {
    mockFinishCapture?.(RESULT);
    await Promise.resolve();
  });
};

const lastWrittenLayer = () =>
  mockSetSmartEqApi.mock.calls[mockSetSmartEqApi.mock.calls.length - 1]?.[0];

/**
 * Only the calls that write a correction, not the ones that take one away.
 *
 * Every attempt now begins by clearing the previous layer — measuring the
 * already-corrected output cannot see through its own cuts, so the run always
 * starts from flat — and those clears are calls with `undefined`. The property
 * these tests are about is narrower and unchanged: nothing may write a *layer*
 * back over a clear the user made, or onto a profile it was not measured from.
 */
const writtenLayers = () =>
  mockSetSmartEqApi.mock.calls.filter(([layer]) => layer !== undefined);

const lastCaptureOptions = () =>
  mockCaptureBalanceProfile.mock.calls[
    mockCaptureBalanceProfile.mock.calls.length - 1
  ]?.[0];

beforeEach(() => {
  mockLive.filters = {
    low: band('low', 63, 3),
    high: band('high', 4000, -2),
  };
  mockLive.smartEq = undefined;
  mockFinishCapture = undefined;
  mockCaptureBalanceProfile.mockClear();
  mockSetSmartEqApi.mockClear();
  mockSetSmartEqState.mockClear();
  // Module state, so it outlives a render tree. A run abandoned by the previous
  // test's unmount never reaches its own `finally`, and a stale "running" would
  // turn the next test's press into a cancel.
  setSmartEqMode('smart');
  setSmartEqRunning(false);
  setSmartEqStatus('');
  setSmartEqListening('');
});

/* --- the tests ---------------------------------------------------------- */

describe('a Smart EQ run while the world changes underneath it', () => {
  it('writes its result when nothing moved', async () => {
    mockLive.smartEq = LAYER_A;
    await startRun();
    await completeCapture();

    await waitFor(() => expect(writtenLayers().length).toBeGreaterThan(0));
    // The residual landed on top of the layer it was measured against, which
    // is the whole point of the loop.
    expect(lastWrittenLayer()?.filters['smart-63'].gain).toBeGreaterThan(0);
  });

  /**
   * Checkable again, and it was not for a while.
   *
   * The run used to clear this layer before listening, so that it measured a
   * flat output — which made a clear arriving from the chip mid-listen
   * invisible to it. The state was already `undefined`, so there was nothing to
   * notice and no way to tell somebody else's clear from its own, and this test
   * had to be narrowed to the half that survived.
   *
   * Nothing is cleared before listening now; the run measures the output as it
   * stands. So the situation exists again and so does the property with teeth: a
   * clear is a change to the audible chain like any other, and a run that wrote
   * `the gains it started from + this residual` over the top of one would
   * silently undo it.
   */
  it('restarts rather than writing over a clear that arrived mid-listen', async () => {
    mockLive.smartEq = LAYER_A;
    await startRun();

    // ActiveLayers' X: the layer is gone from the state and from the profile.
    await writeMidCapture(() => {
      mockLive.smartEq = undefined;
    });
    await completeCapture();

    expect(writtenLayers()).toHaveLength(0);
    expect(mockCaptureBalanceProfile).toHaveBeenCalledTimes(2);

    // The second attempt measures the chain the user now has, and is seeded
    // from nothing rather than from LAYER_A's +6 dB at 63 Hz.
    await completeCapture();
    await waitFor(() => expect(writtenLayers().length).toBeGreaterThan(0));
    expect(lastWrittenLayer()?.filters['smart-63'].gain).toBeLessThan(
      LAYER_A?.filters['smart-63'].gain ?? 0,
    );
  });

  it('never lands one profile’s correction on another', async () => {
    // Profile A is measured; part-way through, the user loads profile B, which
    // brings its own accumulated correction and its own bands.
    mockLive.smartEq = LAYER_A;
    await startRun();

    await writeMidCapture(() => {
      mockLive.smartEq = LAYER_B;
      mockLive.filters = { low: band('low', 63, -5) };
    });
    await completeCapture();

    expect(writtenLayers()).toHaveLength(0);
    expect(mockCaptureBalanceProfile).toHaveBeenCalledTimes(2);

    // The second attempt measures B, and must be seeded from B's gains.
    await completeCapture();
    await waitFor(() => expect(writtenLayers().length).toBeGreaterThan(0));

    const written = lastWrittenLayer();
    // A's +6 dB at 63 Hz never appears: B started at -4 dB, and one residual
    // cannot carry it past zero.
    expect(written?.filters['smart-63'].gain).toBeLessThan(0);
    expect(describeSmartEqLayer(written)).not.toBe(
      describeSmartEqLayer(LAYER_A),
    );
  });
});

/**
 * The reason any of this was moved out of the EQ page.
 *
 * A continuous mode is meant to run for hours: each of its nine regions fills
 * at its own rate, is corrected when it alone has been heard well enough, and
 * keeps a long-run destination averaged over every window since it started.
 * None of that survives a restart — and it used to be restarted by the most
 * ordinary thing in the app, which is looking at another tab. The panel
 * unmounted, React ran the effect cleanup, the cleanup aborted the capture, and
 * coming back began again from nothing.
 *
 * The capture is one session, so "still running" is checkable directly: the
 * signal it was handed is not aborted, and no second session was ever opened.
 */
describe('a continuous measurement while the view comes and goes', () => {
  it('keeps listening when the EQ panel unmounts', async () => {
    // Chosen before anything renders, so the engine comes up already in the
    // mode rather than clearing the layer on the way into it.
    setSmartEqMode('balance');

    render(<Harness />);
    await waitFor(() => expect(mockCaptureBalanceProfile).toHaveBeenCalled());
    expect(lastCaptureOptions().isContinuous).toBe(true);
    const session = lastCaptureOptions().signal;

    // Somebody switches to the Voicing tab.
    await act(async () => {
      showEqPanel(false);
    });
    expect(
      screen.queryByRole('button', {
        name: 'Keep Smart EQ measuring and adjusting while music plays',
      }),
    ).not.toBeInTheDocument();

    // The measurement is untouched: same session, still open, never restarted.
    expect(session.aborted).toBe(false);
    expect(mockCaptureBalanceProfile).toHaveBeenCalledTimes(1);

    // And coming back does not start a second one either — the evidence the
    // regions have accumulated is the same evidence.
    await act(async () => {
      showEqPanel(true);
    });
    expect(session.aborted).toBe(false);
    expect(mockCaptureBalanceProfile).toHaveBeenCalledTimes(1);
    expect(lastCaptureOptions().signal).toBe(session);
  });
});

describe('a continuous measurement when the layer is replaced underneath it', () => {
  /**
   * The clock, held by hand. The loop keeps two windows against it — a settle
   * after every write while Equalizer APO reloads, and a quiet window between
   * corrections — and both are read straight off `Date.now`.
   */
  let nowMs = 1_000_000;
  let clock: jest.SpyInstance<number, []>;
  beforeEach(() => {
    nowMs = 1_000_000;
    clock = jest.spyOn(Date, 'now').mockImplementation(() => nowMs);
  });
  afterEach(() => {
    clock.mockRestore();
  });

  const checkpoint = async (report: IBalanceReport) => {
    const stale: number[] = [];
    await act(async () => {
      stale.push(...(lastCaptureOptions().onReport?.(report) ?? []));
      // The write's promise settles here, which is what closes the settle
      // window's start and opens the quiet one.
      await Promise.resolve();
      rerenderHost();
    });
    return stale;
  };

  /**
   * THE REPORTED DEFECT. A song's remembered curve landed over the running
   * loop, and within one quiet window the loop had walked it most of the way
   * back to where it had been steering before — because everything the loop
   * remembered described the previous song, and a fresh layer looked to it
   * like a disagreement to be corrected.
   *
   * Two halves, and both have to hold: the evidence heard through the old
   * layer is thrown away, and the destination averaged from it is forgotten.
   * The second is the audible one. Without it, a flat checkpoint after the
   * replacement still blends toward the old resonance cut and the loop writes
   * a step toward it over the remembered curve.
   */
  it('forgets where it was steering when a remembered curve is applied', async () => {
    setSmartEqMode('balance');
    render(<Harness />);
    await waitFor(() => expect(mockCaptureBalanceProfile).toHaveBeenCalled());

    // A resonance to steer toward: the loop takes its first step against it.
    await checkpoint(reportOf(SAMPLES));
    expect(writtenLayers()).toHaveLength(1);
    const stepped = lastWrittenLayer();
    expect(stepped).toBeDefined();

    // The song recorder applies a remembered curve, exactly as it does on a
    // match: the loop is told first, then context follows.
    await act(async () => {
      noteSmartEqLayerReplaced(REMEMBERED);
      mockLive.smartEq = REMEMBERED;
      rerenderHost();
    });

    // Past the reload settle: every range's evidence is declared stale in one
    // go, and nothing is written over the curve that just arrived.
    nowMs += 1_000;
    const stale = await checkpoint(reportOf(REFERENCE_SAMPLES));
    expect(stale).toEqual(BALANCE_REGION_LABELS.map((_label, index) => index));
    expect(writtenLayers()).toHaveLength(1);

    // Past the quiet window, on evidence that agrees with the remembered
    // curve: the loop has no opinion left over from before it, so it leaves
    // it exactly where it is.
    nowMs += 30_000;
    await checkpoint(reportOf(REFERENCE_SAMPLES));
    expect(writtenLayers()).toHaveLength(1);
    expect(describeSmartEqLayer(mockLive.smartEq)).toBe(
      describeSmartEqLayer(REMEMBERED),
    );
  });

  /**
   * The same protection for a write the loop only finds out about at its next
   * checkpoint — the chip's clear button, a profile load — which reaches it
   * through context alone.
   */
  it('notices a layer it did not write, without being told', async () => {
    setSmartEqMode('balance');
    render(<Harness />);
    await waitFor(() => expect(mockCaptureBalanceProfile).toHaveBeenCalled());

    await checkpoint(reportOf(SAMPLES));
    expect(writtenLayers()).toHaveLength(1);

    // Somebody clears the layer from the chip: context changes, nobody tells
    // the loop.
    await act(async () => {
      mockLive.smartEq = undefined;
      rerenderHost();
    });

    // The next checkpoint is spent noticing; the one after clears everything.
    nowMs += 1_000;
    expect(await checkpoint(reportOf(REFERENCE_SAMPLES))).toEqual([]);
    nowMs += 1_000;
    expect(await checkpoint(reportOf(REFERENCE_SAMPLES))).toEqual(
      BALANCE_REGION_LABELS.map((_label, index) => index),
    );

    nowMs += 30_000;
    await checkpoint(reportOf(REFERENCE_SAMPLES));
    expect(writtenLayers()).toHaveLength(1);
    expect(mockLive.smartEq).toBeUndefined();
  });

  /**
   * And the loop's own echo is not mistaken for an outside write. Its writes
   * come back through context looking like anything else's; if that reset the
   * loop, it would forget its destination after every step it took.
   */
  it('keeps its memory through the echo of its own write', async () => {
    setSmartEqMode('balance');
    render(<Harness />);
    await waitFor(() => expect(mockCaptureBalanceProfile).toHaveBeenCalled());

    await checkpoint(reportOf(SAMPLES));
    expect(writtenLayers()).toHaveLength(1);

    // Only the ranges the step moved are stale, not all nine: the loop
    // recognised the layer in context as its own.
    nowMs += 1_000;
    const stale = await checkpoint(reportOf(SAMPLES));
    expect(stale.length).toBeGreaterThan(0);
    expect(stale.length).toBeLessThan(BALANCE_REGION_LABELS.length);
  });
});

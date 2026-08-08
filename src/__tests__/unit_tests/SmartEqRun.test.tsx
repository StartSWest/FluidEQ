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
import {
  buildSmartEqSettings,
  describeSmartEqLayer,
  getSmartEqLayout,
} from 'common/smartEq';
import { IBalanceResult, ISpectrumSample } from 'renderer/utils/autoBalance';
import MainContent from 'renderer/MainContent';

/**
 * A Smart EQ run takes tens of seconds, and the world does not hold still for
 * it. These are the writes that arrive while it is listening: the chip's clear
 * button, and a profile load that replaces every layer at once. Both used to be
 * overwritten by the run still in flight, because it read the layer once at the
 * start and never looked again.
 */

/* --- the world the run reads ------------------------------------------- */

const mockLive: {
  filters: IFiltersMap;
  smartEq: ISmartEqSettings | undefined;
} = { filters: {}, smartEq: undefined };

const mockSetSmartEqState = jest.fn((next?: ISmartEqSettings) => {
  mockLive.smartEq = next;
});

/** Resolves the pending capture, so a run can be held open mid-listen. */
let mockFinishCapture: ((result: IBalanceResult) => void) | undefined;
const mockCaptureBalanceProfile = jest.fn(
  () =>
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
};

let rerenderMainContent: () => void = () => undefined;

const HarnessedMainContent = () => {
  const [, setTick] = useState(0);
  rerenderMainContent = () => setTick((value) => value + 1);
  return <MainContent />;
};

const startRun = async () => {
  const user = userEvent.setup();
  render(<HarnessedMainContent />);
  await user.click(
    screen.getByRole('button', { name: 'Smart EQ from live output' }),
  );
  await waitFor(() => expect(mockCaptureBalanceProfile).toHaveBeenCalled());
};

/** Somebody else writes the state while the capture is still listening. */
const writeMidCapture = async (next: () => void) => {
  await act(async () => {
    next();
    rerenderMainContent();
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

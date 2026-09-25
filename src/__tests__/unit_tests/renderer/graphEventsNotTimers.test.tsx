/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The frequency response graph waiting on what it is waiting for.
 *
 * Three waits on the graph were durations: two seconds of silence before the
 * EQ curves came back in solo, 170 ms for the look designer's exit, and 90 ms
 * of a drag's writes gathered before any was sent. Each is now the event that
 * says so — the capture's resting frame, the exit's own `animationend`, the
 * previous write landing — and each null here stands beside the positive
 * control that proves the event still does its job. The nulls let time pass
 * (the fake timers) and show nothing moved for it; the window's timer count
 * is not asserted, because the look picker's auto-cycle rightly keeps an
 * animation frame queued.
 */

import '@testing-library/jest-dom';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { FilterTypeEnum, IFiltersMap } from 'common/constants';
import type {
  IChartCurveData,
  IChartPointData,
  IEditableChartPoint,
} from 'renderer/graph/ChartController';
import { SILENT_WAVEFORM } from 'renderer/graph/liveSpectrumFrames';
import { AudioEngineContext } from 'renderer/utils/audioEngineContext';
import {
  toggleLiveOutputSolo,
  useLiveOutputSolo,
} from 'renderer/utils/graphViewSettings';

const band = (id: string, frequency: number, gain: number) => ({
  id,
  frequency,
  gain,
  quality: 1,
  type: FilterTypeEnum.PK,
});

const mockFilters: IFiltersMap = { low: band('low', 100, 3) };
// A second layer, so solo — which hides the bands' own line — still has
// curves to put back when the music stops.
const mockHeadphone = { filters: { hp: band('hp', 1000, 6) }, intensity: 1 };

jest.mock('renderer/utils/trebleDesignApi', () => ({
  getTrebleDesigns: async () => ({ eq: 'precise', curves: 'precise' }),
  setTrebleDesign: jest.fn(),
}));
jest.mock('renderer/utils/FluidEqContext', () => ({
  ...jest.requireActual('renderer/utils/FluidEqContext'),
  useFluidEqContext: () => ({
    filters: mockFilters,
    headphone: mockHeadphone,
    nextFilterSelection: (id: string) => [id],
    isEqDoubleOn: false,
    bypassed: [],
    isAutoPreAmpOn: false,
    isGraphViewOn: true,
    isEngineUsable: true,
    isLoading: false,
    globalError: undefined,
    preAmp: 0,
    convolution: undefined,
    voicing: undefined,
    driver: undefined,
    smartEq: undefined,
    setGlobalError: jest.fn(),
    setPreAmp: jest.fn(),
    dispatchFilter: jest.fn(),
    selectedFilterIds: [],
    setSelectedFilterIds: jest.fn(),
    hoveredFilterId: '',
    setHoveredFilterId: jest.fn(),
  }),
}));

/** A write that lands only when the test says so. */
interface IWrite {
  args: unknown[];
  land: () => void;
}
const mockWrites: IWrite[] = [];
const mockWrite =
  (name: string) =>
  (...args: unknown[]) =>
    new Promise<void>((resolve) => {
      mockWrites.push({ args: [name, ...args], land: resolve });
    });

jest.mock('renderer/utils/equalizerApi', () => ({
  setFrequency: mockWrite('frequency'),
  setGain: mockWrite('gain'),
  setQuality: mockWrite('quality'),
  setMainPreAmp: jest.fn(() => Promise.resolve()),
  readKnownAudioDevices: () => Promise.resolve([]),
}));

const mockChart: {
  data: IChartCurveData[];
  editablePoints: IEditableChartPoint[];
} = { data: [], editablePoints: [] };

jest.mock('renderer/graph/Chart', () => ({
  __esModule: true,
  default: (props: {
    data: IChartCurveData[];
    editablePoints: IEditableChartPoint[];
  }) => {
    mockChart.data = props.data;
    mockChart.editablePoints = props.editablePoints;
    return null;
  },
}));

const mockAudio = {
  frame: {
    points: [] as IChartPointData[],
    waveform: [] as number[],
    isClipping: false,
  },
  error: '',
};

jest.mock('renderer/audio/LiveAudioContext', () => ({
  ...jest.requireActual('renderer/audio/LiveAudioContext'),
  useLiveAudioFrame: () => mockAudio.frame,
  useLiveAudioControl: () => ({
    error: mockAudio.error,
    isActive: true,
    isPaused: false,
    readFrame: () => undefined,
  }),
  useLiveAudioCapture: () => undefined,
}));

jest.mock('renderer/graph/GraphViewMenu', () => () => null);
jest.mock(
  'renderer/components/LookDesigner',
  () =>
    function MockLookDesigner({
      isClosing,
      onClose,
    }: {
      isClosing: boolean;
      onClose: () => void;
    }) {
      return (
        <div
          role="dialog"
          className={`look-designer${isClosing ? ' is-closing' : ''}`}
        >
          <button type="button" onClick={onClose}>
            close designer
          </button>
        </div>
      );
    },
);

// eslint-disable-next-line import/first
import FrequencyResponseChart from 'renderer/graph/FrequencyResponseChart';

const chart = () => (
  <AudioEngineContext.Provider value="apo">
    <FrequencyResponseChart />
  </AudioEngineContext.Provider>
);

const music: IChartPointData[] = [
  { x: 100, y: -10 },
  { x: 1000, y: -12 },
];

/** jsdom has no AnimationEvent, so the name is put on a plain one. */
const animationEnd = (target: Element, name: string) => {
  const event = new Event('animationend', { bubbles: true });
  Object.assign(event, { animationName: name });
  act(() => {
    target.dispatchEvent(event);
  });
};

let isSoloOn = false;
function SoloProbe() {
  isSoloOn = useLiveOutputSolo();
  return null;
}

beforeEach(() => {
  jest.useFakeTimers({ doNotFake: ['queueMicrotask', 'nextTick'] });
  mockAudio.frame = { points: [], waveform: [], isClipping: false };
  mockAudio.error = '';
  mockWrites.length = 0;
});

afterEach(() => {
  jest.useRealTimers();
});

describe('solo through silence', () => {
  afterEach(() => {
    if (isSoloOn) {
      act(() => toggleLiveOutputSolo());
    }
  });

  it('brings the EQ back on the capture’s resting frame, not on a timer', () => {
    const view = render(
      <>
        <SoloProbe />
        {chart()}
      </>,
    );
    if (!isSoloOn) {
      act(() => toggleLiveOutputSolo());
    }
    expect(isSoloOn).toBe(true);
    const curvesShown = () => mockChart.data.length > 0;
    expect(curvesShown()).toBe(true);

    // Music: the trace has the plot to itself.
    mockAudio.frame = {
      points: music,
      waveform: [0.4, 0.5],
      isClipping: false,
    };
    view.rerender(
      <>
        <SoloProbe />
        {chart()}
      </>,
    );
    expect(curvesShown()).toBe(false);

    // NULL: the spectrum empty while the meters still fall is a dip, and no
    // amount of wall time turns it into silence.
    mockAudio.frame = { points: [], waveform: [0, 0.01], isClipping: false };
    view.rerender(
      <>
        <SoloProbe />
        {chart()}
      </>,
    );
    act(() => {
      jest.advanceTimersByTime(30_000);
    });
    expect(curvesShown()).toBe(false);

    // POSITIVE CONTROL: the resting frame is the output saying it stopped.
    mockAudio.frame = {
      points: [],
      waveform: SILENT_WAVEFORM,
      isClipping: false,
    };
    view.rerender(
      <>
        <SoloProbe />
        {chart()}
      </>,
    );
    expect(curvesShown()).toBe(true);
  });
});

describe('the look designer', () => {
  it('leaves when its exit animation ends, and not before', () => {
    let exitPlaying = false;
    Object.defineProperty(HTMLElement.prototype, 'getAnimations', {
      configurable: true,
      value: () =>
        exitPlaying ? [{ animationName: 'pop-out', playState: 'running' }] : [],
    });
    render(chart());
    fireEvent.click(screen.getByRole('button', { name: 'New look' }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    exitPlaying = true;
    fireEvent.click(screen.getByRole('button', { name: 'close designer' }));
    const panel = screen.getByRole('dialog');
    expect(panel).toHaveClass('is-closing');

    // NULL: time alone does not take it away, nor does another animation.
    act(() => {
      jest.advanceTimersByTime(5_000);
    });
    animationEnd(panel, 'pop-in');
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    // POSITIVE CONTROL: the exit's own end does.
    animationEnd(panel, 'pop-out');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    Reflect.deleteProperty(HTMLElement.prototype, 'getAnimations');
  });
});

describe('dragging a band', () => {
  it('sends the first move at once and the newest one when that write lands', async () => {
    render(chart());
    const [point] = mockChart.editablePoints;
    act(() => point.onSelect?.('replace', { x: 100, y: 3 }));

    act(() => point.onChange?.({ x: 200, y: 4 }));
    // At once: not gathered for 90 ms first.
    expect(mockWrites.map((write) => write.args)).toEqual([
      ['frequency', 'low', 200],
    ]);

    // While that is on the wire, two more moves: only the newest will go.
    act(() => point.onChange?.({ x: 300, y: 5 }));
    act(() => point.onChange?.({ x: 400, y: 6 }));
    expect(mockWrites).toHaveLength(1);

    // The batch in flight finishes in order, then the newest values follow.
    await act(async () => mockWrites[0].land());
    expect(mockWrites[1].args).toEqual(['gain', 'low', 4]);
    await act(async () => mockWrites[1].land());
    expect(mockWrites[2].args).toEqual(['frequency', 'low', 400]);
    await act(async () => mockWrites[2].land());
    expect(mockWrites[3].args).toEqual(['gain', 'low', 6]);
    await act(async () => mockWrites[3].land());
    expect(mockWrites).toHaveLength(4);

    // POSITIVE CONTROL: with nothing in flight, the next move goes at once.
    act(() => point.onChange?.({ x: 500, y: 7 }));
    expect(mockWrites[4].args).toEqual(['frequency', 'low', 500]);
  });
});

/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * THE BELL DRAG (Ivan, 2026-09-28: "if I select multiple bands and move them
 * with control pressed it will create a bell move on all bands, using their
 * Q setting as the bell curve, using the center band as the tip").
 *
 * Ctrl held while a selected group is dragged: the grabbed band moves by the
 * whole drag, the others by the height at their frequency of a bell as wide
 * as the grabbed band's Q, and no band's frequency moves. Without Ctrl the
 * same drag moves every band by the same amount, which is each case's
 * control. And a Ctrl-press on a band of the group no longer takes it out of
 * the selection at once: only a Ctrl-click that never moved does, on release.
 *
 * The chart itself is stood in for; the handles' callbacks are what a drag
 * calls, with the Ctrl state `EditablePoint` reads off each move.
 */

import { act, render } from '@testing-library/react';
import { FilterTypeEnum, IFiltersMap } from 'common/constants';
import type {
  IChartCurveData,
  IEditableChartPoint,
} from 'renderer/graph/ChartController';
import bellGainAt from 'renderer/graph/bellDrag';
import { AudioEngineContext } from 'renderer/utils/audioEngineContext';
import { FilterActionEnum } from 'renderer/utils/FluidEqContext';

const TIP_Q = 1.41;
const band = (id: string, frequency: number) => ({
  id,
  frequency,
  gain: 0,
  quality: TIP_Q,
  type: FilterTypeEnum.PK,
});

const mockEq = {
  filters: {
    a: band('a', 250),
    b: band('b', 400),
    c: band('c', 630),
    d: band('d', 1000),
    e: band('e', 1600),
  } as IFiltersMap,
  selected: [] as string[],
  selections: [] as string[][],
  actions: [] as Array<{
    type: FilterActionEnum;
    id: string;
    newValue: number;
  }>,
};

jest.mock('renderer/utils/trebleDesignApi', () => ({
  getTrebleDesigns: async () => ({ eq: 'precise', curves: 'precise' }),
  setTrebleDesign: jest.fn(),
}));
jest.mock('renderer/utils/FluidEqContext', () => ({
  ...jest.requireActual('renderer/utils/FluidEqContext'),
  useFluidEqContext: () => ({
    filters: mockEq.filters,
    headphone: undefined,
    nextFilterSelection: (id: string, mode: 'replace' | 'toggle' | 'range') =>
      jest
        .requireActual('common/bandSelection')
        .nextBandSelection(
          mockEq.filters,
          mockEq.selected,
          id,
          mode,
          undefined,
        ),
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
    dispatchFilter: (action: {
      type: FilterActionEnum;
      id: string;
      newValue: number;
    }) => mockEq.actions.push(action),
    selectedFilterIds: mockEq.selected,
    setSelectedFilterIds: (ids: string[]) => mockEq.selections.push(ids),
    hoveredFilterId: '',
    setHoveredFilterId: jest.fn(),
  }),
}));
jest.mock('renderer/utils/equalizerApi', () => ({
  setFrequency: () => Promise.resolve(),
  setGain: () => Promise.resolve(),
  setQuality: () => Promise.resolve(),
  setMainPreAmp: () => Promise.resolve(),
  readKnownAudioDevices: () => Promise.resolve([]),
}));

const mockChart: { points: IEditableChartPoint[] } = { points: [] };
jest.mock('renderer/graph/Chart', () => ({
  __esModule: true,
  default: (props: {
    data: IChartCurveData[];
    editablePoints: IEditableChartPoint[];
  }) => {
    mockChart.points = props.editablePoints;
    return null;
  },
}));
jest.mock('renderer/audio/LiveAudioContext', () => ({
  ...jest.requireActual('renderer/audio/LiveAudioContext'),
  useLiveAudioFrame: () => ({ points: [], waveform: [], isClipping: false }),
  useLiveAudioControl: () => ({
    error: '',
    isActive: true,
    isPaused: false,
    readFrame: () => undefined,
  }),
  useLiveAudioCapture: () => undefined,
}));
jest.mock('renderer/graph/GraphViewMenu', () => () => null);

// eslint-disable-next-line import/first
import FrequencyResponseChart from 'renderer/graph/FrequencyResponseChart';

const point = (id: string) => {
  const found = mockChart.points.find((each) => each.id === id);
  if (!found) {
    throw new Error(`no handle for ${id}`);
  }
  return found;
};

/** What the drag left each band at: its last frequency and gain sent. */
const landed = () => {
  const last = (id: string, type: FilterActionEnum) =>
    mockEq.actions.filter((each) => each.id === id && each.type === type).pop()
      ?.newValue;
  return Object.fromEntries(
    Object.keys(mockEq.filters).map((id) => [
      id,
      {
        frequency: last(id, FilterActionEnum.FREQUENCY),
        gain: last(id, FilterActionEnum.GAIN),
      },
    ]),
  );
};

/**
 * The whole group selected, and the chart drawn over it, settled: the Treble
 * choice it asks for on mount has answered.
 */
const showGroup = async (ids = Object.keys(mockEq.filters)) => {
  mockEq.selected = ids;
  render(
    <AudioEngineContext.Provider value="apo">
      <FrequencyResponseChart />
    </AudioEngineContext.Provider>,
  );
  await act(async () => {
    await Promise.resolve();
  });
};

const bellAt = (frequency: number) =>
  Math.round(bellGainAt(frequency, 630, TIP_Q, 6) * 100) / 100;

/** The selection the chart set last. */
const lastSelection = () => mockEq.selections[mockEq.selections.length - 1];

beforeEach(() => {
  mockEq.selected = [];
  mockEq.selections = [];
  mockEq.actions = [];
});

describe('a group dragged with Ctrl held', () => {
  it('rises as a bell round the grabbed band, and no frequency moves', async () => {
    await showGroup();
    const tip = point('c');
    act(() => tip.onSelect('toggle', { x: 630, y: 0 }));
    // Up 6 dB and along a little: the bell has no use for the sideways part.
    act(() => tip.onChange({ x: 700, y: 6 }, true));

    const bands = landed();
    expect(bands.c).toEqual({ frequency: 630, gain: 6 });
    (['a', 'b', 'd', 'e'] as const).forEach((id) => {
      const { frequency } = mockEq.filters[id];
      expect(bands[id]).toEqual({ frequency, gain: bellAt(frequency) });
    });
    // The bell's shape: lower the further from the tip, on either side.
    expect(bands.b.gain).toBeLessThan(6);
    expect(bands.a.gain).toBeLessThan(bands.b.gain ?? 0);
    expect(bands.d.gain).toBeLessThan(6);
    expect(bands.e.gain).toBeLessThan(bands.d.gain ?? 0);
    expect(bands.a.gain).toBeGreaterThan(0);
    // The press kept the group whole.
    expect(lastSelection()).toEqual(['a', 'b', 'c', 'd', 'e']);
  });

  // CONTROL: the same drag without Ctrl moves the group as one.
  it('moves the group as one without Ctrl, frequencies and all', async () => {
    await showGroup();
    const tip = point('c');
    act(() => tip.onSelect('replace', { x: 630, y: 0 }));
    act(() => tip.onChange({ x: 700, y: 6 }, false));

    const bands = landed();
    Object.entries(bands).forEach(([id, { frequency, gain }]) => {
      expect(gain).toBe(6);
      expect(frequency).toBe(mockEq.filters[id].frequency + 70);
    });
  });

  it('goes back to the plain move when Ctrl is let go mid-drag', async () => {
    await showGroup();
    const tip = point('c');
    act(() => tip.onSelect('toggle', { x: 630, y: 0 }));
    act(() => tip.onChange({ x: 630, y: 6 }, true));
    expect(landed().a.gain).toBe(bellAt(250));
    act(() => tip.onChange({ x: 630, y: 6 }, false));
    Object.values(landed()).forEach(({ gain }) => expect(gain).toBe(6));
  });

  it('is only a group’s: one band follows the pointer, Ctrl or not', async () => {
    await showGroup(['c']);
    const only = point('c');
    act(() => only.onSelect('replace', { x: 630, y: 0 }));
    act(() => only.onChange({ x: 700, y: 6 }, true));
    expect(landed().c).toEqual({ frequency: 700, gain: 6 });
  });
});

describe('Ctrl-pressing a band of the selected group', () => {
  it('takes it out of the selection on release when it never moved', async () => {
    await showGroup();
    const pressed = point('e');
    act(() => pressed.onSelect('toggle', { x: 1600, y: 0 }));
    // Not at the press: a drag may follow.
    expect(lastSelection()).toEqual(['a', 'b', 'c', 'd', 'e']);
    act(() => pressed.onCommit());
    expect(lastSelection()).toEqual(['a', 'b', 'c', 'd']);
  });

  // CONTROL: a Ctrl-drag of the same press keeps the whole group.
  it('keeps it once the press became a drag', async () => {
    await showGroup();
    const pressed = point('e');
    act(() => pressed.onSelect('toggle', { x: 1600, y: 0 }));
    act(() => pressed.onChange({ x: 1600, y: 3 }, true));
    act(() => pressed.onCommit());
    expect(lastSelection()).toEqual(['a', 'b', 'c', 'd', 'e']);
  });

  it('still adds a band that was not selected at the press', async () => {
    await showGroup(['a', 'b']);
    act(() => point('c').onSelect('toggle', { x: 630, y: 0 }));
    expect(lastSelection()).toEqual(['a', 'b', 'c']);
  });
});

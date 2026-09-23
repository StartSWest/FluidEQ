/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The selected band's filter type, picked from its list.
 *
 * The list is portalled to the body, and the page lets the band go on a press
 * outside the band's own surfaces. A press in the list counted as outside, so
 * the editor — the list with it — was gone before the click landed and the
 * type never changed (Ivan, 2026-09-22: "when I choose the pane closes and no
 * setting get saved"). A press anywhere else still lets the band go.
 *
 * Mounted the way `SongEqTick.test.tsx` mounts `MainContent`, with a band
 * selected.
 */

import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import { FilterTypeEnum, IFiltersMap } from 'common/constants';
import MainContent from 'renderer/MainContent';
import { setFilterValues } from 'renderer/utils/equalizerApi';

const mockSetSelectedFilterIds = jest.fn();
const mockDispatchFilter = jest.fn();
const mockFilters: IFiltersMap = {
  'band-36': {
    id: 'band-36',
    frequency: 36,
    gain: -2.3,
    quality: 1,
    type: FilterTypeEnum.PK,
  },
};

jest.mock('renderer/audio/nowPlayingIdentity', () => ({
  useNowPlayingIdentity: () => ({ identity: undefined, isPlaying: false }),
}));
jest.mock('renderer/utils/useCurvePhase', () => ({
  __esModule: true,
  default: () => ({ status: undefined, select: jest.fn() }),
}));
jest.mock('renderer/utils/trebleDesignApi', () => ({
  getTrebleDesigns: async () => ({ eq: 'precise', curves: 'precise' }),
  setTrebleDesign: jest.fn(),
}));
jest.mock('renderer/utils/FluidEqContext', () => ({
  ...jest.requireActual('renderer/utils/FluidEqContext'),
  useFluidEqContext: () => ({
    filters: mockFilters,
    isLoading: false,
    isBlockingError: false,
    dispatchFilter: mockDispatchFilter,
    setGlobalError: jest.fn(),
    setPreAmp: jest.fn(),
    selectedFilterId: 'band-36',
    setSelectedFilterId: jest.fn(),
    selectedFilterIds: ['band-36'],
    setSelectedFilterIds: mockSetSelectedFilterIds,
    nextFilterSelection: jest.fn(() => []),
    toggleFilterSelection: jest.fn(),
    hoveredFilterId: '',
    setHoveredFilterId: jest.fn(),
    bypassed: [],
    getBandSetGeneration: () => 0,
    activeDeviceId: 'device-a',
    smartEq: undefined,
    setSmartEq: jest.fn(),
  }),
}));
jest.mock('renderer/audio/LiveAudioContext', () => ({
  useLiveAudioControl: () => ({
    captureBalanceProfile: jest.fn(() => new Promise(() => {})),
    isActive: true,
  }),
  useLiveAudioCapture: () => undefined,
}));
jest.mock('renderer/utils/equalizerApi', () => ({
  addEqualizerSlider: jest.fn(),
  clearGains: jest.fn(),
  removeEqualizerSlider: jest.fn(),
  setFilterValues: jest.fn(() => Promise.resolve(undefined)),
  setFixedBand: jest.fn(),
  lookupSongEq: jest.fn(() => Promise.resolve(undefined)),
  checkpointSongEq: jest.fn(() => Promise.resolve(undefined)),
  commitSongEq: jest.fn(() => Promise.resolve(undefined)),
  forgetSongEq: jest.fn(() => Promise.resolve(undefined)),
  setSmartEq: jest.fn(() => Promise.resolve(undefined)),
  getAudioDevices: jest.fn(() => Promise.resolve([])),
}));
jest.mock('renderer/components/VoicingQuickPick', () => () => null);
jest.mock('renderer/components/ActiveLayers', () => () => null);
jest.mock('renderer/components/FrequencyBand', () => () => null);
jest.mock('renderer/utils/bandReveal', () => ({
  planBandReveal: () => undefined,
  revealBands: jest.fn(),
}));

beforeEach(() => {
  jest.clearAllMocks();
});

it('keeps the band selected while its type is picked, and saves the pick', () => {
  render(<MainContent />);
  fireEvent.click(
    screen.getByRole('menu', { name: 'selected-band-filter-type' }),
  );
  const notch = screen.getByRole('menuitem', { name: 'Notch' });
  // The list is outside the editor in the document: the press that opens a
  // click on it is where the band used to be let go.
  expect(notch.closest('.eq-flat-editor')).toBeNull();
  fireEvent.pointerDown(notch);
  expect(mockSetSelectedFilterIds).not.toHaveBeenCalled();
  fireEvent.click(notch);
  expect(setFilterValues).toHaveBeenCalledWith([
    { id: 'band-36', type: FilterTypeEnum.NO },
  ]);
  expect(mockDispatchFilter).toHaveBeenCalledWith(
    expect.objectContaining({
      edits: [{ id: 'band-36', type: FilterTypeEnum.NO }],
    }),
  );
});

it('still lets the band go on a press anywhere else', () => {
  // POSITIVE CONTROL for the test above: the rule is listening, so its
  // silence there is the list being counted as the band's own surface.
  render(<MainContent />);
  fireEvent.pointerDown(document.body);
  expect(mockSetSelectedFilterIds).toHaveBeenCalledWith([]);
});

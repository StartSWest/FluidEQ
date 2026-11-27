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
import { act, fireEvent, render, screen } from '@testing-library/react';
import { FilterTypeEnum, IFiltersMap } from 'common/constants';
import MainContent from 'renderer/MainContent';
import { setFilterValues } from 'renderer/utils/equalizerApi';
import { refreshTrebleDesigns } from 'renderer/utils/useTrebleDesigns';
import { routeSongSounds } from '../utils/songSoundsBridge';

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
// One answer for the whole window, asked the first time anything shows it.
// Answered before any case renders: left to the first mount, it landed after
// that case had ended and re-rendered the EQ outside act.
beforeAll(() => refreshTrebleDesigns());
jest.mock('renderer/utils/FluidEqContext', () => ({
  ...jest.requireActual('renderer/utils/FluidEqContext'),
  ...jest.requireActual('__tests__/utils/fluidEqHookMocks').eqHooksFrom(() => ({
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
    bandSetReplacement: 0,
    activeDeviceId: 'device-a',
    setSmartEq: jest.fn(),
  })),
}));
jest.mock('renderer/audio/LiveAudioContext', () => ({
  useLiveAudioControl: () => ({
    captureBalanceProfile: jest.fn(() => new Promise(() => {})),
    isActive: true,
  }),
  useLiveAudioCapture: () => undefined,
  // The band row's level tracks read the live frame, handed to a listener
  // since 2026-11-16; one never called is silence, which lights none.
  useLiveAudioFrame: () => ({ graphPoints: [] }),
  useLiveAudioFrameListener: () => undefined,
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
  readKnownAudioDevices: jest.fn(() => Promise.resolve([])),
}));
jest.mock('renderer/components/VoicingQuickPick', () => () => null);
jest.mock('renderer/components/CurvesPicker', () => () => null);
// The popover stays hidden until it is placed beside its handle, which is
// measured, and jsdom measures nothing: a place of its own stands in.
jest.mock('renderer/eq/useBandPopoverPlace', () => ({
  ...jest.requireActual('renderer/eq/useBandPopoverPlace'),
  __esModule: true,
  default: () => ({ left: 0, top: 0, arrow: 0, side: 'right' }),
}));
// Only the band's column, which is what gives the popover its band: it is up
// while Shift is held and a selected band has the keyboard (2026-11-17).
jest.mock(
  'renderer/components/FrequencyBand',
  () =>
    ({ filter }: { filter: { id: string } }) =>
      jest.requireActual('react').createElement('div', {
        className: 'bandWrapper',
        'data-filter-id': filter.id,
        'data-testid': `band-${filter.id}`,
        tabIndex: -1,
      }),
);
jest.mock('renderer/utils/bandReveal', () => ({
  planBandReveal: () => undefined,
  revealBands: jest.fn(),
}));

beforeEach(() => {
  jest.clearAllMocks();
  // The bands toolbar's Save EQ reads the saved EQs from main's song sound
  // index (`songSoundIndex.ts`): a main with nothing saved answers it.
  Object.defineProperty(window, 'electron', {
    configurable: true,
    value: { ipcRenderer: routeSongSounds() },
  });
});

/** The page, once main's answer for the saved EQs has landed. */
const renderPage = async () => {
  await act(async () => {
    render(<MainContent />);
  });
};

/**
 * The selected band's editor is a popover since 2026-11-16, up while Shift
 * is held and the band has the keyboard: its column focused, Shift down.
 */
const openPopover = () => {
  act(() => screen.getByTestId('band-band-36').focus());
  fireEvent.keyDown(window, { key: 'Shift' });
};

it('keeps the band selected while its type is picked, and saves the pick', async () => {
  await renderPage();
  // Not up until it is asked for, so the menu below is the popover's.
  expect(
    screen.queryByRole('menu', { name: 'selected-band-filter-type' }),
  ).toBeNull();
  openPopover();
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

it('still lets the band go on a press anywhere else', async () => {
  // POSITIVE CONTROL for the test above: the rule is listening, so its
  // silence there is the list being counted as the band's own surface.
  await renderPage();
  fireEvent.pointerDown(document.body);
  expect(mockSetSelectedFilterIds).toHaveBeenCalledWith([]);
});

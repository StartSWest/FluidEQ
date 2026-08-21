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
import { act, fireEvent, render, screen } from '@testing-library/react';
import { FilterTypeEnum, ISmartEqSettings } from 'common/constants';
import { translate } from 'common/i18n';
import {
  SONG_EQ_MIN_LISTENED_MS,
  SONG_EQ_SETTLE_MS,
} from 'common/songEqRecorder';
import { buildSongIdentity } from 'common/songIdentity';
import { useNowPlayingIdentity } from 'renderer/audio/nowPlayingIdentity';
import {
  resetSongEqSession,
  setSongEqSaveOn,
  useSongEqSessionHost,
} from 'renderer/audio/songEqSession';
import { formatDuration } from 'renderer/library/player/NowPlayingBar';
import MainContent from 'renderer/MainContent';
import { setSmartEqMode } from 'renderer/utils/smartEqMode';

/**
 * The tick's own toolbar, rendered the way `SmartEqRun.test.tsx` renders
 * `MainContent` — the only suite that already mounts it, so its provider
 * mocking is copied rather than invented. `SmartEqModeSwitch.test.tsx`
 * mounts `SmartEqEngine` alone and never touches this toolbar.
 */

jest.mock('renderer/audio/nowPlayingIdentity');

const mockUseNowPlayingIdentity = useNowPlayingIdentity as jest.Mock;

/** Stands in for the live `smartEq` a real FluidEqProvider would hold, the
 * same way `SmartEqRun.test.tsx`'s `mockLive` does. */
const mockLive: { smartEq: ISmartEqSettings | undefined } = {
  smartEq: undefined,
};
const mockSetSmartEq = jest.fn((next?: ISmartEqSettings) => {
  mockLive.smartEq = next;
});

jest.mock('renderer/utils/FluidEqContext', () => ({
  ...jest.requireActual('renderer/utils/FluidEqContext'),
  useFluidEqContext: () => ({
    filters: {},
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
    bypassed: [],
    getBandSetGeneration: () => 0,
    activeDeviceId: 'device-a',
    smartEq: mockLive.smartEq,
    setSmartEq: mockSetSmartEq,
  }),
}));

jest.mock('renderer/audio/LiveAudioContext', () => ({
  useLiveAudioControl: () => ({
    captureBalanceProfile: jest.fn(() => new Promise(() => {})),
    isActive: true,
  }),
}));

jest.mock('renderer/utils/equalizerApi', () => ({
  addEqualizerSlider: jest.fn(),
  clearGains: jest.fn(),
  removeEqualizerSlider: jest.fn(),
  setFilterValues: jest.fn(),
  setFixedBand: jest.fn(),
  lookupSongEq: jest.fn(() => Promise.resolve(undefined)),
  checkpointSongEq: jest.fn(() => Promise.resolve(undefined)),
  commitSongEq: jest.fn(() => Promise.resolve(undefined)),
  forgetSongEq: jest.fn(() => Promise.resolve(undefined)),
  setSmartEq: jest.fn(() => Promise.resolve(undefined)),
}));

jest.mock('renderer/components/VoicingQuickPick', () => () => null);
jest.mock('renderer/components/ActiveLayers', () => () => null);
jest.mock('renderer/components/FrequencyBand', () => () => null);
jest.mock('renderer/utils/bandReveal', () => ({
  planBandReveal: () => undefined,
  revealBands: jest.fn(),
}));

/** A correction to record, so `willSongEqSave` has something besides the
 * floor and the switch to be true about. */
const layerOf = (gain: number): ISmartEqSettings => ({
  filters: {
    'smart-1000': {
      id: 'smart-1000',
      frequency: 1000,
      gain,
      quality: 1.4,
      type: FilterTypeEnum.PK,
    },
  },
});

/** The host lives above the tabs in the real app (see `App.tsx`); mounted
 * beside `MainContent` here for the same reason `SmartEqRun.test.tsx` mounts
 * `SmartEqEngine` beside it — the panel under test does not run its own
 * session, so nothing updates without this. */
const Harness = () => {
  useSongEqSessionHost();
  return <MainContent />;
};

describe('the save-for-this-song tick', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(0);
    try {
      window.localStorage.removeItem('fluideq.songEq.save');
    } catch {
      // Nothing was stored; nothing to clear.
    }
    resetSongEqSession();
    setSmartEqMode('smart');
    mockLive.smartEq = undefined;
    mockSetSmartEq.mockClear();
    mockUseNowPlayingIdentity.mockReturnValue({
      identity: undefined,
      isPlaying: false,
    });
  });

  afterEach(() => {
    // `MainContent` is still mounted here — testing-library's own auto-cleanup
    // afterEach runs after this one — so reverting the mode change the first
    // test's toggle makes needs the same `act()` wrapping a real click gets.
    act(() => {
      setSmartEqMode('smart');
    });
    jest.useRealTimers();
  });

  /**
   * Fails if the switch is wired to a different store than the one
   * `SongEqSaveSwitch` reads, or if `handleToggle` is dropped rather than
   * calling `setSongEqSaveOn`: either leaves the checkbox unchecked after the
   * click, since nothing would then flip `state.isSaveOn`.
   */
  it('is off by default and turns on when pressed', () => {
    render(<MainContent />);
    const tick = screen.getByRole('checkbox', {
      name: translate('en', 'songEq.saveAria'),
    });
    expect(tick).not.toBeChecked();
    fireEvent.click(tick);
    expect(tick).toBeChecked();
  });

  /**
   * Fails if the branch order in `SongEqSaveSwitch` is wrong — e.g. checking
   * `willSave` before `title === undefined` — since with no session open
   * `willSave` is always `false` (see `computeRecording`), and a swapped or
   * missing waiting-state check would leave this text absent.
   */
  it('says what it is waiting for when nothing is playing', () => {
    render(<MainContent />);
    expect(screen.getByText(translate('en', 'songEq.waiting'))).toBeVisible();
  });

  /**
   * Fails if `remaining` is computed as `listenedMs` instead of
   * `SONG_EQ_MIN_LISTENED_MS - listenedMs` (the countdown would count up, or
   * this exact figure would be wrong), or if the branch falls through to
   * `songEq.waiting` because `title` was never populated onto the status.
   */
  it('counts down while recording, under the two-minute floor', async () => {
    const song = buildSongIdentity(
      'library',
      'tick-listening-song',
      'Tick Listening Song',
      'Artist',
    );
    if (!song) {
      throw new Error('test fixture produced no identity');
    }
    mockUseNowPlayingIdentity.mockReturnValue({
      identity: song,
      isPlaying: true,
    });

    render(<Harness />);

    // Past the settle window and well under the two-minute floor. Landing on
    // a whole second keeps the last `tick` dispatch's clock exactly here,
    // since the interval fires every 1000ms from the moment the session
    // opened (t=0).
    const elapsedMs = SONG_EQ_SETTLE_MS + 100_000;
    await act(async () => {
      jest.advanceTimersByTime(elapsedMs);
      await Promise.resolve();
      await Promise.resolve();
    });

    const expectedRemaining = formatDuration(
      SONG_EQ_MIN_LISTENED_MS - elapsedMs,
    );
    expect(
      screen.getByText(
        translate('en', 'songEq.listening', { remaining: expectedRemaining }),
      ),
    ).toBeVisible();
  });

  /**
   * Fails if `willSave` is re-derived here instead of read off
   * `useSongEqRecording()` — the exact mistake the brief warns against — or
   * if the branch order shows `songEq.listening` even once `willSave` is
   * `true`.
   */
  it('says the song will save once willSave is true', async () => {
    setSongEqSaveOn(true);
    const song = buildSongIdentity(
      'library',
      'tick-willsave-song',
      'Tick Will Save Song',
      'Artist',
    );
    if (!song) {
      throw new Error('test fixture produced no identity');
    }
    // A live layer past the floor is required — `willSongEqSave` reports
    // `false` regardless of elapsed time with none (see `songEqTiming.ts`).
    mockLive.smartEq = layerOf(2);
    mockUseNowPlayingIdentity.mockReturnValue({
      identity: song,
      isPlaying: true,
    });

    render(<Harness />);

    await act(async () => {
      jest.advanceTimersByTime(
        SONG_EQ_SETTLE_MS + SONG_EQ_MIN_LISTENED_MS + 2000,
      );
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(
      screen.getByText(
        translate('en', 'songEq.willSave', { title: song.title }),
      ),
    ).toBeVisible();
  });
});

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
import {
  getSmartEqMode,
  isContinuousMode,
  setSmartEqMode,
} from 'renderer/utils/smartEqMode';

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
  // This factory replaces the whole module, so an export it does not list is
  // `undefined` — and the engine calls this one on every render.
  useLiveAudioCapture: () => undefined,
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

/**
 * Switch an automatic mode on, the way the toolbar's own menu does — picking
 * one starts it, see `setSmartEqMode`.
 *
 * The tick is not rendered without one, and the reducer will not turn saving
 * on without one either, so almost every test here begins with this. `'smart'`
 * is the one-shot measurement, which is how these tests say "no automatic mode
 * running".
 */
const startAutoEq = () => setSmartEqMode('detail');

/** The tick itself, or `null` where the toolbar is not offering one. */
const findTick = () =>
  screen.queryByRole('checkbox', {
    name: translate('en', 'songEq.saveAria'),
  });

/** The tick, insisting it is there — for the tests that are about what it
 * says rather than about whether it is offered. */
const getTick = () =>
  screen.getByRole('checkbox', {
    name: translate('en', 'songEq.saveAria'),
  });

describe('the save-for-this-song tick', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(0);
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
    startAutoEq();
    render(<Harness />);
    const tick = getTick();
    expect(tick).not.toBeChecked();
    fireEvent.click(tick);
    expect(tick).toBeChecked();
  });

  /**
   * The null test and its positive control in one, because a toolbar that
   * simply never draws the tick would pass either half alone.
   *
   * This is the reported defect. The tick used to be rendered
   * unconditionally, so it could be ticked on over a stopped loop — and
   * nothing but a running automatic mode ever writes the Smart EQ layer a
   * save is made of, which is why it then counted out its two minutes and
   * committed nothing.
   */
  it('is offered only while an automatic mode is measuring', () => {
    render(<Harness />);
    // The precondition, asserted rather than assumed.
    expect(isContinuousMode(getSmartEqMode())).toBe(false);
    expect(findTick()).toBeNull();

    act(() => {
      startAutoEq();
    });
    expect(findTick()).toBeInTheDocument();

    act(() => {
      setSmartEqMode('smart');
    });
    expect(findTick()).toBeNull();
  });

  /**
   * Request in its own words: "when turning any auto eq on the auto save
   * starts off". A mode that has just started has measured nothing yet, so a
   * tick found already on would file whatever curve was left in the chain
   * under the first song that plays.
   *
   * Fails if saving is persisted again, or if the host stops reporting the
   * mode going off and on.
   */
  it('starts off again each time an automatic mode is switched on', () => {
    startAutoEq();
    render(<Harness />);
    fireEvent.click(getTick());
    expect(getTick()).toBeChecked();

    act(() => {
      setSmartEqMode('smart');
    });
    act(() => {
      startAutoEq();
    });

    expect(getTick()).not.toBeChecked();
  });

  /**
   * Unticking must NOT stop the engine — "stopping the engine because
   * somebody stopped saving would be taking away something they did not ask
   * to lose" (§10.1). Fails if the coupling is made symmetric.
   */
  it('leaves the mode running when the tick is turned back off', () => {
    startAutoEq();
    render(<Harness />);
    const tick = getTick();
    fireEvent.click(tick);
    fireEvent.click(tick);
    expect(getSmartEqMode()).toBe('detail');
    expect(tick).toBeInTheDocument();
  });

  /**
   * Fails if the branch order in `SongEqSaveSwitch` is wrong — e.g. checking
   * `willSave` before `title === undefined` — since with no session open
   * `willSave` is always `false` (see `computeRecording`), and a swapped or
   * missing waiting-state check would leave this text absent.
   */
  it('says what it is waiting for when nothing is playing', () => {
    startAutoEq();
    render(<Harness />);
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

    startAutoEq();
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

    startAutoEq();
    render(<Harness />);
    // After the mount, not before: the reducer only accepts saving once the
    // host has reported an automatic mode running.
    act(() => {
      setSongEqSaveOn(true);
    });

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

  /**
   * The chip's progress bar, which is the only part of the two-minute wait
   * that can be seen without reading a number.
   *
   * Queried by class rather than by role on purpose: the bar is `aria-hidden`
   * because the countdown beside it is already a live region saying the same
   * thing in words, so there is no role to find it by — see the component's
   * own comment on that.
   *
   * Fails if the fraction is inverted (a bar that empties as the song plays),
   * if it is left at zero because `listenedMs` was never read, or if it is
   * written as a fraction of something other than the floor.
   */
  it('fills the progress bar in step with the countdown', async () => {
    const song = buildSongIdentity(
      'library',
      'tick-progress-song',
      'Tick Progress Song',
      'Artist',
    );
    if (!song) {
      throw new Error('test fixture produced no identity');
    }
    mockUseNowPlayingIdentity.mockReturnValue({
      identity: song,
      isPlaying: true,
    });

    startAutoEq();
    const { container } = render(<Harness />);

    const fill = container.querySelector('.song-eq-save__fill');
    if (!(fill instanceof HTMLElement)) {
      throw new Error('the chip rendered no progress fill');
    }
    // The positive control the null test needs: empty before any of the floor
    // has passed, so a bar that is simply always full cannot pass this.
    expect(fill.style.width).toBe('0%');

    // Half the floor exactly, and the settle window is deliberately NOT added
    // on top: `listenedMs` runs from the moment the session opens, settle
    // included — the countdown test above leans on the same fact — so adding
    // it would put the bar at 51.7% and make the expected figure a restatement
    // of the component's own arithmetic rather than a round number to check it
    // against. Half the floor is still far past settle.
    await act(async () => {
      jest.advanceTimersByTime(SONG_EQ_MIN_LISTENED_MS / 2);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(fill.style.width).toBe('50%');
  });

  /**
   * Fails if the label stops pointing at the checkbox — the chip is about two
   * hundred pixels wide and only the thirty the switch occupies used to do
   * anything, so the words it is named by were dead to the pointer.
   */
  it('toggles when the words beside the switch are clicked', () => {
    startAutoEq();
    render(<Harness />);
    const tick = getTick();
    expect(tick).not.toBeChecked();

    fireEvent.click(screen.getByText(translate('en', 'songEq.save')));

    expect(tick).toBeChecked();
  });
});

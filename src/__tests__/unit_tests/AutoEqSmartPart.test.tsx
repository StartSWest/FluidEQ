/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
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
  getSongEqSaveOn,
  resetSongEqSession,
  useSongEqClock,
  useSongEqSessionHost,
} from 'renderer/audio/songEqSession';
import { resetTransportSource } from 'renderer/audio/transportSource';
import playFor from '__tests__/utils/playerReports';
import AutoEqSmartPart from 'renderer/eq/autoEq/AutoEqSmartPart';
import useAutoEqButton from 'renderer/eq/autoEq/useAutoEqButton';
import { formatDuration } from 'renderer/library/player/NowPlayingBar';
import { setContinuousEq } from 'renderer/utils/continuousEq';
import {
  getSmartEqMode,
  isContinuousMode,
  setSmartEqMode,
} from 'renderer/utils/smartEqMode';

/**
 * Smart correction, inside Auto EQ's panel: Smart EQ's continuous modes, which
 * keep each song's correction whenever they run. It replaced the toolbar's
 * "Save for this song" tick (Auto EQ, 2026-11-20): saving follows the
 * measurement, and the panel says how far the playing song has to go.
 */

jest.mock('renderer/audio/nowPlayingIdentity');

const mockUseNowPlayingIdentity = useNowPlayingIdentity as jest.Mock;

/** Stands in for the live `smartEq` a real FluidEqProvider would hold. */
const mockLive: { smartEq: ISmartEqSettings | undefined } = {
  smartEq: undefined,
};

jest.mock('renderer/utils/FluidEqContext', () => ({
  ...jest.requireActual('renderer/utils/FluidEqContext'),
  ...jest.requireActual('__tests__/utils/fluidEqHookMocks').eqHooksFrom(() => ({
    filters: {},
    isLoading: false,
    isBlockingError: false,
    bypassed: [],
    activeDeviceId: 'device-a',
    smartEq: mockLive.smartEq,
    setSmartEq: jest.fn(),
  })),
}));

jest.mock('renderer/utils/equalizerApi', () => ({
  lookupSongEq: jest.fn(() => Promise.resolve(undefined)),
  checkpointSongEq: jest.fn(() => Promise.resolve(undefined)),
  commitSongEq: jest.fn(() => Promise.resolve(undefined)),
  forgetSongEq: jest.fn(() => Promise.resolve(undefined)),
  setSmartEq: jest.fn(() => Promise.resolve(undefined)),
}));

/** A correction to record, so the session has something to save. */
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

/** The part as the panel draws it, with the button's own state. */
const SmartPart = () => {
  const button = useAutoEqButton();
  return <AutoEqSmartPart button={button} />;
};

/** The host's clock, as it rides beside the host in the window. */
const SongEqClock = () => {
  useSongEqClock();
  return null;
};

/** The song memory's host lives above the tabs in the real app (`App.tsx`). */
const Harness = () => {
  useSongEqSessionHost();
  return (
    <>
      <SongEqClock />
      <SmartPart />
    </>
  );
};

const smartSwitch = () =>
  screen.getByRole('checkbox', {
    name: translate('en', 'autoEq.smart.title'),
  });

const songNamed = (id: string) => {
  const song = buildSongIdentity('library', id, `Song ${id}`, 'Artist');
  if (!song) {
    throw new Error('test fixture produced no identity');
  }
  return song;
};

describe('Smart correction in Auto EQ', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(0);
    resetSongEqSession();
    resetTransportSource();
    setSmartEqMode('smart');
    setContinuousEq(false);
    mockLive.smartEq = undefined;
    mockUseNowPlayingIdentity.mockReturnValue({
      identity: undefined,
      isPlaying: false,
    });
  });

  afterEach(() => {
    act(() => {
      setSmartEqMode('smart');
      setContinuousEq(false);
    });
    jest.useRealTimers();
  });

  it('starts a continuous mode when switched on, and saves each song from the start', () => {
    render(<Harness />);
    // The precondition, asserted rather than assumed: the one-shot
    // measurement is what "nothing running" looks like.
    expect(isContinuousMode(getSmartEqMode())).toBe(false);
    expect(smartSwitch()).not.toBeChecked();

    fireEvent.click(smartSwitch());

    expect(isContinuousMode(getSmartEqMode())).toBe(true);
    expect(smartSwitch()).toBeChecked();
    // No tick to find and press: saving is on with the measurement.
    expect(getSongEqSaveOn()).toBe(true);
  });

  it('stops measuring and saving when switched off', () => {
    setSmartEqMode('detail');
    render(<Harness />);
    expect(getSongEqSaveOn()).toBe(true);

    fireEvent.click(smartSwitch());

    expect(smartSwitch()).not.toBeChecked();
    expect(getSongEqSaveOn()).toBe(false);
    expect(
      screen.queryByText(translate('en', 'autoEq.smart.waiting')),
    ).toBeNull();
  });

  it('says what it is waiting for when nothing is playing', () => {
    setSmartEqMode('detail');
    render(<Harness />);
    expect(
      screen.getByText(translate('en', 'autoEq.smart.waiting')),
    ).toBeVisible();
    // Nothing playing, nothing to count down.
    expect(screen.queryByText(/^Saved for this song/u)).toBeNull();
  });

  it('counts down to the song’s save, under the two-minute floor', async () => {
    mockUseNowPlayingIdentity.mockReturnValue({
      identity: songNamed('counting'),
      isPlaying: true,
    });
    setSmartEqMode('detail');
    render(<Harness />);

    // Past the settle window and well under the two-minute floor, on a whole
    // second: the player reports every second from the session's start.
    const elapsedMs = SONG_EQ_SETTLE_MS + 100_000;
    await playFor(elapsedMs);

    expect(
      screen.getByText(
        translate('en', 'autoEq.smart.savesIn', {
          remaining: formatDuration(SONG_EQ_MIN_LISTENED_MS - elapsedMs),
        }),
      ),
    ).toBeVisible();
  });

  it('says the song will be saved once it is past the floor with a correction to keep', async () => {
    mockLive.smartEq = layerOf(2);
    mockUseNowPlayingIdentity.mockReturnValue({
      identity: songNamed('saving'),
      isPlaying: true,
    });
    setSmartEqMode('detail');
    render(<Harness />);

    await playFor(SONG_EQ_SETTLE_MS + SONG_EQ_MIN_LISTENED_MS + 2000);

    expect(
      screen.getByText(translate('en', 'autoEq.smart.willSave')),
    ).toBeVisible();
  });

  it('fills its bar in step with the countdown', async () => {
    mockUseNowPlayingIdentity.mockReturnValue({
      identity: songNamed('progress'),
      isPlaying: true,
    });
    setSmartEqMode('detail');
    const { container } = render(<Harness />);
    // A second in, past nothing of the floor's worth to speak of: the bar is
    // drawn once a session is open.
    await playFor(1000);
    const fill = container.querySelector('.eq-auto-smart__fill');
    if (!(fill instanceof HTMLElement)) {
      throw new Error('the part drew no progress fill');
    }
    // The control: nearly empty, so a bar that is always full cannot pass.
    expect(parseFloat(fill.style.width)).toBeLessThan(1);

    // Half the floor in all: `listenedMs` runs from the session's opening.
    await playFor(SONG_EQ_MIN_LISTENED_MS / 2 - 1000);

    expect(fill.style.width).toBe('50%');
  });
});

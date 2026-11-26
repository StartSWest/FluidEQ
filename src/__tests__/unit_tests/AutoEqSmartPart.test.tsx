/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import '@testing-library/jest-dom';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { FilterTypeEnum, ISmartEqSettings } from 'common/constants';
import { translate } from 'common/i18n';
import { SONG_EQ_SETTLE_MS } from 'common/songEqRecorder';
import { buildSongIdentity } from 'common/songIdentity';
import { useNowPlayingIdentity } from 'renderer/audio/nowPlayingIdentity';
import {
  getSongEqSaveOn,
  noteSmartEqHeld,
  resetSongEqSession,
  useSongEqClock,
  useSongEqSessionHost,
} from 'renderer/audio/songEqSession';
import { resetTransportSource } from 'renderer/audio/transportSource';
import { setSongSoundParts } from 'renderer/audio/songSoundSession';
import playFor from '__tests__/utils/playerReports';
import AutoEqSmartPart from 'renderer/eq/autoEq/AutoEqSmartPart';
import useAutoEqButton from 'renderer/eq/autoEq/useAutoEqButton';
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
 * measurement, while Song sounds is on, and the song is saved the moment its
 * correction is done (2026-11-26) — the panel says so then, and counts
 * nothing down.
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
    setSongSoundParts({ songs: true, albums: false });
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
      setSongSoundParts({ songs: false, albums: false });
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

  it('says nothing about saving before the song’s correction is done', async () => {
    mockUseNowPlayingIdentity.mockReturnValue({
      identity: songNamed('counting'),
      isPlaying: true,
    });
    setSmartEqMode('detail');
    render(<Harness />);
    await playFor(SONG_EQ_SETTLE_MS + 100_000);
    // No countdown to a save (Ivan, 2026-11-26: "remove the concept of
    // saved for this song in x secs").
    expect(
      screen.queryByText(translate('en', 'autoEq.songs.saved')),
    ).toBeNull();
  });

  it('says the song is saved the moment its correction is done', async () => {
    mockUseNowPlayingIdentity.mockReturnValue({
      identity: songNamed('saving'),
      isPlaying: true,
    });
    setSmartEqMode('detail');
    render(<Harness />);
    await playFor(SONG_EQ_SETTLE_MS + 1000);
    act(() => {
      noteSmartEqHeld(layerOf(2));
    });
    expect(
      screen.getByText(translate('en', 'autoEq.songs.saved')),
    ).toBeVisible();
  });

  it('saves nothing into the song while Song sounds is off', async () => {
    setSongSoundParts({ songs: false, albums: false });
    mockUseNowPlayingIdentity.mockReturnValue({
      identity: songNamed('off'),
      isPlaying: true,
    });
    setSmartEqMode('detail');
    render(<Harness />);
    await playFor(SONG_EQ_SETTLE_MS + 1000);
    act(() => {
      noteSmartEqHeld(layerOf(2));
    });
    expect(getSongEqSaveOn()).toBe(false);
    expect(
      screen.queryByText(translate('en', 'autoEq.songs.saved')),
    ).toBeNull();
  });
});

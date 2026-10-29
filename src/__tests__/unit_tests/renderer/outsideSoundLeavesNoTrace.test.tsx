/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Sound that played outside the listener's own files leaves with its player
 * (Ivan, 2026-10-26: "when nothing is playing it keeps last system audio thing
 * on context ... user maybe watching porn or whatever and closed it and get
 * busted"). A browser tab closed, and its title stood on the bar until
 * something else played — and came back with the window at the next launch.
 *
 * Here, end to end: the bar at the foot of the window once the tab has
 * closed, and the line a linked computer draws for this one once its sound
 * has stopped. What storage holds and what a launch reads are in
 * `transportSource.test.ts`.
 */

import '@testing-library/jest-dom';
import { act, render, renderHook, screen } from '@testing-library/react';
import type { IRemoteNowPlaying } from '../../../common/remoteAudio';
import { useLastShown } from '../../../renderer/audio/lastShown';
import {
  claimPlayback,
  releasePlayback,
  resetPlaybackOwner,
} from '../../../renderer/audio/playbackOwner';
import {
  clearTransportSource,
  resetTransportSource,
  setTransportSource,
  useTransportSources,
} from '../../../renderer/audio/transportSource';
import type { ITransportSource } from '../../../renderer/audio/transportSource';
import useRemoteNowPlayingBroadcast from '../../../renderer/remoteAudio/useRemoteNowPlayingBroadcast';
import useRemoteNowPlayingSource from '../../../renderer/remoteAudio/useRemoteNowPlayingSource';
import type { IRemoteAudioComputer } from '../../../renderer/remoteAudio/remoteAudioState';
import { IdleTransportBarSlot } from '../../../renderer/shell/TransportBars';
import { I18nProvider } from '../../../renderer/utils/I18nContext';

const PRIVATE = 'A private title';

/** A browser tab, as Windows describes it to the bar. */
const browserTab = (isPlaying: boolean): ITransportSource => ({
  owner: 'system',
  title: PRIVATE,
  subtitle: 'A private channel',
  isPlaying,
  positionMs: 0,
  durationMs: 60000,
  toggle: () => {},
});

const librarySong: ITransportSource = {
  owner: 'library',
  title: 'Blue in Green',
  subtitle: 'Miles Davis',
  isPlaying: false,
  positionMs: 0,
  durationMs: 60000,
  toggle: () => {},
};

const original = window.electron;
const sendRemoteAudioLanSignal = jest.fn().mockResolvedValue(undefined);

beforeEach(() => {
  resetPlaybackOwner();
  resetTransportSource();
  sendRemoteAudioLanSignal.mockClear();
  window.electron = {
    ipcRenderer: {
      sendRemoteAudioLanSignal,
      pauseOtherSystemPlayers: jest.fn().mockResolvedValue(undefined),
    },
  } as unknown as typeof original;
});

afterEach(() => {
  act(() => {
    resetPlaybackOwner();
    resetTransportSource();
  });
  window.electron = original;
});

const renderIdleBar = () =>
  render(
    <I18nProvider>
      <IdleTransportBarSlot
        activeTab="eq"
        isFullScreen={false}
        onGoToTab={() => {}}
      />
    </I18nProvider>,
  );

describe('the bar once a browser tab has closed', () => {
  it('says nothing is playing, and nothing of the tab', () => {
    renderIdleBar();
    act(() => setTransportSource(browserTab(true)));
    act(() => setTransportSource(browserTab(false)));

    // Windows takes the session away with the tab.
    act(() => clearTransportSource('system'));

    expect(screen.getByText('Nothing playing')).toBeVisible();
    expect(document.body.textContent).not.toContain(PRIVATE);
    expect(document.body.textContent).not.toContain('A private channel');
  });

  it('goes back to the listener’s own song, not to the tab', () => {
    renderIdleBar();
    // The control for the case above: what the idle bar does keep.
    act(() => {
      claimPlayback('library');
      setTransportSource({ ...librarySong, isPlaying: true });
    });
    act(() => {
      releasePlayback('library');
      clearTransportSource('library');
    });
    act(() => setTransportSource(browserTab(true)));
    act(() => clearTransportSource('system'));

    expect(screen.getByText('Blue in Green')).toBeVisible();
    expect(document.body.textContent).not.toContain(PRIVATE);
  });
});

describe('the line a linked computer draws for this one', () => {
  /** The last description this computer sent to `peer-1`. */
  const lastSent = (): IRemoteNowPlaying | undefined => {
    const { calls } = sendRemoteAudioLanSignal.mock;
    const message = calls[calls.length - 1]?.[0] as
      { signal: { kind: string; playing?: IRemoteNowPlaying } } | undefined;
    expect(message?.signal.kind).toBe('now-playing');
    return message?.signal.playing;
  };

  it('is told there is nothing playing here once the tab has closed', () => {
    renderHook(() => useRemoteNowPlayingBroadcast(['peer-1']));
    act(() => setTransportSource(browserTab(true)));
    // The control: while the tab plays, the other computer hears its title.
    expect(lastSent()?.title).toBe(PRIVATE);

    act(() => clearTransportSource('system'));

    expect(lastSent()).toBeUndefined();
  });

  it('clears its bar there, and keeps nothing of the song', () => {
    const playing: IRemoteNowPlaying = {
      title: PRIVATE,
      isPlaying: true,
      positionMs: 0,
      durationMs: 60000,
      canNext: false,
      canPrevious: false,
      canStep: false,
      canStop: false,
    };
    const computer = (
      nowPlaying: IRemoteNowPlaying | undefined,
    ): IRemoteAudioComputer[] => [{ id: 'peer-1', name: 'Den PC', nowPlaying }];
    const { result, rerender } = renderHook(
      ({ computers }: { computers: IRemoteAudioComputer[] }) => {
        useRemoteNowPlayingSource(computers, [], {});
        return { sources: useTransportSources(), shown: useLastShown() };
      },
      { initialProps: { computers: computer(playing) } },
    );
    expect(result.current.sources.remote?.title).toBe(PRIVATE);

    // The sending computer's tab closed: it says its bar is empty.
    rerender({ computers: computer(undefined) });

    expect(result.current.sources.remote).toBeUndefined();
    expect(result.current.shown).toBeUndefined();
  });
});

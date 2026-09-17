/* FluidEQ — GPL-3.0-or-later */

/**
 * The pause that came back as a press.
 *
 * Share Audio's one-player rule crosses the wire: what a sending computer's
 * user starts wins, and what this computer's user starts pauses the senders.
 * It went round in a circle. The listener worked out "somebody pressed play
 * over there" by diffing the descriptions each sender sends, and the pause it
 * sent made the next description say playing again — the sender's bar falls
 * through to whatever else was already going on that machine — so the rule
 * fired again and stopped the music the listener's own user had just started.
 *
 * Both halves are held here: the sender only ever calls a player going from
 * paused to playing a press, and the listener only ever acts on being told
 * one — never on a description, and never against the computer that sent it.
 */

import { act, renderHook } from '@testing-library/react';
import type {
  IRemoteAudioComputer,
  TRemoteAudioPhase,
} from 'renderer/remoteAudio/remoteAudioState';
import {
  claimPlayback,
  registerPlayer,
  releasePlayback,
  resetPlaybackOwner,
} from 'renderer/audio/playbackOwner';
import {
  resetTransportSource,
  setTransportSource,
} from 'renderer/audio/transportSource';
import type { ITransportSource } from 'renderer/audio/transportSource';
import useRemoteNowPlayingBroadcast from 'renderer/remoteAudio/useRemoteNowPlayingBroadcast';
import useRemoteNowPlayingSource from 'renderer/remoteAudio/useRemoteNowPlayingSource';

const source = (
  owner: ITransportSource['owner'],
  title: string,
  isPlaying: boolean,
): ITransportSource => ({
  owner,
  title,
  isPlaying,
  positionMs: 0,
  durationMs: 0,
  toggle: () => undefined,
});

const computer = (id: string, isPlaying: boolean): IRemoteAudioComputer => ({
  id,
  name: id.toUpperCase(),
  nowPlaying: {
    title: 'Song',
    isPlaying,
    positionMs: 0,
    durationMs: 0,
    canNext: false,
    canPrevious: false,
    canStep: false,
    canStop: false,
  },
});

describe('a sending computer announcing a press', () => {
  const sendRemoteAudioLanSignal = jest.fn();

  const lastMessage = () => {
    const { calls } = sendRemoteAudioLanSignal.mock;
    return calls[calls.length - 1]?.[0]?.signal;
  };

  beforeEach(() => {
    sendRemoteAudioLanSignal.mockReset().mockResolvedValue(undefined);
    resetTransportSource();
    resetPlaybackOwner();
    Object.assign(window, {
      electron: {
        ipcRenderer: {
          sendRemoteAudioLanSignal,
          sendSystemMediaCommand: jest.fn(),
        },
      },
    });
  });

  const renderSender = () =>
    renderHook(() =>
      useRemoteNowPlayingBroadcast('sender', 'connected', {
        current: 'listener-peer',
      }),
    );

  it('says so when its own player goes from paused to playing', () => {
    renderSender();
    act(() => setTransportSource(source('library', 'Album', false)));
    expect(lastMessage()?.started).toBeUndefined();
    act(() => {
      setTransportSource(source('library', 'Album', true));
      claimPlayback('library');
    });
    expect(lastMessage()).toMatchObject({
      started: true,
      playing: { title: 'Album', isPlaying: true },
    });
  });

  it('never says so because the listener paused it', () => {
    // THE LOOP. A browser tab is already playing on the sending machine when
    // its library takes over the bar. The listener's user presses play on
    // their own machine, which pauses the library here — and the bar falls
    // back to the tab, which is playing. Called a press, that reply stopped
    // the listener's music and paused this machine again.
    renderSender();
    act(() => setTransportSource(source('system', 'Tab', true)));
    act(() => setTransportSource(source('library', 'Album', false)));
    act(() => {
      setTransportSource(source('library', 'Album', true));
      claimPlayback('library');
    });
    expect(lastMessage()?.started).toBe(true);

    sendRemoteAudioLanSignal.mockClear();
    act(() => {
      setTransportSource(source('library', 'Album', false));
      releasePlayback('library');
    });
    expect(lastMessage()).toMatchObject({ playing: { title: 'Tab' } });
    expect(lastMessage()?.started).toBeUndefined();
  });

  it('never says so for a description it is only repeating', () => {
    // A reconnection re-announces the song that has been playing all along,
    // under a peer id the listener has never seen. That used to read as a
    // press and silence whatever the listener was playing.
    const { rerender } = renderHook(
      ({ phase }: { phase: TRemoteAudioPhase }) =>
        useRemoteNowPlayingBroadcast('sender', phase, {
          current: 'listener-peer',
        }),
      { initialProps: { phase: 'connecting' as TRemoteAudioPhase } },
    );
    act(() => setTransportSource(source('library', 'Album', false)));
    act(() => setTransportSource(source('library', 'Album', true)));
    sendRemoteAudioLanSignal.mockClear();
    rerender({ phase: 'connected' });
    expect(lastMessage()).toMatchObject({ playing: { isPlaying: true } });
    expect(lastMessage()?.started).toBeUndefined();
  });
});

describe('a listening computer told of a press', () => {
  const sendRemoteAudioLanSignal = jest.fn();
  const sendSystemMediaCommand = jest.fn();

  const pausedPeers = () =>
    sendRemoteAudioLanSignal.mock.calls
      .filter((call) => call[0]?.signal?.command === 'pause')
      .map((call) => call[0].peerId);

  beforeEach(() => {
    sendRemoteAudioLanSignal.mockReset().mockResolvedValue(undefined);
    sendSystemMediaCommand.mockReset().mockResolvedValue(undefined);
    resetTransportSource();
    resetPlaybackOwner();
    Object.assign(window, {
      electron: {
        ipcRenderer: { sendRemoteAudioLanSignal, sendSystemMediaCommand },
      },
    });
  });

  const renderListener = (computers: IRemoteAudioComputer[]) =>
    renderHook(
      ({ list }: { list: IRemoteAudioComputer[] }) =>
        useRemoteNowPlayingSource('listener', list),
      { initialProps: { list: computers } },
    );

  it('stops what this machine plays, and never the computer that pressed', () => {
    const stopLibrary = jest.fn();
    const { result } = renderListener([
      computer('a', true),
      computer('b', true),
    ]);
    act(() => {
      registerPlayer('library', stopLibrary);
    });
    act(() => result.current('a'));
    expect(stopLibrary).toHaveBeenCalledTimes(1);
    // Never back to the one that just pressed play: its own pause would
    // arrive as the answer to its press.
    expect(pausedPeers()).toEqual(['b']);
  });

  it('does nothing for a sender that merely appears to be playing', () => {
    // No press message, no press: a peer that reconnects mid-song, or a
    // machine whose Windows session list flapped, arrives exactly like this.
    const stopLibrary = jest.fn();
    const { rerender } = renderListener([computer('a', false)]);
    act(() => {
      registerPlayer('library', stopLibrary);
    });
    act(() => rerender({ list: [computer('a', true), computer('b', true)] }));
    expect(stopLibrary).not.toHaveBeenCalled();
    expect(pausedPeers()).toEqual([]);
  });

  it('pauses every playing sender when this machine takes the sound', () => {
    // The other direction, unchanged: the register's own entry is how a
    // library track started here reaches the wire at all.
    const { rerender } = renderListener([computer('a', true)]);
    act(() => rerender({ list: [computer('a', true), computer('b', true)] }));
    act(() => claimPlayback('library'));
    expect(pausedPeers()).toEqual(['a', 'b']);
  });
});

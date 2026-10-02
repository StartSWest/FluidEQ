/* FluidEQ — GPL-3.0-or-later */

/**
 * "One player at a time" across linked computers: turned off on one, it is
 * off on the other (Ivan, 2026-10-02).
 *
 * What travels is the change, never where the switch stands: two computers
 * that disagreed when they linked would otherwise each set the other's and
 * swap for ever. A change from one link goes on to the others and never back.
 */

import { act, renderHook } from '@testing-library/react';
import { isRemoteAudioSignal } from 'common/remoteAudio';
import { resetPlaybackOwner } from 'renderer/audio/playbackOwner';
import { resetTransportSource } from 'renderer/audio/transportSource';
import useRemoteNowPlayingBroadcast from 'renderer/remoteAudio/useRemoteNowPlayingBroadcast';
import {
  isSinglePlayerEnabled,
  setSinglePlayer,
  setSinglePlayerFromLink,
} from 'renderer/utils/singlePlayer';

const sendRemoteAudioLanSignal = jest.fn();

/** The switch as each linked computer was told it. */
const told = () =>
  sendRemoteAudioLanSignal.mock.calls
    .map(([message]) => message)
    .filter((message) => message.signal.singlePlayer !== undefined)
    .map((message) => [message.peerId, message.signal.singlePlayer]);

beforeEach(() => {
  sendRemoteAudioLanSignal.mockReset().mockResolvedValue(undefined);
  resetTransportSource();
  resetPlaybackOwner();
  Object.assign(window, {
    electron: { ipcRenderer: { sendRemoteAudioLanSignal } },
  });
});

afterEach(() => {
  act(() => setSinglePlayer(true));
});

describe('the one-player switch across links', () => {
  it('tells every linked computer when it is changed here', () => {
    renderHook(() => useRemoteNowPlayingBroadcast(['alpha', 'beta']));
    act(() => setSinglePlayer(false));
    expect(told().sort()).toEqual([
      ['alpha', false],
      ['beta', false],
    ]);
  });

  it('takes a change from a link, and passes it on to the others only', () => {
    renderHook(() => useRemoteNowPlayingBroadcast(['alpha', 'beta']));
    act(() => setSinglePlayerFromLink(false, 'alpha'));
    expect(isSinglePlayerEnabled()).toBe(false);
    expect(told()).toEqual([['beta', false]]);
  });

  it('sends nothing when the switch did not move', () => {
    // Which is also what ends a change going round a ring of links.
    renderHook(() => useRemoteNowPlayingBroadcast(['alpha']));
    act(() => setSinglePlayerFromLink(true, 'alpha'));
    act(() => setSinglePlayer(true));
    expect(told()).toEqual([]);
  });

  it('never says where the switch stands in an ordinary description', () => {
    renderHook(() => useRemoteNowPlayingBroadcast(['alpha']));
    expect(sendRemoteAudioLanSignal).toHaveBeenCalled();
    expect(told()).toEqual([]);
  });

  it('crosses the wire as a yes or a no, and nothing else', () => {
    const message = (singlePlayer: unknown) => ({
      kind: 'now-playing',
      singlePlayer,
    });
    expect(isRemoteAudioSignal(message(false))).toBe(true);
    expect(isRemoteAudioSignal(message(undefined))).toBe(true);
    expect(isRemoteAudioSignal(message('off'))).toBe(false);
  });
});

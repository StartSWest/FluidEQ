/* FluidEQ — GPL-3.0-or-later */

import { act, renderHook } from '@testing-library/react';
import useRemoteAudioStreamMode from '../../../renderer/remoteAudio/useRemoteAudioStreamMode';

describe('remote audio stream mode', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('re-handshakes an active sender when its latency profile changes', () => {
    const reconnect = jest.fn().mockResolvedValue(undefined);
    const roleRef = { current: 'sender' as const };
    const reconnectRef = { current: reconnect };
    const { result } = renderHook(() =>
      useRemoteAudioStreamMode(roleRef, reconnectRef),
    );

    act(() => result.current.setStreamMode('video'));

    expect(result.current.streamMode).toBe('video');
    expect(window.localStorage.getItem('fluideq.remoteAudio.streamMode')).toBe(
      'video',
    );
    expect(reconnect).toHaveBeenCalledWith('video');

    act(() => result.current.setStreamMode('video'));
    expect(reconnect).toHaveBeenCalledTimes(1);

    act(() => result.current.setStreamMode('music'));
    expect(result.current.streamMode).toBe('music');
    expect(result.current.streamModeRef.current).toBe('music');
    expect(window.localStorage.getItem('fluideq.remoteAudio.streamMode')).toBe(
      'music',
    );
    expect(reconnect.mock.calls).toEqual([['video'], ['music']]);
  });

  it('stores an idle or listener preference without starting a connection', () => {
    const reconnect = jest.fn().mockResolvedValue(undefined);
    const roleRef: { current?: 'listener' | 'sender' } = {
      current: 'listener',
    };
    const { result } = renderHook(() =>
      useRemoteAudioStreamMode(roleRef, { current: reconnect }),
    );

    act(() => result.current.setStreamMode('video'));
    roleRef.current = undefined;
    act(() => result.current.setStreamMode('music'));

    expect(reconnect).not.toHaveBeenCalled();
    expect(result.current.streamMode).toBe('music');
  });
});

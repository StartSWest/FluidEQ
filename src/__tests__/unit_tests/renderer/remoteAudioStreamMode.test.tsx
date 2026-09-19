/* FluidEQ — GPL-3.0-or-later */

import { act, renderHook } from '@testing-library/react';
import useRemoteAudioStreamMode from '../../../renderer/remoteAudio/useRemoteAudioStreamMode';

describe('raw shared-audio mode', () => {
  beforeEach(() => window.localStorage.clear());

  it('ignores a saved Music mode and always requests immediate PCM', () => {
    window.localStorage.setItem('fluideq.remoteAudio.streamMode', 'music');
    const reconnect = jest.fn();
    const { result } = renderHook(() =>
      useRemoteAudioStreamMode({ current: 'sender' }, { current: reconnect }),
    );
    expect(result.current.streamMode).toBe('video');
    expect(result.current.streamModeRef.current).toBe('video');
    expect(reconnect).not.toHaveBeenCalled();
  });

  it('does not restart a connection or change processing for a legacy mode command', () => {
    const reconnect = jest.fn();
    const { result } = renderHook(() =>
      useRemoteAudioStreamMode({ current: 'listener' }, { current: reconnect }),
    );
    act(() => result.current.setStreamMode('music'));
    act(() => result.current.setStreamMode('video'));
    expect(result.current.streamMode).toBe('video');
    expect(result.current.streamModeRef.current).toBe('video');
    expect(reconnect).not.toHaveBeenCalled();
    expect(
      window.localStorage.getItem('fluideq.remoteAudio.streamMode'),
    ).toBeNull();
  });
});

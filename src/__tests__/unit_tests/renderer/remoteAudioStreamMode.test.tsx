/* FluidEQ — GPL-3.0-or-later */

import { renderHook } from '@testing-library/react';
import useRemoteAudioStreamMode from '../../../renderer/remoteAudio/useRemoteAudioStreamMode';

describe('raw shared-audio mode', () => {
  beforeEach(() => window.localStorage.clear());

  // The wire still names a mode for older peers, and it is always the one
  // the app plays: immediate, lossless PCM ('video' on the wire).
  it('ignores a saved Music mode and always requests immediate PCM', () => {
    window.localStorage.setItem('fluideq.remoteAudio.streamMode', 'music');
    const { result } = renderHook(() => useRemoteAudioStreamMode());
    expect(result.current.streamModeRef.current).toBe('video');
  });
});

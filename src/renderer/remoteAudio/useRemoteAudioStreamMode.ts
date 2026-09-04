/* FluidEQ — GPL-3.0-or-later */

import { useCallback, useRef, useState } from 'react';
import type { TRemoteAudioStreamMode } from '../../common/remoteAudio';
import type { TRemoteAudioRole } from './remoteAudioState';

const STORAGE_KEY = 'fluideq.remoteAudio.streamMode';

const savedStreamMode = (): TRemoteAudioStreamMode => {
  const saved = window.localStorage.getItem(STORAGE_KEY);
  return saved === 'video' ? 'video' : 'music';
};

const useRemoteAudioStreamMode = (
  roleRef: { current?: TRemoteAudioRole },
  reconnectSenderRef: {
    current?: (mode: TRemoteAudioStreamMode) => Promise<void>;
  },
) => {
  const [streamMode, setStreamModeState] =
    useState<TRemoteAudioStreamMode>(savedStreamMode);
  const streamModeRef = useRef(streamMode);
  const setStreamMode = useCallback(
    (next: TRemoteAudioStreamMode) => {
      if (streamModeRef.current === next) {
        return;
      }
      streamModeRef.current = next;
      setStreamModeState(next);
      window.localStorage.setItem(STORAGE_KEY, next);
      if (roleRef.current === 'sender') {
        reconnectSenderRef.current?.(next).catch(() => undefined);
      }
    },
    [reconnectSenderRef, roleRef],
  );

  return { setStreamMode, streamMode, streamModeRef };
};

export default useRemoteAudioStreamMode;

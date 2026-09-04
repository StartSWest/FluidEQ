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
  senderPeerIdRef: { current?: string },
) => {
  const [streamMode, setStreamModeState] =
    useState<TRemoteAudioStreamMode>(savedStreamMode);
  const streamModeRef = useRef(streamMode);
  const setStreamMode = useCallback(
    (next: TRemoteAudioStreamMode) => {
      streamModeRef.current = next;
      setStreamModeState(next);
      window.localStorage.setItem(STORAGE_KEY, next);
      const peerId = senderPeerIdRef.current;
      if (roleRef.current === 'sender' && peerId) {
        window.electron.ipcRenderer
          .sendRemoteAudioLanSignal({
            peerId,
            signal: { kind: 'stream-mode', mode: next },
          })
          .catch(() => undefined);
      }
    },
    [roleRef, senderPeerIdRef],
  );

  return { setStreamMode, streamMode, streamModeRef };
};

export default useRemoteAudioStreamMode;

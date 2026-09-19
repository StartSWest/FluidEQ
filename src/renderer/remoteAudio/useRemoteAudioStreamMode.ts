/* FluidEQ — GPL-3.0-or-later */
import { useRef } from 'react';
import type { TRemoteAudioStreamMode } from '../../common/remoteAudio';
import type { TRemoteAudioRole } from './remoteAudioState';

/** 'video' is the legacy wire name for immediate, lossless PCM. */
const useRemoteAudioStreamMode = (
  _roleRef: { current?: TRemoteAudioRole },
  _reconnectSenderRef: {
    current?: (mode: TRemoteAudioStreamMode) => Promise<void>;
  },
) => {
  const streamModeRef = useRef<TRemoteAudioStreamMode>('video');
  return {
    streamMode: 'video' as const,
    streamModeRef,
    setStreamMode: (_next: TRemoteAudioStreamMode) => undefined,
  };
};
export default useRemoteAudioStreamMode;

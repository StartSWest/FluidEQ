/* FluidEQ — GPL-3.0-or-later */
import { useRef } from 'react';
import type { TRemoteAudioStreamMode } from '../../common/remoteAudio';

/**
 * The mode the wire names for every stream: 'video', the legacy name for
 * immediate, lossless PCM, and the only mode there is. Older peers still
 * read it, so it still travels.
 */
const useRemoteAudioStreamMode = () => {
  const streamModeRef = useRef<TRemoteAudioStreamMode>('video');
  return { streamModeRef };
};
export default useRemoteAudioStreamMode;

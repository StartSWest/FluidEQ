/* FluidEQ — GPL-3.0-or-later */

import { createContext, useContext } from 'react';
import type { IRemoteAudioValue } from './remoteAudioState';

const RemoteAudioContext = createContext<IRemoteAudioValue | undefined>(
  undefined,
);

export const useRemoteAudio = (): IRemoteAudioValue => {
  const value = useContext(RemoteAudioContext);
  if (!value) {
    throw new Error('useRemoteAudio must be used inside RemoteAudioProvider');
  }
  return value;
};

/**
 * Whether another computer's sound is playing here now — what the DSP page
 * needs to know about Share Audio, and all it needs. Both ways, either side
 * of a link may be playing the other.
 *
 * Its own context because a context's consumers all re-render whenever its
 * value changes, and the full value changes with every network-stats sample
 * — four a second while a link is up. The DSP page used to read the full
 * value and redrew its header, its rail and the open processor with every
 * dial on each sample.
 */
export const RemoteAudioReceivingContext = createContext(false);

export const useRemoteAudioReceiving = (): boolean =>
  useContext(RemoteAudioReceivingContext);

export default RemoteAudioContext;

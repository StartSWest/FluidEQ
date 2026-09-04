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

export default RemoteAudioContext;

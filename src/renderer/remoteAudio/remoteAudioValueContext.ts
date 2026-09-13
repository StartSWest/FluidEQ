/* FluidEQ — GPL-3.0-or-later */

import { createContext, useContext } from 'react';
import type { IRemoteAudioValue, TRemoteAudioRole } from './remoteAudioState';

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
 * The role alone, for a component that needs to know whether this window is
 * listening or sending and nothing else.
 *
 * A context's consumers all re-render whenever its value changes, and the full
 * value changes with every network-stats sample — four a second while a
 * connection is up. The DSP page read it only for the role, and redrew its
 * header, its rail and the open processor with every dial on each sample.
 *
 * `undefined` both outside a provider and while no role is taken, which is
 * the same answer for every reader: this window is not in a session.
 */
export const RemoteAudioRoleContext = createContext<
  TRemoteAudioRole | undefined
>(undefined);

export const useRemoteAudioRole = (): TRemoteAudioRole | undefined =>
  useContext(RemoteAudioRoleContext);

export default RemoteAudioContext;

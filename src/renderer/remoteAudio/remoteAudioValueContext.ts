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

/** A linked computer whose sound is playing here now, and how far behind. */
export interface IIncomingSound {
  id: string;
  name: string;
  /** Milliseconds, once the first reading has come in. */
  delayMs?: number;
  /**
   * Whether sound is coming from it now, rather than a linked stream
   * carrying silence (`useIncomingSounding`).
   */
  isSounding: boolean;
}

/**
 * The other computers' sound playing here, each with its delay — for the
 * second output, which plays it later still, and anything else outside the
 * Share page that has to say so. Its own context for the reason the receiving
 * flag has one: it changes a few times a minute, not with every sample.
 */
export const IncomingSoundContext = createContext<readonly IIncomingSound[]>(
  [],
);

export const useIncomingSound = (): readonly IIncomingSound[] =>
  useContext(IncomingSoundContext);

export default RemoteAudioContext;

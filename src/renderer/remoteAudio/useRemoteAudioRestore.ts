/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { type MutableRefObject, useCallback, useEffect, useRef } from 'react';
import type { ILanPairingOption } from '../../common/remoteAudio';
import type {
  TRemoteAudioError,
  TRemoteAudioPhase,
  TRemoteAudioRole,
} from './remoteAudioState';

interface IRemoteAudioRestoreDeps {
  phase: TRemoteAudioPhase;
  roleRef: MutableRefObject<TRemoteAudioRole | undefined>;
  stoppingRef: MutableRefObject<boolean>;
  /** Bumped by every step that replaces the session; an answer that comes
   * back under an older one is not published. */
  generationRef: MutableRefObject<number>;
  setRole(next: TRemoteAudioRole | undefined): void;
  setPhase(next: TRemoteAudioPhase): void;
  setError(next: TRemoteAudioError | undefined): void;
  setDeviceName(next: string | undefined): void;
  setLanOptions(next: ILanPairingOption[]): void;
  /** Redraws every link and the page's word for them. */
  publish(): void;
}

/**
 * A link made once stays made: through the app closing, the computer
 * restarting and the network dropping, from either side.
 *
 * Whatever was linked last time is linked again on the first render, under
 * the same code. A computer that joined goes back to the one it joined
 * (`rejoin`); a computer whose code was used puts its code back on the
 * network (`rehost`). And a network that comes back is the moment to try
 * again after either failed — not a clock.
 */
const useRemoteAudioRestore = ({
  phase,
  roleRef,
  stoppingRef,
  generationRef,
  setRole,
  setPhase,
  setError,
  setDeviceName,
  setLanOptions,
  publish,
}: IRemoteAudioRestoreDeps) => {
  const bridge = window.electron?.ipcRenderer;

  /** Back to the computer this one joined, after it went away. */
  const rejoin = useCallback(async () => {
    if (roleRef.current !== 'sender' || stoppingRef.current) {
      return;
    }
    generationRef.current += 1;
    const attempt = generationRef.current;
    setPhase('connecting');
    try {
      const restored = await bridge.restoreRemoteAudioLan();
      if (generationRef.current !== attempt || roleRef.current !== 'sender') {
        return;
      }
      if (!restored || restored.role !== 'sender') {
        throw new Error('The saved link is unavailable.');
      }
      setDeviceName(restored.listener.deviceName);
      setError(undefined);
      publish();
    } catch {
      if (generationRef.current === attempt && roleRef.current === 'sender') {
        setError('connection');
        setPhase('disconnected');
      }
    }
  }, [
    bridge,
    generationRef,
    publish,
    roleRef,
    setDeviceName,
    setError,
    setPhase,
    stoppingRef,
  ]);

  /** This computer's code, live again after the network went away. */
  const rehost = useCallback(async () => {
    if (roleRef.current !== 'listener' || stoppingRef.current) {
      return;
    }
    generationRef.current += 1;
    const attempt = generationRef.current;
    setPhase('preparing');
    try {
      const restored = await bridge.restoreRemoteAudioLan();
      if (generationRef.current !== attempt || roleRef.current !== 'listener') {
        return;
      }
      if (!restored || restored.role !== 'listener') {
        throw new Error('The saved code is unavailable.');
      }
      setDeviceName(restored.details.deviceName);
      setLanOptions(restored.details.options);
      setError(undefined);
      setPhase('waiting');
      publish();
    } catch {
      if (generationRef.current === attempt && roleRef.current === 'listener') {
        setError('connection');
        setPhase('disconnected');
      }
    }
  }, [
    bridge,
    generationRef,
    publish,
    roleRef,
    setDeviceName,
    setError,
    setLanOptions,
    setPhase,
    stoppingRef,
  ]);

  // A network that comes back is the moment to try again, not a clock.
  useEffect(() => {
    if (phase !== 'disconnected') {
      return undefined;
    }
    const retry = () => {
      if (roleRef.current === 'sender') {
        rejoin().catch(() => undefined);
      } else if (roleRef.current === 'listener') {
        rehost().catch(() => undefined);
      }
    };
    window.addEventListener('online', retry);
    return () => window.removeEventListener('online', retry);
  }, [phase, rehost, rejoin, roleRef]);

  // Whatever was linked last time is linked again, under the same code.
  const restoreAttemptedRef = useRef(false);
  useEffect(() => {
    if (restoreAttemptedRef.current || !bridge?.getSavedRemoteAudioLanRole) {
      return;
    }
    restoreAttemptedRef.current = true;
    bridge
      .getSavedRemoteAudioLanRole()
      .then((saved) => {
        if (!saved || roleRef.current !== undefined) {
          return undefined;
        }
        setRole(saved);
        return saved === 'sender' ? rejoin() : rehost();
      })
      .catch(() => undefined);
  }, [bridge, rehost, rejoin, roleRef, setRole]);

  return { rejoin, rehost };
};

export default useRemoteAudioRestore;

/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Which engine is processing the audio, for a component that has to say so.
 *
 * Fetched once when the component mounts and then only when something asks
 * for it again — there is no polling and no timer, because the answer changes
 * exactly when the user changes it, and whatever changed it is in a position
 * to call `refresh`.
 *
 * `undefined` while the first answer is in flight, and that is a third state
 * rather than a default: a pill that guessed "Library only" for the frames
 * before main replied would show the wrong scope on every visit to the page,
 * on the one line of this app whose whole job is to say what is being
 * processed.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { IAudioEngineStatus } from 'common/audioEngine';
import { getAudioEngineStatus } from './audioEngineApi';
import { reportError } from './logger';
import { subscribeAudioEngineChanged } from './audioEngineEvents';
import { resetSystemDspChain } from '../dsp/systemChain';

export interface IAudioEngineStatusHook {
  status: IAudioEngineStatus | undefined;
  refresh: () => Promise<void>;
}

export const useAudioEngineStatus = (): IAudioEngineStatusHook => {
  const [status, setStatus] = useState<IAudioEngineStatus | undefined>(
    undefined,
  );
  // The page this sits on can be left before main answers, and a state write
  // after that is a warning that trains people to ignore warnings.
  const mounted = useRef(true);
  /**
   * The engine this hook last saw, read outside React state on purpose: it
   * exists only to be compared against the next answer, never rendered, and
   * a ref survives strict-mode's double effect run without asking `refresh`
   * to close over a stale value.
   */
  const lastKnownEngine = useRef<IAudioEngineStatus['engine'] | undefined>(
    undefined,
  );

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const refresh = useCallback(async () => {
    try {
      const next = await getAudioEngineStatus();
      // A rack this window already believes it delivered is only true of the
      // engine it was delivered to. `main` can switch engines while this tab
      // sits open — Task 11's dialog, or another window entirely — and the
      // freshly chosen one has never seen a byte from here. Forgetting the
      // cache on the first refresh that notices is what makes the next
      // publish (see `DspPanel`'s effect on `isSystemWide`) actually send,
      // instead of skipping because the array happens to match last time.
      if (
        lastKnownEngine.current !== undefined &&
        lastKnownEngine.current !== next.engine
      ) {
        resetSystemDspChain();
      }
      lastKnownEngine.current = next.engine;
      if (mounted.current) {
        setStatus(next);
      }
    } catch (error) {
      // The page still renders; it simply cannot say which engine is running,
      // and it then says nothing rather than something wrong.
      reportError('the audio engine status could not be read', error);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => subscribeAudioEngineChanged(refresh), [refresh]);

  return { status, refresh };
};

export default useAudioEngineStatus;

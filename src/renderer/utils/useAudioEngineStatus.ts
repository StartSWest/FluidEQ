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

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const refresh = useCallback(async () => {
    try {
      const next = await getAudioEngineStatus();
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

  return { status, refresh };
};

export default useAudioEngineStatus;

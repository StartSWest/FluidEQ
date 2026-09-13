/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The engine update the window offers, and when it offers it.
 *
 * The run is `useAudioRestart`'s, because the update ends the way a restart
 * of Windows audio does and wants the same keeping: it outlives the notice
 * showing it, refuses a second go, and brings the notice back by itself when
 * it fails.
 *
 * Offered when the answer turns to yes — at launch, or on switching back to
 * the FluidEQ Engine — and not again on every re-read of the status that says
 * the same thing, of which there are many: every engine action reads it
 * again. So "Not now" holds until the app next starts.
 *
 * Withdrawn when the answer turns to no while it is still only an offer: on
 * switching to Equalizer APO, or once the installed engine already is this
 * app's. It used to stay on screen after either, offering a Windows prompt
 * and an audio restart that could change nothing. A run in progress, or its
 * result, stays: that is a report of what happened, and the update itself
 * reads the status again before it finishes.
 */

import { useEffect, useRef } from 'react';
import type { IAudioRestartOutcome } from 'common/audioEngine';
import { useAudioRestart, type IAudioRestart } from './useAudioRestart';

export const useEngineUpdate = (
  isReady: boolean,
  perform: () => Promise<IAudioRestartOutcome>,
): IAudioRestart => {
  const update = useAudioRestart(perform);
  const { open, close, phase } = update;
  // Read when the answer changes, not a reason to act: a phase moving on to
  // done or failed must not withdraw the result it produced.
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  useEffect(() => {
    if (isReady) {
      open();
    } else if (phaseRef.current === 'ask') {
      close();
    }
  }, [isReady, open, close]);
  return update;
};

export default useEngineUpdate;

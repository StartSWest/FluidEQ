/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License version 3 or later.
*/

/**
 * One "Restart Windows audio", owned outside the card that shows it.
 *
 * The card used to own the restart, so closing it abandoned the answer, and
 * it could not be closed while Windows worked — a vendor service that hung
 * on its way up left "Restarting audio…" on screen with nothing to press.
 * Here the restart outlives the card: close it and the restart carries on,
 * open it again and it is still running, and a failure opens it by itself so
 * the reason lands where it can be read.
 */

import { useCallback, useRef, useState } from 'react';
import type { IAudioRestartOutcome } from 'common/audioEngine';
import { reportError } from './logger';

export type TRestartPhase = 'ask' | 'running' | 'done' | 'failed';

export interface IAudioRestart {
  isOpen: boolean;
  phase: TRestartPhase;
  outcome?: IAudioRestartOutcome;
  open: () => void;
  close: () => void;
  run: () => Promise<void>;
}

export const useAudioRestart = (
  restart: () => Promise<IAudioRestartOutcome>,
): IAudioRestart => {
  const [isOpen, setIsOpen] = useState(false);
  const [phase, setPhase] = useState<TRestartPhase>('ask');
  const [outcome, setOutcome] = useState<IAudioRestartOutcome | undefined>();
  // A ref and not the phase: two presses in one frame both read the phase
  // from before either ran, and two restarts at once fight over the same
  // services.
  const running = useRef(false);

  const open = useCallback(() => {
    // Reopened mid-restart it shows the restart, not a fresh question.
    if (!running.current) {
      setPhase('ask');
      setOutcome(undefined);
    }
    setIsOpen(true);
  }, []);

  const close = useCallback(() => setIsOpen(false), []);

  const run = async () => {
    if (running.current) {
      return;
    }
    running.current = true;
    setPhase('running');
    setOutcome(undefined);
    let result: IAudioRestartOutcome;
    try {
      result = await restart();
    } catch (error) {
      reportError(
        'Restarting Windows audio failed before it could answer',
        error,
      );
      result = {
        ok: false,
        declined: false,
        detail: error instanceof Error ? error.message : String(error),
      };
    } finally {
      running.current = false;
    }
    setOutcome(result);
    setPhase(result.ok ? 'done' : 'failed');
    if (!result.ok) {
      setIsOpen(true);
    }
  };

  return { isOpen, phase, outcome, open, close, run };
};

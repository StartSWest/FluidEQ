/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Restart Windows audio by itself, once, when the FluidEQ Engine is on the
 * output being listened to and Windows is not running it.
 *
 * That state is what a restart of Windows audio fixes: the engine is attached
 * but the endpoint was built before it was, so Windows never loaded it. It is
 * how a freshly installed engine could stay silent until somebody found the
 * notice's button. So the first time a session it happens without the button,
 * with the restart card showing it running; a restart that fails leaves its
 * reason on that card, and the notice's own button stays for any later time.
 *
 * Not while the engine update or its result owns the spot: that run ends in
 * the same restart, and two restarts fight over the same services.
 */

import { useEffect, useRef } from 'react';
import type { TEngineTrouble } from '../audio/engineTrouble';
import type { IAudioRestart } from './useAudioRestart';
import { reportInfo } from './logger';

/**
 * Once for this run of FluidEQ, not once per mount.
 *
 * A component's own ref is reset by anything that rebuilds it — the crash
 * recovery reload, the shell being unmounted — and a restart of Windows audio
 * reachable that way is one that can happen again and again while the state
 * that triggered it persists. It stops every stream on the machine, so once
 * means once: `sessionStorage` is per window and survives a reload, and is
 * emptied when FluidEQ is closed, which is exactly the life this belongs to.
 */
const RESTARTED_KEY = 'fluideq.engineOffRestartDone';

const alreadyRestarted = (): boolean => {
  try {
    return window.sessionStorage.getItem(RESTARTED_KEY) === 'true';
  } catch {
    // Storage refused: the ref below is then the only guard, which is the
    // behaviour this had before — never a reason to skip the restart.
    return false;
  }
};

const rememberRestarted = (): void => {
  try {
    window.sessionStorage.setItem(RESTARTED_KEY, 'true');
  } catch {
    // See above.
  }
};

const useRestartWhenEngineOff = (
  trouble: TEngineTrouble | undefined,
  isSuppressed: boolean,
  audioRestart: Pick<IAudioRestart, 'open' | 'run'>,
  /**
   * Whether the engine has ever run on this machine, as the setup helper
   * reports it. `false` means Windows has never once created it — on that
   * machine a restart cannot help, because there is nothing to restart into
   * the chain, and the install repair in main is what answers it. Undefined
   * from an older helper, which is treated as "may help", the old behaviour.
   */
  hasEverRun?: boolean,
): void => {
  const tried = useRef(false);
  const isOff = trouble?.kind === 'off' && hasEverRun !== false;
  // The latest pair, read when it is time; the object is rebuilt every render.
  const restart = useRef(audioRestart);
  restart.current = audioRestart;
  useEffect(() => {
    if (!isOff || isSuppressed || tried.current || alreadyRestarted()) {
      return;
    }
    tried.current = true;
    rememberRestarted();
    // What follows is a restart of Windows audio nobody asked for; the log
    // has to say who asked and why. `useAudioRestart` logs how it went.
    reportInfo(
      'Restarting Windows audio: the engine is on the output being listened ' +
        'to and Windows is not running it',
    );
    // Without opening its card. This runs by itself, and a dialog that
    // appears unbidden — in the middle of listening, for something the user
    // never asked for — is noise when it works: the sound comes back and
    // there is nothing to decide. `useAudioRestart` puts the card up by
    // itself when the restart fails, which is the only time it says
    // anything worth reading.
    restart.current.run().catch(() => undefined);
  }, [isOff, isSuppressed]);
};

export default useRestartWhenEngineOff;

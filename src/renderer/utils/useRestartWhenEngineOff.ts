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

const useRestartWhenEngineOff = (
  trouble: TEngineTrouble | undefined,
  isSuppressed: boolean,
  audioRestart: Pick<IAudioRestart, 'open' | 'run'>,
): void => {
  const tried = useRef(false);
  const isOff = trouble?.kind === 'off';
  // The latest pair, read when it is time; the object is rebuilt every render.
  const restart = useRef(audioRestart);
  restart.current = audioRestart;
  useEffect(() => {
    if (!isOff || isSuppressed || tried.current) {
      return;
    }
    tried.current = true;
    // What follows is a restart of Windows audio nobody asked for; the log
    // has to say who asked and why. `useAudioRestart` logs how it went.
    reportInfo(
      'Restarting Windows audio: the engine is on the output being listened ' +
        'to and Windows is not running it',
    );
    restart.current.open();
    restart.current.run().catch(() => undefined);
  }, [isOff, isSuppressed]);
};

export default useRestartWhenEngineOff;

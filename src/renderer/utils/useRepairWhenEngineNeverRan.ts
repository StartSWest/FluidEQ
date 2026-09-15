/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Put the engine's installation back, once, when sound has gone past an
 * engine Windows has never once created.
 *
 * Why here and not in main, where the rest of the engine's repairs live: main
 * reads the setup helper's answer and nothing else, and from that answer a
 * machine where Windows has never created the engine looks exactly like one
 * where setup finished a minute ago and nothing has played yet. Repairing on
 * that read alone would put a Windows permission prompt in front of somebody
 * seconds after installing, before they had heard anything at all.
 *
 * The window knows the difference. This trouble is only reached once the live
 * capture has heard sound on an output the engine is on and the engine has
 * still written nothing — which is the evidence, and is the state a user's
 * machine sat in with everything reporting healthy.
 *
 * The repair is the same one the engine update runs: re-install, which puts
 * back Windows' permission to load unsigned effects, the class registration,
 * the runtime beside the DLL and the permissions on the engine's own folder,
 * then restarts Windows audio. Never `--attach-all`: which outputs the engine
 * is on stays the user's choice.
 *
 * Once per run of FluidEQ, remembered in `sessionStorage` rather than a ref,
 * so a crash-recovery reload cannot ask a second time. If it does not help,
 * the notice stays and says what is left to check.
 */

import { useEffect, useRef } from 'react';
import type { TEngineTrouble } from '../audio/engineTrouble';
import { reportError, reportInfo } from './logger';

const REPAIRED_KEY = 'fluideq.engineNeverRanRepairDone';

const alreadyRepaired = (): boolean => {
  try {
    return window.sessionStorage.getItem(REPAIRED_KEY) === 'true';
  } catch {
    // Storage refused: the ref below is then the only guard, which still
    // holds for as long as the window lives.
    return false;
  }
};

const rememberRepaired = (): void => {
  try {
    window.sessionStorage.setItem(REPAIRED_KEY, 'true');
  } catch {
    // See above.
  }
};

const useRepairWhenEngineNeverRan = (
  trouble: TEngineTrouble | undefined,
  isSuppressed: boolean,
  repair: () => Promise<unknown>,
): void => {
  const tried = useRef(false);
  const neverRan = trouble?.kind === 'off' && trouble.neverRan === true;
  // The latest callback, read when it is time; the prop is rebuilt on every
  // render.
  const run = useRef(repair);
  run.current = repair;
  useEffect(() => {
    if (!neverRan || isSuppressed || tried.current || alreadyRepaired()) {
      return;
    }
    tried.current = true;
    rememberRepaired();
    reportInfo(
      'Repairing the engine: sound played on an output it is on and Windows ' +
        'has never once created it',
    );
    run
      .current()
      .catch((error) => reportError('The engine could not be repaired', error));
  }, [neverRan, isSuppressed]);
};

export default useRepairWhenEngineNeverRan;

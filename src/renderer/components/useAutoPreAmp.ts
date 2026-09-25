/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useCallback, useRef, useState } from 'react';
import { ErrorDescription } from 'common/errors';
import { useCurrentEngine } from '../utils/audioEngineContext';
import { disableAutoPreAmp, enableAutoPreAmp } from '../utils/equalizerApi';
import { useFluidEqShell } from '../utils/FluidEqContext';

/**
 * Auto normalize, switched.
 *
 * The switch in the side bar and the player's own preamp key are two
 * controls for one setting, and the ordering here is the part worth sharing:
 * the page is told first so the fader answers at once, the engine is asked
 * after, and a refusal puts the page back. Under Equalizer APO the answer
 * carries the value it settled on, which is then the preamp.
 *
 * `isBusy` covers the round trip, so a second press cannot cross the first.
 */
const useAutoPreAmp = () => {
  const {
    isBlockingError,
    isAutoPreAmpOn,
    setGlobalError,
    setAutoPreAmpOn,
    setPreAmp,
  } = useFluidEqShell();
  const engine = useCurrentEngine();
  const pending = useRef(false);
  const [isBusy, setIsBusy] = useState(false);

  const toggle = useCallback(async () => {
    if (pending.current) {
      return;
    }
    pending.current = true;
    setIsBusy(true);
    const enabled = !isAutoPreAmpOn;
    setAutoPreAmpOn(enabled);
    try {
      const applied = isAutoPreAmpOn
        ? await disableAutoPreAmp()
        : await enableAutoPreAmp();
      if (enabled && engine === 'apo') {
        setPreAmp(applied);
      }
    } catch (e) {
      setAutoPreAmpOn(isAutoPreAmpOn);
      setGlobalError(e as ErrorDescription);
    } finally {
      pending.current = false;
      setIsBusy(false);
    }
  }, [engine, isAutoPreAmpOn, setGlobalError, setAutoPreAmpOn, setPreAmp]);

  return {
    isOn: isAutoPreAmpOn,
    isDisabled: isBlockingError || isBusy,
    toggle,
  };
};

export default useAutoPreAmp;

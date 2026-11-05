/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useCallback } from 'react';
import type { ErrorDescription } from 'common/errors';
import { disableEqualizer, enableEqualizer } from './equalizerApi';
import { useFluidEqShell } from './FluidEqContext';

/**
 * FluidEQ's own on/off switch, for anything that offers it.
 *
 * One definition of what turning it on or off does — ask main, then say so in
 * the shell's state, and surface a refusal — shared by the switch itself and
 * by the places that explain what being off costs, such as the DSP page under
 * the FluidEQ Engine, where the rack is off while FluidEQ is.
 */
const useEqualizerPower = () => {
  const { isBlockingError, isEnabled, setGlobalError, setIsEnabled } =
    useFluidEqShell();

  /** Resolves to the switch's new position, or undefined when main refused. */
  const toggle = useCallback(async (): Promise<boolean | undefined> => {
    try {
      if (isEnabled) {
        await disableEqualizer();
      } else {
        await enableEqualizer();
      }
      setIsEnabled(!isEnabled);
      return !isEnabled;
    } catch (e) {
      setGlobalError(e as ErrorDescription);
      return undefined;
    }
  }, [isEnabled, setGlobalError, setIsEnabled]);

  return { isEnabled, isBlockingError, toggle };
};

export default useEqualizerPower;

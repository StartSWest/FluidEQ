/*
<AQUA: System-wide parametric audio equalizer interface>
Copyright (C) <2023>  <AQUA Dev Team>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import { ErrorDescription } from 'common/errors';
import { useCallback } from 'react';
import {
  disableAutoPreAmp,
  enableAutoPreAmp,
  setMainPreAmp,
} from '../utils/equalizerApi';
import { getManualPreAmp } from '../utils/manualPreAmp';
import { useFluidEqContext } from '../utils/FluidEqContext';
import Switch from '../widgets/Switch';

// The public UI calls this Auto normalize. The existing component and API
// names remain for compatibility with saved state and automation selectors.

interface IAutoPreAmpEnablerSwitchProps {
  id: string;
}

export default function AutoPreAmpEnablerSwitch({
  id,
}: IAutoPreAmpEnablerSwitchProps) {
  const {
    isBlockingError,
    isAutoPreAmpOn,
    setGlobalError,
    setAutoPreAmpOn,
    setPreAmp,
  } = useFluidEqContext();

  const handleToggle = useCallback(async () => {
    try {
      if (isAutoPreAmpOn) {
        await disableAutoPreAmp();
        // Hand the preamp back rather than abandoning it wherever the last
        // automatic value happened to leave it.
        //
        // Switching this off used to mean keeping a number nobody chose: the
        // slider and the headroom effect both wrote the same field, so somebody
        // who had deliberately set -3 dB, tried auto-normalize and turned it
        // off again was left on -7.4 dB with nothing to say what their own
        // figure had been. Zero when there has never been one, which is where
        // the app starts.
        const manual = getManualPreAmp();
        await setMainPreAmp(manual);
        setPreAmp(manual);
      } else {
        // Main returns the value derived from the final chain it just wrote.
        // Do not depend on the response graph to calculate it: the graph is not
        // mounted in every workspace, which left the root slider showing the
        // old manual value and made this switch appear to do nothing.
        const automatic = await enableAutoPreAmp();
        setPreAmp(automatic);
      }
      setAutoPreAmpOn(!isAutoPreAmpOn);
    } catch (e) {
      setGlobalError(e as ErrorDescription);
    }
  }, [isAutoPreAmpOn, setGlobalError, setAutoPreAmpOn, setPreAmp]);

  return (
    <Switch
      id={id}
      isOn={isAutoPreAmpOn}
      handleToggle={handleToggle}
      isDisabled={isBlockingError}
    />
  );
}

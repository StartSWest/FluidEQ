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
import { disableAutoPreAmp, enableAutoPreAmp } from '../utils/equalizerApi';
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
      // Both directions answer with the value main derived from the chain it
      // just wrote, and the switch shows that and nothing else.
      //
      // Turning it off used to put back a preamp remembered from the last time
      // a slider was moved. That is gone: nothing records a "user value" any
      // more, so switching off keeps the level auto-normalize had arrived at
      // and hands control of it over. Restoring an older number meant the one
      // click most likely to be made by somebody who thinks it is too quiet
      // could also make it clip.
      //
      // Do not depend on the response graph to compute the displayed value: the
      // graph is not mounted in every workspace, and where it is missing — the
      // Karaoke tab — nothing corrects a wrong number afterwards.
      const applied = isAutoPreAmpOn
        ? await disableAutoPreAmp()
        : await enableAutoPreAmp();
      setPreAmp(applied);
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

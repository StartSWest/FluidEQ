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
import { useCallback, useRef, useState } from 'react';
import { useCurrentEngine } from '../utils/audioEngineContext';
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
  const engine = useCurrentEngine();
  const pending = useRef(false);
  const [busy, setBusy] = useState(false);

  const handleToggle = useCallback(async () => {
    if (pending.current) {
      return;
    }
    pending.current = true;
    setBusy(true);
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
      setBusy(false);
    }
  }, [engine, isAutoPreAmpOn, setGlobalError, setAutoPreAmpOn, setPreAmp]);

  return (
    <Switch
      id={id}
      isOn={isAutoPreAmpOn}
      handleToggle={handleToggle}
      isDisabled={isBlockingError || busy}
    />
  );
}

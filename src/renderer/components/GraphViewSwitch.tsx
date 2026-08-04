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
import { disableGraphView, enableGraphView } from '../utils/equalizerApi';
import { useAquaContext } from '../utils/AquaContext';
import Switch from '../widgets/Switch';

interface IGraphViewSwitchProps {
  id: string;
}

export default function GraphViewSwitch({ id }: IGraphViewSwitchProps) {
  const { isBlockingError, isGraphViewOn, setGlobalError, setGraphViewOn } =
    useAquaContext();

  // Toggling the graph never resizes the OS window. The workspace keeps the
  // size the user chose and the EQ panel simply reclaims the freed height.
  const handleToggle = useCallback(async () => {
    try {
      if (isGraphViewOn) {
        await disableGraphView();
      } else {
        await enableGraphView();
      }
      setGraphViewOn(!isGraphViewOn);
    } catch (e) {
      setGlobalError(e as ErrorDescription);
    }
  }, [isGraphViewOn, setGlobalError, setGraphViewOn]);

  return (
    <Switch
      id={id}
      isOn={isGraphViewOn}
      handleToggle={handleToggle}
      isDisabled={isBlockingError}
    />
  );
}

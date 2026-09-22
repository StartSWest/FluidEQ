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

import Switch from '../widgets/Switch';
import useAutoPreAmp from './useAutoPreAmp';

// The public UI calls this Auto normalize. The existing component and API
// names remain for compatibility with saved state and automation selectors.

interface IAutoPreAmpEnablerSwitchProps {
  id: string;
}

export default function AutoPreAmpEnablerSwitch({
  id,
}: IAutoPreAmpEnablerSwitchProps) {
  // The switching itself is shared with the player's own preamp key
  // (`useAutoPreAmp`): one setting, one order of operations.
  const { isOn, isDisabled, toggle } = useAutoPreAmp();

  return (
    <Switch id={id} isOn={isOn} handleToggle={toggle} isDisabled={isDisabled} />
  );
}

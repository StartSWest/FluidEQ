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

import { KeyboardEvent } from 'react';
import '../styles/Switch.scss';

interface ISwitchProps {
  id: string;
  isOn: boolean;
  isDisabled: boolean;
  handleToggle: () => void;
  /** The checkbox's accessible name. Every existing caller omits this and
   * keeps relying on `id` for the wrapper button's label below — optional so
   * none of them has to start naming a switch that was working without one. */
  ariaLabel?: string;
}

// Structure taken from https://upmostly.com/tutorials/build-a-react-switch-toggle-component
export default function Switch({
  id,
  isOn,
  isDisabled,
  handleToggle,
  ariaLabel,
}: ISwitchProps) {
  const handleKeyUp = (e: KeyboardEvent) => {
    if (e.code === 'Enter') {
      handleToggle();
    }
  };

  return (
    <label className="switch" htmlFor={id}>
      <input
        id={id}
        type="checkbox"
        checked={isOn}
        aria-checked={isOn}
        aria-label={ariaLabel}
        className="switch-checkbox"
        onChange={handleToggle}
        onKeyUp={handleKeyUp}
        disabled={isDisabled}
      />
      <div role="button" className="switch-label" aria-label={ariaLabel ?? id}>
        <span className="switch-button" />
      </div>
    </label>
  );
}

/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { type ReactNode, useId } from 'react';
import Switch from '../widgets/Switch';

/**
 * A drawing the View menu turns on or off, as a named row with the app's
 * switch at its end (Ivan, 2026-11-16: "all of them have to be toggle
 * buttons"): the same row the window-look switches are (`RainbowSwitch`). It
 * replaces the rows whose label flipped between "Hide …" and "Show …", which
 * read as an action to take rather than a state to see.
 */
const ViewMenuSwitch = ({
  icon,
  name,
  isOn,
  isDisabled = false,
  onToggle,
}: {
  icon: ReactNode;
  name: string;
  isOn: boolean;
  isDisabled?: boolean;
  onToggle: () => void;
}) => {
  const id = useId();
  return (
    <div className="graph-view-menu__slider graph-view-menu__slider--switch">
      <svg className="graph-view-menu__icon" viewBox="0 0 16 16" aria-hidden>
        {icon}
      </svg>
      <label htmlFor={id}>{name}</label>
      <span className="graph-view-menu__switch">
        <Switch
          id={id}
          isOn={isOn}
          isDisabled={isDisabled}
          handleToggle={onToggle}
          ariaLabel={name}
        />
      </span>
    </div>
  );
};

export default ViewMenuSwitch;

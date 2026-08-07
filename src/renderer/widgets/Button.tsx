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

import { KeyboardEvent, ReactNode } from 'react';
import '../styles/Button.scss';

interface IButtonProps {
  children: ReactNode;
  ariaLabel: string;
  isDisabled: boolean;
  className?: string;
  /**
   * For the buttons that are switches rather than actions.
   *
   * Optional, and absent means "not a switch" rather than "off" — a plain
   * action button reporting `aria-pressed="false"` tells a screen reader it is
   * a toggle that is currently off, which is a different control from the one
   * on screen.
   */
  isPressed?: boolean;
  handleChange: () => void;
}

const Button = ({
  children,
  ariaLabel,
  isDisabled,
  className = '',
  isPressed,
  handleChange,
}: IButtonProps) => {
  // `aria-disabled` only removes pointer events through CSS, so the handler
  // still has to refuse activation itself.
  const activate = () => {
    if (isDisabled) {
      return;
    }
    handleChange();
  };

  // The element is focusable, so it must respond to the keys a real button
  // responds to.
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.code === 'Enter' || e.code === 'Space') {
      e.preventDefault();
      activate();
    }
  };

  return (
    <div
      role="button"
      aria-label={ariaLabel}
      className={`button ${className}`}
      onClick={activate}
      onKeyDown={onKeyDown}
      tabIndex={isDisabled ? -1 : 0}
      aria-disabled={isDisabled}
      aria-pressed={isPressed}
    >
      {children}
    </div>
  );
};

export default Button;

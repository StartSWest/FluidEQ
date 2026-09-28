/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

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

import type { Ref } from 'react';
import '../styles/DialogFrame.scss';

interface IDialogCloseProps {
  /** What it closes, for a screen reader: the glyph says nothing. */
  label: string;
  /** The tooltip, where it says more than the label; the label otherwise. */
  hint?: string;
  onClose: () => void;
  ref?: Ref<HTMLButtonElement>;
  /** Where the surface it closes places it; the frame's corner otherwise. */
  className?: string;
}

/**
 * The one way out of every dialog, notice and viewer: a quiet square in the
 * corner with a cross in it. There were eight — boxed, round, bare, a text ✕,
 * a glyph over a picture banner — and eighteen dialogs had none at all, so
 * the way out had to be looked for in each one.
 */
export default function DialogClose({
  label,
  hint,
  onClose,
  ref,
  className,
}: IDialogCloseProps) {
  return (
    <button
      ref={ref}
      type="button"
      className={`dialog-close${className ? ` ${className}` : ''}`}
      aria-label={label}
      title={hint ?? label}
      onClick={onClose}
    >
      <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
        <path d="M4 4l8 8M12 4l-8 8" />
      </svg>
    </button>
  );
}

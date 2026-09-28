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

import type { ReactNode } from 'react';
import '../styles/DialogFrame.scss';

export interface IDialogIdentityProps {
  /** The glyph in the tile: the one the menu that opens the dialog shows. */
  icon: ReactNode;
  title: string;
  /** The heading's id, which names the dialog. */
  titleId: string;
  /**
   * The small all-caps line over the title, where a dialog has one. Its id is
   * `${titleId}-eyebrow`, for a dialog whose name needs both lines.
   */
  eyebrow?: string;
  /** Beside the title: a version pill, a count. */
  badge?: ReactNode;
  /** One or two lines under the title saying what this is for. */
  description?: ReactNode;
}

/**
 * What a dialog is, at the top of its rail: the tile with its glyph, the
 * title and the line under it. `DialogFrame` draws it for every dialog; the
 * user guide, a native `<dialog>` the frame cannot wrap, draws it itself so
 * its head is the same as everybody else's.
 */
export default function DialogIdentity({
  icon,
  title,
  titleId,
  eyebrow,
  badge,
  description,
}: IDialogIdentityProps) {
  return (
    <div className="dialog-frame__identity">
      <span className="dialog-frame__tile" aria-hidden="true">
        {icon}
      </span>
      <div className="dialog-frame__heading">
        {eyebrow && (
          <span id={`${titleId}-eyebrow`} className="dialog-frame__eyebrow">
            {eyebrow}
          </span>
        )}
        {/* The badge is the heading's sibling, not its child: the title's id
            names the dialog, and a version inside it renamed the About panel
            on every release. */}
        <div className="dialog-frame__title-row">
          <h2 id={titleId} className="dialog-frame__title">
            {title}
          </h2>
          {badge}
        </div>
        {description && (
          <p className="dialog-frame__description">{description}</p>
        )}
      </div>
    </div>
  );
}

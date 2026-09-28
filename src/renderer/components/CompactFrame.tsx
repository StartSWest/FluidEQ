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

import type { HTMLAttributes, ReactNode, Ref } from 'react';
import DialogClose from './DialogClose';
import '../styles/DialogFrame.scss';

/**
 * What the tile says before a word is read: the accent for a question or an
 * offer, amber for something that is wrong, red for something that deletes.
 */
export type TFrameTone = 'accent' | 'warn' | 'danger';

interface ICompactFrameProps extends Omit<
  HTMLAttributes<HTMLDivElement>,
  'title'
> {
  icon: ReactNode;
  tone?: TFrameTone;
  title: ReactNode;
  titleId: string;
  /** What the question or the notice is about, under the title. */
  children?: ReactNode;
  /** The quiet answer first, the one it asks for last. */
  actions?: ReactNode;
  onClose?: () => void;
  closeLabel?: string;
  ref?: Ref<HTMLDivElement>;
}

/**
 * The split in miniature, for what is one question or one line of news: a
 * strip in the rail's colour holding the glyph, and the words and the answers
 * beside it. Confirmations and the notices that arrive on their own use it
 * alike — "Empty EQ?", "The FluidEQ Engine isn't running" — so a question
 * looks the same wherever in the app it is asked.
 *
 * A confirmation by default (`alertdialog`, modal); a notice that floats over
 * a page it does not block says so through its own `role` and `aria-modal`.
 */
export default function CompactFrame({
  icon,
  tone = 'accent',
  title,
  titleId,
  children,
  actions,
  onClose,
  closeLabel,
  ref,
  className,
  ...surface
}: ICompactFrameProps) {
  return (
    <div
      ref={ref}
      className={`compact-frame${className ? ` ${className}` : ''}`}
      role="alertdialog"
      aria-modal="true"
      aria-labelledby={titleId}
      // eslint-disable-next-line react/jsx-props-no-spreading -- a dialog's own role, handlers and labels land on its surface
      {...surface}
    >
      <div className="compact-frame__strip">
        <span className={`dialog-frame__tile is-${tone}`} aria-hidden="true">
          {icon}
        </span>
      </div>
      <div className="compact-frame__main">
        <h2 id={titleId} className="compact-frame__title">
          {title}
        </h2>
        {children && <div className="compact-frame__message">{children}</div>}
        {actions && <div className="compact-frame__actions">{actions}</div>}
      </div>
      {onClose && closeLabel && (
        <DialogClose label={closeLabel} onClose={onClose} />
      )}
    </div>
  );
}

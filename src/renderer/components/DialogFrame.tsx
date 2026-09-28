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

import type { HTMLAttributes, ReactNode, Ref, RefObject } from 'react';
import DialogClose from './DialogClose';
import DialogIdentity, { type IDialogIdentityProps } from './DialogIdentity';
import '../styles/DialogFrame.scss';

interface IDialogFrameProps
  extends Omit<HTMLAttributes<HTMLDivElement>, 'title'>, IDialogIdentityProps {
  /** More of the rail under the identity: a list to walk, a game. */
  rail?: ReactNode;
  /** A note on the left and the actions on the right, loud one last. */
  footer?: ReactNode;
  /** Absent for a dialog with no way out but its own buttons. */
  onClose?: () => void;
  closeLabel?: string;
  closeRef?: RefObject<HTMLButtonElement | null>;
  ref?: Ref<HTMLDivElement>;
  children: ReactNode;
}

/**
 * Every dialog in the app, drawn once: what it is on the left, what it holds
 * on the right (Ivan, 2026-09-27: "go C split").
 *
 * Before this there were eight close buttons, five kinds of head and seven
 * loud buttons across sixty dialogs and notices, because each one was drawn
 * by the stylesheet it lived in. The rail carries the dialog's glyph — the one
 * on the menu row that opened it, so the two are recognised as one thing —
 * its title and a line on what it is for; the body scrolls on its own; the
 * foot keeps its buttons in the one order the app uses, the quiet answer
 * first and the recommended one last.
 *
 * The frame is the dialog's surface, not its backdrop: a dialog still owns
 * where it sits, how it is dismissed from outside and what the keyboard does,
 * because those differ for real — a gate cannot be escaped and a busy dialog
 * cannot be closed — and a frame that knew about them would be a set of modes.
 */
export default function DialogFrame({
  icon,
  title,
  titleId,
  eyebrow,
  badge,
  description,
  rail,
  footer,
  onClose,
  closeLabel,
  closeRef,
  ref,
  className,
  children,
  ...surface
}: IDialogFrameProps) {
  return (
    <div
      ref={ref}
      className={`dialog-frame${className ? ` ${className}` : ''}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      // eslint-disable-next-line react/jsx-props-no-spreading -- a dialog's own role, handlers and labels land on its surface
      {...surface}
    >
      <div className="dialog-frame__rail">
        <DialogIdentity
          icon={icon}
          title={title}
          titleId={titleId}
          eyebrow={eyebrow}
          badge={badge}
          description={description}
        />
        {rail}
      </div>
      {onClose && closeLabel && (
        <DialogClose ref={closeRef} label={closeLabel} onClose={onClose} />
      )}
      <div className="dialog-frame__body">{children}</div>
      {footer && <div className="dialog-frame__foot">{footer}</div>}
    </div>
  );
}

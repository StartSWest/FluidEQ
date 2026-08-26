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

import { RefObject } from 'react';
import BrandMark from '../icons/BrandMark';
import '../styles/DialogHeader.scss';

interface IDialogHeaderProps {
  /** The small all-caps line above the title. */
  eyebrow: string;
  title: string;
  /** Matches the dialog's own `aria-labelledby`. */
  titleId: string;
  /**
   * Shown as a pill beside the title, `v` prefixed here so callers pass the
   * bare number. Omitted where a panel does not describe one build — the
   * changelog spans several, and a single number on it would name the wrong
   * one.
   */
  version?: string;
  closeLabel: string;
  onClose: () => void;
  /** For a dialog that opens with the way out focused. */
  closeRef?: RefObject<HTMLButtonElement | null>;
}

/**
 * The top of a dialog: the mark, what this is, and the way out.
 *
 * It began as one shape written twice — About and the release notes had
 * byte-identical `__header` and `__close` rules in two stylesheets and the
 * same JSX in two files. Written twice, the second copy is the one that
 * eventually forgets, which is the same reason `useTransportStrip` is shared.
 *
 * THE MARK IS THE POINT OF IT. These panels used to identify themselves in a
 * second row below the header — logo, name, version, tagline — which put the
 * app's identity in two places on the same card and separated the tagline
 * from the name it belongs to. The window's own titlebar has said all of that
 * in one line since the first version, and this is that line: mark, name,
 * version pill. One row, and the panel's content starts immediately under it.
 *
 * Not the support dialog. Its identity mark is the creature, not the logo,
 * and its header is a stage a rhythm game is played on — adopting this would
 * mean a flag for "which mark", which is two components pretending to be one.
 */
export default function DialogHeader({
  eyebrow,
  title,
  titleId,
  version,
  closeLabel,
  onClose,
  closeRef,
}: IDialogHeaderProps) {
  return (
    <div className="dialog-header">
      <div className="dialog-header__identity">
        <BrandMark className="dialog-header__mark" />
        <div className="dialog-header__text">
          <span className="eyebrow">{eyebrow}</span>
          {/* The pill is a sibling of the heading, not a child of it.
              `titleId` is what the dialog points `aria-labelledby` at, so a
              version inside the `h2` renames the whole dialog: About
              announced itself as "FluidEQ v1.5.0" to a screen reader, and
              would rename itself on every release. The titlebar pairs them
              the same way, for the same reason. */}
          <div className="dialog-header__heading">
            <h2 id={titleId} className="dialog-header__title">
              {title}
            </h2>
            {version && (
              <span className="dialog-header__version">v{version}</span>
            )}
          </div>
        </div>
      </div>
      <button
        ref={closeRef}
        type="button"
        className="dialog-header__close"
        aria-label={closeLabel}
        onClick={onClose}
      >
        <svg viewBox="0 0 12 12" aria-hidden="true">
          <path d="M3 3l6 6M9 3l-6 6" />
        </svg>
      </button>
    </div>
  );
}

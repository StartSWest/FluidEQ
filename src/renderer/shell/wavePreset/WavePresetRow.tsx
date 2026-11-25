/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { ReactNode } from 'react';
import MenuIcon from '../../icons/MenuIcon';

interface IWavePresetRowProps {
  glyph: ReactNode;
  name: string;
  /** What it does, muted at the row's end; cut before it can push the name. */
  hint?: string;
  /** The name as drawn, when it is more than its words (a search's mark). */
  shownName?: ReactNode;
  /** The hint as drawn, likewise. */
  shownHint?: ReactNode;
  /** For a row that is a choice: whether it is the one playing. */
  checked?: boolean;
  disabled?: boolean;
  /** The suggested way out (a game's Back to the music sound): in the accent. */
  isLoud?: boolean;
  /** The row the panel's keys are on, while the caret stays in the field. */
  isActive?: boolean;
  /** A favourite unstarred in this opening, dimmed where it stood. */
  isGone?: boolean;
  /** For the field's active descendant. */
  id?: string;
  onFocus?: () => void;
  onPress: () => void;
}

/**
 * One row of the plate's list, as the mockup drew them (Ivan, 2026-11-20):
 * a glyph, the name, what it does in a muted line at the end, and a check on
 * the one that plays. A choice is a radio item; an action (Back to the music
 * sound, Open the Gaming Lab) a plain one.
 */
const WavePresetRow = ({
  glyph,
  name,
  hint,
  shownName,
  shownHint,
  checked,
  disabled,
  isLoud,
  isActive,
  isGone,
  id,
  onFocus,
  onPress,
}: IWavePresetRowProps) => (
  <button
    id={id}
    type="button"
    role={checked === undefined ? 'menuitem' : 'menuitemradio'}
    aria-checked={checked}
    className={`wave-preset-menu__row${isLoud ? ' is-loud' : ''}${
      isActive ? ' is-active' : ''
    }${isGone ? ' is-gone' : ''}`}
    disabled={disabled}
    title={hint ? `${name} · ${hint}` : name}
    onFocus={onFocus}
    onClick={onPress}
  >
    {glyph}
    <span className="wave-preset-menu__name">{shownName ?? name}</span>
    <span className="wave-preset-menu__hint">{shownHint ?? hint}</span>
    {checked && <MenuIcon name="check" className="wave-preset-menu__check" />}
  </button>
);

export default WavePresetRow;

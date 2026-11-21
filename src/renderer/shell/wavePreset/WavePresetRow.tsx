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
  /** For a row that is a choice: whether it is the one playing. */
  checked?: boolean;
  disabled?: boolean;
  /** The suggested way out (a game's Back to the music sound): in the accent. */
  isLoud?: boolean;
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
  checked,
  disabled,
  isLoud,
  onPress,
}: IWavePresetRowProps) => (
  <button
    type="button"
    role={checked === undefined ? 'menuitem' : 'menuitemradio'}
    aria-checked={checked}
    className={`wave-preset-menu__row${isLoud ? ' is-loud' : ''}`}
    disabled={disabled}
    title={hint ? `${name} · ${hint}` : name}
    onClick={onPress}
  >
    {glyph}
    <span className="wave-preset-menu__name">{name}</span>
    <span className="wave-preset-menu__hint">{hint}</span>
    {checked && <MenuIcon name="check" className="wave-preset-menu__check" />}
  </button>
);

export default WavePresetRow;

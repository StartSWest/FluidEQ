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

import {
  GraphPalette,
  GraphStyle,
  resolveGraphPalette,
} from 'common/graphStyles';
import { TranslationKey } from 'common/i18n';
import { getMaxLookColours } from 'common/customLooks';
import { ReactNode } from 'react';
import rangeFill from '../utils/rangeFill';

// What the look designer is built from: the palettes it offers, and a
// setting's row and slider. Its colours are `LookGradient.tsx`.

/**
 * Written out rather than taken from `GRAPH_PALETTE_LABELS`.
 *
 * That table names looks in the picker, where the signal palette is the
 * unmarked case and so has an empty label — "Bars" rather than "Bars · signal".
 * Here they are side by side as a choice, and a choice with an unnamed option
 * is not one.
 *
 * The hints say what the colour *means* rather than what it looks like, because
 * that is the whole difference between the two gradients: one is painted along
 * the frequency axis and one up the decibel axis, and from a still picture of a
 * loud frame they can look much the same.
 */
export const PALETTE_CHOICES: {
  value: GraphPalette;
  label: TranslationKey;
  hint: TranslationKey;
}[] = [
  {
    value: 'signal',
    label: 'look.palette.flat',
    hint: 'look.palette.flatHint',
  },
  {
    value: 'rainbow',
    label: 'look.palette.frequency',
    hint: 'look.palette.frequencyHint',
  },
  {
    value: 'level',
    label: 'look.palette.level',
    hint: 'look.palette.levelHint',
  },
  {
    value: 'heat',
    label: 'look.palette.heat',
    hint: 'look.palette.heatHint',
  },
  {
    value: 'auto',
    label: 'look.palette.auto',
    hint: 'look.palette.autoHint',
  },
];

/**
 * Where a palette's colours start when somebody decides to change them.
 *
 * A look with none of its own is drawn in the window's colours — Normal mode's
 * primary and secondary, Rainbow mode's palette (`windowInk.ts`) — so that is
 * where the panel starts: the first thing it shows is what is on screen, and
 * the first stop somebody changes turns the window's set into the look's own.
 * `set` is the window's set as the caller read it: the hook's in a render, the
 * store's in a click.
 */
export const seedLookColours = (
  set: readonly string[],
  style: GraphStyle,
  choice: GraphPalette,
): string[] => {
  const palette = resolveGraphPalette(style, choice);
  return set.slice(0, getMaxLookColours(palette));
};

interface ISettingRowProps {
  id: string;
  label: string;
  value: string;
  isDisabled?: boolean;
  hint?: string;
  children: ReactNode;
}

/**
 * A labelled control with its current value written beside the name.
 *
 * The number matters more here than on most sliders: these are milliseconds and
 * counts that somebody may want to reproduce on another form, and a thumb
 * position is not something you can write down.
 */
export const SettingRow = ({
  id,
  label,
  value,
  isDisabled = false,
  hint,
  children,
}: ISettingRowProps) => (
  <div
    className={`look-designer__row${isDisabled ? ' is-disabled' : ''}`}
    aria-disabled={isDisabled}
  >
    <label className="look-designer__caption" htmlFor={id}>
      <span>{label}</span>
      <span className="look-designer__value">{value}</span>
    </label>
    {children}
    {hint && <span className="look-designer__hint">{hint}</span>}
  </div>
);

interface ISettingSliderProps {
  id: string;
  min: number;
  max: number;
  step?: number;
  value: number;
  isDisabled?: boolean;
  onChange: (value: number) => void;
}

export const SettingSlider = ({
  id,
  min,
  max,
  step = 1,
  value,
  isDisabled = false,
  onChange,
}: ISettingSliderProps) => (
  <input
    id={id}
    className="look-designer__slider"
    type="range"
    min={min}
    max={max}
    step={step}
    value={value}
    style={rangeFill(value, min, max)}
    disabled={isDisabled}
    onChange={(event) => onChange(Number(event.target.value))}
  />
);

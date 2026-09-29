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
import { ReactNode, useEffect, useRef, useState } from 'react';
import { useTranslation } from '../utils/I18nContext';
import useExitAnimation from '../utils/useExitAnimation';

// What the look designer is built from: the palettes and swatches it
// offers, a gradient stop's picker, and a setting's row and slider.

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

/**
 * The colours a stop can be set to without leaving the panel.
 *
 * The native colour input opens Chromium's own picker, which is a saturation
 * square, a hue strip and three numeric fields — about three hundred pixels of
 * chrome dropped over a two-hundred-and-fifty pixel panel, covering the very
 * graph the colour is being chosen against. It is a fine tool for specifying a
 * colour and a poor one for picking one while watching a wave.
 *
 * This is the other half of that trade: a fixed set, one click, nothing
 * covered. Two rows — the app's own accents first, then a spread around the
 * wheel — which is enough to build any ramp anybody has asked for. The native
 * picker is still there behind "custom" for the case this cannot serve.
 */
const SWATCH_CHOICES = [
  '#00e5cf',
  '#54ff8a',
  '#ffcc4d',
  '#ff8a3d',
  '#ff4f4f',
  '#ff4f9a',
  '#c86bff',
  '#6b8aff',
  '#00b3ff',
  '#ffffff',
  '#9aa7b8',
  '#0d1420',
];

interface IStopPickerProps {
  colour: string;
  index: number;
  canRemove: boolean;
  onChange: (colour: string) => void;
  onRemove: () => void;
}

/**
 * One stop: a swatch that opens a small grid, and a corner control to drop it.
 */
export const StopPicker = ({
  colour,
  index,
  canRemove,
  onChange,
  onRemove,
}: IStopPickerProps) => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  // Folds back into the swatch when it closes, as every other menu does,
  // rather than blinking out (`menu-out`).
  const gridRef = useRef<HTMLDivElement>(null);
  const exit = useExitAnimation(isOpen, 'menu-out', gridRef);

  // Anywhere else closes it. Pointer-down rather than click, so the grid is
  // gone by the time whatever was pressed reacts.
  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }
    const close = () => setIsOpen(false);
    window.addEventListener('pointerdown', close);
    return () => window.removeEventListener('pointerdown', close);
  }, [isOpen]);

  return (
    <span
      className="look-designer__swatch"
      // The listener above is on the window, so a press inside must not reach
      // it or the grid would close on the way to the colour being chosen.
      onPointerDown={(event) => event.stopPropagation()}
    >
      <button
        type="button"
        className="look-designer__swatch-face"
        style={{ background: colour }}
        aria-label={t('look.colourValue', { number: index + 1, colour })}
        aria-expanded={isOpen}
        title={colour}
        onClick={() => setIsOpen((open) => !open)}
      />
      {canRemove && (
        <button
          type="button"
          className="look-designer__swatch-drop"
          aria-label={t('look.removeColour', { number: index + 1 })}
          onClick={onRemove}
        >
          ✕
        </button>
      )}
      {exit.present && (
        <div
          ref={gridRef}
          className="look-designer__swatch-grid"
          role="group"
          data-closing={exit.closing ? '' : undefined}
          inert={exit.closing}
          onAnimationEnd={exit.onAnimationEnd}
        >
          {SWATCH_CHOICES.map((choice) => (
            <button
              key={choice}
              type="button"
              className={`look-designer__swatch-choice${
                choice === colour ? ' is-on' : ''
              }`}
              style={{ background: choice }}
              aria-label={choice}
              title={choice}
              onClick={() => {
                onChange(choice);
                setIsOpen(false);
              }}
            />
          ))}
          <label
            className="look-designer__swatch-custom"
            htmlFor={`look-designer-custom-${index}`}
            title={t('look.customColour')}
          >
            {t('look.custom')}
            <input
              id={`look-designer-custom-${index}`}
              type="color"
              value={colour}
              aria-label={t('look.customColour')}
              onChange={(event) => onChange(event.target.value)}
            />
          </label>
        </div>
      )}
    </span>
  );
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
    disabled={isDisabled}
    onChange={(event) => onChange(Number(event.target.value))}
  />
);

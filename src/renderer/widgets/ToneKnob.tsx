/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import Knob from './Knob';
import '../styles/ToneKnob.scss';

interface IToneKnobProps {
  /** The word under the dial: Bass, Mid, Treble. */
  name: string;
  value: number;
  min: number;
  max: number;
  step: number;
  isDisabled: boolean;
  unit: string;
  /** Where Ctrl+click puts it back to — flat, for a tone control. */
  defaultValue?: number;
  onReset?: () => void;
  handleChange: (newValue: number) => Promise<void>;
}

/**
 * The player's three tone dials: the app's knob with its name under its
 * reading, as big as the deck allows (`--tone-knob-size`). The same knob as
 * every other dial in the window (Ivan, 2026-09-26: "a single reusable
 * component"); it had a drawing of its own, value and all.
 */
const ToneKnob = ({
  name,
  value,
  min,
  max,
  step,
  isDisabled,
  unit,
  defaultValue,
  onReset,
  handleChange,
}: IToneKnobProps) => (
  <div className={`tone-knob${isDisabled ? ' tone-knob--disabled' : ''}`}>
    <Knob
      name={name}
      value={value}
      min={min}
      max={max}
      step={step}
      isDisabled={isDisabled}
      unit={unit}
      defaultValue={defaultValue}
      onReset={onReset}
      handleChange={handleChange}
    />
    <span className="tone-knob__name">{name}</span>
  </div>
);

export default ToneKnob;

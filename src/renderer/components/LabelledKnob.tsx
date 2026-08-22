/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import Knob from '../widgets/Knob';
import '../styles/LabelledKnob.scss';

export interface ILabelledKnobProps {
  /** The parameter's name. Shown under the dial and read out as its label. */
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  /**
   * The caption under the number.
   *
   * Empty for a parameter that genuinely has none — a drive factor, a blend
   * ratio. Inventing a unit for the caption reads as a measurement the value
   * is not.
   */
  unit: string;
  /** Where Ctrl+click returns the dial to. Omit and the gesture does nothing. */
  defaultValue?: number;
  isDisabled?: boolean;
  /** Fires on every value as the dial turns, so the change is audible at once. */
  onChange: (next: number) => void;
  /**
   * Fires when the gesture ends — pointer released, key lifted.
   *
   * Separate from `onChange` because a knob reports a value per pixel of
   * travel, and whatever a caller does to persist a setting is almost always
   * too expensive to do a hundred times across one turn. Optional: a caller
   * with nothing to save can leave it out.
   */
  onCommit?: () => void;
}

/**
 * A knob with its name under it, and the release callback the bare one lacks.
 *
 * `Knob` reports every value as it turns and has no notion of a gesture
 * ending, which is fine for the preamp — it writes to APO through a debounce
 * of its own — and not fine for anything that persists on release. Rather than
 * teach `Knob` about that, the commit rides on this wrapper: `pointerup`
 * bubbles from the dial and the knob captures the pointer, so it arrives even
 * when the drag ends outside the control, and `keyup` covers the arrow keys.
 */
const LabelledKnob = ({
  label,
  value,
  min,
  max,
  step,
  unit,
  defaultValue,
  isDisabled = false,
  onChange,
  onCommit,
}: ILabelledKnobProps) => (
  // Not interactive itself — a layout box that happens to be where two events
  // surface — so no role and no tab stop. The knob inside is the control and
  // already has both.
  // eslint-disable-next-line jsx-a11y/no-static-element-interactions
  <div className="labelled-knob" onPointerUp={onCommit} onKeyUp={onCommit}>
    <Knob
      name={label}
      value={value}
      min={min}
      max={max}
      step={step}
      unit={unit}
      defaultValue={defaultValue}
      isDisabled={isDisabled}
      handleChange={async (next: number) => onChange(next)}
    />
    <span className="labelled-knob__label">{label}</span>
  </div>
);

export default LabelledKnob;

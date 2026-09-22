/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import useDialGesture from './dialGesture';
import KnobDial from './KnobDial';
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
 * A dial with its value and its name under it, as big as its row allows.
 *
 * The three tone dials, on the EQ page and in the player, drawn the way the
 * player's design has them (Ivan, 2026-09-21): an unbroken disc, the lit arc
 * around it, and the reading under it rather than in its face. The same disc
 * and the same gestures as every other knob here — only where the number
 * sits is different, and that is a matter of the room the row has.
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
}: IToneKnobProps) => {
  const {
    inputRef,
    clampedProgress,
    arcStart,
    arcLength,
    showsArc,
    displayValue,
    dialProps,
    inputProps,
  } = useDialGesture({
    name,
    value,
    min,
    max,
    step,
    sensitivity: 1,
    isDisabled,
    unit,
    defaultValue,
    onReset,
    handleChange,
  });

  return (
    <div className={`tone-knob${isDisabled ? ' tone-knob--disabled' : ''}`}>
      <div
        className={`tone-knob__dial knob${isDisabled ? ' knob--disabled' : ''}`}
        // eslint-disable-next-line react/jsx-props-no-spreading -- the dial gesture is one group of handlers, named together
        {...dialProps}
      >
        <KnobDial
          progress={clampedProgress}
          arcStart={arcStart}
          arcLength={arcLength}
          showsArc={showsArc}
        />
        <input
          ref={inputRef}
          className="knob__input"
          // eslint-disable-next-line react/jsx-props-no-spreading -- the range input is described in one place, the gesture
          {...inputProps}
        />
      </div>
      <span className="tone-knob__value">
        {displayValue} {unit}
      </span>
      <span className="tone-knob__name">{name}</span>
    </div>
  );
};

export default ToneKnob;

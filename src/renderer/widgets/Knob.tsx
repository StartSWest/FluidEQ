/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.
*/

import useDialGesture from './dialGesture';
import KnobView from './KnobView';

interface IKnobProps {
  name: string;
  value: number;
  min: number;
  max: number;
  step: number;
  sensitivity?: number;
  isDisabled: boolean;
  /** The caption under the number, and what assistive tech hears before it —
   * `Q` for a filter's width, `dB` for the preamp. */
  unit: string;
  /**
   * Where Ctrl+click puts the dial back to.
   *
   * Optional because not every knob has a meaningful home: a filter's Q has a
   * neutral 0.7 to return to, a preamp has 0, and a value with no such
   * position is better off with the gesture doing nothing than with it
   * inventing one. Omitting it disables the gesture rather than defaulting to
   * `min`, which would be a trapdoor to silence on anything measured in
   * decibels.
   */
  defaultValue?: number;
  /**
   * What Ctrl+click does, where going home is not the same as setting this
   * value.
   *
   * The EQ's gain dial shows one band but drives every band selected, and it
   * drives them by a delta so the selection keeps its shape. "Back to flat"
   * is the one thing that cannot be said that way: a delta large enough to
   * flatten the band being shown leaves the rest wherever that delta put
   * them, and it is no delta at all when the shown band is already at zero.
   * Given this, the gesture calls it instead of writing `defaultValue`.
   */
  onReset?: () => void;
  handleChange: (newValue: number) => Promise<void>;
}

/**
 * A dial with its number in its face.
 *
 * The compact one: the editor's rows and the chain's cards give a control a
 * square and nothing under it, so the value is read off the middle of the
 * disc. Where there is room for a line under the dial — the three tone dials
 * — `ToneKnob` is the same dial with the value under it instead, which is
 * the shape the player's mockup was drawn in.
 */
const Knob = ({
  name,
  value,
  min,
  max,
  step,
  sensitivity = 1,
  isDisabled,
  unit,
  defaultValue,
  onReset,
  handleChange,
}: IKnobProps) => {
  const view = useDialGesture({
    name,
    value,
    min,
    max,
    step,
    sensitivity,
    isDisabled,
    unit,
    defaultValue,
    onReset,
    handleChange,
  });

  return <KnobView view={view} unit={unit} isDisabled={isDisabled} />;
};

export default Knob;

/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import useSteppedDialGesture from './steppedDialGesture';
import KnobView from './KnobView';

interface ISteppedKnobProps {
  name: string;
  /** Its settings, in the order it turns through them. */
  stops: readonly number[];
  value: number;
  isDisabled: boolean;
  unit: string;
  /** Where Ctrl+click puts it back to. */
  defaultValue?: number;
  handleChange: (newValue: number) => Promise<void>;
}

/**
 * A dial that clicks between a few settings: the same disc and face as
 * `Knob`, turned a setting at a time (`steppedDialGesture`).
 */
const SteppedKnob = ({
  name,
  stops,
  value,
  isDisabled,
  unit,
  defaultValue,
  handleChange,
}: ISteppedKnobProps) => {
  const view = useSteppedDialGesture({
    name,
    stops,
    value,
    isDisabled,
    unit,
    defaultValue,
    handleChange,
  });

  return <KnobView view={view} unit={unit} isDisabled={isDisabled} />;
};

export default SteppedKnob;

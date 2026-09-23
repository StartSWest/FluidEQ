/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useId } from 'react';
import type { TDialView } from './dialGesture';
import KnobDial from './KnobDial';
import '../styles/Knob.scss';

interface IKnobViewProps {
  /** What the dial's gesture decided: where it stands and how it answers. */
  view: TDialView;
  /** The caption under the number, `Q` for a width, `dB` for a level. */
  unit: string;
  isDisabled: boolean;
}

/**
 * The compact dial as drawn: the disc, its number in its face, and the range
 * input its gesture drives. Whatever the gesture — the sweep of `Knob`, the
 * detents of `SteppedKnob` — the dial looks the same, so only the hand can
 * tell which one it is turning.
 */
const KnobView = ({ view, unit, isDisabled }: IKnobViewProps) => {
  const ids = useId();
  const {
    inputRef,
    clampedProgress,
    arcStart,
    arcLength,
    showsArc,
    displayValue,
    dialProps,
    inputProps,
  } = view;

  return (
    <div
      className={`knob${isDisabled ? ' knob--disabled' : ''}`}
      // eslint-disable-next-line react/jsx-props-no-spreading -- the dial gesture is one group of handlers, named together
      {...dialProps}
    >
      <KnobDial
        progress={clampedProgress}
        arcStart={arcStart}
        arcLength={arcLength}
        showsArc={showsArc}
      >
        {/* The well the number sits in. It was #122a3a to #0e2230 — below the
            window's own floor, so the middle of every knob was the darkest
            thing on the panel and read as a hole rather than as a recess. One
            step under the knob's body is all a recess needs. */}
        <defs>
          <radialGradient id={`${ids}-face`} cx="50%" cy="40%" r="70%">
            <stop offset="0%" className="knob__stop--face-top" />
            <stop offset="100%" className="knob__stop--face-edge" />
          </radialGradient>
        </defs>
        <circle
          className="knob__face"
          cx="36"
          cy="36"
          r="15"
          fill={`url(#${ids}-face)`}
        />
        <text className="knob__number" x="36" y="36.5" textAnchor="middle">
          {displayValue}
        </text>
        <text className="knob__label" x="36" y="44" textAnchor="middle">
          {unit}
        </text>
      </KnobDial>
      <input
        ref={inputRef}
        className="knob__input"
        // eslint-disable-next-line react/jsx-props-no-spreading -- the range input is described in one place, the gesture
        {...inputProps}
      />
    </div>
  );
};

export default KnobView;

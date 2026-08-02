/*
<AQUA: System-wide parametric audio equalizer interface>
Copyright (C) <2023>  <AQUA Dev Team>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.
*/

import { ChangeEvent, CSSProperties, WheelEvent } from 'react';
import '../styles/Knob.scss';

interface IKnobProps {
  name: string;
  value: number;
  min: number;
  max: number;
  step: number;
  isDisabled: boolean;
  handleChange: (newValue: number) => Promise<void>;
}

const Knob = ({
  name,
  value,
  min,
  max,
  step,
  isDisabled,
  handleChange,
}: IKnobProps) => {
  const progress = ((value - min) / (max - min)) * 100;
  const clampedProgress = Math.min(100, Math.max(0, progress));
  const displayValue = value < 1 ? value.toFixed(2) : value.toFixed(1);

  const updateValue = (nextValue: number) => {
    const precision = step < 1 ? Math.ceil(-Math.log10(step)) : 0;
    const rounded = Number(nextValue.toFixed(precision));
    const next = Math.min(max, Math.max(min, rounded));
    handleChange(next);
  };

  const onInput = (event: ChangeEvent<HTMLInputElement>) => {
    updateValue(Number(event.currentTarget.value));
  };

  const onWheel = (event: WheelEvent<HTMLDivElement>) => {
    if (isDisabled) {
      return;
    }
    event.preventDefault();
    updateValue(value + (event.deltaY < 0 ? step : -step));
  };

  const style = {
    '--knob-progress': `${clampedProgress}%`,
  } as CSSProperties;

  return (
    <div
      className={`knob${isDisabled ? ' knob--disabled' : ''}`}
      style={style}
      onWheel={onWheel}
    >
      <svg className="knob__dial" viewBox="0 0 72 72" aria-hidden="true">
        <circle
          className="knob__track"
          cx="36"
          cy="36"
          r="27"
          pathLength="100"
          strokeDasharray="75 25"
          transform="rotate(135 36 36)"
        />
        <circle
          className="knob__value"
          cx="36"
          cy="36"
          r="27"
          pathLength="100"
          strokeDasharray={`${(75 * clampedProgress) / 100} 100`}
          transform="rotate(135 36 36)"
        />
        <circle className="knob__hub" cx="36" cy="36" r="19" />
        <text className="knob__number" x="36" y="37" textAnchor="middle">
          {displayValue}
        </text>
        <text className="knob__label" x="36" y="48" textAnchor="middle">
          Q
        </text>
      </svg>
      <input
        className="knob__input"
        type="range"
        name={name}
        aria-label={name}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={onInput}
        disabled={isDisabled}
      />
    </div>
  );
};

export default Knob;

/*
<AQUA: System-wide parametric audio equalizer interface>
Copyright (C) <2023>  <AQUA Dev Team>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.
*/

import {
  ChangeEvent,
  CSSProperties,
  PointerEvent,
  useRef,
  WheelEvent,
} from 'react';
import '../styles/Knob.scss';

/**
 * Vertical travel, in pixels, that sweeps the dial end to end.
 *
 * A range input maps its own width to the whole range, and this dial is only
 * about 64px across — so every pixel was worth a huge slice of Q and the
 * control was impossible to place. Driving it from a virtual travel distance
 * instead decouples precision from how big the knob is drawn, which is exactly
 * what a real knob does.
 */
const DRAG_TRAVEL_PX = 280;
/** Shift narrows each pixel for placing an exact value. */
const FINE_DRAG_FACTOR = 4;

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
  // Q is a ratio, not a distance, so the dial travels logarithmically.
  //
  // Mapped linearly, 0.01–33.33 puts the entire musically useful range —
  // roughly 0.5 to 3 — inside 7% of the sweep, so a few pixels of drag threw
  // the value across a filter's whole character. On a log sweep that same range
  // gets about a fifth of the travel, and every pixel is the same *proportional*
  // change wherever you are on the dial.
  const inputRef = useRef<HTMLInputElement>(null);
  const ratio = max / min;
  const toPosition = (input: number) =>
    Math.log(Math.min(max, Math.max(min, input)) / min) / Math.log(ratio);
  const toValue = (position: number) => min * ratio ** position;

  const position = toPosition(value);
  const clampedProgress = Math.min(100, Math.max(0, position * 100));
  const displayValue = value < 1 ? value.toFixed(2) : value.toFixed(1);

  const updateValue = (nextValue: number) => {
    const precision = step < 1 ? Math.ceil(-Math.log10(step)) : 0;
    const rounded = Number(nextValue.toFixed(precision));
    const next = Math.min(max, Math.max(min, rounded));
    if (next !== value) {
      handleChange(next);
    }
  };

  const onInput = (event: ChangeEvent<HTMLInputElement>) => {
    updateValue(toValue(Number(event.currentTarget.value)));
  };

  const onWheel = (event: WheelEvent<HTMLDivElement>) => {
    if (isDisabled) {
      return;
    }
    event.preventDefault();
    // Proportional too: a notch is worth ~4% of the current value, so it stays
    // usable at Q 0.3 and at Q 20 alike. Shift gives a finer ~1%.
    const factor = event.shiftKey ? 1.01 : 1.04;
    updateValue(event.deltaY < 0 ? value * factor : value / factor);
  };

  // Drag up to open the filter out, down to narrow it, over a travel distance
  // that has nothing to do with the widget's own size.
  const drag = useRef<{ y: number; position: number } | null>(null);

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (isDisabled || event.button !== 0) {
      return;
    }
    drag.current = { y: event.clientY, position };
    event.currentTarget.setPointerCapture(event.pointerId);
    // Pointer drives the value, but the range input still owns focus so the
    // arrow keys keep working after a drag.
    inputRef.current?.focus();
    event.preventDefault();
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const gesture = drag.current;
    if (!gesture) {
      return;
    }
    const travel = DRAG_TRAVEL_PX * (event.shiftKey ? FINE_DRAG_FACTOR : 1);
    const next = gesture.position + (gesture.y - event.clientY) / travel;
    updateValue(toValue(Math.min(1, Math.max(0, next))));
  };

  const endDrag = (event: PointerEvent<HTMLDivElement>) => {
    if (!drag.current) {
      return;
    }
    drag.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const style = {
    '--knob-progress': `${clampedProgress}%`,
  } as CSSProperties;

  return (
    <div
      className={`knob${isDisabled ? ' knob--disabled' : ''}`}
      style={style}
      onWheel={onWheel}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
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
        ref={inputRef}
        className="knob__input"
        type="range"
        name={name}
        aria-label={name}
        // The slider carries a 0-1 position, not the Q itself. aria-* keeps
        // reporting the real value so assistive tech announces "1.4", not "0.57".
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        aria-valuetext={`Q ${displayValue}`}
        min={0}
        max={1}
        // ~500 stops across the sweep: fine enough that dragging feels
        // continuous, coarse enough that a keyboard arrow moves perceptibly.
        step={0.002}
        value={position}
        onChange={onInput}
        disabled={isDisabled}
      />
    </div>
  );
};

export default Knob;

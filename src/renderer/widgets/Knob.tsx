/*
<FluidEQ: System-wide parametric audio equalizer interface>
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
  /** The caption under the number, and what assistive tech hears before it —
   * `Q` for a filter's width, `dB` for the preamp. */
  unit: string;
  handleChange: (newValue: number) => Promise<void>;
}

const Knob = ({
  name,
  value,
  min,
  max,
  step,
  isDisabled,
  unit,
  handleChange,
}: IKnobProps) => {
  const inputRef = useRef<HTMLInputElement>(null);

  /**
   * How the sweep maps onto the range, decided by the range itself.
   *
   * Not a prop, because it is not a choice: a logarithmic sweep is only
   * defined for a range that stays above zero. Q is a ratio — 0.01 to 33.33 —
   * and mapped linearly it puts the entire musically useful part, roughly 0.5
   * to 3, inside 7% of the travel, so a few pixels threw the value across a
   * filter's whole character; on a log sweep that same part gets about a fifth
   * of the dial and every pixel is the same *proportional* change wherever you
   * are on it. The preamp is a distance in decibels that runs from -20 to +20,
   * where a ratio has no meaning at all and the honest sweep is the even one.
   */
  const isProportional = min > 0;
  const ratio = isProportional ? max / min : 1;
  const toPosition = (input: number) => {
    const clamped = Math.min(max, Math.max(min, input));
    return isProportional
      ? Math.log(clamped / min) / Math.log(ratio)
      : (clamped - min) / (max - min);
  };
  const toValue = (position: number) =>
    isProportional ? min * ratio ** position : min + position * (max - min);

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
    if (isProportional) {
      // A notch is worth ~4% of the current value, so it stays usable at Q 0.3
      // and at Q 20 alike. Shift gives a finer ~1%.
      const factor = event.shiftKey ? 1.01 : 1.04;
      updateValue(event.deltaY < 0 ? value * factor : value / factor);
      return;
    }
    // An even range gets an even notch. Multiplying would be meaningless here
    // and, at a value of zero, would be nothing at all: no factor moves it.
    const notch = (max - min) / (event.shiftKey ? 200 : 50);
    updateValue(event.deltaY < 0 ? value + notch : value - notch);
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
          {unit}
        </text>
      </svg>
      <input
        ref={inputRef}
        className="knob__input"
        type="range"
        name={name}
        aria-label={name}
        // The slider carries a 0-1 position, not the value itself. aria-* keeps
        // reporting the real one, so assistive tech announces "1.4 Q" or
        // "-8.9 dB" rather than "0.57".
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        aria-valuetext={`${displayValue} ${unit}`}
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

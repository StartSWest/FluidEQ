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
  useId,
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
  defaultValue,
  handleChange,
}: IKnobProps) => {
  const inputRef = useRef<HTMLInputElement>(null);
  // Two knobs can be on screen at once — a band's Q and the preamp — and SVG
  // gradient ids are document-global, so a fixed one would have the second
  // silently paint itself with the first one's metal.
  const ids = useId();

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
    /**
     * Ctrl+click puts the dial home — the gesture every DAW uses for it.
     *
     * Handled before the drag is armed, so a control-click that moves a pixel
     * cannot also drag the value away from the home it was just sent to.
     * `metaKey` because on a Mac keyboard that is the same finger.
     */
    if ((event.ctrlKey || event.metaKey) && defaultValue !== undefined) {
      updateValue(defaultValue);
      inputRef.current?.focus();
      event.preventDefault();
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
        {/* The metal is three gradients rather than one, because that is what
            a turned aluminium knob under a single light actually is: a body
            lit from the upper left, a bevel that is bright along the top edge
            and dark along the bottom, and a recessed face that catches almost
            none of it. Flat fills with a border read as a circle with a line
            on it; these read as an object. */}
        <defs>
          <radialGradient id={`${ids}-body`} cx="32%" cy="24%" r="82%">
            <stop offset="0%" stopColor="#f6fafc" />
            <stop offset="38%" stopColor="#c3cfd8" />
            <stop offset="74%" stopColor="#8b97a3" />
            <stop offset="100%" stopColor="#5b6672" />
          </radialGradient>
          <linearGradient id={`${ids}-bevel`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.85" />
            <stop offset="45%" stopColor="#ffffff" stopOpacity="0.12" />
            <stop offset="100%" stopColor="#000000" stopOpacity="0.55" />
          </linearGradient>
          <radialGradient id={`${ids}-face`} cx="50%" cy="34%" r="70%">
            <stop offset="0%" stopColor="#20303f" />
            <stop offset="100%" stopColor="#0b141d" />
          </radialGradient>
        </defs>
        <circle
          className="knob__track"
          cx="36"
          cy="36"
          r="30"
          pathLength="100"
          strokeDasharray="75 25"
          transform="rotate(135 36 36)"
        />
        <circle
          className="knob__value"
          cx="36"
          cy="36"
          r="30"
          pathLength="100"
          strokeDasharray={`${(75 * clampedProgress) / 100} 100`}
          transform="rotate(135 36 36)"
        />
        <circle className="knob__shadow" cx="36" cy="37.5" r="23" />
        <circle
          className="knob__body"
          cx="36"
          cy="36"
          r="23"
          fill={`url(#${ids}-body)`}
        />
        <circle
          className="knob__bevel"
          cx="36"
          cy="36"
          r="22.2"
          stroke={`url(#${ids}-bevel)`}
        />
        {/* Drawn along the +x axis and rotated onto the value, which is the
            same 135°-plus-sweep the arcs above are rotated by — so the notch
            and the filled arc always point at the same place by construction
            rather than by two calculations agreeing. */}
        <g transform={`rotate(${135 + (clampedProgress / 100) * 270} 36 36)`}>
          {/* Cyan on near-white is almost invisible, and the brightest part of
              this body is exactly where the notch sits at the top of its
              travel. The dark line underneath is what gives it an edge to
              read against — the same trick a real knob gets for free from
              the groove being cut into the metal. */}
          <line
            className="knob__notch-groove"
            x1="49"
            y1="36"
            x2="57"
            y2="36"
          />
          <line className="knob__notch" x1="49" y1="36" x2="57" y2="36" />
        </g>
        <circle
          className="knob__face"
          cx="36"
          cy="36"
          r="13.5"
          fill={`url(#${ids}-face)`}
        />
        <text className="knob__number" x="36" y="36.5" textAnchor="middle">
          {displayValue}
        </text>
        <text className="knob__label" x="36" y="44" textAnchor="middle">
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

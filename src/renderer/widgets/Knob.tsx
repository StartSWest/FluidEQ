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

  /**
   * Where the filled arc GROWS FROM, decided by the range rather than by a
   * prop — the same reasoning as `isProportional` above, and read off the same
   * two numbers.
   *
   * What the predicate MEANS: a range that straddles zero symmetrically is one
   * where zero is the rest position rather than the floor, so turning the dial
   * down is a decision and not an absence. Grown from the low end, such a dial
   * sits half filled while it is doing nothing, which reads as a level — and a
   * dial whose rest position looks like a level is one nobody thinks to turn
   * down. Grown from the centre, its rest is empty and the notch points
   * straight up, which is what "doing nothing" looks like.
   *
   * Anything satisfying that gets the centre, including whatever is added
   * next; as this is written it catches three — Bass Punch's Attack and
   * Sustain (-1 to +1), the EQ's band gain (-24 to +24 dB) and the side bar's
   * preamp, which is the -20 to +20 dB dial the paragraph above already names.
   *
   * A range that merely happens to include negatives is not this: the Master's
   * -24 to +6 dB trim, the Normalizer's -12 to -0.1 target and the Denoise
   * -6 to +12 makeup all have a low end that IS their floor.
   */
  const isBipolar = min < 0 && max === -min;
  const arcOrigin = isBipolar ? 50 : 0;
  const arcStart = Math.min(arcOrigin, clampedProgress);
  const arcLength = Math.abs(clampedProgress - arcOrigin);
  /**
   * A bipolar dial at rest draws nothing; every other one keeps what it had.
   *
   * The stroke has round caps, so a zero-length dash paints a dot. At the low
   * end of an amount that dot is the cap of an arc about to grow and has been
   * on screen for the life of this widget. At the CENTRE of a bipolar range it
   * would be a mark saying "a little" on the one setting that means none —
   * and the notch already points straight up there, which says it better.
   */
  const showsArc = arcLength > 0 || !isBipolar;
  /**
   * As many digits as fit inside the dial, and no more.
   *
   * The face is about 40px across, which is roughly six characters of the
   * readout's type. `toFixed(1)` on everything overflowed it the moment a
   * value reached four digits — the EQ's Freq knob shipped reading "3778.0"
   * with the text running out past the metal.
   *
   * Kilohertz above 10k, whole numbers from 1,000 up, and decimals only where
   * the value is small enough for them to be worth reading. Nothing here is
   * frequency-specific: a knob does not know what it is turning.
   */
  const displayValue = (() => {
    const magnitude = Math.abs(value);
    if (magnitude >= 10_000) {
      return `${(value / 1_000).toFixed(1)}k`;
    }
    if (magnitude >= 1_000) {
      return value.toFixed(0);
    }
    return magnitude < 1 ? value.toFixed(2) : value.toFixed(1);
  })();

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
        {/* Slate, like everything else in the window. This was a turned
            aluminium knob — a near-white body lit from the upper left, a
            chrome bevel, a black face — and it was the one piece of metal in
            a flat blue interface: the eye went to it before the EQ. The body
            is now the field rung of the same ladder every control uses, one
            step lighter than the card, with the faintest top light so it still
            reads as a disc rather than a printed circle; the face is the well
            rung. Only the notch and the arc carry colour, which is the part
            that means something. */}
        <defs>
          <radialGradient id={`${ids}-body`} cx="38%" cy="28%" r="80%">
            <stop offset="0%" stopColor="#33637e" />
            <stop offset="70%" stopColor="#27526b" />
            <stop offset="100%" stopColor="#224a61" />
          </radialGradient>
          <linearGradient id={`${ids}-bevel`} x1="0" y1="0" x2="0" y2="1">
            {/* Mist above, mist below. The lower stop was black at 30%,
                which on a navy body is not a shaded edge — it is a dark
                ring drawn round the knob, and it read as a hole the knob
                sat in. */}
            <stop offset="0%" stopColor="#d6e9f7" stopOpacity="0.24" />
            <stop offset="55%" stopColor="#d6e9f7" stopOpacity="0.05" />
            <stop offset="100%" stopColor="#d6e9f7" stopOpacity="0.1" />
          </linearGradient>
          {/* The well the number sits in. It was #122a3a to #0e2230 —
              below the window's own floor, so the middle of every knob was
              the darkest thing on the panel and read as a hole rather than
              as a recess. One step under the knob's body is all a recess
              needs. */}
          <radialGradient id={`${ids}-face`} cx="50%" cy="40%" r="70%">
            <stop offset="0%" stopColor="#27526b" />
            <stop offset="100%" stopColor="#21475d" />
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
        {showsArc ? (
          <circle
            className="knob__value"
            cx="36"
            cy="36"
            r="30"
            pathLength="100"
            strokeDasharray={`${(75 * arcLength) / 100} 100`}
            // Negative, because a dash pattern offset backwards begins that
            // far along the path — which is how the arc starts at the centre
            // of a bipolar range instead of at its low end.
            strokeDashoffset={-(75 * arcStart) / 100}
            transform="rotate(135 36 36)"
          />
        ) : undefined}
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
          {/* A faint groove under the notch, so the cyan line has an edge to
              sit in rather than floating on the disc. Much quieter than it
              was when the body was near-white and the line needed a dark
              bed to be seen at all. */}
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

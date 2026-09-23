/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { ChangeEvent, PointerEvent, useRef, WheelEvent } from 'react';

/**
 * Vertical travel, in pixels, that sweeps a dial end to end.
 *
 * A range input maps its own width to the whole range, and these dials are
 * only about 64px across — so every pixel was worth a huge slice of Q and the
 * control was impossible to place. Driving it from a virtual travel distance
 * instead decouples precision from how big the knob is drawn, which is exactly
 * what a real knob does.
 */
const DRAG_TRAVEL_PX = 280;
/** Shift narrows each pixel for placing an exact value. */
const FINE_DRAG_FACTOR = 4;

export interface IDialGesture {
  /** What the dial is called, for assistive tech. */
  name: string;
  value: number;
  min: number;
  max: number;
  step: number;
  sensitivity: number;
  isDisabled: boolean;
  /** The caption under the number: `Q` for a width, `dB` for a level. */
  unit: string;
  /** Where Ctrl+click puts the dial back to; omitted disables the gesture. */
  defaultValue?: number;
  /** What Ctrl+click does where going home is not writing `defaultValue`. */
  onReset?: () => void;
  handleChange: (newValue: number) => Promise<void> | void;
}

/**
 * Everything a dial does that is not drawing: how its range maps onto the
 * sweep, what its number reads, and the pointer, wheel and keyboard gestures.
 *
 * Shared, because there are two dials in this app — the one with its number
 * in its face, which is what the editor rows and the chain's rows have room
 * for, and the big one with its value under it — and the way a dial answers
 * a hand must not depend on which of the two is on screen.
 */
const useDialGesture = ({
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
}: IDialGesture) => {
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
   * Decimals this dial can actually reach, read off its own step.
   *
   * Used both to round what is written and to decide what is drawn, so the
   * readout never promises a resolution the control does not have.
   */
  const precision = step < 1 ? Math.ceil(-Math.log10(step)) : 0;
  /**
   * As many digits as fit inside the dial, and no more.
   *
   * The face is about 40px across, which is roughly six characters of the
   * readout's type. `toFixed(1)` on everything overflowed it the moment a
   * value reached four digits — the EQ's Freq knob shipped reading "3778.0"
   * with the text running out past the metal.
   *
   * Kilohertz above 10k, whole numbers from 1,000 up, and decimals only where
   * the value is small enough for them to be worth reading AND the step can
   * land on them: a dial that moves in whole hertz drawing "630.0" spends one
   * of its six characters on a digit it can never set. Nothing here is
   * frequency-specific: a knob does not know what it is turning, only how
   * finely it turns.
   */
  const displayValue = (() => {
    const magnitude = Math.abs(value);
    if (magnitude >= 10_000) {
      return `${(value / 1_000).toFixed(1)}k`;
    }
    const decimals =
      magnitude >= 1_000 ? 0 : Math.min(magnitude < 1 ? 2 : 1, precision);
    const text = value.toFixed(decimals);
    // A value that rounds away to nothing must not keep its minus sign:
    // (-0.04).toFixed(1) is "-0.0", which on a bipolar dial reads as a cut
    // that is not there.
    return Number(text) === 0 ? (0).toFixed(decimals) : text;
  })();

  const updateValue = (nextValue: number) => {
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
      const factor = (event.shiftKey ? 1.01 : 1.04) ** sensitivity;
      const proposed = event.deltaY < 0 ? value * factor : value / factor;
      const movement = Math.max(step, Math.abs(proposed - value));
      updateValue(value + (event.deltaY < 0 ? movement : -movement));
      return;
    }
    // An even range gets an even notch. Multiplying would be meaningless here
    // and, at a value of zero, would be nothing at all: no factor moves it.
    const notch = ((max - min) / (event.shiftKey ? 200 : 50)) * sensitivity;
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
    if (
      (event.ctrlKey || event.metaKey) &&
      (onReset || defaultValue !== undefined)
    ) {
      if (onReset) {
        onReset();
      } else if (defaultValue !== undefined) {
        updateValue(defaultValue);
      }
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
    const next =
      gesture.position + ((gesture.y - event.clientY) / travel) * sensitivity;
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

  return {
    inputRef,
    /** Where the dial stands, 0 to 100, for the arc and the pointer. */
    clampedProgress,
    arcStart,
    arcLength,
    showsArc,
    displayValue,
    /** On the box around the dial, which is what the hand lands on. */
    dialProps: {
      onWheel,
      onPointerDown,
      onPointerMove,
      onPointerUp: endDrag,
      onPointerCancel: endDrag,
    },
    /**
     * The range input the dial is driven through, kept for focus and the
     * arrow keys: it carries a 0-1 position, not the value itself, so aria-*
     * keeps reporting the real one — "1.4 Q", "-8.9 dB" — rather than "0.57".
     */
    inputProps: {
      type: 'range' as const,
      name,
      'aria-label': name,
      'aria-valuemin': min,
      'aria-valuemax': max,
      'aria-valuenow': value,
      'aria-valuetext': `${displayValue} ${unit}`,
      min: 0,
      max: 1,
      // ~500 stops across the sweep: fine enough that dragging feels
      // continuous, coarse enough that a keyboard arrow moves perceptibly.
      step: 0.002,
      value: position,
      onChange: onInput,
      disabled: isDisabled,
    },
  };
};

/** What a dial's gesture hands the dial that draws it (`KnobView`). */
export type TDialView = ReturnType<typeof useDialGesture>;

export default useDialGesture;

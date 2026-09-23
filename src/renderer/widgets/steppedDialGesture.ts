/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { ChangeEvent, PointerEvent, useRef, WheelEvent } from 'react';
import type { TDialView } from './dialGesture';

/**
 * Drag from one setting to the next, in pixels.
 *
 * The sweep dial takes 280 px end to end because it places a value among
 * hundreds. A dial of five settings spent seventy pixels on each of them, and
 * the hand ran out of desk before the dial ran out of settings (Ivan,
 * 2026-09-23: "I have to move the mouse to much").
 */
const DETENT_PX = 24;
/**
 * How far past the midpoint between two settings a drag has to go before it
 * crosses, as a share of a detent. A hand resting on the midpoint shakes by a
 * pixel either way, and without this the dial would flicker between the two.
 */
const DETENT_HYSTERESIS = 0.2;
/**
 * Wheel travel for one setting. A mouse notch is about 100 and crosses it at
 * once; a trackpad sends a stream of small deltas, which one setting per event
 * would spin from end to end in a single stroke.
 */
const WHEEL_DETENT = 50;

export interface ISteppedDialGesture {
  /** What the dial is called, for assistive tech. */
  name: string;
  /** Its settings, in the order it turns through them. */
  stops: readonly number[];
  value: number;
  isDisabled: boolean;
  /** The caption under the number. */
  unit: string;
  /** Where Ctrl+click puts it back to; omitted disables the gesture. */
  defaultValue?: number;
  handleChange: (newValue: number) => Promise<void> | void;
}

/** The setting nearest `value`, which is what a value between two reads as. */
const nearestStop = (stops: readonly number[], value: number): number =>
  stops.reduce(
    (best, stop, index) =>
      Math.abs(stop - value) < Math.abs(stops[best] - value) ? index : best,
    0,
  );

/**
 * A dial that clicks between a few settings instead of sweeping a range: the
 * EQ's cuts, off and four slopes.
 *
 * Its own gesture rather than the sweep's with a flag, because it answers a
 * hand differently throughout: a drag moves a detent at a time and never
 * shows anything between two settings, a wheel notch or an arrow key is one
 * setting, and what is asked for is only ever one of them. On the sweep, a
 * dial stepping by twelve rounded to whole numbers, so it read 7 and 20 on the
 * way, asked for them, was refused, and fell back to the slope it still had
 * (Ivan, 2026-09-23: "I move and the thing go back and forward"). It is drawn
 * with the same disc and face as every other knob (`KnobView`), so only the
 * hand can tell them apart.
 */
const useSteppedDialGesture = ({
  name,
  stops,
  value,
  isDisabled,
  unit,
  defaultValue,
  handleChange,
}: ISteppedDialGesture): TDialView => {
  const inputRef = useRef<HTMLInputElement>(null);
  const last = Math.max(0, stops.length - 1);
  const index = nearestStop(stops, value);
  const progress = last > 0 ? (index / last) * 100 : 0;
  const displayValue = String(stops[index] ?? value);

  const turnTo = (next: number) => {
    const clamped = Math.min(last, Math.max(0, next));
    if (clamped !== index) {
      handleChange(stops[clamped]);
    }
  };

  const wheel = useRef(0);
  const onWheel = (event: WheelEvent<HTMLDivElement>) => {
    if (isDisabled) {
      return;
    }
    event.preventDefault();
    // A turn the other way starts from nothing rather than first paying back
    // what the last one left over.
    if (Math.sign(event.deltaY) !== Math.sign(wheel.current)) {
      wheel.current = 0;
    }
    wheel.current += event.deltaY;
    if (Math.abs(wheel.current) >= WHEEL_DETENT) {
      turnTo(index + (wheel.current < 0 ? 1 : -1));
      wheel.current = 0;
    }
  };

  /** Where the drag began, which setting it began on, and the one it is on. */
  const drag = useRef<{ y: number; from: number; at: number } | null>(null);

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (isDisabled || event.button !== 0) {
      return;
    }
    // Ctrl+click puts the dial home, as on every other dial here; handled
    // before the drag is armed so the click cannot also drag it away again.
    if ((event.ctrlKey || event.metaKey) && defaultValue !== undefined) {
      turnTo(nearestStop(stops, defaultValue));
      inputRef.current?.focus();
      event.preventDefault();
      return;
    }
    drag.current = { y: event.clientY, from: index, at: index };
    event.currentTarget.setPointerCapture(event.pointerId);
    // The range input keeps focus, so the arrow keys work after a drag.
    inputRef.current?.focus();
    event.preventDefault();
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const gesture = drag.current;
    if (!gesture) {
      return;
    }
    // Up turns it up, as on every other dial here. Measured from where the
    // drag began, so a setting reached is the same wherever the mouse
    // stopped on the way to it.
    const reached = gesture.from + (gesture.y - event.clientY) / DETENT_PX;
    if (Math.abs(reached - gesture.at) < 0.5 + DETENT_HYSTERESIS) {
      return;
    }
    const next = Math.min(last, Math.max(0, Math.round(reached)));
    if (next === gesture.at) {
      return;
    }
    gesture.at = next;
    if (stops[next] !== value) {
      handleChange(stops[next]);
    }
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
    clampedProgress: progress,
    arcStart: 0,
    arcLength: progress,
    showsArc: true,
    displayValue,
    dialProps: {
      onWheel,
      onPointerDown,
      onPointerMove,
      onPointerUp: endDrag,
      onPointerCancel: endDrag,
    },
    /**
     * The range input carries the setting's place, one per step, so an arrow
     * key moves exactly one setting; aria-* reports the setting itself.
     */
    inputProps: {
      type: 'range' as const,
      name,
      'aria-label': name,
      'aria-valuemin': stops[0] ?? 0,
      'aria-valuemax': stops[last] ?? 0,
      'aria-valuenow': value,
      'aria-valuetext': `${displayValue} ${unit}`,
      min: 0,
      max: last,
      step: 1,
      value: index,
      onChange: (event: ChangeEvent<HTMLInputElement>) =>
        turnTo(Number(event.currentTarget.value)),
      disabled: isDisabled,
    },
  };
};

export default useSteppedDialGesture;

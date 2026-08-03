/*
<AQUA: System-wide parametric audio equalizer interface>
Copyright (C) <2023>  <AQUA Dev Team>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import { ChangeEvent, WheelEvent, CSSProperties, useMemo, useRef } from 'react';
import ArrowButton from './ArrowButton';
import '../styles/RangeInput.scss';
import { clamp } from '../utils/utils';
import { getBandColor } from '../utils/bandColors';

interface IRangeInputProps {
  name: string;
  value: number;
  min: number;
  max: number;
  isDisabled: boolean;
  incrementPrecision?: number;
  displayPrecision?: number;
  height: string;
  handleChange: (newValue: number) => Promise<void>;
  handleMouseUp: (newValue: number) => Promise<void>;
  handleDragStart?: () => void;
  colorProgress?: number;
}

const RangeInput = ({
  name,
  value,
  min,
  max,
  isDisabled,
  incrementPrecision = 0,
  displayPrecision = 1,
  height,
  handleChange,
  handleMouseUp,
  handleDragStart,
  colorProgress = 0,
}: IRangeInputProps) => {
  // Store a copy of the last value so it isn't lost to the throttle
  const lastValue = useRef<number | undefined>(undefined);
  const isGestureActive = useRef(false);
  const factor = useMemo(() => 10 ** displayPrecision, [displayPrecision]);

  // Quantise the value so the css variables driving the track fill have a
  // small range to work with, which avoids the repaint jitter from jat-82.
  // One decimal keeps the thumb visually on the real value; rounding to whole
  // units made the thumb disagree with the gain shown beneath it.
  const rangeValue = useMemo(() => Math.round(value * 10) / 10, [value]);

  const increment = useMemo(
    () => 1 / 10 ** incrementPrecision,
    [incrementPrecision],
  );
  const rangeColor = useMemo(
    () => getBandColor(colorProgress),
    [colorProgress],
  );

  const onRangeInput = (e: ChangeEvent<HTMLInputElement>) => {
    const newValue: number =
      Math.round(clamp(parseFloat(e.target.value), min, max) * factor) / factor;
    lastValue.current = newValue;
    handleChange(newValue);
  };

  const onArrowInput = (isIncrement: boolean) => {
    const offset = isIncrement ? increment : -increment;
    const newValue =
      Math.round(clamp(offset + value, min, max) * factor) / factor;
    handleChange(newValue);
  };

  const beginGesture = () => {
    isGestureActive.current = true;
    handleDragStart?.();
  };

  // Always report the end of a drag, even when the pointer went down and up
  // without moving. The caller uses this to release its drag lock, so
  // swallowing the event left the slider permanently out of sync with the
  // backend value. The ref also collapses the pointerup/mouseup pair that the
  // browser fires for a single mouse gesture into one callback.
  const endGesture = () => {
    if (!isGestureActive.current) {
      return;
    }
    isGestureActive.current = false;
    const finalValue = lastValue.current;
    lastValue.current = undefined;
    handleMouseUp(finalValue === undefined ? value : finalValue);
  };

  // Keyboard and wheel changes never produce a pointer gesture, so flush the
  // pending value once the interaction settles.
  const commitPendingValue = () => {
    if (isGestureActive.current || lastValue.current === undefined) {
      return;
    }
    const finalValue = lastValue.current;
    lastValue.current = undefined;
    handleMouseUp(finalValue);
  };

  const onWheel = (e: WheelEvent) => {
    if (isDisabled) {
      return;
    }

    if (e.deltaY >= 0) {
      // scroll down
      onArrowInput(false);
    } else {
      // scroll up
      onArrowInput(true);
    }
  };

  return (
    <div
      className="col center range"
      style={
        {
          '--slider-color': rangeColor.color,
          '--slider-color-muted': rangeColor.muted,
          '--slider-track': rangeColor.track,
          // Published as a *preference*: RangeInput.scss derives the real
          // --range-length from it, which lets layout stylesheets override the
          // track length per density or breakpoint without !important.
          '--range-length-prop': height,
        } as CSSProperties
      }
    >
      <ArrowButton
        name={name}
        type="up"
        handleChange={() => onArrowInput(true)}
        isDisabled={isDisabled}
      />
      <input
        type="range"
        min={min}
        max={max}
        value={rangeValue}
        step={0.01}
        name={name}
        aria-label={name}
        onChange={onRangeInput}
        onMouseUp={endGesture}
        onPointerDown={beginGesture}
        onPointerUp={endGesture}
        onPointerCancel={endGesture}
        onKeyUp={commitPendingValue}
        onBlur={commitPendingValue}
        onWheel={onWheel}
        disabled={isDisabled}
        style={
          // Set css variables for determining upper/lower track
          {
            '--min': min,
            '--max': max,
            '--val': rangeValue,
          } as CSSProperties
        }
      />
      <ArrowButton
        name={name}
        type="down"
        handleChange={() => onArrowInput(false)}
        isDisabled={isDisabled}
      />
    </div>
  );
};

export default RangeInput;

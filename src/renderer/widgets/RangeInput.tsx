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
  colorProgress?: number;
}

interface IRangeColor {
  color: string;
  muted: string;
  track: string;
}

type Rgb = readonly [number, number, number];

// Bass, mids and treble all sample this same waveform-inspired spectrum. The
// number of bands only changes the sampling density, never the palette.
const RANGE_COLOR_STOPS: ReadonlyArray<{ position: number; color: Rgb }> = [
  { position: 0, color: [0, 229, 255] },
  { position: 0.28, color: [84, 255, 138] },
  { position: 0.52, color: [255, 230, 109] },
  { position: 0.76, color: [255, 60, 172] },
  { position: 1, color: [139, 92, 255] },
];

const getRangeColor = (progress: number): IRangeColor => {
  const normalized = Math.max(0, Math.min(1, progress));
  const rightStop =
    RANGE_COLOR_STOPS.find((stop) => stop.position >= normalized) ||
    RANGE_COLOR_STOPS[RANGE_COLOR_STOPS.length - 1];
  const rightIndex = RANGE_COLOR_STOPS.indexOf(rightStop);
  const leftStop = RANGE_COLOR_STOPS[Math.max(0, rightIndex - 1)];
  const span = rightStop.position - leftStop.position || 1;
  const amount = (normalized - leftStop.position) / span;
  const rgb = leftStop.color.map((channel, index) =>
    Math.round(channel + (rightStop.color[index] - channel) * amount),
  );
  const color = `rgb(${rgb.join(', ')})`;
  return {
    color,
    muted: `rgba(${rgb.join(', ')}, 0.38)`,
    track: `rgba(${rgb.join(', ')}, 0.1)`,
  };
};

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
  colorProgress = 0,
}: IRangeInputProps) => {
  // Store a copy of the last value so it isn't lost to the throttle
  const lastValue = useRef<number | undefined>(undefined);
  const factor = useMemo(() => 10 ** displayPrecision, [displayPrecision]);

  // Simplify the value so that the css variables have a smaller range of values to work with
  // which seems to slightly improve the jitter caused by jat-82. Ideally, we should
  // be just using the value itself (i.e. there is no reason to round)
  // TODO: fix the root cause of this error.
  const rangeValue = useMemo(() => Math.round(value), [value]);

  const increment = useMemo(
    () => 1 / 10 ** incrementPrecision,
    [incrementPrecision],
  );
  const rangeColor = useMemo(
    () => getRangeColor(colorProgress),
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

  const onMouseUp = () => {
    // Apply the last value if it there is one associated to this input
    if (lastValue.current !== undefined) {
      handleMouseUp(lastValue.current);
      lastValue.current = undefined;
    }
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
        onMouseUp={onMouseUp}
        onWheel={onWheel}
        disabled={isDisabled}
        style={
          // Set css variables for determining upper/lower track
          {
            '--min': min,
            '--max': max,
            '--val': rangeValue,
            width: `${height}`,
            margin: `calc(${height} / 2) 0px`,
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

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

import { useCallback, useEffect, useRef, useState } from 'react';
import NumberInput from '../widgets/NumberInput';
import RangeInput from '../widgets/RangeInput';
import { useAquaContext } from '../utils/AquaContext';
import '../styles/Slider.scss';

interface ISliderProps {
  name: string;
  min: number;
  max: number;
  value: number;
  isDisabled?: boolean;
  sliderHeight?: string;
  label?: string;
  showNumberInput?: boolean;
  colorProgress?: number;
  setValue: (newValue: number) => Promise<void>;
}

const Slider = ({
  name,
  min,
  max,
  value,
  sliderHeight = '150px',
  label,
  showNumberInput = true,
  isDisabled = false,
  colorProgress = 0,
  setValue,
}: ISliderProps) => {
  const { isBlockingError } = useAquaContext();

  // Local copy of slider value used so that the number input increases smoothly while throttling EQ APO writes
  const [sliderValue, setSliderValue] = useState<number>(value);
  const isDragging = useRef(false);

  useEffect(() => {
    // Backend/throttled updates can arrive out of order while dragging. The
    // local value owns the thumb until pointer-up so it never jumps backward.
    if (!isDragging.current) {
      setSliderValue(value);
    }
  }, [value]);

  const handleChangeValue = useCallback(
    async (newValue: number) => {
      await setValue(newValue);
    },
    [setValue],
  );

  const handleInput = async (newValue: number) => {
    setSliderValue(newValue);
    // Deliberately not awaited: the thumb keeps tracking the pointer while the
    // value propagates.
    // eslint-disable-next-line no-void
    void handleChangeValue(newValue);
  };

  const handleDragStart = () => {
    isDragging.current = true;
  };

  const handleDragEnd = async (newValue: number) => {
    setSliderValue(newValue);
    isDragging.current = false;
    // A press that did not move the thumb still ends the drag, but there is
    // nothing new to write.
    if (newValue !== value) {
      await handleChangeValue(newValue);
    }
  };

  return (
    <div className="col center slider">
      <RangeInput
        name={`${name}-range`}
        value={sliderValue}
        min={min}
        max={max}
        height={sliderHeight}
        handleChange={handleInput}
        handleMouseUp={handleDragEnd}
        handleDragStart={handleDragStart}
        isDisabled={isDisabled || isBlockingError}
        colorProgress={colorProgress}
        incrementPrecision={0}
        displayPrecision={2}
      />
      {label && <div>{label}</div>}
      {showNumberInput && (
        <NumberInput
          name={`${name}-number`}
          value={sliderValue}
          min={min}
          max={max}
          handleSubmit={handleInput}
          isDisabled={isDisabled || isBlockingError}
          floatPrecision={2}
          showArrows
        />
      )}
    </div>
  );
};

export default Slider;

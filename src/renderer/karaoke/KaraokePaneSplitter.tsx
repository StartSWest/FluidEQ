/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

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

import { KeyboardEvent, PointerEvent, useRef, useState } from 'react';

interface IKaraokePaneSplitterProps {
  orientation: 'horizontal' | 'vertical';
  ariaLabel: string;
  valuePercent: number;
  onStart: () => void;
  onDrag: (delta: number) => void;
  onEnd: () => void;
}

const KEYBOARD_STEP = 24;

const KaraokePaneSplitter = ({
  orientation,
  ariaLabel,
  valuePercent,
  onStart,
  onDrag,
  onEnd,
}: IKaraokePaneSplitterProps) => {
  const [isDragging, setIsDragging] = useState(false);
  const startCoordinate = useRef(0);
  const coordinate = (event: PointerEvent<HTMLDivElement>) =>
    orientation === 'vertical' ? event.clientX : event.clientY;

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture?.(event.pointerId);
    startCoordinate.current = coordinate(event);
    setIsDragging(true);
    onStart();
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (isDragging) {
      onDrag(coordinate(event) - startCoordinate.current);
    }
  };

  const finishPointerDrag = (event: PointerEvent<HTMLDivElement>) => {
    if (!isDragging) {
      return;
    }
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    setIsDragging(false);
    onEnd();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const negativeKey = orientation === 'vertical' ? 'ArrowLeft' : 'ArrowUp';
    const positiveKey = orientation === 'vertical' ? 'ArrowRight' : 'ArrowDown';
    if (event.key !== negativeKey && event.key !== positiveKey) {
      return;
    }
    event.preventDefault();
    onStart();
    onDrag(event.key === positiveKey ? KEYBOARD_STEP : -KEYBOARD_STEP);
    onEnd();
  };

  return (
    <div className={`karaoke-pane-splitter is-${orientation}`}>
      {/* eslint-disable jsx-a11y/no-noninteractive-element-interactions,
          jsx-a11y/no-noninteractive-tabindex */}
      <div
        className={`karaoke-pane-splitter__handle${
          isDragging ? ' is-dragging' : ''
        }`}
        role="separator"
        aria-label={ariaLabel}
        aria-orientation={orientation}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(valuePercent)}
        tabIndex={0}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={finishPointerDrag}
        onPointerCancel={finishPointerDrag}
        onKeyDown={onKeyDown}
      >
        <span />
      </div>
      {/* eslint-enable jsx-a11y/no-noninteractive-element-interactions,
          jsx-a11y/no-noninteractive-tabindex */}
    </div>
  );
};

export default KaraokePaneSplitter;

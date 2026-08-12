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
import '../styles/PaneResizer.scss';

/** How far one arrow-key press moves the divider. */
const KEYBOARD_STEP = 24;

interface IPaneResizerProps {
  ariaLabel: string;
  /** Where the divider sits in its range, 0–100, for assistive technology. */
  valuePercent: number;
  /**
   * Called on every move with the distance from where the drag began, not
   * since the last event.
   *
   * Deliberate: the caller resizes from the heights it recorded in `onStart`,
   * so a pointer that leaves the window and comes back, or a clamp that
   * refused part of an earlier move, cannot leave the pane drifting away from
   * the pointer. Accumulating deltas is what makes a divider slide out from
   * under the cursor.
   */
  onDrag: (deltaY: number) => void;
  /** Record the sizes the drag is measured against. */
  onStart: () => void;
  /** Persist, and drop any "being dragged" styling. */
  onEnd: () => void;
}

const PaneResizer = ({
  ariaLabel,
  valuePercent,
  onDrag,
  onStart,
  onEnd,
}: IPaneResizerProps) => {
  const [isDragging, setIsDragging] = useState(false);
  const startY = useRef(0);

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    // Capture, so the drag survives the pointer crossing anything else — most
    // of all the embedded player, which swallows every event that reaches it.
    event.currentTarget.setPointerCapture(event.pointerId);
    startY.current = event.clientY;
    setIsDragging(true);
    onStart();
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!isDragging) {
      return;
    }
    onDrag(event.clientY - startY.current);
  };

  const handlePointerUp = (event: PointerEvent<HTMLDivElement>) => {
    if (!isDragging) {
      return;
    }
    event.currentTarget.releasePointerCapture(event.pointerId);
    setIsDragging(false);
    onEnd();
  };

  // A divider that only a mouse can move is a divider some people cannot move
  // at all. One press is one step, opened and closed like a very short drag.
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') {
      return;
    }
    event.preventDefault();
    onStart();
    onDrag(event.key === 'ArrowDown' ? KEYBOARD_STEP : -KEYBOARD_STEP);
    onEnd();
  };

  return (
    // A focusable `separator` carrying `aria-valuenow` is ARIA's window
    // splitter, which is an interactive widget — but the lint rule only knows
    // the bare role, which is not. Both errors are that same misreading, so
    // both are turned off here rather than the element being made something it
    // is not: a `button` would announce itself as a button and lose the value.
    /* eslint-disable jsx-a11y/no-noninteractive-element-interactions,
       jsx-a11y/no-noninteractive-tabindex */
    <div
      className={`pane-resizer${isDragging ? ' is-dragging' : ''}`}
      role="separator"
      aria-label={ariaLabel}
      aria-orientation="horizontal"
      // What makes it a splitter rather than a decorative rule. The position is
      // reported as a percentage of the drag's range, which is the one number
      // that means anything without knowing the window's height.
      aria-valuenow={valuePercent}
      aria-valuemin={0}
      aria-valuemax={100}
      tabIndex={0}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onKeyDown={handleKeyDown}
    >
      <span />
    </div>
    /* eslint-enable jsx-a11y/no-noninteractive-element-interactions,
       jsx-a11y/no-noninteractive-tabindex */
  );
};

export default PaneResizer;

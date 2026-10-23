/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { KeyboardEvent, PointerEvent, useRef, useState } from 'react';
import '../styles/ColumnResizer.scss';

/** How far one arrow-key press moves the divider. */
const KEYBOARD_STEP = 24;

interface IColumnResizerProps {
  ariaLabel: string;
  /** Where the divider sits in its range, 0–100, for assistive technology. */
  valuePercent: number;
  /**
   * Called on every move with the distance from where the drag began, not
   * since the last event — the caller sizes from what it recorded in
   * `onStart`, so a clamp that refused part of a move cannot leave the
   * divider drifting away from the pointer (as `PaneResizer` does).
   */
  onDrag: (deltaX: number) => void;
  /** Record the size the drag is measured against. */
  onStart: () => void;
  /** Persist the size the drag left. */
  onEnd: () => void;
  /** A double-click puts the column back at its own width. */
  onReset: () => void;
}

/**
 * The divider between two side-by-side columns: `PaneResizer` turned on its
 * side. A component of its own rather than an orientation flag on that one,
 * because the axis changes every handler, the cursor and the ARIA reading.
 */
const ColumnResizer = ({
  ariaLabel,
  valuePercent,
  onDrag,
  onStart,
  onEnd,
  onReset,
}: IColumnResizerProps) => {
  const [isDragging, setIsDragging] = useState(false);
  const startX = useRef(0);

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) {
      return;
    }
    // Captured, so the drag survives the pointer crossing the stage's canvas.
    event.currentTarget.setPointerCapture(event.pointerId);
    startX.current = event.clientX;
    setIsDragging(true);
    onStart();
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (isDragging) {
      onDrag(event.clientX - startX.current);
    }
  };

  const handlePointerUp = (event: PointerEvent<HTMLDivElement>) => {
    if (!isDragging) {
      return;
    }
    event.currentTarget.releasePointerCapture(event.pointerId);
    setIsDragging(false);
    onEnd();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') {
      return;
    }
    event.preventDefault();
    onStart();
    onDrag(event.key === 'ArrowRight' ? KEYBOARD_STEP : -KEYBOARD_STEP);
    onEnd();
  };

  return (
    // ARIA's window splitter: a focusable separator with a value. The lint
    // rule knows only the bare role, which is not interactive — the same
    // misreading `PaneResizer` explains.
    /* eslint-disable jsx-a11y/no-noninteractive-element-interactions,
       jsx-a11y/no-noninteractive-tabindex */
    <div
      className={`column-resizer${isDragging ? ' is-dragging' : ''}`}
      role="separator"
      aria-label={ariaLabel}
      aria-orientation="vertical"
      aria-valuenow={valuePercent}
      aria-valuemin={0}
      aria-valuemax={100}
      tabIndex={0}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onKeyDown={handleKeyDown}
      onDoubleClick={onReset}
    >
      <span />
    </div>
    /* eslint-enable jsx-a11y/no-noninteractive-element-interactions,
       jsx-a11y/no-noninteractive-tabindex */
  );
};

export default ColumnResizer;

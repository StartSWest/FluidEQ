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

import {
  useEffect,
  useRef,
  type Dispatch,
  type KeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent,
  type SetStateAction,
  type WheelEvent,
} from 'react';
import { dragUnit, flickTarget } from './coverFlow/coverFlowGeometry';
import { clampIndex, type ICoverFlowItem } from './coverFlowItems';

/** Wheel distance, in the units a mouse notch reports, that moves the centre
 * by one cover. A trackpad's much smaller per-frame deltas simply accumulate
 * across events until they cross it, rather than each one moving a step. */
const COVER_FLOW_WHEEL_STEP = 80;
/** Pointer movement, in pixels, below which a press-and-release still counts
 * as the click that opens or selects a cover rather than a drag. */
const COVER_FLOW_DRAG_CLICK_TOLERANCE = 6;
/** How far past either end a drag may pull the row, in covers: enough to
 * feel the end give, not enough to lose it. */
const COVER_FLOW_OVERPULL = 0.4;

export interface ICoverFlowGesturesInput {
  currentIndex: number;
  count: number;
  setCentre: (index: number) => void;
  /** The centre's own primary action — see `activateCurrent`. */
  activateCurrent: (pressCount: number) => void;
  /** Which cover is drawn under a point (the scene's own answer), or
   * nothing while there is no scene to ask. */
  coverIndexAt: (clientX: number, clientY: number) => number | undefined;
  /** A drag's own fractional place in the row, followed frame by frame by
   * the scene, and `undefined` once it lets go. */
  onDragPosition: (position: number | undefined) => void;
  expandedId: string | undefined;
  openPanel: (next: string | undefined) => void;
  itemAt: (index: number) => ICoverFlowItem | undefined;
  setHoveredIndex: Dispatch<SetStateAction<number | undefined>>;
}

/**
 * How the row is turned: the arrow keys and Home/End, on the stage and at
 * window level, the mouse wheel, a pointer drag with the momentum of a
 * flick, and a press on a cover — the stage's handlers, and the step the
 * arrow buttons take.
 */
const useCoverFlowGestures = ({
  currentIndex,
  count,
  setCentre,
  activateCurrent,
  coverIndexAt,
  onDragPosition,
  expandedId,
  openPanel,
  itemAt,
  setHoveredIndex,
}: ICoverFlowGesturesInput) => {
  const moveBy = (delta: number) => {
    setCentre(currentIndex + delta);
  };
  /** The window-level key handler is bound once and would otherwise close
   * over the `moveBy` from that first render, and with it a `currentIndex`
   * that never changes — every press would move to the same cover. */
  const moveByRef = useRef(moveBy);
  moveByRef.current = moveBy;

  /**
   * Left and right move the row, whether or not it has been clicked first —
   * the stage's own keys, at window level, refusing whenever the key belongs
   * to somebody else: any text field, anything being edited, and any
   * modifier combination, which are shortcuts rather than navigation.
   */
  useEffect(() => {
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') {
        return;
      }
      if (event.altKey || event.ctrlKey || event.metaKey) {
        return;
      }
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName;
      if (
        tag === 'INPUT' ||
        tag === 'TEXTAREA' ||
        tag === 'SELECT' ||
        target?.isContentEditable
      ) {
        return;
      }
      // The stage's own handler already has it, and running both would move
      // the row two covers for one press.
      if (target?.closest('.library-coverflow__stage')) {
        return;
      }
      event.preventDefault();
      moveByRef.current(event.key === 'ArrowRight' ? 1 : -1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const onStageKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (
      event.key === 'ArrowRight' ||
      event.key === 'ArrowDown' ||
      event.key === 'ArrowLeft' ||
      event.key === 'ArrowUp'
    ) {
      event.preventDefault();
      const forward = event.key === 'ArrowRight' || event.key === 'ArrowDown';
      moveBy(forward ? 1 : -1);
      return;
    }
    if (event.key === 'Home') {
      event.preventDefault();
      setCentre(0);
      return;
    }
    if (event.key === 'End') {
      event.preventDefault();
      setCentre(count - 1);
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      activateCurrent(1);
    }
  };

  // Trackpad ticks are far smaller than one mouse notch, so they accumulate
  // here until their sum crosses `COVER_FLOW_WHEEL_STEP` rather than each one
  // moving the centre — otherwise a single swipe would fly past a hundred
  // covers.
  const wheelAccumulator = useRef(0);
  const onStageWheel = (event: WheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    const delta =
      Math.abs(event.deltaY) > Math.abs(event.deltaX)
        ? event.deltaY
        : event.deltaX;
    wheelAccumulator.current += delta;
    if (Math.abs(wheelAccumulator.current) >= COVER_FLOW_WHEEL_STEP) {
      moveBy(wheelAccumulator.current > 0 ? 1 : -1);
      wheelAccumulator.current = 0;
    }
  };

  // A drag in progress: the index and pointer position it began from, so
  // every move is measured from that start rather than accumulated move to
  // move — see `PaneResizer.onDrag` for why that avoids drift. `moved` marks
  // whether the drag travelled far enough that the pointerup afterwards is a
  // drag ending, not a click. `velocity` is covers per second, smoothed over
  // the last few moves, so the flick that ends a drag carries on.
  const dragState = useRef<
    | {
        pointerId: number;
        startX: number;
        startIndex: number;
        moved: boolean;
        position: number;
        lastX: number;
        lastTime: number;
        velocity: number;
      }
    | undefined
  >(undefined);
  // Set for the one click that follows a real drag's pointerup, so releasing
  // over a cover does not also open or re-target it.
  const suppressNextClick = useRef(false);

  /**
   * A press begins a *possible* drag. The pointer is deliberately NOT
   * captured here: capturing on pointerdown retargets the `click` that
   * follows to the stage too, and a press that never becomes a drag has to
   * stay a click. Capture is taken in `onStagePointerMove`, at the moment a
   * drag actually becomes a drag.
   */
  const onStagePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    dragState.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startIndex: currentIndex,
      moved: false,
      position: currentIndex,
      lastX: event.clientX,
      lastTime: event.timeStamp,
      velocity: 0,
    };
  };

  const onStagePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const drag = dragState.current;
    if (!drag || drag.pointerId !== event.pointerId) {
      // Not dragging, so this is just the pointer passing over the row.
      setHoveredIndex(coverIndexAt(event.clientX, event.clientY));
      return;
    }
    const distance = event.clientX - drag.startX;
    if (!drag.moved) {
      if (Math.abs(distance) < COVER_FLOW_DRAG_CLICK_TOLERANCE) {
        return;
      }
      // Now it is a drag, and now the stage wants the pointer: the row has
      // to keep following a pointer that leaves it, and the `click` this
      // would otherwise end with is one the reader no longer means.
      event.currentTarget.setPointerCapture(event.pointerId);
      drag.moved = true;
      setHoveredIndex(undefined);
    }
    const unit = dragUnit(event.currentTarget.clientWidth);
    // Dragging the row left (negative distance) reveals what is further
    // along it, the same way pulling a filmstrip left brings the next frame
    // into the centre — hence the subtraction rather than addition. The row
    // follows the pointer continuously, through every angle in between.
    const position = Math.max(
      -COVER_FLOW_OVERPULL,
      Math.min(
        count - 1 + COVER_FLOW_OVERPULL,
        drag.startIndex - distance / unit,
      ),
    );
    const seconds = Math.max(0.001, (event.timeStamp - drag.lastTime) / 1000);
    const instant = -(event.clientX - drag.lastX) / unit / seconds;
    drag.velocity = drag.velocity * 0.7 + instant * 0.3;
    drag.lastX = event.clientX;
    drag.lastTime = event.timeStamp;
    drag.position = position;
    onDragPosition(position);
    setCentre(Math.round(position));
  };

  const endDrag = (event: PointerEvent<HTMLDivElement>) => {
    const drag = dragState.current;
    if (!drag || drag.pointerId !== event.pointerId) {
      return;
    }
    // Only if it was ever taken — a press that never became a drag never
    // captured, and releasing a capture that does not exist throws.
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    suppressNextClick.current = drag.moved;
    dragState.current = undefined;
    if (drag.moved) {
      // A pointer held still before letting go has no flick left in it.
      const isHeld = event.timeStamp - drag.lastTime > 80;
      setCentre(flickTarget(drag.position, isHeld ? 0 : drag.velocity, count));
      onDragPosition(undefined);
    }
  };

  const onCoverClick = (index: number, pressCount: number) => {
    if (suppressNextClick.current) {
      suppressNextClick.current = false;
      return;
    }
    if (index === currentIndex) {
      activateCurrent(pressCount);
      return;
    }
    setCentre(index);
    // A click is a choice, so it moves the panel with it — but only if one is
    // already open. Turning the row by any other means leaves the panel
    // showing what it was showing; see `expandedId`.
    if (expandedId !== undefined) {
      openPanel(itemAt(clampIndex(index, count))?.id);
    }
  };

  const onStageClick = (event: ReactMouseEvent<HTMLDivElement>) => {
    const index = coverIndexAt(event.clientX, event.clientY);
    if (index !== undefined) {
      onCoverClick(index, event.detail);
    }
  };

  return {
    moveBy,
    onStageKeyDown,
    onStageWheel,
    onStagePointerDown,
    onStagePointerMove,
    endDrag,
    onStageClick,
  };
};

export default useCoverFlowGestures;

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
  type RefObject,
  type SetStateAction,
  type WheelEvent,
} from 'react';
import { clampIndex, type ICoverFlowItem } from './coverFlowItems';

/** Wheel distance, in the units a mouse notch reports, that moves the centre
 * by one cover. A trackpad's much smaller per-frame deltas simply accumulate
 * across events until they cross it, rather than each one moving a step. */
const COVER_FLOW_WHEEL_STEP = 80;
/** Drag distance, in pixels, that moves the centre by one cover. Measured
 * from where the drag began — the same "distance from where the drag began,
 * not since the last event" rule `PaneResizer` uses — so a pointer that
 * pauses mid-drag does not keep advancing on its own. */
const COVER_FLOW_DRAG_STEP = 70;
/** Pointer movement, in pixels, below which a press-and-release still counts
 * as the click that opens or selects a cover rather than a drag. */
const COVER_FLOW_DRAG_CLICK_TOLERANCE = 6;

export interface ICoverFlowGesturesInput {
  currentIndex: number;
  count: number;
  /** The first cover mounted, which `coverIndexAt` counts from. */
  start: number;
  setCentre: (index: number) => void;
  /** The centre's own primary action — see `activateCurrent`. */
  activateCurrent: (pressCount: number) => void;
  /** The covers' shared parent, measured on every press. */
  trackRef: RefObject<HTMLDivElement | null>;
  expandedId: string | undefined;
  openPanel: (next: string | undefined) => void;
  itemAt: (index: number) => ICoverFlowItem | undefined;
  setHoveredIndex: Dispatch<SetStateAction<number | undefined>>;
}

/**
 * How the row is turned: the arrow keys and Home/End, on the stage and at
 * window level, the mouse wheel, a pointer drag, and a press on a cover —
 * the stage's handlers, and the step the arrow buttons take.
 */
const useCoverFlowGestures = ({
  currentIndex,
  count,
  start,
  setCentre,
  activateCurrent,
  trackRef,
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
  // drag ending, not a click.
  const dragState = useRef<
    | { pointerId: number; startX: number; startIndex: number; moved: boolean }
    | undefined
  >(undefined);
  // Set for the one click that follows a real drag's pointerup, so releasing
  // over a cover does not also open or re-target it.
  const suppressNextClick = useRef(false);

  /**
   * Which cover the pointer is over, worked out from where the covers have
   * actually landed on screen rather than from what the event says it hit.
   *
   * Chromium will not route real input to these covers. They are rotated in
   * 3D inside a `preserve-3d` subtree, and while `elementFromPoint` happily
   * reports the side cover under a given point, the compositor's own hit test
   * — the one that decides what a mouse press targets — does not: every press
   * on a side cover arrived with the track as its target, so the per-cover
   * `onClick` never fired and only the unrotated centre cover could be
   * pressed at all. Confirmed against the running window, not inferred: a
   * real `Input.dispatchMouseEvent` on a side cover's artwork reported
   * `closest('.library-coverflow__cover') === null`, at coordinates where
   * `elementsFromPoint` listed that very cover.
   *
   * So the stage takes the press and answers the question itself. Each
   * cover's projected centre is read from its own client rect — which IS
   * accurate, and matches what is drawn — and the nearest one horizontally
   * wins. That also makes the whole vertical strip above and below a cover
   * live, which is the behaviour wanted anyway: pressing near a cover in a
   * fanned row should take you to it.
   */
  const coverIndexAt = (clientX: number): number | undefined => {
    const track = trackRef.current;
    if (!track) {
      return undefined;
    }
    const covers = track.querySelectorAll<HTMLElement>(
      '.library-coverflow__cover',
    );
    let bestIndex: number | undefined;
    let bestDistance = Number.POSITIVE_INFINITY;
    covers.forEach((element, offset) => {
      const rect = element.getBoundingClientRect();
      const distance = Math.abs(clientX - (rect.left + rect.width / 2));
      if (distance < bestDistance) {
        bestDistance = distance;
        bestIndex = start + offset;
      }
    });
    return bestIndex;
  };

  /**
   * A press begins a *possible* drag. The pointer is deliberately NOT
   * captured here.
   *
   * Capturing on pointerdown retargets every following pointer event to the
   * stage — and, per the pointer-events spec, the `click` that follows is
   * dispatched at the capture target too. So every cover's own `onClick` was
   * dead: pressing any cover, centre or side, did nothing at all, and the
   * only way to move the row was the keyboard, the wheel or a drag. Capture
   * is taken in `onStagePointerMove` instead, at the moment a drag actually
   * becomes a drag, which is the only moment it is needed for.
   */
  const onStagePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    dragState.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startIndex: currentIndex,
      moved: false,
    };
  };

  const onStagePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const drag = dragState.current;
    if (!drag || drag.pointerId !== event.pointerId) {
      // Not dragging, so this is just the pointer passing over the row. Which
      // cover it is over has to be worked out the same way a press does —
      // see `coverIndexAt` for why a CSS `:hover` rule only ever lit the
      // centre cover.
      setHoveredIndex(coverIndexAt(event.clientX));
      return;
    }
    const distance = event.clientX - drag.startX;
    if (Math.abs(distance) >= COVER_FLOW_DRAG_CLICK_TOLERANCE) {
      // Now it is a drag, and now the stage wants the pointer: the row has to
      // keep following a pointer that leaves it, and the `click` this would
      // otherwise end with is one the reader no longer means. Taken here
      // rather than on pointerdown — see `onStagePointerDown`.
      if (!drag.moved) {
        event.currentTarget.setPointerCapture(event.pointerId);
      }
      drag.moved = true;
    }
    // Dragging the row left (negative distance) reveals what is further
    // along it, the same way pulling a filmstrip left brings the next frame
    // into the centre — hence the subtraction rather than addition.
    const target =
      drag.startIndex - Math.round(distance / COVER_FLOW_DRAG_STEP);
    setCentre(target);
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
    const index = coverIndexAt(event.clientX);
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

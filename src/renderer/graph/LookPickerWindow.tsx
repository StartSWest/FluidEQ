/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent, ReactNode } from 'react';
import { readStored, removeStored, writeStored } from '../utils/graphStorage';
import AnchoredMenu, {
  type IMenuFrame,
  MENU_MARGIN,
} from '../widgets/AnchoredMenu';

/**
 * The look picker's window, which the reader sizes (Ivan, 2026-11-19: "make
 * the windows resizable too"): dragged at either side, at the edge away from
 * its trigger or at the corners between them, and opened at that size again
 * next time. Where it stands stays its trigger's - right-aligned under or
 * over it - so only the size is remembered; a side dragged outwards moves
 * that side alone for as long as the picker is on the page.
 *
 * The grips stand just outside the window's edge, as Windows' own resize
 * borders do, so they never cover the rail, the lists' scrollbars or the
 * foot's buttons. A double press on one puts the window back to its first
 * size.
 */

const SIZE_KEY = 'fluideq.lookPicker.size';

/** The size it has always opened at, before anybody sized it. */
const DEFAULT_WIDTH = 880;
const DEFAULT_HEIGHT = 600;

/**
 * The smallest window is the one the narrowest app window (720px) opened it
 * at, which the layout was drawn for: the rail, then a name, its mark, a
 * maker and a version side by side (Kind goes first, `_lookPickerTiles.scss`).
 * At 600 the name and the maker were down to three letters each. The largest
 * is three screens of pictures, past which a picker is a page.
 */
const MIN_WIDTH = 700;
const MIN_HEIGHT = 400;
const MAX_WIDTH = 1440;
const MAX_HEIGHT = 1000;

type TGrip =
  | 'left'
  | 'right'
  | 'top'
  | 'bottom'
  | 'top-left'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-right';

const GRIPS: readonly TGrip[] = [
  'left',
  'right',
  'top',
  'bottom',
  'top-left',
  'top-right',
  'bottom-left',
  'bottom-right',
];

const clampSize = (value: number, low: number, high: number) =>
  Math.min(high, Math.max(low, value));

/** `lo` gives way to `hi`: the window's edge wins over the smallest size. */
const clampEdge = (value: number, lo: number, hi: number) =>
  Math.max(Math.min(lo, hi), Math.min(hi, value));

const readSize = (): Pick<IMenuFrame, 'width' | 'height'> => {
  const [width, height] = (readStored(SIZE_KEY) ?? '').split('x').map(Number);
  return Number.isFinite(width) &&
    Number.isFinite(height) &&
    width > 0 &&
    height > 0
    ? {
        width: clampSize(width, MIN_WIDTH, MAX_WIDTH),
        height: clampSize(height, MIN_HEIGHT, MAX_HEIGHT),
      }
    : { width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT };
};

interface IDrag {
  grip: TGrip;
  pointerId: number;
  x: number;
  y: number;
  /** Where the window stood when the drag began. */
  rect: DOMRect;
  /** The trigger's right edge, which the window's is measured from. */
  anchorRight: number;
  /** The room on the window's side, which AnchoredMenu caps it to. */
  room: number;
}

interface ILookPickerWindowProps {
  anchor: HTMLElement | null;
  isOpen: boolean;
  ariaLabel: string;
  children: ReactNode;
}

export default function LookPickerWindow({
  anchor,
  isOpen,
  ariaLabel,
  children,
}: ILookPickerWindowProps) {
  const [frame, setFrame] = useState<IMenuFrame>(() => ({
    ...readSize(),
    nudge: 0,
  }));
  const dragRef = useRef<IDrag | undefined>(undefined);
  /** What the drag last asked for, written to storage once it ends. */
  const sizedRef = useRef(frame);

  const begin = (grip: TGrip, event: ReactPointerEvent<HTMLElement>) => {
    const menu = event.currentTarget.closest<HTMLElement>(
      '[data-anchored-menu]',
    );
    if (!menu || !anchor || event.button !== 0) {
      return;
    }
    // No text selected, and the caret left in the search.
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    const rect = menu.getBoundingClientRect();
    const cap = Number.parseFloat(getComputedStyle(menu).maxHeight);
    dragRef.current = {
      grip,
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      rect,
      anchorRight: anchor.getBoundingClientRect().right,
      room: Number.isFinite(cap) ? cap : rect.height,
    };
  };

  /**
   * The drag this event belongs to: one whose grip still holds the pointer.
   * A drag the picker closed in the middle of (Escape) never sees its
   * pointer let go - the grip is gone - and without the capture check the
   * mouse, whose pointer id never changes, would resume it the next time it
   * crossed a grip, from where the window stood then.
   */
  const heldBy = (event: ReactPointerEvent<HTMLElement>) => {
    const drag = dragRef.current;
    return drag?.pointerId === event.pointerId &&
      event.currentTarget.hasPointerCapture(event.pointerId)
      ? drag
      : undefined;
  };

  const move = (event: ReactPointerEvent<HTMLElement>) => {
    const drag = heldBy(event);
    if (!drag) {
      return;
    }
    const { grip, rect, room } = drag;
    const dx = event.clientX - drag.x;
    const dy = event.clientY - drag.y;
    let { left, right, top, bottom } = rect;
    if (grip.includes('left')) {
      left = clampEdge(
        rect.left + dx,
        Math.max(MENU_MARGIN, rect.right - MAX_WIDTH),
        rect.right - MIN_WIDTH,
      );
    }
    if (grip.includes('right')) {
      right = clampEdge(
        rect.right + dx,
        rect.left + MIN_WIDTH,
        Math.min(window.innerWidth - MENU_MARGIN, rect.left + MAX_WIDTH),
      );
    }
    // Only the edge away from the trigger has a grip (`data-side`), and the
    // window is held to the room on its side.
    if (grip.includes('bottom')) {
      bottom = clampEdge(
        rect.bottom + dy,
        rect.top + MIN_HEIGHT,
        rect.top + Math.min(room, MAX_HEIGHT),
      );
    }
    if (grip.includes('top')) {
      top = clampEdge(
        rect.top + dy,
        rect.bottom - Math.min(room, MAX_HEIGHT),
        rect.bottom - MIN_HEIGHT,
      );
    }
    const horizontal = grip.includes('left') || grip.includes('right');
    const vertical = grip.includes('top') || grip.includes('bottom');
    const next: IMenuFrame = {
      width: horizontal ? right - left : frame.width,
      height: vertical ? bottom - top : frame.height,
      nudge: horizontal ? right - drag.anchorRight : frame.nudge,
    };
    sizedRef.current = next;
    setFrame(next);
  };

  const end = (event: ReactPointerEvent<HTMLElement>) => {
    if (!heldBy(event)) {
      return;
    }
    dragRef.current = undefined;
    event.currentTarget.releasePointerCapture(event.pointerId);
    const { width, height } = sizedRef.current;
    writeStored(SIZE_KEY, `${Math.round(width)}x${Math.round(height)}`);
  };

  const reset = () => {
    removeStored(SIZE_KEY);
    const first = { width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT, nudge: 0 };
    sizedRef.current = first;
    setFrame(first);
  };

  return (
    <AnchoredMenu
      anchor={anchor}
      isOpen={isOpen}
      className="graph-look-menu look-picker__menu"
      role="dialog"
      ariaLabel={ariaLabel}
      frame={frame}
    >
      {children}
      {GRIPS.map((grip) => (
        // A pointer's affordance only: the window is as usable at any size,
        // and the keyboard already walks everything inside it.
        <span
          key={grip}
          className={`look-picker__grip look-picker__grip--${grip}`}
          aria-hidden="true"
          onPointerDown={(event) => begin(grip, event)}
          onPointerMove={move}
          onPointerUp={end}
          onPointerCancel={end}
          onDoubleClick={reset}
        />
      ))}
    </AnchoredMenu>
  );
}

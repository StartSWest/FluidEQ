/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useRef, useState } from 'react';
import type {
  KeyboardEvent as ReactKeyboardEvent,
  PointerEvent as ReactPointerEvent,
  ReactNode,
} from 'react';
import { useTranslation } from '../utils/I18nContext';
import AnchoredMenu from '../widgets/AnchoredMenu';
import {
  bandOf,
  type IMenuFrame,
  menuRoom,
  type TMenuSide,
} from '../widgets/menuFrame';
import {
  DEFAULT_FRAME,
  dragFrame,
  farEdge,
  forgetFrame,
  type IResizeStart,
  KEY_STEP,
  MAX_HEIGHT,
  MAX_WIDTH,
  MIN_HEIGHT,
  MIN_WIDTH,
  readFrame,
  stepFrame,
  type TGrip,
  writeFrame,
} from './lookPickerResize';

/**
 * The look picker's window, which the reader sizes (Ivan, 2026-11-19: "make
 * the windows resizable too") and flips (2026-11-23: "it shows above or
 * below depending on what the user intends"): dragged at either side, at
 * the edge away from its select or at the corners between them, and opened
 * that way again next time. It always hangs from its select and never covers
 * it - "the select must always be the anchor and be seen" - so the edge
 * beside the select has no grip; the far edge dragged back across the select
 * flips the window to the select's other side (`menuFrame.ts`).
 *
 * The grips stand just outside the window's edge, as Windows' own resize
 * borders do, so they never cover the rail, the lists' scrollbars or the
 * foot's buttons. A double press on one puts the window back to its first
 * size, under the select. The far edge and the sides take the keyboard as
 * the app's other splitters do - focused, the arrows move them - and the
 * corners, which are two edges at once, are the pointer's alone.
 */

const EDGES = ['top', 'bottom', 'left', 'right'] as const;
type TEdge = (typeof EDGES)[number];
const CORNERS = [
  'top-left',
  'top-right',
  'bottom-left',
  'bottom-right',
] as const;

const EDGE_LABEL = {
  top: 'graph.picker.edgeTop',
  bottom: 'graph.picker.edgeBottom',
  left: 'graph.picker.edgeLeft',
  right: 'graph.picker.edgeRight',
} as const;

interface IDrag {
  grip: TGrip;
  pointerId: number;
  x: number;
  y: number;
  start: IResizeStart;
}

const menuOf = (element: HTMLElement) =>
  element.closest<HTMLElement>('[data-anchored-menu]');

/** Where everything stood as a resize began, or nothing to resize. */
const startOf = (
  grip: HTMLElement,
  anchor: HTMLElement | null,
): IResizeStart | undefined => {
  const menu = menuOf(grip);
  if (!menu || !anchor) {
    return undefined;
  }
  const rect = menu.getBoundingClientRect();
  const select = anchor.getBoundingClientRect();
  // The side it is drawn on, which is not the one asked for when that side
  // had no room for it (`placeFrame`).
  const side: TMenuSide = menu.dataset.side === 'up' ? 'up' : 'down';
  return {
    rect: {
      left: rect.left,
      right: rect.right,
      top: rect.top,
      bottom: rect.bottom,
    },
    side,
    band: bandOf(select),
    anchorRight: select.right,
    room: menuRoom(),
    viewWidth: window.innerWidth,
  };
};

/**
 * The grip that lights while `held` is dragged: the edge or corner that is
 * actually moving. After a flip the grip holding the pointer stands beside
 * the select, where nothing moves, so the light goes to the far edge of the
 * side the window is on now.
 */
const litBy = (held: TGrip, side: TMenuSide): TGrip => {
  if (held === 'left' || held === 'right') {
    return held;
  }
  if (held.endsWith('left')) {
    return `${farEdge(side)}-left`;
  }
  return held.endsWith('right') ? `${farEdge(side)}-right` : farEdge(side);
};

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
  const { t } = useTranslation();
  const [frame, setFrame] = useState<IMenuFrame>(readFrame);
  const [held, setHeld] = useState<TGrip | undefined>(undefined);
  const dragRef = useRef<IDrag | undefined>(undefined);
  /** What the drag last asked for, written to storage once it ends. */
  const sizedRef = useRef(frame);

  const show = (next: IMenuFrame) => {
    sizedRef.current = next;
    setFrame(next);
  };

  const begin = (grip: TGrip, event: ReactPointerEvent<HTMLElement>) => {
    const start = startOf(event.currentTarget, anchor);
    if (!start || event.button !== 0) {
      return;
    }
    // No text selected, and the caret left in the search.
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      grip,
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      start,
    };
    setHeld(grip);
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
    if (drag) {
      show(
        dragFrame(
          frame,
          drag.grip,
          drag.start,
          event.clientX - drag.x,
          event.clientY - drag.y,
        ),
      );
    }
  };

  const end = (event: ReactPointerEvent<HTMLElement>) => {
    if (!heldBy(event)) {
      return;
    }
    dragRef.current = undefined;
    setHeld(undefined);
    event.currentTarget.releasePointerCapture(event.pointerId);
    writeFrame(sizedRef.current);
  };

  /**
   * An arrow on a focused edge moves it a step, from where the window
   * stands now, and is remembered at once: a step is a whole resize. A step
   * that flips the window hands the focus to the far edge of its new side,
   * once that edge is drawn - the one focused is beside the select now, and
   * has no grip there.
   */
  const step = (edge: TEdge, event: ReactKeyboardEvent<HTMLElement>) => {
    const upright = edge === 'top' || edge === 'bottom';
    const back = upright ? 'ArrowUp' : 'ArrowLeft';
    const forth = upright ? 'ArrowDown' : 'ArrowRight';
    if (event.key !== back && event.key !== forth) {
      return;
    }
    const start = startOf(event.currentTarget, anchor);
    const menu = menuOf(event.currentTarget);
    if (!start || !menu) {
      return;
    }
    // Held here: the picker's own walk would otherwise read the arrow too.
    event.preventDefault();
    event.stopPropagation();
    const next = stepFrame(
      frame,
      edge,
      start,
      event.key === forth ? KEY_STEP : -KEY_STEP,
    );
    show(next);
    writeFrame(next);
    if (next.side !== start.side) {
      requestAnimationFrame(() => {
        menu
          .querySelector<HTMLElement>(
            `.look-picker__grip--${farEdge(next.side)}`,
          )
          ?.focus();
      });
    }
  };

  const reset = () => {
    forgetFrame();
    show(DEFAULT_FRAME);
  };

  const lit = held ? litBy(held, frame.side) : undefined;
  const gripClass = (grip: TGrip) =>
    `look-picker__grip look-picker__grip--${grip}${
      grip === held ? ' is-held' : ''
    }${grip === lit ? ' is-lit' : ''}`;

  return (
    <AnchoredMenu
      anchor={anchor}
      isOpen={isOpen}
      className={`graph-look-menu look-picker__menu${
        held ? ' look-picker__menu--resizing' : ''
      }`}
      role="dialog"
      ariaLabel={ariaLabel}
      frame={frame}
      minFrameHeight={MIN_HEIGHT}
    >
      {children}
      {EDGES.map((edge) => {
        const upright = edge === 'top' || edge === 'bottom';
        const [value, low, high] = upright
          ? [frame.height, MIN_HEIGHT, MAX_HEIGHT]
          : [frame.width, MIN_WIDTH, MAX_WIDTH];
        return (
          // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- a focusable separator is the ARIA window splitter, which the plugin counts as static
          <span
            key={edge}
            className={gripClass(edge)}
            role="separator"
            aria-label={t(EDGE_LABEL[edge])}
            aria-orientation={upright ? 'horizontal' : 'vertical'}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(
              (Math.min(high, Math.max(low, value)) - low) /
                ((high - low) / 100),
            )}
            // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- the window splitter pattern: a separator that moves takes the focus
            tabIndex={0}
            onKeyDown={(event) => step(edge, event)}
            onPointerDown={(event) => begin(edge, event)}
            onPointerMove={move}
            onPointerUp={end}
            onPointerCancel={end}
            onDoubleClick={reset}
          />
        );
      })}
      {CORNERS.map((corner) => (
        // Two edges at once: the keyboard has both already.
        <span
          key={corner}
          className={gripClass(corner)}
          aria-hidden="true"
          onPointerDown={(event) => begin(corner, event)}
          onPointerMove={move}
          onPointerUp={end}
          onPointerCancel={end}
          onDoubleClick={reset}
        />
      ))}
    </AnchoredMenu>
  );
}

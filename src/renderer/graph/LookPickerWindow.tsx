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
import { bandOf, menuRoom, type TMenuFrame } from '../widgets/menuFrame';
import {
  DEFAULT_FRAME,
  forgetFrame,
  type IResizeStart,
  KEY_STEP,
  MAX_HEIGHT,
  MAX_WIDTH,
  MIN_HEIGHT,
  MIN_WIDTH,
  readFrame,
  resizeFrame,
  type TGrip,
  writeFrame,
} from './lookPickerResize';

/**
 * The look picker's window, which the reader sizes and places (Ivan,
 * 2026-11-19: "make the windows resizable too"; 2026-11-23: "resize it down
 * so it shows below the select or up so it shows on top of the select"):
 * dragged at any edge or corner, and opened that way again next time. The
 * top and bottom edges both move, the one beside the select too, so the
 * window can hang under the select, stand over it, or reach past it both
 * ways and cover it - an edge that reaches the select goes past it in one
 * step, at its middle, and never stops halfway across it
 * (`menuFrame.ts`).
 *
 * The grips stand just outside the window's edge, as Windows' own resize
 * borders do, so they never cover the rail, the lists' scrollbars or the
 * foot's buttons. A double press on one puts the window back to its first
 * size and place. The four edges take the keyboard as the app's other
 * splitters do - focused, the arrows move them - and the corners, which are
 * two edges at once, are the pointer's alone.
 */

const EDGES = ['top', 'bottom', 'left', 'right'] as const;
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

/**
 * The height the window asks for, as a separator's value: over its select
 * this leaves the select's own band out, which a value read aloud as a
 * share of the range does not miss.
 */
const heightOf = (frame: TMenuFrame) => (frame.above ?? 0) + (frame.below ?? 0);

/** Where everything stood as a resize began, or nothing to resize. */
const startOf = (
  grip: HTMLElement,
  anchor: HTMLElement | null,
): IResizeStart | undefined => {
  const menu = grip.closest<HTMLElement>('[data-anchored-menu]');
  if (!menu || !anchor) {
    return undefined;
  }
  const rect = menu.getBoundingClientRect();
  const select = anchor.getBoundingClientRect();
  return {
    rect: {
      left: rect.left,
      right: rect.right,
      top: rect.top,
      bottom: rect.bottom,
    },
    band: bandOf(select),
    anchorRight: select.right,
    room: menuRoom(),
    viewWidth: window.innerWidth,
  };
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
  const [frame, setFrame] = useState<TMenuFrame>(readFrame);
  const dragRef = useRef<IDrag | undefined>(undefined);
  /** What the drag last asked for, written to storage once it ends. */
  const sizedRef = useRef(frame);

  const show = (next: TMenuFrame) => {
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
        resizeFrame(
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
    event.currentTarget.releasePointerCapture(event.pointerId);
    writeFrame(sizedRef.current);
  };

  /**
   * An arrow on a focused edge moves it a step, from where the window
   * stands now, and is remembered at once: a step is a whole resize.
   */
  const step = (
    edge: (typeof EDGES)[number],
    event: ReactKeyboardEvent<HTMLElement>,
  ) => {
    const upright = edge === 'top' || edge === 'bottom';
    const back = upright ? 'ArrowUp' : 'ArrowLeft';
    const forth = upright ? 'ArrowDown' : 'ArrowRight';
    if (event.key !== back && event.key !== forth) {
      return;
    }
    const start = startOf(event.currentTarget, anchor);
    if (!start) {
      return;
    }
    // Held here: the picker's own walk would otherwise read the arrow too.
    event.preventDefault();
    event.stopPropagation();
    const delta = event.key === forth ? KEY_STEP : -KEY_STEP;
    const next = resizeFrame(
      frame,
      edge,
      start,
      upright ? 0 : delta,
      upright ? delta : 0,
      delta > 0 ? 'down' : 'up',
    );
    show(next);
    writeFrame(next);
  };

  const reset = () => {
    forgetFrame();
    show(DEFAULT_FRAME);
  };

  const height = heightOf(frame);

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
      {EDGES.map((edge) => {
        const upright = edge === 'top' || edge === 'bottom';
        const [value, low, high] = upright
          ? [height, MIN_HEIGHT, MAX_HEIGHT]
          : [frame.width, MIN_WIDTH, MAX_WIDTH];
        return (
          // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- a focusable separator is the ARIA window splitter, which the plugin counts as static
          <span
            key={edge}
            className={`look-picker__grip look-picker__grip--${edge}`}
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
          className={`look-picker__grip look-picker__grip--${corner}`}
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

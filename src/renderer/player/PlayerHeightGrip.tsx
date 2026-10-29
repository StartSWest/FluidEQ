/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useRef } from 'react';
import type { PointerEvent } from 'react';
import { useTranslation } from '../utils/I18nContext';
import {
  resizePlayerWindow,
  resizePlayerWindowFromTop,
} from './windowModeStore';

/** A drag of the grip under way: where it began, and the height asked for. */
interface IGripDrag {
  pointerId: number;
  startY: number;
  startHeight: number;
  wanted?: number;
  frame?: number;
}

/**
 * THE AMP'S HEIGHT, DRAGGED BY ITS FOOT OR ITS HEAD (Ivan, 2026-10-25: "don't
 * show x resize mouse icon on the width", "we need to be able to resize from
 * the top too"). The amp has one width, so it is not resizable to the system
 * at all — that is the only way no edge of it offers the sideways cursor
 * (`applyLimits`) — and its height, which is the listener's, is dragged here
 * instead: a strip along the window's bottom or top edge, where the system's
 * own would be, with the up-and-down cursor alone.
 *
 * The opposite edge stays where it is and this one follows the pointer, one
 * request a frame however fast the pointer reports; main holds the window to
 * the amp's floor (`resizePlayer`).
 */
const PlayerHeightGrip = ({ edge }: { edge: 'top' | 'bottom' }) => {
  const { t } = useTranslation();
  const dragRef = useRef<IGripDrag | undefined>(undefined);

  const ask = () => {
    const drag = dragRef.current;
    if (!drag) {
      return;
    }
    drag.frame = undefined;
    if (drag.wanted === undefined) {
      return;
    }
    if (edge === 'top') {
      resizePlayerWindowFromTop(drag.wanted);
    } else {
      resizePlayerWindow(drag.wanted).catch(() => undefined);
    }
  };

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) {
      return;
    }
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      pointerId: event.pointerId,
      startY: event.screenY,
      startHeight: window.innerHeight,
    };
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) {
      return;
    }
    // Measured on the screen, not in the page: dragged by its head the window
    // moves under the pointer, and a page position would chase itself.
    const moved = event.screenY - drag.startY;
    drag.wanted = drag.startHeight + (edge === 'top' ? -moved : moved);
    if (drag.frame === undefined) {
      drag.frame = requestAnimationFrame(ask);
    }
  };

  const onPointerEnd = (event: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) {
      return;
    }
    if (drag.frame !== undefined) {
      cancelAnimationFrame(drag.frame);
    }
    ask();
    dragRef.current = undefined;
  };

  return (
    <div
      className={`player-height-grip player-height-grip--${edge}`}
      role="separator"
      aria-orientation="horizontal"
      aria-label={t('player.heightGrip')}
      title={t('player.heightGrip')}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerEnd}
      onPointerCancel={onPointerEnd}
    />
  );
};

export default PlayerHeightGrip;

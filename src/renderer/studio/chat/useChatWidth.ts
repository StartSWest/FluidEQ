/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useRef, useState, type CSSProperties, type RefObject } from 'react';
import {
  readStored,
  removeStored,
  writeStored,
} from '../../utils/graphStorage';

const WIDTH_KEY = 'fluideq.studio.chatWidth';

/**
 * `$studio-chat-min`, and the stage's own least width beside the chat
 * (`$studio-stage-min`) plus the grid's gap, in `Studio.scss`. The sheet
 * clamps the column with the same numbers whatever is stored, so a width
 * saved on a wide window is never one the stage cannot give on a narrow one;
 * these only keep the drag from wandering past what the sheet will draw.
 */
const CHAT_MIN = 320;
const STAGE_MIN = 480;
const GRID_GAP = 16;

const storedWidth = () => {
  const value = Number(readStored(WIDTH_KEY));
  return Number.isFinite(value) && value >= CHAT_MIN ? value : undefined;
};

/**
 * The chat column's width, as the member dragged it (Ivan, 2026-10-09: "I
 * wanna be able to resize the chat part"). Unset, the sheet's own width
 * stands: 30% of the bench between 320 and 440px.
 *
 * A drag writes the column's variable straight onto it and renders nothing
 * until it ends: a state change per pointer move would render the whole
 * conversation sixty times a second for a number only the sheet reads.
 */
export default function useChatWidth(column: RefObject<HTMLElement | null>) {
  const [width, setWidth] = useState(storedWidth);
  const drag = useRef({ start: 0, max: CHAT_MIN, now: 0 });

  const onStart = () => {
    const element = column.current;
    const grid = element?.parentElement;
    if (!element || !grid) {
      return;
    }
    const start = element.getBoundingClientRect().width;
    drag.current = {
      start,
      now: start,
      max: Math.max(
        CHAT_MIN,
        grid.getBoundingClientRect().width - STAGE_MIN - GRID_GAP,
      ),
    };
  };

  // The divider stands at the column's left edge: dragging it left widens.
  const onDrag = (deltaX: number) => {
    const { start, max } = drag.current;
    const next = Math.round(Math.min(max, Math.max(CHAT_MIN, start - deltaX)));
    drag.current.now = next;
    column.current?.style.setProperty('--studio-chat-width', `${next}px`);
  };

  const onEnd = () => {
    const { now } = drag.current;
    if (now >= CHAT_MIN) {
      setWidth(now);
      writeStored(WIDTH_KEY, String(now));
    }
  };

  const onReset = () => {
    column.current?.style.removeProperty('--studio-chat-width');
    setWidth(undefined);
    removeStored(WIDTH_KEY);
  };

  const { max } = drag.current;
  const valuePercent =
    width === undefined || max <= CHAT_MIN
      ? 0
      : Math.round(
          (Math.min(1, (width - CHAT_MIN) / (max - CHAT_MIN)) || 0) * 100,
        );

  return {
    style:
      width === undefined
        ? undefined
        : ({ '--studio-chat-width': `${width}px` } as CSSProperties),
    resizer: { valuePercent, onStart, onDrag, onEnd, onReset },
  };
}

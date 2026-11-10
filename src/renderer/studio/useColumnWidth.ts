/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useRef, useState, type CSSProperties, type RefObject } from 'react';
import { readStored, removeStored, writeStored } from '../utils/graphStorage';

interface IColumnWidth {
  /** Where the dragged width is kept between visits; a reset forgets it. */
  storageKey: string;
  /** The custom property the column's sheet sizes it from. */
  property: `--${string}`;
  /** The least the column is dragged to. */
  least: number;
  /**
   * The least the column across the divider keeps, with the gap between
   * them: the drag's widest is the grid's width less this.
   */
  besideLeast: number;
}

/**
 * A column's width as the member dragged its divider (`ColumnResizer`),
 * stood at the column's left edge so dragging left widens it. Unset, the
 * sheet's own width stands. The sheet clamps the column with the same
 * numbers whatever is stored, so a width saved on a wide window is never one
 * a narrow one cannot give; these only keep the drag from wandering past
 * what the sheet will draw.
 *
 * A drag writes the column's property straight onto it and renders nothing
 * until it ends: a state change per pointer move would render the whole
 * conversation in the column sixty times a second for a number only the
 * sheet reads.
 */
export default function useColumnWidth(
  column: RefObject<HTMLElement | null>,
  { storageKey, property, least, besideLeast }: IColumnWidth,
) {
  const [width, setWidth] = useState(() => {
    const value = Number(readStored(storageKey));
    return Number.isFinite(value) && value >= least ? value : undefined;
  });
  const drag = useRef({ start: 0, max: least, now: 0 });

  const onStart = () => {
    const element = column.current;
    const grid = element?.parentElement;
    if (!element || !grid) {
      return;
    }
    const start = element.getBoundingClientRect().width;
    // Inside the grid's padding, where the sheet's `100cqw` measures too: a
    // padded grid (the bigger animation view's body) would otherwise let the
    // drag run on past where the column stops.
    const { paddingLeft, paddingRight } = getComputedStyle(grid);
    const room =
      grid.getBoundingClientRect().width -
      (parseFloat(paddingLeft) || 0) -
      (parseFloat(paddingRight) || 0);
    drag.current = {
      start,
      now: start,
      max: Math.max(least, room - besideLeast),
    };
  };

  const onDrag = (deltaX: number) => {
    const { start, max } = drag.current;
    const next = Math.round(Math.min(max, Math.max(least, start - deltaX)));
    drag.current.now = next;
    column.current?.style.setProperty(property, `${next}px`);
  };

  const onEnd = () => {
    const { now } = drag.current;
    if (now >= least) {
      setWidth(now);
      writeStored(storageKey, String(now));
    }
  };

  const onReset = () => {
    column.current?.style.removeProperty(property);
    setWidth(undefined);
    removeStored(storageKey);
  };

  const { max } = drag.current;
  const valuePercent =
    width === undefined || max <= least
      ? 0
      : Math.round((Math.min(1, (width - least) / (max - least)) || 0) * 100);

  return {
    style:
      width === undefined
        ? undefined
        : ({ [property]: `${width}px` } as CSSProperties),
    resizer: { valuePercent, onStart, onDrag, onEnd, onReset },
  };
}

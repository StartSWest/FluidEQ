/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useState } from 'react';
import SceneLookIcon from '../icons/SceneLookIcon';
import type { IPlusRow } from './lookPickerRows';
import { useLookThumbnail } from './lookThumbnails';

/** The graph picker's keyboard walk and the small parts of its rows. */

export const PICK = '.look-picker__pick';

/**
 * The arrows walk a column, left and right cross to the other at the same
 * height, and down from the search arrives at the chosen look — or the top of
 * the styles when the choice is in neither column.
 */
export const walkPicker = (event: KeyboardEvent, menu: Element) => {
  const active = document.activeElement as HTMLElement | null;
  const columns = Array.from(
    menu.querySelectorAll<HTMLElement>('.look-picker__column'),
  );
  const picksIn = (column: Element) =>
    Array.from(column.querySelectorAll<HTMLElement>(PICK));
  const go = (target: HTMLElement | undefined) => {
    if (!target) {
      return;
    }
    event.preventDefault();
    target.focus({ preventScroll: true });
    // jsdom has no scrollIntoView.
    if (typeof target.scrollIntoView === 'function') {
      target.scrollIntoView({ block: 'nearest' });
    }
  };
  const search = menu.querySelector<HTMLInputElement>(
    '.look-picker__search input',
  );
  if (active === search) {
    if (event.key === 'ArrowDown') {
      const chosen = menu.querySelector<HTMLElement>(
        `${PICK}[aria-pressed="true"]`,
      );
      go(chosen ?? (columns[0] && picksIn(columns[0])[0]));
    }
    return;
  }
  const column = columns.findIndex((each) => each.contains(active));
  if (!active?.matches(PICK) || column < 0) {
    return;
  }
  const picks = picksIn(columns[column]);
  const at = picks.indexOf(active);
  if (event.key === 'ArrowDown') {
    go(picks[Math.min(at + 1, picks.length - 1)]);
  } else if (event.key === 'ArrowUp') {
    if (at === 0) {
      event.preventDefault();
      search?.focus();
    } else {
      go(picks[at - 1]);
    }
  } else if (event.key === 'Home') {
    go(picks[0]);
  } else if (event.key === 'End') {
    go(picks[picks.length - 1]);
  } else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
    const other = columns[column + (event.key === 'ArrowRight' ? 1 : -1)];
    const across = other ? picksIn(other) : [];
    go(across[Math.min(at, across.length - 1)]);
  }
};

export const LockBadge = ({ label }: { label: string }) => (
  <span className="graph-look-badge graph-look-badge--locked">
    <svg
      className="graph-look-badge__lock"
      viewBox="0 0 10 12"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M2.5 5V3.6a2.5 2.5 0 0 1 5 0V5" />
      <rect x="1" y="5" width="8" height="6" rx="1.4" />
    </svg>
    {label}
  </span>
);

/** A visualizer's picture, or its colours until the picture is there. */
export const SceneThumbnail = ({ row }: { row: IPlusRow }) => {
  const [element, setElement] = useState<HTMLSpanElement | null>(null);
  const thumbnail = useLookThumbnail(
    row.thumbnail ?? { lookId: row.id, version: '' },
    row.thumbnail ? element : null,
  );
  return (
    <span
      ref={setElement}
      className={`look-picker__thumb look-picker__thumb--${thumbnail.state}`}
      aria-hidden="true"
    >
      {thumbnail.state === 'ready' ? (
        <img src={thumbnail.url} alt="" draggable={false} />
      ) : (
        <SceneLookIcon
          className="look-picker__thumb-glyph"
          swatch={row.swatch}
          lookId={row.id}
        />
      )}
    </span>
  );
};

/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useState } from 'react';
import SceneLookIcon from '../icons/SceneLookIcon';
import type { IPlusRow } from './lookPickerRows';
import { useLookThumbnail } from './lookThumbnails';

/** The look picker's keyboard walk and the small parts of its tiles. */

export const PICK =
  ':is(.look-picker__pick, .look-picker__discover-actions .button)';

/** Two tiles whose tops are this close stand on one row of the grid. */
const SAME_ROW_PX = 4;

/**
 * The tile above or below `from`: on the nearest row in that direction, the
 * one whose middle is nearest its middle. Read from where the tiles are laid
 * out, because the scenes' grid and the styles' grid under it have different
 * column counts and either can wrap at any width.
 */
const acrossRows = (
  picks: readonly HTMLElement[],
  from: HTMLElement,
  down: boolean,
) => {
  const at = from.getBoundingClientRect();
  const middle = at.left + at.width / 2;
  const placed = picks.map((pick) => {
    const box = pick.getBoundingClientRect();
    return {
      pick,
      rowGap: down ? box.top - at.top : at.top - box.top,
      gap: Math.abs(box.left + box.width / 2 - middle),
    };
  });
  const ahead = placed.filter((each) => each.rowGap > SAME_ROW_PX);
  if (ahead.length === 0) {
    return undefined;
  }
  const nearest = Math.min(...ahead.map((each) => each.rowGap));
  return ahead
    .filter((each) => each.rowGap - nearest <= SAME_ROW_PX)
    .reduce((best, each) => (each.gap < best.gap ? each : best)).pick;
};

/**
 * The picker's keyboard walk: the arrows move round the grid as it is laid
 * out, left from its first column steps into the rail, right from the rail
 * steps back to the chosen look, up from the top row is the search, and down
 * from the search arrives at the chosen look - or the first one showing.
 */
export const walkPicker = (event: KeyboardEvent, menu: Element) => {
  const active = document.activeElement as HTMLElement | null;
  const search = menu.querySelector<HTMLInputElement>(
    '.look-picker__search input',
  );
  const picks = Array.from(
    menu.querySelectorAll<HTMLElement>(`.look-picker__scroll ${PICK}`),
  );
  const places = Array.from(
    menu.querySelectorAll<HTMLElement>('.look-picker__place'),
  );
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
  const chosenPick = () =>
    picks.find((pick) => pick.getAttribute('aria-pressed') === 'true') ??
    picks[0];
  if (active === search) {
    if (event.key === 'ArrowDown') {
      go(chosenPick());
    }
    return;
  }
  const place = active ? places.indexOf(active) : -1;
  if (place >= 0) {
    if (event.key === 'ArrowDown') {
      go(places[Math.min(place + 1, places.length - 1)]);
    } else if (event.key === 'ArrowUp') {
      go(place === 0 ? (search ?? undefined) : places[place - 1]);
    } else if (event.key === 'Home') {
      go(places[0]);
    } else if (event.key === 'End') {
      go(places[places.length - 1]);
    } else if (event.key === 'ArrowRight') {
      go(chosenPick());
    }
    return;
  }
  const at = active ? picks.indexOf(active) : -1;
  if (!active || at < 0) {
    return;
  }
  const sameRow = (other: HTMLElement | undefined) =>
    other !== undefined &&
    Math.abs(
      other.getBoundingClientRect().top - active.getBoundingClientRect().top,
    ) <= SAME_ROW_PX;
  if (event.key === 'ArrowRight') {
    go(picks[at + 1]);
  } else if (event.key === 'ArrowLeft') {
    const before = picks[at - 1];
    go(
      sameRow(before)
        ? before
        : (places.find(
            (each) => each.getAttribute('aria-current') === 'page',
          ) ?? places[0]),
    );
  } else if (event.key === 'ArrowDown') {
    go(acrossRows(picks, active, true));
  } else if (event.key === 'ArrowUp') {
    go(acrossRows(picks, active, false) ?? search ?? undefined);
  } else if (event.key === 'Home') {
    go(picks[0]);
  } else if (event.key === 'End') {
    go(picks[picks.length - 1]);
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

/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License version 3 or later.
*/

import { IFiltersMap } from './constants';

/**
 * What a click on a band means for the selection, read off the modifier
 * keys the way a file manager reads them:
 *
 * - `replace`: the band alone — unless it is already part of the selection,
 *   which is left as it is so a group can be grabbed by any of its members.
 * - `toggle` (Ctrl, or Cmd on a Mac): the band joins or leaves the selection.
 * - `range` (Shift): every band from the anchor to this one, in frequency
 *   order, replaces the selection.
 */
export type SelectionMode = 'replace' | 'toggle' | 'range';

export const selectionModeFromEvent = (event: {
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
}): SelectionMode => {
  if (event.shiftKey) {
    return 'range';
  }
  return event.ctrlKey || event.metaKey ? 'toggle' : 'replace';
};

/**
 * The ids of every band whose frequency lies between two bands, inclusive,
 * lowest first. Either end may be missing from the map — a band deleted
 * since it was clicked — in which case only the other end is returned.
 */
export const bandsBetween = (
  filters: IFiltersMap,
  fromId: string,
  toId: string,
): string[] => {
  const from = filters[fromId];
  const to = filters[toId];
  if (!from || !to) {
    return [to?.id ?? from?.id].filter((id): id is string => !!id);
  }
  const low = Math.min(from.frequency, to.frequency);
  const high = Math.max(from.frequency, to.frequency);
  return Object.values(filters)
    .filter((filter) => filter.frequency >= low && filter.frequency <= high)
    .sort((a, b) => a.frequency - b.frequency)
    .map((filter) => filter.id);
};

/**
 * The selection a click produces. `anchorId` is the band the last non-shift
 * click landed on; a shift-click ranges from it, and when there is none the
 * first selected band stands in.
 */
export const nextBandSelection = (
  filters: IFiltersMap,
  selectedIds: readonly string[],
  clickedId: string,
  mode: SelectionMode,
  anchorId: string | undefined,
): string[] => {
  switch (mode) {
    case 'toggle':
      return selectedIds.includes(clickedId)
        ? selectedIds.filter((id) => id !== clickedId)
        : [...selectedIds, clickedId];
    case 'range': {
      const anchor =
        anchorId && filters[anchorId]
          ? anchorId
          : (selectedIds[0] ?? clickedId);
      return bandsBetween(filters, anchor, clickedId);
    }
    default:
      return selectedIds.includes(clickedId) ? [...selectedIds] : [clickedId];
  }
};

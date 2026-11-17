/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License version 3 or later.
*/

/**
 * What a click on a band means for the selection, read off the modifier
 * keys:
 *
 * - `replace`: the band alone — unless it is already part of the selection,
 *   which is left as it is so a group can be grabbed by any of its members.
 * - `toggle` (Ctrl, or Cmd on a Mac): the band joins or leaves the selection.
 *
 * Shift selects as a plain click does: it is what opens the band's popover
 * (Ivan, 2026-11-17, `bandPopover.ts`). It used to select every band from
 * the last one clicked to this one, so a Shift-press meant to open one band
 * would have opened a group of them; a run of bands is still one drag of the
 * selection box away, and Ctrl adds them one at a time.
 */
export type SelectionMode = 'replace' | 'toggle';

export const selectionModeFromEvent = (event: {
  ctrlKey: boolean;
  metaKey: boolean;
}): SelectionMode => (event.ctrlKey || event.metaKey ? 'toggle' : 'replace');

/** The selection a click produces. */
export const nextBandSelection = (
  selectedIds: readonly string[],
  clickedId: string,
  mode: SelectionMode,
): string[] => {
  if (mode === 'toggle') {
    return selectedIds.includes(clickedId)
      ? selectedIds.filter((id) => id !== clickedId)
      : [...selectedIds, clickedId];
  }
  return selectedIds.includes(clickedId) ? [...selectedIds] : [clickedId];
};

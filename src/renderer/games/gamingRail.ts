/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  RAIL_MAX,
  RAIL_MIN,
  readPersistedText,
  writePersistedText,
} from '../library/libraryWorkspacePrefs';

/**
 * Where the games rail's width is remembered once its edge has been dragged
 * (`useRailWidth`): the Library's rail and splitter, with a width of its own
 * (Ivan, 2026-11-19: "the left panel as it is in the Library, resizable").
 */
export const GAMING_RAIL_WIDTH_KEY = 'fluideq.gaming.railWidth';

/** Whether the games rail is pinned open or folded to icons (`useRailPinned`). */
export const GAMING_RAIL_PINNED_KEY = 'fluideq.gaming.railPinned';

/**
 * The list's layout before it became the rail: width, a height for the
 * stacked arrangement the rail no longer has, and whether it was folded to
 * its icons.
 */
const LEGACY_LAYOUT_KEY = 'fluideq.gaming.gamesLayout';

/**
 * The list's width and fold, carried over once into the rail's own keys and
 * the old record removed, so somebody who folded the list or dragged it wider
 * finds the rail the same way. Runs as this module loads, before the rail's
 * pin setting is first made (`useRailPinned`, on the page's first render),
 * because that setting reads its stored value once, when it is made.
 */
const adoptLegacyLayout = (): void => {
  const stored = readPersistedText(LEGACY_LAYOUT_KEY);
  if (stored === undefined) {
    return;
  }
  try {
    const value: unknown = JSON.parse(stored);
    if (typeof value === 'object' && value !== null) {
      if (
        'width' in value &&
        typeof value.width === 'number' &&
        Number.isFinite(value.width) &&
        readPersistedText(GAMING_RAIL_WIDTH_KEY) === undefined
      ) {
        const width = Math.min(RAIL_MAX, Math.max(RAIL_MIN, value.width));
        writePersistedText(GAMING_RAIL_WIDTH_KEY, String(Math.round(width)));
      }
      if (
        'collapsed' in value &&
        typeof value.collapsed === 'boolean' &&
        readPersistedText(GAMING_RAIL_PINNED_KEY) === undefined
      ) {
        writePersistedText(GAMING_RAIL_PINNED_KEY, String(!value.collapsed));
      }
    }
  } catch {
    // A damaged record carries nothing worth keeping; it is removed below.
  }
  writePersistedText(LEGACY_LAYOUT_KEY, undefined);
};

adoptLegacyLayout();

/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026> <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { createContext, useContext } from 'react';

/**
 * Where the EQ page's tab row stands: the panel's own top, above the box that
 * scrolls, so the row is the graph's foot and never scrolls away from it
 * (Ivan, 2026-11-17, J2: "the row stands on the graph"). Inside the scroller
 * it rode up with a long Preset page, and the graph's surface it now stands
 * on — a scene's picture included — would have shown through behind whatever
 * scrolled into its place.
 *
 * `undefined` where nobody offers a place (the Gaming Lab's editor, which
 * keeps the row inline above its bands); `null` while the EQ page's place is
 * still being laid out, for the one commit before its element is known.
 */
export const EqRowSlotContext = createContext<HTMLElement | null | undefined>(
  undefined,
);

export const useEqRowSlot = () => useContext(EqRowSlotContext);

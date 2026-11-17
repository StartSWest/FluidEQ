/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026> <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { createContext, useContext } from 'react';

/**
 * Whether the response graph stands above the EQ page (layout A, Ivan
 * 2026-09-25; `isGraphFirst` in `App.tsx`): only then can the bands stand
 * directly under the points they move (`useEqPageBands`, `bandsRail.ts`).
 * False while the graph is off or fills the column.
 *
 * It used to be the element the page's title row was portalled into, above
 * the graph; the row went when the page took its three tabs under the graph
 * (Ivan, 2026-11-16, "One pane, inset cards"), and this is the one thing the
 * slot still said.
 */
export const EqGraphAboveContext = createContext(false);

export const useIsEqGraphAbove = () => useContext(EqGraphAboveContext);

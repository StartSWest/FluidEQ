/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License version 3 or later.
*/

import { createContext, useContext } from 'react';

/**
 * Where the EQ page's title row goes while the graph stands between it and
 * the bands (layout A, Ivan 2026-09-25): the head of the centre column, above
 * the graph (`App.tsx`, `.center-head`). The row is still `MainContent`'s —
 * its tools read and set that component's state — and is portalled there, so
 * the page reads title, graph, bands from the top down while the bands stand
 * directly under the points they move.
 *
 * `null` while the graph is off or filling the column: the row stays in the
 * page, above the bands, as it always was.
 */
export const EqTitleSlotContext = createContext<HTMLElement | null>(null);

export const useEqTitleSlot = () => useContext(EqTitleSlotContext);

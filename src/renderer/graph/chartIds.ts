/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { createContext, useContext } from 'react';

/**
 * A chart's own id for one of its definitions — a clip, a gradient — by the
 * name the code knows it by.
 *
 * A document has one namespace for ids, and `url(#…)` takes the first
 * element with the id. Two charts with fixed ids (the main graph and the
 * Gaming Lab's Curve stage) would each clip and colour their curves by the
 * first one's rectangles and spectrum, which are laid out for another
 * width. Outside a chart the names stand as they are.
 */
export type TChartIdOf = (name: string) => string;

const asNamed: TChartIdOf = (name) => name;

export const ChartIdsContext = createContext<TChartIdOf>(asNamed);

export const useChartIdOf = (): TChartIdOf => useContext(ChartIdsContext);

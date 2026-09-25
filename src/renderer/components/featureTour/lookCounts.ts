/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026> <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { isAnalysisStyle } from '../../../common/graphAnalysis';
import { SELECTABLE_GRAPH_STYLES } from '../../../common/graphStyles';

/**
 * How many looks the tour says the picker holds, counted from the picker's own
 * list. The words said "28" for as long as it was typed, and were wrong the
 * day nineteen drawn scenes joined the list.
 */

/** Every free look the graph's picker offers, measuring views included. */
export const FREE_LOOK_COUNT = SELECTABLE_GRAPH_STYLES.length;

/**
 * The forms a look can be drawn in: the picker less its measuring views, which
 * read the sound rather than draw it and take none of the look's controls.
 */
export const DRAWN_FORM_COUNT = SELECTABLE_GRAPH_STYLES.filter(
  (style) => !isAnalysisStyle(style),
).length;

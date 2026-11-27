/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { GraphStyle } from './graphStyles';

/**
 * Forms taken out of the app altogether, which no longer draw at all (Ivan,
 * 2026-11-27: "remove Synthwave, Tide, Invaders, Pulse, Bubbles, Truss", and
 * "remove terrace"). Pulse's id is `ecg`.
 *
 * Unlike a retired form (`RETIRED` in `graphStyles.ts`), which still draws for
 * whoever saved a look on it, these are gone from `GraphStyle` with their
 * geometry. What is left of them is somebody's saved state that names one:
 *
 *  - a selection of one (`synthwave`, `tide-auto`) is an id `getGraphLook`
 *    does not know, and lands on the default look, the Analyzer;
 *  - a look somebody made from one is kept, with its name and colours, and
 *    draws as the Analyzer from the Analyzer's own settings
 *    (`normalizeCustomLook`), because the numbers it was tuned with were the
 *    removed drawing's.
 *
 * Strings rather than `GraphStyle`, because that is exactly what they are no
 * longer.
 */
const REMOVED_GRAPH_STYLES: readonly string[] = [
  'synthwave',
  'tide',
  'invaders',
  'ecg',
  'bubbles',
  'truss',
  'terrace',
];

/** What a look made from a removed form is drawn as. */
export const REMOVED_STYLE_FALLBACK: GraphStyle = 'analyzer';

export const isRemovedGraphStyle = (value: unknown): boolean =>
  typeof value === 'string' && REMOVED_GRAPH_STYLES.includes(value);

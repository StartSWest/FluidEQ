/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import type { GraphPalette } from '../../src/common/graphStyles';
import {
  STILL_BOX,
  STILL_GAP,
  STILL_PIXELS,
  STILL_SCALE,
} from '../../src/renderer/graph/lookStills/stillSize';
import type { IBuildRequest, TRealState } from './protocol';

/**
 * What the generator (`generate.ts`) asks of the stills' page, and of the
 * browser it opens: everything outside the page that decides what a still
 * is drawn as. The freshness hashes this file whole (`BYTES_MADE_BY`).
 */

export const BOX = STILL_BOX;
export const SCALE = STILL_SCALE;
export const OUT = STILL_PIXELS;
export const GAP = STILL_GAP;

/** The page, in CSS pixels: room for the stage and, under it, the plate. */
export const PAGE = { width: 800, height: 600 };

/** The browser's own switches the stills are drawn under. */
export const BROWSER_SWITCHES = [
  '--disable-gpu',
  '--disable-background-timer-throttling',
];

/** The mixed states each still is solved from: three equations each. */
export const SEEDS = Array.from(
  { length: 16 },
  (_, index) => 7919 * (index + 1),
);

/** The palette each form is shown in until the listener picks another. */
export const PALETTES: readonly GraphPalette[] = ['auto'];

export const GROUPS: ReadonlyArray<{
  side: IBuildRequest['side'];
  colours: IBuildRequest['colours'];
  checks: readonly TRealState[];
}> = [
  { side: 'dark', colours: 'one', checks: ['ocean', 'picked', 'black'] },
  { side: 'dark', colours: 'many', checks: ['ocean', 'picked'] },
  { side: 'light', colours: 'one', checks: ['ocean', 'picked'] },
  { side: 'light', colours: 'many', checks: ['ocean', 'picked'] },
];

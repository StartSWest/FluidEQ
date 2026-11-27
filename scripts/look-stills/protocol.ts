/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import type { GraphPalette, GraphStyle } from '../../src/common/graphStyles';
import type {
  TStillColours,
  TStillSide,
} from '../../src/renderer/graph/lookStills/stillSize';
import type { IStillError } from './fit';

/**
 * What the generator (`generate.ts`) asks of the stills' page
 * (`harness/index.tsx`) and what it hands back, with nothing of a window in
 * it, so the generator reads it outside one.
 */

/** A named state of the window, as a listener would have it. */
export type TRealState = 'ocean' | 'picked' | 'black';

export interface IBox {
  width: number;
  height: number;
}

export interface IBuildRequest {
  style: GraphStyle;
  palette: GraphPalette;
  side: TStillSide;
  colours: TStillColours;
  /** Seeds of the mixed states the roles are solved from. */
  seeds: readonly number[];
  /** The listener's own states the answer is checked against. */
  checks: readonly TRealState[];
  box: IBox;
  out: IBox;
}

export interface IBuildAnswer {
  roles: readonly string[];
  /** The masks, one after another, each `out` in size: base64. */
  masks: string;
  /** The rest, RGBA: base64. */
  rest: string;
  coverageDrift: number;
  /** What each role explained as it was taken (`fit.ts`). */
  gains: readonly number[];
  /** In-sample: how well the answer explains the drawings it came from. */
  fitted: IStillError;
  checks: ReadonlyArray<{ name: TRealState } & IStillError>;
  /** Milliseconds the whole build took. */
  took: number;
}

/** A still to lay on a plate for the screenshot (`harness/composeStill.tsx`). */
export interface IShowRequest {
  style: GraphStyle;
  palette: GraphPalette;
  side: TStillSide;
  colours: TStillColours;
  state: TRealState;
  /** The still's picture, served beside the page. */
  url: string;
  roles: readonly string[];
  box: IBox;
  out: IBox;
}

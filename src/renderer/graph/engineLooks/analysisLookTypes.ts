/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type {
  IAnalysisReading,
  IAnalysisState,
} from '../analysis/analysisFrame';
import type { IEngineLookInput } from './engineLookInput';

/**
 * One of the measuring views as the engine draws it: its shader, and the
 * step that advances the view's state and lays the frame out for it from the
 * readings every measuring view is handed (`readAnalysisView`) — one per copy
 * of the drawing, only the first carrying the frame's time.
 *
 * The state is the view's own on the page (`IAnalysisState`), advanced by
 * the same functions the page's canvas drawing calls, so a view that falls
 * back to the page mid-song carries on from where the engine left it.
 */
export type TEngineAnalysisStep = (
  readings: readonly IAnalysisReading[],
  state: IAnalysisState,
  input: IEngineLookInput,
) => boolean;

export interface IEngineAnalysisLook {
  /** GLSL after `LOOK_GLSL` and `ANALYSIS_GLSL`, providing `sceneColour`. */
  glsl: string;
  /** Lays this frame out into `input`; whether anything is still moving. */
  step: TEngineAnalysisStep;
}

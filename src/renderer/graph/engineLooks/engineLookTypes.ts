/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { ISceneViewState } from '../sceneViews/drawSceneView';
import type { ISceneReading } from '../sceneViews/sceneFrame';
import type { IEngineLookInput } from './engineLookInput';

/**
 * One of FluidEQ's own looks as the engine draws it: its shader, and the
 * step that lays each frame out for it from the reading every drawn look is
 * handed (`readSceneView`).
 */
export interface IEngineLook<TState> {
  /** GLSL after `LOOK_GLSL`, providing `sceneColour` (`lookGlsl.ts`). */
  glsl: string;
  /**
   * The look's state, which is the page's own for the look
   * (`ISceneViewState`): the engine and the page's canvas each carry on from
   * the other's peaks, trails and sparks whenever one takes over — while
   * the engine builds a look, after a lost context, on a fallback.
   */
  stateOf(scene: ISceneViewState): TState;
  /** Lays this frame out into `input`; whether anything is still moving. */
  step(reading: ISceneReading, state: TState, input: IEngineLookInput): boolean;
}

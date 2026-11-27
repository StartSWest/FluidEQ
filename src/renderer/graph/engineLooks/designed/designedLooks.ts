/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { GraphStyle } from 'common/graphStyles';
import type { IEngineLookInput } from '../engineLookInput';
import DESIGNED_GLSL from './designedGlsl';
import { readDesignedInput, type IDesignedFrame } from './designedInput';
import echoLook, { type IEchoScene } from './echoLook';
import skylineLook, { type ISkylineScene } from './skylineLook';
import slopeLook, { type ISlopeScene } from './slopeLook';

/**
 * The designed scenes the engine draws, each with the layout the page has
 * already made for it this frame (`LiveTraceCanvas`), so neither painter
 * lays a scene out on its own.
 */

/** A designed scene's own layout, by the look it belongs to. */
export type TDesignedScene =
  | { style: 'echo'; scene: IEchoScene }
  | { style: 'skyline'; scene: ISkylineScene }
  | { style: 'slope'; scene: ISlopeScene };

/**
 * Every designed scene's layout the page has made this frame; only the
 * chosen look's is there.
 */
export interface IDesignedLayouts {
  echo?: IEchoScene;
  skyline?: ISkylineScene;
  slope?: ISlopeScene;
}

/** The chosen look's scene, when the engine draws it and it is laid out. */
export const designedSceneOf = (
  style: GraphStyle,
  layouts: IDesignedLayouts,
): TDesignedScene | undefined => {
  if (style === 'echo' && layouts.echo) {
    return { style, scene: layouts.echo };
  }
  if (style === 'skyline' && layouts.skyline) {
    return { style, scene: layouts.skyline };
  }
  if (style === 'slope' && layouts.slope) {
    return { style, scene: layouts.slope };
  }
  return undefined;
};

const SHADERS: Partial<Record<GraphStyle, string>> = {
  echo: echoLook.glsl,
  skyline: skylineLook.glsl,
  slope: slopeLook.glsl,
};

/** The scene's shader, after the parts every designed scene shares. */
export const designedShader = (style: GraphStyle): string | undefined => {
  const own = SHADERS[style];
  return own === undefined ? undefined : `${DESIGNED_GLSL}${own}`;
};

/** Whether the engine draws the designed scene `style`. */
export const isDesignedLookStyle = (style: GraphStyle): boolean =>
  SHADERS[style] !== undefined;

/** Lays a designed scene's frame out for the engine. */
export const stepDesignedLook = (
  frame: IDesignedFrame,
  designed: TDesignedScene,
  input: IEngineLookInput,
): void => {
  readDesignedInput(input, frame);
  switch (designed.style) {
    case 'echo':
      echoLook.step(frame, designed.scene, input);
      break;
    case 'skyline':
      skylineLook.step(frame, designed.scene, input);
      break;
    case 'slope':
      slopeLook.step(frame, designed.scene, input);
      break;
    default:
      break;
  }
};

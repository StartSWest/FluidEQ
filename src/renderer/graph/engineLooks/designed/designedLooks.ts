/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { GraphStyle } from 'common/graphStyles';
import { bubbleShake, type BubbleStorm } from '../../bubbleStorm';
import { pulseShake } from '../../pulseMonitor';
import { invasionShake } from '../../spaceInvasion';
import type { IEngineLookInput } from '../engineLookInput';
import DESIGNED_GLSL from './designedGlsl';
import { readDesignedInput, type IDesignedFrame } from './designedInput';
import bubblesLook, { type IBubblesScene } from './bubblesLook';
import echoLook, { type IEchoScene } from './echoLook';
import invadersLook, { type IInvadersScene } from './invadersLook';
import pulseLook, { type IPulseScene } from './pulseLook';
import skylineLook, { type ISkylineScene } from './skylineLook';
import slopeLook, { type ISlopeScene } from './slopeLook';
import terraceLook, { type ITerraceScene } from './terraceLook';
import trussLook, { type ITrussScene } from './trussLook';

/**
 * The designed scenes the engine draws, each with the layout the page has
 * already made for it this frame (`LiveTraceCanvas`), so neither painter
 * lays a scene out on its own.
 */

/** A designed scene's own layout, by the look it belongs to. */
export type TDesignedScene =
  | { style: 'ecg'; scene: IPulseScene }
  | { style: 'echo'; scene: IEchoScene }
  | {
      style: 'bubbles';
      scene: IBubblesScene;
      storm: BubbleStorm;
      clock: number;
    }
  | { style: 'skyline'; scene: ISkylineScene }
  | { style: 'slope'; scene: ISlopeScene }
  | { style: 'terrace'; scene: ITerraceScene }
  | { style: 'truss'; scene: ITrussScene }
  | { style: 'invaders'; scene: IInvadersScene };

/**
 * Every designed scene's layout the page has made this frame; only the
 * chosen look's is there.
 */
export interface IDesignedLayouts {
  pulse?: IPulseScene;
  echo?: IEchoScene;
  bubbles?: { scene: IBubblesScene; storm: BubbleStorm; clock: number };
  skyline?: ISkylineScene;
  slope?: ISlopeScene;
  terrace?: ITerraceScene;
  truss?: ITrussScene;
  invaders?: IInvadersScene;
}

/** The chosen look's scene, when the engine draws it and it is laid out. */
export const designedSceneOf = (
  style: GraphStyle,
  layouts: IDesignedLayouts,
): TDesignedScene | undefined => {
  if (style === 'ecg' && layouts.pulse) {
    return { style, scene: layouts.pulse };
  }
  if (style === 'echo' && layouts.echo) {
    return { style, scene: layouts.echo };
  }
  if (style === 'bubbles' && layouts.bubbles) {
    return { style, ...layouts.bubbles };
  }
  if (style === 'skyline' && layouts.skyline) {
    return { style, scene: layouts.skyline };
  }
  if (style === 'slope' && layouts.slope) {
    return { style, scene: layouts.slope };
  }
  if (style === 'terrace' && layouts.terrace) {
    return { style, scene: layouts.terrace };
  }
  if (style === 'truss' && layouts.truss) {
    return { style, scene: layouts.truss };
  }
  if (style === 'invaders' && layouts.invaders) {
    return { style, scene: layouts.invaders };
  }
  return undefined;
};

/** Where the whole scene is shaken to this frame, by its own beat. */
export const designedShake = (
  designed: TDesignedScene,
): { x: number; y: number } => {
  switch (designed.style) {
    case 'ecg':
      return pulseShake(designed.scene.monitor, designed.scene.clock);
    case 'bubbles':
      return bubbleShake(designed.storm, designed.clock);
    case 'invaders':
      return invasionShake(designed.scene.state, designed.scene.clock);
    default:
      return { x: 0, y: 0 };
  }
};

const SHADERS: Partial<Record<GraphStyle, string>> = {
  ecg: pulseLook.glsl,
  echo: echoLook.glsl,
  bubbles: bubblesLook.glsl,
  skyline: skylineLook.glsl,
  slope: slopeLook.glsl,
  terrace: terraceLook.glsl,
  truss: trussLook.glsl,
  invaders: invadersLook.glsl,
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
    case 'ecg':
      pulseLook.step(frame, designed.scene, input);
      break;
    case 'echo':
      echoLook.step(frame, designed.scene, input);
      break;
    case 'bubbles':
      bubblesLook.step(frame, designed.scene, input);
      break;
    case 'skyline':
      skylineLook.step(frame, designed.scene, input);
      break;
    case 'slope':
      slopeLook.step(frame, designed.scene, input);
      break;
    case 'terrace':
      terraceLook.step(frame, designed.scene, input);
      break;
    case 'truss':
      trussLook.step(frame, designed.scene, input);
      break;
    case 'invaders':
      invadersLook.step(frame, designed.scene, input);
      break;
    default:
      break;
  }
};

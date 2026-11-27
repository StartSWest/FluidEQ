/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { ILookTuning } from 'common/customLooks';
import { PATTERN_TILE } from 'common/graphTextures';
import { getEaseFactor } from 'common/smoothing';
import { RUN_MAX_TURNS, type ISpectrumEnergy } from 'common/spectrumEnergy';
import { prefersReducedMotion } from '../utils/bandReveal';
import { PATTERN_SPACING } from './fillTextureTiles';
import type { ILiveSound } from './liveSound';

/**
 * A look's texture moving with the music: the look editor's switch under
 * Tile size (`ILookTuning.textureMotion`). Ivan, 2026-11-27: "they will
 * subtly move with music"; of three ways shown to him as clips of the demo
 * song (a drift, a breath on the beat, a rise), he chose the drift.
 *
 * The texture is a background to the reading, so it moves the way a
 * current does: it flows along a heading that wanders slowly, as fast as
 * the music's flywheel turns — building through a chorus, coasting down
 * through a verse, never jumping — pushed a little further on each kick, and
 * it glints with the hats and cymbals (`GLINT`). Nothing about it snaps: the
 * travel's speed and the glint are both eased.
 *
 * Worked out once a frame on the page, from the window's one hearing of the
 * music (`liveSound.ts`: the levels, the beat and the flywheel every scene
 * reads), and handed to both painters as a pose (`ITexturePose`): the page
 * lays its pattern by it and the engine its rectangle, by one rule
 * (`movedPlacement` in `movedTexture.ts`), so the two cannot disagree about
 * where the texture is, and the engine's shader is the one it always was.
 *
 * Measured on the demo song with the flash meter scenes are reviewed with
 * (`sceneFlashMeter.ts`), the worst 10-degree view, still against drifting:
 * Dots on the Analyzer 7.0 % and 8.0 % on the dark window, 10.9 % and 15.1 %
 * on the white one, where the pattern prints in black and its dots pass a
 * pixel two to three times a second; an 8 px hatch there 11.0 % and 16.2 %;
 * a picture over the plot 6.5 % and 6.6 %. The review looks twice past 10 %
 * and fails past 25 %; on the white window the look itself, still, is past
 * 10 % already.
 */

/** Where the texture is this frame, against where it lies still. */
export interface ITexturePose {
  /** How far it has travelled, in CSS pixels, right and down. */
  x: number;
  y: number;
  /** How strongly it prints, against how it prints still: 1 as it lies. */
  strength: number;
  /**
   * How much of its margin a picture over the whole plot may sway in, 0 as
   * it lies and 1 once the motion has eased in (`movedPlacement`).
   */
  reach: number;
}

export interface ITextureMotion {
  x: number;
  y: number;
  /** How fast it travels, in tiles a second, eased. */
  speed: number;
  /** The kick's push, eased: what carries the travel on a beat. */
  surge: number;
  /** The treble's glint, eased, 0..1. */
  glint: number;
  /** The slow phase the heading wanders on, in turns. */
  wander: number;
  /** How far the motion has eased in since it was switched on, 0..1. */
  reach: number;
}

export const createTextureMotion = (): ITextureMotion => ({
  x: 0,
  y: 0,
  speed: 0,
  surge: 0,
  glint: 0,
  wander: 0,
  reach: 0,
});

/** Rest, kept: copied onto a look's motion every frame it lies still. */
const REST: Readonly<ITextureMotion> = Object.freeze(createTextureMotion());

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

/** Quick to rise and slower to fall, by half-lives in milliseconds. */
const follow = (
  current: number,
  target: number,
  deltaMs: number,
  riseMs: number,
  fallMs: number,
) =>
  current +
  (target - current) *
    getEaseFactor(deltaMs, target > current ? riseMs : fallMs);

/**
 * What the treble glints with: the hats and cymbals over the part's usual
 * level (0.55, `energyLevels.ts`), so a singer's "s" — 0.52 on a voice
 * alone — is no glint, and a ride cymbal is.
 */
const glintOf = (treble: number) => clamp01((treble - 0.55) / 0.4);

/**
 * How much stronger the texture prints at the brightest glint: a third, on
 * the 0.32 a pattern prints at (`TEXTURE_ALPHA`).
 *
 * While a white tile lightened a pale fill on the white window, a glint
 * lifting every dot at once on each hat read as flashing there (10.8 % of a
 * view still, 11.1 % drifting without it, 14.9 % with it). Printed in black
 * there, as patterns are now (`patternInk`), it adds next to nothing to the
 * dots (15.1 % with it against 15.0 % without) and a little to the finest
 * pattern, an 8 px hatch (16.2 % against 14.4 %).
 */
export const GLINT = 0.35;

/**
 * The travel, in tiles a second. The flywheel alone at its fastest carries
 * a pattern most of a tile a second; a loud passage adds a little and each
 * kick a push: through the demo song, 16 px dots travelled 5 to 23 px a
 * second.
 */
const RUN_TILES = 0.9;
const LEVEL_TILES = 0.3;
const KICK_TILES = 0.9;

/** The heading, in radians from rightwards, y down: up and to the right. */
const HEADING = -0.55;
/** How far it swings either side of that, and how slowly. */
const HEADING_SWING = 0.6;
const WANDER_TURN_S = 40;

const TURN = Math.PI * 2;

/**
 * How fast a picture over the plot grows into the margin it sways in, once
 * the motion is switched on, as a half-life: under a second and a half to
 * be all but there, never a jump of the margin's 4 % at the press.
 */
const REACH_MS = 250;

/** The longest step a frame is taken as: a stall is not a leap. */
const LONGEST_STEP_MS = 100;

/** Below this every eased part is over, so the drawing may rest. */
const SETTLED = 0.002;

/**
 * One frame of the texture's travel, from the music as heard (undefined
 * while nothing is, which lets it coast to rest), `unit` the texture's tile
 * in CSS pixels. Returns whether it is still moving, so a texture coasting
 * to rest keeps the graph's loop going until it has.
 */
export const moveTexture = (
  state: ITextureMotion,
  music: ISpectrumEnergy | undefined,
  deltaMs: number,
  unit: number,
): boolean => {
  const stepMs = Math.min(LONGEST_STEP_MS, Math.max(0, deltaMs));
  const seconds = stepMs / 1000;
  const level = music?.level ?? 0;
  const kick = music ? music.beat * (0.5 + 0.5 * music.bass) : 0;
  const run = music ? clamp01(music.runSpeed / RUN_MAX_TURNS) : 0;
  state.surge = follow(state.surge, kick, stepMs, 30, 220);
  state.glint = follow(
    state.glint,
    glintOf(music?.treble ?? 0),
    stepMs,
    60,
    300,
  );
  // The speed is eased on top of the flywheel, which is smooth while music
  // plays, for the moments it is not: a pause, or a preview of a look, ends
  // the reading in one frame, and the texture stopped dead with it.
  const target =
    RUN_TILES * run + LEVEL_TILES * level + KICK_TILES * state.surge;
  state.speed = follow(state.speed, target, stepMs, 120, 400);
  state.reach = follow(state.reach, 1, stepMs, REACH_MS, REACH_MS);
  state.wander += (seconds * (0.2 + level)) / WANDER_TURN_S;
  const heading = HEADING + HEADING_SWING * Math.sin(state.wander * TURN);
  const travel = state.speed * unit * seconds;
  state.x += Math.cos(heading) * travel;
  state.y += Math.sin(heading) * travel;
  return (
    travel > SETTLED ||
    state.surge > SETTLED ||
    state.glint > SETTLED ||
    1 - state.reach > SETTLED
  );
};

/** The texture's pose for this frame. */
export const texturePoseOf = (state: ITextureMotion): ITexturePose => ({
  x: state.x,
  y: state.y,
  strength: 1 + GLINT * state.glint,
  reach: state.reach,
});

/**
 * The tile the travel is counted in, in CSS pixels: the texture's own, up to
 * a pattern's first size, and for a pattern that as many of its strokes as
 * the dots have in theirs (`PATTERN_SPACING`), so its lines pass a pixel as
 * often as the dots' do in the clip Ivan chose, whatever the pattern and
 * its size. Counted in a large picture's tile, a chorus sent it across the
 * plot.
 */
export const textureUnitOf = (
  tuning: Pick<
    ILookTuning,
    'texture' | 'textureFit' | 'textureSize' | 'patternSize'
  >,
): number => {
  const { texture } = tuning;
  if (texture === 'none') {
    return PATTERN_TILE;
  }
  if (texture !== 'image') {
    return (
      (Math.min(PATTERN_TILE, tuning.patternSize) * PATTERN_SPACING[texture]) /
      PATTERN_SPACING.dots
    );
  }
  // A picture over the whole plot has no tile; it travels as a pattern's
  // first size does, folded into a sway (`movedPlacement`).
  return tuning.textureFit === 'tile'
    ? Math.min(PATTERN_TILE, tuning.textureSize)
    : PATTERN_TILE;
};

/**
 * This frame's pose for a look's texture, and whether it is still moving.
 * No pose where the texture lies still — the look's switch off, no texture
 * printed, or motion reduced — which prints it exactly as it always did.
 * The music is read here, and only when there is a texture to move.
 */
export const lookTexturePose = (
  state: ITextureMotion,
  tuning: Pick<
    ILookTuning,
    | 'textureMotion'
    | 'filled'
    | 'texture'
    | 'textureFit'
    | 'textureSize'
    | 'patternSize'
  >,
  sound: ILiveSound | undefined,
  deltaMs: number,
): { pose: ITexturePose | undefined; moving: boolean } => {
  if (
    !tuning.textureMotion ||
    !tuning.filled ||
    tuning.texture === 'none' ||
    prefersReducedMotion()
  ) {
    // At rest for when it is switched on again: from where the texture
    // lies still, easing in, never from wherever it last travelled to.
    Object.assign(state, REST);
    return { pose: undefined, moving: false };
  }
  const moving = moveTexture(
    state,
    sound?.music(),
    deltaMs,
    textureUnitOf(tuning),
  );
  return { pose: texturePoseOf(state), moving };
};

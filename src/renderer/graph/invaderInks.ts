import {
  INVADER_GREEN,
  INVADER_POINTS,
  INVADER_READOUT,
} from './invaderCabinet';
import { isLightWindow } from '../utils/windowSide';

/**
 * How each part of the arcade is painted — its colour, how solid, how wide
 * — by the page's canvas and the engine's invaders alike. What answers the
 * music is a function of the beat (`thump`) or the warp.
 */
const INVADER_INKS = {
  /** The cabinet's screen edges, filled or outlined with the look. */
  frame: {
    ground: { colour: INVADER_GREEN, alpha: 0.9 },
    spare: { colour: INVADER_GREEN, alpha: 0.75 },
    readout: { colour: INVADER_READOUT, alpha: 0.85 },
  },
  /** The star field, three layers, brighter in warp. */
  stars: {
    colour: '#fff',
    width: (layer: number) => 1 + layer * 0.6,
    lift: (warp: number) => 0.7 + warp * 0.3,
  },
  /** The boss: a red glow round its hull, the hull, its running lights. */
  saucer: {
    colour: '#ff4d6d',
    glowWidth: 2.4,
    glowAlpha: (thump: number) => 0.16 + thump * 0.14,
    alpha: 0.95,
    lights: '#fff3b0',
  },
  /** Its plasma: a soft halo, the flame, the white-hot core. */
  plasma: {
    halo: '#ff7a1f',
    haloWidth: 2,
    haloAlpha: 0.22,
    flame: '#ff5a2a',
    flameAlpha: 0.9,
    core: '#fff3b0',
  },
  /** The aliens' bolts and the fighter's lasers: a glow, then a core. */
  bolts: {
    colour: '#ff5d7a',
    glowWidth: 1.6,
    glowAlpha: 0.3,
    width: 0.6,
    alpha: 0.95,
  },
  shots: {
    glow: '#7dffb0',
    glowWidth: 1.6,
    glowAlpha: 0.35,
    core: '#fff',
    width: 0.55,
    alpha: 0.95,
  },
  shelter: INVADER_GREEN,
  /**
   * The ship: a soft glow round the hull that swells on the beat, then the
   * flames, the hull, the stripes and the canopy, each its own colour.
   */
  ship: {
    glow: '#8fd3ff',
    glowWidth: 5,
    glowAlpha: (thump: number) => 0.1 + thump * 0.15,
    flame: { colour: '#ff7a1f', alpha: 0.9 },
    core: { colour: '#fff3b0', alpha: 1 },
    hull: { colour: '#d6dee8', alpha: 1 },
    stripes: { colour: '#ff4d6d', alpha: 1 },
    canopy: { colour: '#6fe6ff', alpha: 1 },
    flash: { colour: '#fff', alpha: 0.95 },
  },
  /** The bubble: a soft halo of its own dots under a crisp ring. */
  shield: {
    colour: '#7fe3ff',
    glowWidth: 2.2,
    glowAlpha: 0.18,
    alpha: (thump: number) => 0.7 + thump * 0.3,
  },
  /**
   * The last ship coming apart: the fireball behind, its hot heart, then
   * the fighter's own pixels in its own colours — white all over for the
   * first instant of the blast.
   */
  wreck: {
    fire: '#ff7a1f',
    fireAlpha: (glow: number) => glow * 0.85,
    heart: '#fff3b0',
    heartAlpha: (glow: number) => glow * glow,
    flash: '#fff',
  },
  /** The formation's glow, in the look's own colour. */
  formation: {
    glowWidth: 3,
    glowAlpha: (thump: number) => 0.2 + thump * 0.2,
  },
  /** A hit alien flashes white; the points won print over everything. */
  hit: { colour: '#fff', alpha: 0.9 },
  points: { colour: INVADER_POINTS, alpha: 1, fading: 0.5 },
  /** An outline, where the look is not filled. */
  outline: 1,
};

/** The steel and screen-text ink the day arcade uses for what was white. */
const DAY_INK = '#26303f';

/**
 * The arcade on a light window, where everything light vanished — the
 * score, credits and hi-score at 1.04:1, the fighter's hull at 1.2:1, the
 * points, the shots, the hit flash (2026-11-19 scan). The same parts in the
 * same hues, deep enough to read on white: the readouts and the flashes in a
 * dark screen-text ink, the hull a steel grey, the greens, blues and the
 * points' gold taken down, the stars a faint dust. The reds read as they
 * are.
 */
const INVADER_DAY_INKS: typeof INVADER_INKS = {
  ...INVADER_INKS,
  frame: {
    ground: { colour: '#1d9c47', alpha: 0.9 },
    spare: { colour: '#1d9c47', alpha: 0.75 },
    readout: { colour: DAY_INK, alpha: 0.85 },
  },
  stars: { ...INVADER_INKS.stars, colour: '#97a0ab' },
  // One green for the glow and the core: the engine keeps the brighter of
  // two strokes at a pixel, which by day would drop a darker core.
  shots: { ...INVADER_INKS.shots, glow: '#14874a', core: '#14874a' },
  shelter: '#1d9c47',
  ship: {
    ...INVADER_INKS.ship,
    glow: '#3d8fd6',
    hull: { colour: '#5e6b7b', alpha: 1 },
    canopy: { colour: '#1497bb', alpha: 1 },
    flash: { colour: DAY_INK, alpha: 0.95 },
  },
  shield: { ...INVADER_INKS.shield, colour: '#2a95c7' },
  wreck: { ...INVADER_INKS.wreck, flash: DAY_INK },
  hit: { colour: DAY_INK, alpha: 0.9 },
  points: { ...INVADER_INKS.points, colour: '#b67c00' },
};

/** The arcade's inks for the window's side. */
export const invaderInks = (): typeof INVADER_INKS =>
  isLightWindow() ? INVADER_DAY_INKS : INVADER_INKS;

export default INVADER_INKS;

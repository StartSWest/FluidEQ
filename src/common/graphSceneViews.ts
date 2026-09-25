/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The drawn scenes: LED wall, glass towers, tide, halo and synthwave (Ivan,
 * 2026-09-24: "5 more nice standard viz ... under scenes ... leds, bars and
 * waves and so on"), and the plain spectrums after them — LED bars, neon
 * bars, 3D bars, the spectrum wave and silk waves ("nice standard spectrums
 * and waves with square leds and bars"), and ten more of those (Ivan,
 * 2026-09-25: "10 mas de esos con creatividad pero sin irse a crear scenas
 * solo vizualisers") — visualizers, no scenery.
 *
 * Filed under Scenes with the ones before them, and drawn apart from them,
 * like the measuring views: each is several paths, layers and lights rather
 * than one figure, so the graph hands each the frame and lets it draw itself
 * (`renderer/graph/sceneViews/`). They obey the style editor all the same —
 * colour by, pieces, gap, filled or outlined, opacity, line width, texture,
 * lit peaks and glow — through one reading of it (`sceneFrame.ts`).
 */
export const SCENE_VIEW_STYLES = [
  'ledwall',
  'towers',
  'tide',
  'halo',
  'synthwave',
  'ledbars',
  'neonbars',
  'bars3d',
  'spectrumwave',
  'silkwaves',
  'mirrorbars',
  'pixelbars',
  'beams',
  'sparkbars',
  'glitchbars',
  'orb',
  'kaleido',
  'helix',
  'mesh',
  'halftone',
] as const;

export type TSceneViewStyle = (typeof SCENE_VIEW_STYLES)[number];

export const isSceneViewStyle = (style: string): style is TSceneViewStyle =>
  (SCENE_VIEW_STYLES as readonly string[]).includes(style);

/**
 * Each scene as the real thing is coloured, for a look on Auto with no
 * colours of its own, ramped from the scene's floor to its top: an LED
 * board's green to red, glass from aqua to violet, the sea from the deep to
 * the shallows, synthwave's cyan grid, violet range and magenta-to-gold sun.
 *
 * Here rather than beside the drawing so the style editor can show the same
 * stops the scene is painted in; a scene not listed is painted in its
 * palette's own colours, as every other form is.
 */
export const SCENE_OWN_COLOURS: Partial<
  Record<TSceneViewStyle, readonly string[]>
> = {
  ledwall: ['#00e676', '#76ff03', '#ffea00', '#ff9100', '#ff1744'],
  towers: ['#00e5cf', '#00b0ff', '#7c4dff', '#e040fb'],
  tide: ['#020b22', '#0a2a5c', '#0f5d9c', '#1aa3d9', '#8fe8ff'],
  synthwave: ['#00e5ff', '#7c4dff', '#b04dff', '#ff2e97', '#ffb300', '#fff176'],
  ledbars: ['#19e37a', '#9cf23a', '#f5e63b', '#ff9a2e', '#ff3b3b'],
  neonbars: ['#00f0ff', '#3d7bff', '#a24bff', '#ff3fd4', '#ff6b6b'],
  bars3d: ['#2de2e6', '#3a86ff', '#8338ec', '#ff006e', '#fb5607'],
  spectrumwave: ['#00e5ff', '#6c63ff', '#ff4ecd'],
  silkwaves: ['#00d2ff', '#7b61ff', '#ff5ec8', '#ffb86b'],
  mirrorbars: ['#3ee7ff', '#6a7bff', '#c86bff', '#ff6bd1'],
  pixelbars: ['#29adff', '#00e436', '#ffec27', '#ffa300', '#ff004d'],
  beams: ['#7df9ff', '#5b8cff', '#b36bff', '#ff7ad9'],
  sparkbars: ['#ff3d00', '#ff9100', '#ffd600', '#fff59d'],
  glitchbars: ['#00f5ff', '#7a5cff', '#ff2ec4'],
  orb: ['#00e5ff', '#7c4dff', '#ff4081'],
  kaleido: ['#ffd740', '#ff4081', '#7c4dff', '#00e5ff'],
  helix: ['#00e5ff', '#2979ff', '#d500f9', '#ff1744'],
  mesh: ['#00e5ff', '#651fff', '#ff4081'],
  halftone: ['#1de9b6', '#00b0ff', '#651fff', '#ff4081'],
};

/** The scene's own stops, if it is a scene that has them. */
export const sceneOwnColours = (
  style: string,
): readonly string[] | undefined =>
  isSceneViewStyle(style) ? SCENE_OWN_COLOURS[style] : undefined;

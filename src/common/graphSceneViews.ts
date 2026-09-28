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
 * solo vizualisers") — visualizers, no scenery; four of those he did not
 * like were replaced the same morning, and the Mesh went into the Waterfall,
 * which draws the same history against the scale. Horizon came the day after,
 * from a picture Ivan loved ("make one like this one").
 *
 * Filed under Scenes with the ones before them, and drawn apart from them,
 * like the measuring views: each is several paths, layers and lights rather
 * than one figure, so the graph hands each the frame and lets it draw itself
 * (`renderer/graph/sceneViews/`). They obey the style editor all the same —
 * colour by, pieces, gap, filled or outlined, opacity, line width, texture,
 * lit peaks and glow — through one reading of it (`sceneFrame.ts`). With no
 * colours of their own they paint in the window's (`windowInk.ts`), as every
 * other look does.
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
  'sparkbars',
  'glitchbars',
  'halftone',
  'bouncedots',
  'fallblocks',
  'fibers',
  'afterglow',
  'horizon',
] as const;

export type TSceneViewStyle = (typeof SCENE_VIEW_STYLES)[number];

export const isSceneViewStyle = (style: string): style is TSceneViewStyle =>
  (SCENE_VIEW_STYLES as readonly string[]).includes(style);

/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * THE mark for a scene: a small spectrum, four bars under a curve, on a
 * 20-unit grid at a 1.5 stroke. Ivan, 2026-11-13: "put the graph one, the
 * same as in the gallery". The title bar's Scenes tab wore a sparkle while
 * the Gallery row and the signed-out page's heading under it wore this, so
 * one screen said "scenes" with two pictures. Everything that means a scene
 * draws these strokes from here - the community glyph set (`Glyph` 'looks')
 * and the shell's menu icons (`MenuIcon` 'scene') alike - so the two sets
 * cannot drift apart again (`sceneMarkOneSource.test.tsx`).
 */
export const SCENE_MARK_PATHS = [
  { d: 'M3 16.5V11M7.5 16.5V7M12 16.5V9.5M16.5 16.5V4.5', opacity: 1 },
  { d: 'M2 8.5c3-3 5.5-3 8-1s5 1.5 8-2', opacity: 0.6 },
] as const;

/** The mark's strokes, for an svg on the 20-unit grid at a 1.5 stroke. */
export function SceneMarkPaths() {
  return (
    <>
      {SCENE_MARK_PATHS.map(({ d, opacity }) => (
        <path key={d} d={d} opacity={opacity === 1 ? undefined : opacity} />
      ))}
    </>
  );
}

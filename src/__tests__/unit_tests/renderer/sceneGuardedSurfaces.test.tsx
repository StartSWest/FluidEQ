/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { readFileSync } from 'fs';
import { join } from 'path';
import {
  createFlashGuard,
  limiterIsFor,
} from '../../../renderer/graph/sceneFlashGuard';

/**
 * Who a scene is drawn through the brightness limiter for.
 *
 * The limiter holds a flash back by blending the last picture shown into the
 * new one, and on a scene moving fast that paints the previous frame's detail
 * over this one: a gem at full speed came out with two sets of facets on it,
 * which is what a ghost is, measured at a tenth of the picture wrong. That is
 * worth it for a scene another member made, which reaches somebody's eyes
 * with nobody having watched it first, and wrong for a scene FluidEQ released
 * — those are watched before release — and wrong for the listener's own,
 * which they built and watched themselves.
 *
 * It was written out four times, once per surface, and they disagreed: the
 * Studio's stage showed a scene as it is while the graph and the gallery
 * showed the same scene, made by the same listener, ghosted. So a source now
 * states one fact — who made its scene — and the runner alone decides what
 * follows. Pinned here because nothing else can see it: the decision ends up
 * as one argument to a worker, no test can query it by role, and rendering
 * any of these surfaces mounts a page's worth of context that would mock away
 * the line that matters.
 */

const wiring = (file: string) =>
  readFileSync(join(__dirname, '../../../renderer', file), 'utf8');

/** Every surface that draws a scene through the runner. */
const SURFACES = [
  'graph/SceneCanvas.tsx',
  'plus/ScenePreview.tsx',
  'wallpaper/WallpaperSurface.tsx',
  'studio/StudioStage.tsx',
];

describe('who the brightness limiter is for', () => {
  it('is decided once, by the runner, from a fact the source states', () => {
    SURFACES.forEach((file) => {
      expect(wiring(file)).toContain('madeBy');
      // No surface reaches for the limiter itself any more.
      expect(wiring(file)).not.toContain('createGuard');
      expect(wiring(file)).not.toContain('createFlashGuard');
    });
    expect(wiring('graph/useSceneRunner.ts')).toContain(
      'limiterIsFor(sourceRef.current.madeBy)',
    );
  });

  it('holds another member’s scene and spares the two that were watched', () => {
    expect(limiterIsFor('member')).toBe(true);
    // FluidEQ's own are watched before release; the listener's own they made.
    expect(limiterIsFor('fluideq')).toBe(false);
    expect(limiterIsFor('listener')).toBe(false);
  });

  it('tells the listener’s own scene from another member’s, everywhere', () => {
    // The graph and the scene page both draw a member's scene whoever made
    // it, so both pass the answer along rather than assuming one.
    expect(wiring('graph/SceneCanvas.tsx')).toContain(
      "madeBy: own ? 'listener' : 'member'",
    );
    expect(wiring('plus/ScenePage.tsx')).toContain(
      "madeBy={own ? 'listener' : 'member'}",
    );
    // The stage and the publish camera are the author's own work by
    // definition; a scene FluidEQ released is watched before it ships.
    expect(wiring('studio/StudioStage.tsx')).toContain("madeBy: 'listener'");
    expect(wiring('studio/StudioPublishCamera.tsx')).toContain(
      'madeBy="listener"',
    );
    expect(wiring('graph/SceneCanvas.tsx')).toContain("madeBy: 'fluideq'");
    // A desktop background is told a scene is a member's, never whose.
    expect(wiring('wallpaper/WallpaperSurface.tsx')).toContain(
      "madeBy: bootstrap.member ? 'member' : 'fluideq'",
    );
  });

  it('still has a limiter to apply', () => {
    // A test that passed because the limiter had been deleted proves nothing.
    expect(typeof createFlashGuard).toBe('function');
  });
});

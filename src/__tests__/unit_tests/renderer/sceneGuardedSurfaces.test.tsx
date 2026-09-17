/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { readFileSync } from 'fs';
import { join } from 'path';
import {
  createFlashGuard,
  flashGuardFor,
} from '../../../renderer/graph/sceneFlashGuard';

/**
 * Which surfaces draw a scene through the brightness limiter, and which show
 * it as it is drawn.
 *
 * The limiter holds a flash back by blending the last picture shown into the
 * new one, and on a scene moving fast that paints the previous frame's detail
 * over this one: a gem at full speed came out with two sets of facets on it,
 * which is what a ghost is, measured at a tenth of the picture wrong. That is
 * worth it everywhere somebody meets a scene nobody has watched — the graph,
 * the desktop background, the gallery's previews — and wrong on the Studio's
 * stage, which IS the watching: the author is at the machine looking at their
 * own work, and a scene slowed down to escape the limiter is slowed for
 * everyone.
 *
 * Pinned here because nothing else can see it. Whether a scene is guarded is
 * one argument handed to a worker; no test can query it by role, rendering
 * any of these four mounts a page's worth of context and would mock away the
 * one line that matters, and putting it back on the stage would read as a
 * tidy-up. Each file is read instead, and the three that must have it are the
 * control for the one that must not: a wrong path or a renamed symbol fails
 * them together rather than passing silently.
 */

const wiring = (file: string) =>
  readFileSync(join(__dirname, '../../../renderer', file), 'utf8');

describe('the brightness limiter’s reach', () => {
  it('is decided in one place, which every surface asks', () => {
    // Four files once each named the limiter themselves and disagreed: the
    // Studio's stage showed a scene as it is while the graph showed the same
    // scene, made by the same listener, ghosted.
    [
      'graph/SceneCanvas.tsx',
      'plus/ScenePreview.tsx',
      'wallpaper/WallpaperSurface.tsx',
      'studio/StudioStage.tsx',
    ].forEach((file) => {
      expect(wiring(file)).toContain('flashGuardFor');
      expect(wiring(file)).not.toContain('createGuard: createFlashGuard');
    });
  });

  it('spares a scene the listener made and holds one they did not', () => {
    expect(flashGuardFor(true)).toBeUndefined();
    expect(flashGuardFor(false)).toBe(createFlashGuard);
  });

  it('asks it of the listener’s own scene on the graph, and of nobody’s on the stage', () => {
    // The graph draws a member's scene whoever made it, so it passes the
    // answer along; the stage is the author's own work by definition.
    expect(wiring('graph/SceneCanvas.tsx')).toContain('flashGuardFor(own)');
    expect(wiring('studio/StudioStage.tsx')).toContain('flashGuardFor(true)');
    // The gallery shows other members' scenes, and main tells a desktop
    // background that a scene is a member's without saying whose.
    expect(wiring('plus/ScenePreview.tsx')).toContain('flashGuardFor(false)');
    expect(wiring('wallpaper/WallpaperSurface.tsx')).toContain(
      'bootstrap.member ? flashGuardFor(false) : undefined',
    );
  });

  it('still has a limiter to apply', () => {
    // A test that passed because the limiter had been deleted proves nothing.
    expect(typeof createFlashGuard).toBe('function');
  });
});

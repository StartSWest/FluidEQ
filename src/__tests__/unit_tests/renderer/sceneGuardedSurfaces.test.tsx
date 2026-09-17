/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { readFileSync } from 'fs';
import { join } from 'path';
import { createFlashGuard } from '../../../renderer/graph/sceneFlashGuard';

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
  it('is applied wherever somebody meets a scene nobody has watched', () => {
    expect(wiring('graph/SceneCanvas.tsx')).toContain(
      'createGuard: createFlashGuard',
    );
    expect(wiring('plus/ScenePreview.tsx')).toContain(
      'createGuard: createFlashGuard',
    );
    // The desktop background draws FluidEQ's own scenes as well as members',
    // and guards a member's alone.
    expect(wiring('wallpaper/WallpaperSurface.tsx')).toContain(
      'createGuard: bootstrap.member ? createFlashGuard : undefined',
    );
  });

  it('is not applied on the Studio’s stage', () => {
    const stage = wiring('studio/StudioStage.tsx');
    expect(stage).not.toContain('createGuard');
    expect(stage).not.toContain('createFlashGuard');
    // The stage still builds a scene source and still warms up: a stage that
    // had stopped drawing altogether would pass the two lines above.
    expect(stage).toContain('createLadder: createWarmupLadder');
  });

  it('still has a limiter to apply', () => {
    // A test that passed because the limiter had been deleted proves nothing.
    expect(typeof createFlashGuard).toBe('function');
  });
});

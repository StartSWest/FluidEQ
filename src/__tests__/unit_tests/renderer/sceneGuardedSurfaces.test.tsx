/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { readFileSync } from 'fs';
import { join } from 'path';
import { sceneMakerOf } from '../../../common/sceneMaker';
import { createFlashGuard } from '../../../renderer/graph/sceneFlashGuard';
import { createCostLadder } from '../../../renderer/graph/sceneHealth';
import { sceneRulesFor } from '../../../renderer/graph/sceneRules';
import { createWarmupLadder } from '../../../renderer/graph/sceneWarmup';

/**
 * How a scene is run, decided by who made it and the same in every place it
 * plays.
 *
 * The brightness limiter holds a flash back by blending the last picture
 * shown into the new one, and on a scene moving fast that paints the previous
 * frame's detail over this one: a gem at full speed came out with two sets of
 * facets on it, which is what a ghost is. It was written out once per place,
 * and the places disagreed — the Studio's stage showed a scene as it is while
 * the graph and the gallery showed the same scene ghosted — and once that was
 * put in one decision, the desktop still stated its own: told only that a
 * member had made its scene, it ran the listener's own Dancing Cat through the
 * limiter beside a clean Studio. The size ladder and resting in silence had
 * drifted the same way. So a place now states one fact, who made its scene,
 * and the runner alone reads what follows from `sceneRules.ts`. Pinned here
 * because nothing else can see it: the decision ends up as arguments to a
 * worker, no test can query it by role, and rendering any of these places
 * mounts a page's worth of context that would mock away the line that
 * matters.
 */

const wiring = (file: string) =>
  readFileSync(join(__dirname, '../../../renderer', file), 'utf8');

/** Every place that states a source for the runner. */
const SURFACES = [
  'graph/SceneCanvas.tsx',
  'plus/ScenePreview.tsx',
  // The desktop page draws each visualizer in a layer of its own, which is
  // where its source is stated (`sceneCrossfade.ts`).
  'wallpaper/WallpaperSceneLayer.tsx',
  'studio/StudioStage.tsx',
];

/** What a place could once ask for itself, and now cannot. */
const PLACE_CHOICES = [
  'createGuard',
  'createFlashGuard',
  'createLadder',
  'createWarmupLadder',
  'createCostLadder',
  'restsInSilence',
  'warmWhenUnseen',
];

describe('how a scene is run', () => {
  it('is decided once, by the runner, from who made it', () => {
    SURFACES.forEach((file) => {
      const text = wiring(file);
      expect(text).toContain('madeBy');
      PLACE_CHOICES.forEach((choice) => expect(text).not.toContain(choice));
    });
    const runner = wiring('graph/useSceneRunner.ts');
    expect(runner).toContain('sceneRulesFor(sourceRef.current.madeBy)');
    expect(runner).not.toContain('restsInSilence');
  });

  it('limits another member’s scene and spares the two that were watched', () => {
    expect(sceneRulesFor('member').limited).toBe(true);
    // FluidEQ's own are watched before release; the listener's own they made.
    expect(sceneRulesFor('fluideq').limited).toBe(false);
    expect(sceneRulesFor('listener').limited).toBe(false);
  });

  it('starts FluidEQ’s own at full size and warms every member’s up', () => {
    expect(sceneRulesFor('fluideq').createLadder).toBe(createCostLadder);
    expect(sceneRulesFor('listener').createLadder).toBe(createWarmupLadder);
    expect(sceneRulesFor('member').createLadder).toBe(createWarmupLadder);
    expect(sceneRulesFor('fluideq').warmWhenUnseen).toBe(true);
    expect(sceneRulesFor('listener').warmWhenUnseen).toBe(false);
    expect(sceneRulesFor('member').warmWhenUnseen).toBe(false);
  });

  it('tells the listener’s own scene from another member’s', () => {
    expect(sceneMakerOf({ member: false, own: false })).toBe('fluideq');
    expect(sceneMakerOf({ member: true, own: true })).toBe('listener');
    expect(sceneMakerOf({ member: true, own: false })).toBe('member');
  });

  it('asks every place for the same fact, the desktop included', () => {
    expect(wiring('graph/SceneCanvas.tsx')).toContain('sceneMakerOf(');
    expect(wiring('plus/ScenePage.tsx')).toContain('sceneMakerOf(');
    expect(wiring('plus/ReviewScene.tsx')).toContain('sceneMakerOf(');
    expect(wiring('player/useGraphScenePack.ts')).toContain('sceneMakerOf(');
    // Main's word, never worked out by the page (`wallpaperScenes.test.ts`).
    expect(wiring('wallpaper/WallpaperSceneLayer.tsx')).toContain(
      'madeBy: bootstrap.madeBy',
    );
    // The stage and the publish camera are the author's own work by
    // definition.
    expect(wiring('studio/StudioStage.tsx')).toContain("madeBy: 'listener'");
    expect(wiring('studio/StudioPublishCamera.tsx')).toContain(
      'madeBy="listener"',
    );
  });

  it('still has a limiter to apply', () => {
    // A test that passed because the limiter had been deleted proves nothing.
    expect(typeof createFlashGuard).toBe('function');
  });
});

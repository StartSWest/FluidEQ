/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { sceneMakerOf, type TSceneMaker } from 'common/sceneMaker';
import type { IScenePack } from 'common/scenePacks';
import { loadScenePack, type IUsableScene } from '../utils/scenePacks';
import {
  loadMemberScene,
  type IUsableMemberScene,
} from '../utils/memberScenes';

/**
 * What the graph's scene is, said once for the canvas that draws it
 * (`SceneCanvas`) and for Auto, which builds the next one ahead of it
 * (`scenePreload.ts`): the two have to agree on which scene, which version
 * and who made it, or what was built ahead is never the one drawn.
 */

export type TDrawableScene = IUsableScene | IUsableMemberScene;

export const isMemberScene = (
  scene: TDrawableScene,
): scene is IUsableMemberScene => 'kind' in scene && scene.kind === 'member';

/** What a scene is drawn as: a new one starts the clock and the fade again. */
export const sceneIdentityOf = (scene: TDrawableScene): string =>
  isMemberScene(scene) ? scene.lookId : scene.id;

/** The version built: a member's revision, else the pack's number. */
export const sceneVersionOf = (scene: TDrawableScene): string =>
  scene.revision ?? String(scene.version);

/** Who made it, which decides how it is run (`sceneRules.ts`). */
export const sceneMakerOfDrawable = (scene: TDrawableScene): TSceneMaker => {
  const member = isMemberScene(scene);
  return sceneMakerOf({ member, own: member && scene.own });
};

/** The pack itself, from wherever this kind of scene is kept. */
export const loadDrawableScene = (
  scene: TDrawableScene,
): Promise<IScenePack | undefined> =>
  isMemberScene(scene)
    ? loadMemberScene(scene.lookId)
    : loadScenePack(sceneIdentityOf(scene));

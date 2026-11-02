/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  isPremiumLookId,
  packIdOfLook,
  type IScenePack,
} from '../../common/scenePacks';
import type { IMemberLooks, IOfficialLooks } from '../wallpaper/scenes';

/**
 * The scene the desk lights play, from whichever store holds that kind of
 * look, behind the same gates the window's own loads go through: a FluidEQ
 * look only while this account owns it (`scene-packs-load`), a member's
 * look only while it is one this account can see (`member-scenes-load`).
 * The window said which look; main asks again, because the lamps keep
 * playing long after the window that said so is gone.
 */
export const createLampSceneSource = (
  official: Pick<IOfficialLooks, 'store' | 'subscribeScenes'>,
  member: Pick<IMemberLooks, 'loadVisible' | 'subscribeScenes'>,
  ownership: {
    owns(lookId: string): boolean;
    subscribe(listener: () => void): () => void;
  },
) => ({
  loadScene: (lookId: string): IScenePack | undefined => {
    if (isPremiumLookId(lookId)) {
      return ownership.owns(lookId)
        ? official.store.load(packIdOfLook(lookId))
        : undefined;
    }
    return member.loadVisible(lookId)?.pack;
  },
  /** A scene installed, updated or taken away, or what the account owns. */
  subscribeScenes: (listener: () => void): (() => void) => {
    const stops = [
      official.subscribeScenes(listener),
      member.subscribeScenes(listener),
      ownership.subscribe(listener),
    ];
    return () => stops.forEach((stop) => stop());
  },
});

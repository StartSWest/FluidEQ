/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { ipcMain } from 'electron';
import { memberLookId } from '../../common/memberScenes';
import { FLUIDEQ_CREATOR_ID } from '../../common/plusGallery';
import type { IKeptSceneVersions } from '../../common/sceneStore';
import { premiumLookId } from '../../common/scenePacks';
import type { IVersionPins } from '../keptVersions';
import type { IMemberSceneStore } from '../memberScenes/store';
import { sceneRefOf } from '../plus/galleryAccess';
import type { ISceneOwnership } from '../plus/sceneOwnership';
import type { IScenePackStore } from '../scenePackStore';

/**
 * Which earlier versions of a scene this computer kept, and which one plays
 * (`keptVersions.ts`). Asked and answered on this computer alone: the server
 * holds only a scene's current file, and an owner going back to the version
 * they liked downloads nothing.
 *
 * Owners only. A scene this account does not own plays no version at all,
 * and a pin left behind by an account that owned it is not honoured here
 * either: the stores are asked only after `owns`.
 */

const CHANNELS = ['scene-versions-kept', 'scene-versions-play'] as const;

export interface ISceneVersionsDeps {
  pins: IVersionPins;
  officialStore: Pick<IScenePackStore, 'keptVersions'>;
  memberStore: Pick<IMemberSceneStore, 'keptVersions'>;
  ownership: Pick<ISceneOwnership, 'owns'>;
  /** The looks' lists, told that a scene now plays another version. */
  announceOfficial: () => void;
  announceMember: () => void;
}

export const registerSceneVersionsIpc = ({
  pins,
  officialStore,
  memberStore,
  ownership,
  announceOfficial,
  announceMember,
}: ISceneVersionsDeps) => {
  /** The scene a page names, when this account owns it. */
  const ownedScene = (authorId: unknown, sceneId: unknown) => {
    const ref = sceneRefOf(authorId, sceneId);
    if (!ref) {
      return undefined;
    }
    const official = ref.authorId === FLUIDEQ_CREATOR_ID;
    const lookId = official
      ? premiumLookId(ref.packId)
      : memberLookId(ref.authorId, ref.packId);
    if (!ownership.owns(lookId)) {
      return undefined;
    }
    return {
      lookId,
      kept: () =>
        official
          ? officialStore.keptVersions(ref.packId)
          : memberStore.keptVersions(ref.authorId, ref.packId),
      announce: official ? announceOfficial : announceMember,
    };
  };

  ipcMain.handle(
    'scene-versions-kept',
    (_event, authorId: unknown, sceneId: unknown): IKeptSceneVersions => {
      const scene = ownedScene(authorId, sceneId);
      if (!scene) {
        return { versions: [] };
      }
      const versions = scene.kept();
      const playing = pins.pinned(scene.lookId);
      return playing !== undefined && versions.includes(playing)
        ? { versions, playing }
        : { versions };
    },
  );

  // `null` is the newest again. A version this computer did not keep is
  // refused rather than pinned: a pin to nothing would play the newest while
  // the page said otherwise.
  ipcMain.handle(
    'scene-versions-play',
    (
      _event,
      authorId: unknown,
      sceneId: unknown,
      version: unknown,
    ): boolean => {
      const scene = ownedScene(authorId, sceneId);
      if (!scene) {
        return false;
      }
      if (version === null) {
        pins.pin(scene.lookId, undefined);
      } else if (
        typeof version === 'number' &&
        Number.isInteger(version) &&
        scene.kept().includes(version)
      ) {
        pins.pin(scene.lookId, version);
      } else {
        return false;
      }
      scene.announce();
      return true;
    },
  );

  return () => CHANNELS.forEach((channel) => ipcMain.removeHandler(channel));
};

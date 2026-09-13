import { ipcMain } from 'electron';
import { FLUIDEQ_CREATOR_ID } from '../../common/plusGallery';
import type { IScenePack } from '../../common/scenePacks';
import { sceneRefOf, type IGalleryAccess } from '../plus/galleryAccess';
import { fetchOfficialScene } from '../plus/officialGallery';
import type { IScenePackStore } from '../scenePackStore';
import type { TInspection } from './memberScenes';

/**
 * "Open in Studio" for FluidEQ's own scenes, over IPC: the scene written out
 * as a Studio project to look inside and take ideas from.
 *
 * Only FluidEQ's scenes, and that is decided here, by signature, never by
 * the page. The page sends a scene id and nothing else; the scene is the one
 * the official store holds or the one the server sends for that id, and both
 * are verified against FluidEQ's own key, which no member's scene is signed
 * with. There is no member path in this file at all, so a page that asks for
 * a member's scene id gets FluidEQ's scene of that name or nothing.
 *
 * The project is marked where the member cannot unmark it, in the app's own
 * list, and the Studio then refuses to add, export or publish it. The server
 * refuses a scene that is mostly one of FluidEQ's whatever folder it comes
 * from (`sceneFingerprint.ts`), which is what holds against a copy.
 */

export type TInspectOutcome =
  | TInspection
  | 'not-entitled'
  /** Not in the official store, and could not be fetched and verified. */
  | 'unavailable'
  /** The disk refused the project's files. */
  | 'failed';

export interface IStudioInspectIpcDeps {
  access: IGalleryAccess;
  officialStore: IScenePackStore;
  openInspection: (pack: IScenePack) => Promise<TInspection>;
  logger?: { warn(message: string): void };
}

const CHANNEL = 'studio-inspect-official';

export const registerStudioInspectIpc = ({
  access,
  officialStore,
  openInspection,
  logger,
}: IStudioInspectIpcDeps): (() => void) => {
  ipcMain.handle(
    CHANNEL,
    async (_event, sceneId: unknown): Promise<TInspectOutcome> => {
      // The id checked as a look id is, under FluidEQ's own author.
      const ref = sceneRefOf(FLUIDEQ_CREATOR_ID, sceneId);
      const me = access.accountId();
      if (!access.entitled() || !me) {
        return 'not-entitled';
      }
      if (!ref) {
        return 'unavailable';
      }
      let pack = officialStore.load(ref.packId);
      if (!pack) {
        const auth = await access.auth();
        pack = auth
          ? (await fetchOfficialScene(auth, ref.packId))?.pack
          : undefined;
      }
      // The account that asked is still the one signed in, still with Plus.
      if (!access.entitled() || access.accountId() !== me) {
        return 'not-entitled';
      }
      if (!pack) {
        return 'unavailable';
      }
      try {
        return await openInspection(pack);
      } catch (error) {
        logger?.warn(
          `Opening a FluidEQ scene in the Studio failed: ${String(error)}`,
        );
        return 'failed';
      }
    },
  );
  return () => ipcMain.removeHandler(CHANNEL);
};

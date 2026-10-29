import { dialog, ipcMain, shell, type BrowserWindow } from 'electron';
import { parseMemberLookId } from '../../common/memberScenes';
import type { IScenePack } from '../../common/scenePacks';
import type { IAccountSession } from '../account/session';
import type { IVersionPins } from '../keptVersions';
import type { ISceneOwnership } from '../plus/sceneOwnership';
import {
  createMemberSceneStore,
  type IMemberSceneStore,
} from '../memberScenes/store';
import {
  loadVisibleScene,
  sceneListing,
  visibleScenes,
  type IMemberScenesListing,
  type ISceneViewer,
  type IVisibleScene,
} from '../memberScenes/visibleScenes';
import { isSceneFailure, type TSceneFailure } from '../scenePackStore';
import {
  registerStudioProjectsIpc,
  type IStudioProjectsIpcRegistration,
} from './studioProjectsIpc';
import type { TInspection, TProjectRestore } from './studioProjectTypes';

/**
 * Member scenes, as the renderer sees them, and the Studio hung off them.
 *
 * A member scene plays for an account that owns it — bought, or its own,
 * published or not (`mayPlayLook`) — asked fresh on every call rather than once at
 * startup, exactly as FluidEQ's own looks are. Removing one does not ask: a
 * member can always take a scene out of the app.
 *
 * What is here is the scenes themselves — which of them this account may see,
 * load and remove. The Studio's projects are `studioProjectsIpc.ts`, which
 * this starts and hands the two things it cannot answer for itself: who is
 * signed in, and how to say the scene list has changed.
 */

export type { IMemberScenesListing } from '../memberScenes/visibleScenes';
export type {
  ILinkFolderResult,
  IStudioProject,
  IStudioState,
  TAddOutcome,
  TInspection,
  TNewProjectResult,
  TProjectRestore,
  TRenameProjectResult,
} from './studioProjectTypes';

interface IDialogLike {
  showOpenDialog: typeof dialog.showOpenDialog;
}

export interface IMemberScenesIpcDeps {
  getMainWindow: () => BrowserWindow | null;
  userDataDir: string;
  /** The member's Documents folder, where projects go until they choose. */
  documentsDir: string;
  session: IAccountSession;
  /** Which scenes this account may play (`plus/sceneOwnership.ts`). */
  ownership: Pick<ISceneOwnership, 'owns' | 'subscribe'>;
  /** Which earlier version each look plays (`keptVersions.ts`). */
  pins?: IVersionPins;
  logger?: { info(message: string): void; warn(message: string): void };
  dialogImpl?: IDialogLike;
  openPath?: (target: string) => Promise<string>;
}

export interface IMemberScenesIpcRegistration {
  store: IMemberSceneStore;
  /**
   * The same account and ownership check as the renderer's load request,
   * and whether this account made the scene: a desktop background is run
   * by who made it (`sceneRules.ts`), as the window's own list says.
   */
  loadVisible(lookId: unknown): IVisibleScene | undefined;
  /**
   * The look ids of every scene this account holds here, playable or not:
   * what the lamps' gate counts a maker's own scene from. Read again only
   * after the list is announced, because the gate asks on every frame.
   */
  heldLookIds(): readonly string[];
  subscribeScenes(listener: () => void): () => void;
  /**
   * A member's look would not run here, right now. The graph reports through
   * its channel; a desktop background through main. Logged for operator
   * visibility only — it does not stop a later attempt at the same scene.
   */
  reportFailure(lookId: string, reason: TSceneFailure): void;
  /** The open project's folder, for export and publish. */
  activeFolder(): string | undefined;
  /** Whether the open project is a FluidEQ scene, opened only to look inside. */
  activeIsInspection(): boolean;
  /** Whether the open project may be used; what publishing asks. */
  mayUseActive(): boolean;
  /** The member's own imported scene, back on the Studio's list. */
  restoreOwnProject(pack: IScenePack): Promise<TProjectRestore>;
  /** One of FluidEQ's own, written out as a project to look inside. */
  openInspection(pack: IScenePack): Promise<TInspection>;
  /** The Studio's list, as far as the member's AI may reach it. */
  agentProject: IStudioProjectsIpcRegistration['agentProject'];
  /** The scene list changed outside this file: an import, a takedown. */
  announce(): void;
  /**
   * A publication landed: what went out becomes the author's own look, so
   * the graph plays it from that moment (Ivan, 2026-10-21: "after publishing
   * an scene it needs to show in grahp").
   */
  keepPublished(author: string, pack: IScenePack): void;
  dispose(): void;
}

const CHANNELS = [
  'member-scenes-list',
  'member-scenes-load',
  'member-scenes-remove',
  'member-scenes-report-failure',
] as const;

export const registerMemberScenesIpc = ({
  getMainWindow,
  userDataDir,
  documentsDir,
  session,
  ownership,
  pins,
  logger,
  dialogImpl = dialog,
  openPath = (target) => shell.openPath(target),
}: IMemberScenesIpcDeps): IMemberScenesIpcRegistration => {
  const store = createMemberSceneStore({ userDataDir, pins, logger });

  const accountId = () => session.state().identity?.id;

  /** Who is asking, for the rules in `visibleScenes.ts`. */
  const viewer: ISceneViewer = {
    accountId,
    owns: (lookId) => ownership.owns(lookId),
  };

  const visible = () => visibleScenes(store, viewer);

  const listing = (): IMemberScenesListing => sceneListing(store, viewer);

  const loadVisible = (lookId: unknown): IVisibleScene | undefined =>
    loadVisibleScene(store, viewer, lookId);

  const sceneListeners = new Set<() => void>();

  // Every change to the store, and every change of account or ownership, is
  // announced, so the ids read since the last announcement are still true.
  let held: readonly string[] | undefined;
  const heldLookIds = () => {
    held ??= visible().map((scene) => scene.lookId);
    return held;
  };

  const announceScenes = () => {
    held = undefined;
    getMainWindow()?.webContents.send('member-scenes-changed', listing());
    sceneListeners.forEach((listener) => listener());
  };

  const studio = registerStudioProjectsIpc({
    getMainWindow,
    userDataDir,
    documentsDir,
    store,
    accountId,
    announceScenes,
    dialogImpl,
    openPath,
    ...(logger ? { logger } : {}),
  });

  // A buy, a publication, an account changing, Plus: which scenes play
  // changed, and the Studio settles on a project the account may use.
  const unsubscribe = ownership.subscribe(() => {
    studio.accountChanged();
    announceScenes();
  });

  ipcMain.handle('member-scenes-list', () => listing());

  ipcMain.handle('member-scenes-load', (_event, lookId: unknown) => {
    return loadVisible(lookId)?.pack;
  });

  ipcMain.handle('member-scenes-remove', (_event, lookId: unknown) => {
    const ref =
      typeof lookId === 'string' ? parseMemberLookId(lookId) : undefined;
    // Only a scene this account can see may be removed by it. Not gated on
    // Plus: a member whose membership ended may still take their work out.
    const seen =
      ref !== undefined &&
      visible().some(
        (scene) =>
          scene.authorId === ref.authorId && scene.packId === ref.packId,
      );
    if (!ref || !seen) {
      return false;
    }
    const removed = store.remove(ref.authorId, ref.packId);
    if (removed) {
      announceScenes();
    }
    return removed;
  });

  const reportFailure = (lookId: string, reason: TSceneFailure) => {
    const ref = parseMemberLookId(lookId);
    if (!ref) {
      return;
    }
    // Diagnostic only: nothing here gates a later attempt at the same scene.
    logger?.warn(`Member scene ${lookId} failed to run here: ${reason}.`);
  };

  ipcMain.handle(
    'member-scenes-report-failure',
    (_event, lookId: unknown, reason: unknown) => {
      if (typeof lookId === 'string' && isSceneFailure(reason)) {
        reportFailure(lookId, reason);
      }
    },
  );

  return {
    store,
    loadVisible,
    heldLookIds,
    subscribeScenes: (listener) => {
      sceneListeners.add(listener);
      return () => {
        sceneListeners.delete(listener);
      };
    },
    reportFailure,
    activeFolder: studio.activeFolder,
    activeIsInspection: studio.activeIsInspection,
    mayUseActive: studio.mayUseActive,
    restoreOwnProject: studio.restoreOwnProject,
    openInspection: studio.openInspection,
    agentProject: studio.agentProject,
    announce: announceScenes,
    keepPublished: (author, pack) => {
      try {
        store.save(author, pack);
      } catch (error) {
        logger?.warn(
          `Keeping published scene ${pack.id} in the looks failed: ${String(error)}`,
        );
        return;
      }
      announceScenes();
      studio.announceStudio();
    },
    dispose: () => {
      unsubscribe();
      studio.dispose();
      CHANNELS.forEach((channel) => ipcMain.removeHandler(channel));
    },
  };
};

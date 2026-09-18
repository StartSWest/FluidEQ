import { dialog, ipcMain, shell, type BrowserWindow } from 'electron';
import { parseMemberLookId } from '../../common/memberScenes';
import type { IScenePack } from '../../common/scenePacks';
import type { IEntitlement } from '../account/entitlement';
import type { IAccountSession } from '../account/session';
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
} from '../memberScenes/visibleScenes';
import { isSceneFailure, type TSceneFailure } from '../scenePackStore';
import { registerStudioProjectsIpc } from './studioProjectsIpc';
import type { TInspection, TProjectRestore } from './studioProjectTypes';

/**
 * Member scenes, as the renderer sees them, and the Studio hung off them.
 *
 * Everything that makes or runs a member scene needs an active Plus
 * membership, asked fresh on every call rather than once at startup, exactly
 * as the Plus looks are. Removing one's own scene does not: a member whose
 * membership ended can still take their work out of the app.
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
  entitlement: IEntitlement;
  logger?: { info(message: string): void; warn(message: string): void };
  dialogImpl?: IDialogLike;
  openPath?: (target: string) => Promise<string>;
}

export interface IMemberScenesIpcRegistration {
  store: IMemberSceneStore;
  /** The same account and entitlement check as the renderer's load request. */
  loadVisible(lookId: unknown): IScenePack | undefined;
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
  /** The member's own imported scene, back on the Studio's list. */
  restoreOwnProject(pack: IScenePack): Promise<TProjectRestore>;
  /** One of FluidEQ's own, written out as a project to look inside. */
  openInspection(pack: IScenePack): Promise<TInspection>;
  /** The scene list changed outside this file: an import, a takedown. */
  announce(): void;
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
  entitlement,
  logger,
  dialogImpl = dialog,
  openPath = (target) => shell.openPath(target),
}: IMemberScenesIpcDeps): IMemberScenesIpcRegistration => {
  const store = createMemberSceneStore({ userDataDir, logger });

  const accountId = () => session.state().identity?.id;
  const entitled = () =>
    entitlement.status().state !== 'none' && accountId() !== undefined;

  /** Who is asking, for the rules in `visibleScenes.ts`. */
  const viewer: ISceneViewer = { accountId, entitled };

  const visible = () => visibleScenes(store, viewer);

  const listing = (): IMemberScenesListing => sceneListing(store, viewer);

  const loadVisible = (lookId: unknown): IScenePack | undefined =>
    loadVisibleScene(store, viewer, lookId);

  const sceneListeners = new Set<() => void>();

  const announceScenes = () => {
    getMainWindow()?.webContents.send('member-scenes-changed', listing());
    sceneListeners.forEach((listener) => listener());
  };

  const studio = registerStudioProjectsIpc({
    getMainWindow,
    userDataDir,
    documentsDir,
    store,
    accountId,
    entitled,
    announceScenes,
    dialogImpl,
    openPath,
    ...(logger ? { logger } : {}),
  });

  const unsubscribe = entitlement.subscribe(() => {
    // Losing Plus moves the bench off a FluidEQ scene opened to look inside
    // and stops its watcher; gaining it (with the Studio open) starts one.
    // Either way both views are told.
    studio.entitlementChanged();
    announceScenes();
  });

  ipcMain.handle('member-scenes-list', () => listing());

  ipcMain.handle('member-scenes-load', (_event, lookId: unknown) => {
    return loadVisible(lookId);
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
    subscribeScenes: (listener) => {
      sceneListeners.add(listener);
      return () => {
        sceneListeners.delete(listener);
      };
    },
    reportFailure,
    activeFolder: studio.activeFolder,
    activeIsInspection: studio.activeIsInspection,
    restoreOwnProject: studio.restoreOwnProject,
    openInspection: studio.openInspection,
    announce: announceScenes,
    dispose: () => {
      unsubscribe();
      studio.dispose();
      CHANNELS.forEach((channel) => ipcMain.removeHandler(channel));
    },
  };
};

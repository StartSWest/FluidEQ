import { dialog, ipcMain, shell, type BrowserWindow } from 'electron';
import fs from 'fs';
import path from 'path';
import { parseMemberLookId } from '../../common/memberScenes';
import type { IEntitlement } from '../account/entitlement';
import type { IAccountSession } from '../account/session';
import writeFileAtomically from '../atomicWrite';
import {
  readProject,
  writeStarterProject,
  type TProjectBuild,
} from '../memberScenes/project';
import {
  watchProject,
  type IProjectWatcher,
} from '../memberScenes/projectWatcher';
import {
  createMemberSceneStore,
  type IMemberSceneStore,
  type IMemberSceneSummary,
} from '../memberScenes/store';
import type { TSceneFailure } from '../scenePackStore';

/**
 * Member scenes and the Studio, as the renderer sees them.
 *
 * Everything that makes or runs a member scene needs an active Plus
 * membership, asked fresh on every call rather than once at startup, exactly
 * as the Plus looks are. Removing one's own scene does not: a member whose
 * membership ended can still take their work out of the app.
 *
 * NO PATH EVER COMES FROM THE PAGE. Folders are chosen in the system dialog
 * here, and "Add to my looks" saves the build this process made from the
 * linked folder — never a pack the renderer hands back. The renderer is told
 * the folder's path so the member can see which one is linked; it cannot
 * send one.
 *
 * The folder is watched only while the Studio is open. Closing it, losing
 * Plus, or quitting stops the watcher.
 */

export interface IMemberScenesListing {
  entitled: boolean;
  /**
   * The member's own scenes and the ones other members sent them, when they
   * may be drawn.
   */
  scenes: IMemberSceneSummary[];
  /** The same scenes while Plus is off: shown locked, never deleted. */
  locked: IMemberSceneSummary[];
}

export interface IStudioState {
  entitled: boolean;
  /** The linked folder, for display. Never accepted back from the page. */
  folder?: { name: string; path: string };
  /** The latest build of the linked folder, while the Studio is open. */
  build?: TProjectBuild;
}

export type TStarterOutcome = 'written' | 'exists' | 'cancelled' | 'refused';

export type TAddOutcome =
  | { ok: true; scene: IMemberSceneSummary }
  | { ok: false; reason: 'not-entitled' | 'no-build' | 'refused' };

interface IDialogLike {
  showOpenDialog: typeof dialog.showOpenDialog;
}

export interface IMemberScenesIpcDeps {
  getMainWindow: () => BrowserWindow | null;
  userDataDir: string;
  session: IAccountSession;
  entitlement: IEntitlement;
  logger?: { info(message: string): void; warn(message: string): void };
  dialogImpl?: IDialogLike;
  openPath?: (target: string) => Promise<string>;
}

export interface IMemberScenesIpcRegistration {
  store: IMemberSceneStore;
  /** The Studio's linked folder, for sharing's export. */
  linkedFolder(): string | undefined;
  /** Tell the renderer the list of member scenes changed. */
  announce(): void;
  dispose(): void;
}

const CHANNELS = [
  'member-scenes-list',
  'member-scenes-load',
  'member-scenes-remove',
  'member-scenes-report-failure',
  'studio-open',
  'studio-close',
  'studio-link-folder',
  'studio-unlink',
  'studio-create-starter',
  'studio-add-to-looks',
  'studio-show-folder',
] as const;

const STUDIO_FILE = path.join('member-scenes', 'studio.json');

export const registerMemberScenesIpc = ({
  getMainWindow,
  userDataDir,
  session,
  entitlement,
  logger,
  dialogImpl = dialog,
  openPath = (target) => shell.openPath(target),
}: IMemberScenesIpcDeps): IMemberScenesIpcRegistration => {
  const store = createMemberSceneStore({ userDataDir, logger });
  const studioPath = path.join(userDataDir, STUDIO_FILE);

  const readLinkedFolder = (): string | undefined => {
    try {
      const parsed: unknown = JSON.parse(fs.readFileSync(studioPath, 'utf8'));
      const folder =
        typeof parsed === 'object' && parsed !== null
          ? (parsed as { folder?: unknown }).folder
          : undefined;
      return typeof folder === 'string' ? folder : undefined;
    } catch {
      return undefined;
    }
  };

  let linkedFolder = readLinkedFolder();
  let studioOpen = false;
  let watcher: IProjectWatcher | undefined;
  let lastBuild: TProjectBuild | undefined;

  const accountId = () => session.state().identity?.id;
  const entitled = () =>
    entitlement.status().state !== 'none' && accountId() !== undefined;

  /**
   * This account's scenes and the ones other members sent it. Scenes another
   * account on this computer made are theirs, and not listed here.
   */
  const visible = () => {
    const me = accountId();
    return me
      ? store.list().filter((scene) => !scene.own || scene.authorId === me)
      : [];
  };

  const listing = (): IMemberScenesListing => {
    const scenes = visible();
    return entitled()
      ? { entitled: true, scenes, locked: [] }
      : { entitled: false, scenes: [], locked: scenes };
  };

  const isVisible = (authorId: string, packId: string) =>
    visible().some(
      (scene) => scene.authorId === authorId && scene.packId === packId,
    );

  const studioState = (): IStudioState => ({
    entitled: entitled(),
    ...(linkedFolder
      ? { folder: { name: path.basename(linkedFolder), path: linkedFolder } }
      : {}),
    ...(studioOpen && lastBuild ? { build: lastBuild } : {}),
  });

  const announceScenes = () =>
    getMainWindow()?.webContents.send('member-scenes-changed', listing());
  const announceStudio = () =>
    getMainWindow()?.webContents.send('studio-changed', studioState());

  const stopWatching = () => {
    watcher?.close();
    watcher = undefined;
    lastBuild = undefined;
  };

  const startWatching = () => {
    stopWatching();
    if (!linkedFolder || !studioOpen || !entitled()) {
      return;
    }
    watcher = watchProject(linkedFolder, (build) => {
      lastBuild = build;
      announceStudio();
    });
  };

  const link = (folder: string | undefined) => {
    linkedFolder = folder;
    writeFileAtomically(studioPath, JSON.stringify(folder ? { folder } : {}));
    startWatching();
  };

  const chooseFolder = async (
    properties: Array<'openDirectory' | 'createDirectory'>,
  ): Promise<string | undefined> => {
    const window = getMainWindow();
    const options = { properties };
    const result = window
      ? await dialogImpl.showOpenDialog(window, options)
      : await dialogImpl.showOpenDialog(options);
    return result.canceled ? undefined : result.filePaths[0];
  };

  const unsubscribe = entitlement.subscribe(() => {
    // Losing Plus stops the watcher; gaining it (with the Studio open)
    // starts it. Either way both views are told.
    startWatching();
    announceScenes();
    announceStudio();
  });

  ipcMain.handle('member-scenes-list', () => listing());

  ipcMain.handle('member-scenes-load', (_event, lookId: unknown) => {
    const ref =
      typeof lookId === 'string' ? parseMemberLookId(lookId) : undefined;
    if (!ref || !entitled() || !isVisible(ref.authorId, ref.packId)) {
      return undefined;
    }
    return store.load(ref.authorId, ref.packId);
  });

  ipcMain.handle('member-scenes-remove', (_event, lookId: unknown) => {
    const ref =
      typeof lookId === 'string' ? parseMemberLookId(lookId) : undefined;
    if (!ref || !isVisible(ref.authorId, ref.packId)) {
      return false;
    }
    const removed = store.remove(ref.authorId, ref.packId);
    if (removed) {
      announceScenes();
    }
    return removed;
  });

  ipcMain.handle(
    'member-scenes-report-failure',
    (_event, lookId: unknown, reason: unknown) => {
      const ref =
        typeof lookId === 'string' ? parseMemberLookId(lookId) : undefined;
      if (ref && (reason === 'compile' || reason === 'context-lost')) {
        store.quarantine(ref.authorId, ref.packId, reason as TSceneFailure);
        announceScenes();
      }
    },
  );

  ipcMain.handle('studio-open', () => {
    studioOpen = true;
    startWatching();
    return studioState();
  });

  ipcMain.handle('studio-close', () => {
    studioOpen = false;
    stopWatching();
  });

  ipcMain.handle('studio-link-folder', async () => {
    if (!entitled()) {
      return studioState();
    }
    const folder = await chooseFolder(['openDirectory']);
    if (folder) {
      link(folder);
    }
    return studioState();
  });

  ipcMain.handle('studio-unlink', () => {
    link(undefined);
    return studioState();
  });

  ipcMain.handle(
    'studio-create-starter',
    async (): Promise<TStarterOutcome> => {
      if (!entitled()) {
        return 'refused';
      }
      const folder = await chooseFolder(['openDirectory', 'createDirectory']);
      if (!folder) {
        return 'cancelled';
      }
      const outcome = await writeStarterProject(folder);
      if (outcome === 'written') {
        link(folder);
      }
      return outcome;
    },
  );

  ipcMain.handle('studio-add-to-looks', async (): Promise<TAddOutcome> => {
    const me = accountId();
    if (!entitled() || !me) {
      return { ok: false, reason: 'not-entitled' };
    }
    if (!linkedFolder) {
      return { ok: false, reason: 'no-build' };
    }
    // Read the folder again rather than trusting the last watched build: the
    // press may land between a save and the watcher's rebuild.
    const build = await readProject(linkedFolder);
    if (!build.ok) {
      return { ok: false, reason: 'no-build' };
    }
    try {
      const scene = store.save(me, build.pack);
      announceScenes();
      return { ok: true, scene };
    } catch (error) {
      logger?.warn(`Adding a member scene failed: ${String(error)}`);
      return { ok: false, reason: 'refused' };
    }
  });

  ipcMain.handle('studio-show-folder', async () => {
    if (linkedFolder) {
      await openPath(linkedFolder);
    }
  });

  return {
    store,
    linkedFolder: () => linkedFolder,
    announce: announceScenes,
    dispose: () => {
      unsubscribe();
      stopWatching();
      CHANNELS.forEach((channel) => ipcMain.removeHandler(channel));
    },
  };
};

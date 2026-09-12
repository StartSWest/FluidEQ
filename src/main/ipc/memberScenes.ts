import { dialog, ipcMain, shell, type BrowserWindow } from 'electron';
import fs from 'fs';
import path from 'path';
import { registerStudioNotesIpc } from './studioNotes';
import { parseMemberLookId } from '../../common/memberScenes';
import type { TLocalizedName } from '../../common/scenePacks';
import type { IEntitlement } from '../account/entitlement';
import type { IAccountSession } from '../account/session';
import {
  readProject,
  readProjectNames,
  type TProjectBuild,
} from '../memberScenes/project';
import {
  createProjectFolder,
  defaultProjectsRoot,
} from '../memberScenes/projectFolders';
import {
  watchProject,
  type IProjectWatcher,
} from '../memberScenes/projectWatcher';
import {
  createMemberSceneStore,
  type IMemberSceneStore,
  type IMemberSceneSummary,
} from '../memberScenes/store';
import {
  byRecent,
  readProjectList,
  withActive,
  withFolder,
  without,
  withRoot,
  writeProjectList,
  type IProjectList,
} from '../memberScenes/studioProjects';
import type { TSceneFailure } from '../scenePackStore';
import { registerStudioPicturesIpc } from './studioPictures';
import { registerStudioSettingsIpc } from './studioSettings';

/**
 * Member scenes and the Studio, as the renderer sees them.
 *
 * Everything that makes or runs a member scene needs an active Plus
 * membership, asked fresh on every call rather than once at startup, exactly
 * as the Plus looks are. Removing one's own scene does not: a member whose
 * membership ended can still take their work out of the app.
 *
 * NO PATH EVER COMES FROM THE PAGE. Folders are chosen in the system dialog
 * here and named to the page by an id made here; a new project's name is the
 * one thing the page sends, and it becomes a single folder name inside the
 * projects folder (see `projectFolders.ts`). "Add to my looks" saves the
 * build this process made from the open project's folder — never a pack the
 * renderer hands back. The renderer is told each folder's path so the member
 * can see which is which; it cannot send one.
 *
 * Only the open project is watched, and only while the Studio is open.
 * Switching projects, closing the Studio, losing Plus, or quitting stops the
 * watcher; the projects not open are a line in a list and cost nothing.
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

export interface IStudioProject {
  /** What the page names it by. Its folder is never accepted back. */
  id: string;
  /** The folder's own name and where it is, for display only. */
  folderName: string;
  path: string;
  /** What its scene is called, when its `pack.json` could be read. */
  names?: TLocalizedName;
}

export interface IStudioState {
  entitled: boolean;
  /** Where "New project" makes its folders, for display only. */
  projectsRoot: string;
  /** Most recently opened first. */
  projects: IStudioProject[];
  /** The project on the bench: the only one watched, the only one playing. */
  activeId?: string;
  /** The latest build of the open project, while the Studio is open. */
  build?: TProjectBuild;
}

export type TNewProjectResult =
  | 'written'
  /** The projects folder already has a folder of that name. */
  | 'exists'
  /** Nothing of the name is usable as a folder name. */
  | 'invalid'
  | 'failed'
  | 'refused';

export type TAddOutcome =
  | { ok: true; scene: IMemberSceneSummary }
  | { ok: false; reason: 'not-entitled' | 'no-build' | 'refused' };

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
  /** The open project's folder, for export and publish. */
  activeFolder(): string | undefined;
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
  'studio-select-project',
  'studio-forget-project',
  'studio-choose-root',
  'studio-create-project',
  'studio-add-to-looks',
  'studio-show-folder',
] as const;

const STUDIO_FILE = path.join('member-scenes', 'studio.json');

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
  const studioPath = path.join(userDataDir, STUDIO_FILE);

  let projects: IProjectList = readProjectList(studioPath);
  /** Each project's scene names, read from its `pack.json`, by project id. */
  const projectNames = new Map<string, TLocalizedName>();
  let studioOpen = false;
  let watcher: IProjectWatcher | undefined;
  let lastBuild: TProjectBuild | undefined;

  const activeFolder = () =>
    projects.projects.find((project) => project.id === projects.active)?.folder;

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

  const projectsRoot = () => projects.root ?? defaultProjectsRoot(documentsDir);

  const studioState = (): IStudioState => ({
    entitled: entitled(),
    projectsRoot: projectsRoot(),
    projects: byRecent(projects).map((project) => {
      const names = projectNames.get(project.id);
      return {
        id: project.id,
        folderName: path.basename(project.folder),
        path: project.folder,
        ...(names ? { names } : {}),
      };
    }),
    ...(projects.active ? { activeId: projects.active } : {}),
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
    const folder = activeFolder();
    const { active } = projects;
    if (!folder || !active || !studioOpen || !entitled()) {
      return;
    }
    watcher = watchProject(folder, (build) => {
      lastBuild = build;
      // Held by the id this watcher started with, so a build that lands as
      // the member switches projects cannot rename the one they switched to.
      if (build.ok) {
        projectNames.set(active, build.pack.names);
      }
      announceStudio();
    });
  };

  /** Every project's name, read afresh: they are edited outside the app. */
  const refreshNames = async () => {
    await Promise.all(
      projects.projects.map(async (project) => {
        const names = await readProjectNames(project.folder);
        if (names) {
          projectNames.set(project.id, names);
        } else {
          projectNames.delete(project.id);
        }
      }),
    );
    announceStudio();
  };

  const adopt = (next: IProjectList) => {
    const switched = next.active !== projects.active;
    projects = next;
    writeProjectList(studioPath, next);
    if (switched || !watcher) {
      startWatching();
    }
  };

  /**
   * The system folder dialog, opened on the projects folder: that is where
   * the member keeps their projects, so "Open a folder" and "Change" both
   * start there, never wherever the app's last dialog happened to be. The
   * folder is made first if it is not there yet, because a dialog pointed at
   * a folder that does not exist opens somewhere else instead.
   */
  const chooseFolder = async (
    properties: Array<'openDirectory' | 'createDirectory'>,
  ): Promise<string | undefined> => {
    const window = getMainWindow();
    const root = projectsRoot();
    const defaultPath = await fs.promises.mkdir(root, { recursive: true }).then(
      () => root,
      () => undefined,
    );
    const options = { properties, ...(defaultPath ? { defaultPath } : {}) };
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
    refreshNames().catch(() => undefined);
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
      adopt(withFolder(projects, folder, Date.now()));
      await refreshNames();
    }
    return studioState();
  });

  ipcMain.handle('studio-select-project', (_event, id: unknown) => {
    if (typeof id === 'string' && entitled()) {
      adopt(withActive(projects, id, Date.now()));
    }
    return studioState();
  });

  // Takes the project off the list. Its folder, and every file in it, stays
  // exactly where it is.
  ipcMain.handle('studio-forget-project', (_event, id: unknown) => {
    if (typeof id === 'string') {
      adopt(without(projects, id));
      projectNames.delete(id);
    }
    return studioState();
  });

  // Where new projects go: chosen once, in the system dialog, opening on
  // the folder in use now.
  ipcMain.handle('studio-choose-root', async () => {
    if (!entitled()) {
      return studioState();
    }
    const root = await chooseFolder(['openDirectory', 'createDirectory']);
    if (root) {
      projects = withRoot(projects, root);
      writeProjectList(studioPath, projects);
    }
    return studioState();
  });

  ipcMain.handle(
    'studio-create-project',
    async (_event, name: unknown): Promise<TNewProjectResult> => {
      if (!entitled()) {
        return 'refused';
      }
      if (typeof name !== 'string') {
        return 'invalid';
      }
      const made = await createProjectFolder(projectsRoot(), name).catch(
        (error: unknown) => {
          logger?.warn(`A new Studio project failed: ${String(error)}`);
          return { ok: false, reason: 'failed' } as const;
        },
      );
      if (!made.ok) {
        return made.reason;
      }
      adopt(withFolder(projects, made.folder, Date.now()));
      await refreshNames();
      return 'written';
    },
  );

  ipcMain.handle('studio-add-to-looks', async (): Promise<TAddOutcome> => {
    const me = accountId();
    if (!entitled() || !me) {
      return { ok: false, reason: 'not-entitled' };
    }
    const folder = activeFolder();
    if (!folder) {
      return { ok: false, reason: 'no-build' };
    }
    // Read the folder again rather than trusting the last watched build: the
    // press may land between a save and the watcher's rebuild.
    const build = await readProject(folder);
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
    const folder = activeFolder();
    if (folder) {
      await openPath(folder);
    }
  });

  // The Pictures card, and the scene's settings.
  const disposeNotes = registerStudioNotesIpc({
    entitled,
    folderFor: (id) =>
      projects.projects.find((project) => project.id === id)?.folder,
  });
  const disposePictures = registerStudioPicturesIpc({
    getMainWindow,
    entitled,
    activeFolder,
    dialogImpl,
    ...(logger ? { logger } : {}),
  });
  const disposeSettings = registerStudioSettingsIpc({
    entitled,
    activeFolder,
    accountId,
    store,
    announceScenes,
    ...(logger ? { logger } : {}),
  });

  return {
    store,
    activeFolder,
    announce: announceScenes,
    dispose: () => {
      unsubscribe();
      stopWatching();
      disposeNotes();
      disposePictures();
      disposeSettings();
      CHANNELS.forEach((channel) => ipcMain.removeHandler(channel));
    },
  };
};

import { dialog, ipcMain, shell, type BrowserWindow } from 'electron';
import path from 'path';
import type { IScenePack } from '../../common/scenePacks';
import { writeProjectSource, type TSourceWrite } from '../memberScenes/project';
import { createPublishedMarks } from '../memberScenes/publishedMarks';
import type { IProjectPublished } from '../memberScenes/publishedRecords';
import {
  mayAddProject as mayAdd,
  mayUseProject,
  settledList,
  type IStudioAccess,
} from '../memberScenes/projectAccess';
import {
  createProjectFolder,
  defaultProjectsRoot,
  findProjectFolders,
} from '../memberScenes/projectFolders';
import { renameProjectFolder } from '../memberScenes/projectRename';
import createStudioLooksCopy from './studioLooksCopy';
import {
  findAgentProject,
  type TAgentProject,
} from '../studioAgent/agentProject';
import type { IMemberSceneStore } from '../memberScenes/store';
import {
  isLookInside,
  readProjectList,
  withActive,
  withFolder,
  withFolders,
  withProjectFolder,
  without,
  withRoot,
  writeProjectList,
  type IMemberCopyMark,
  type IProjectList,
  type IStoredProject,
} from '../memberScenes/studioProjects';
import { originOf, withTrusted } from '../memberScenes/projectOrigin';
import {
  studioStateOf,
  type ILinkFolderResult,
  type IStudioState,
  type TInspection,
  type TNewProjectResult,
  type TProjectRestore,
  type TRenameProjectResult,
} from './studioProjectTypes';
import { createProjectBench } from './studioProjectBench';
import { createProjectMaking } from './studioProjectMaking';
import { registerStudioProjectPanes } from './studioProjectPanes';

/**
 * The Studio's projects, as the renderer sees them.
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
 * Switching projects, closing the Studio, signing out or quitting stops the
 * watcher; the projects not open are a line in a list and cost nothing.
 *
 * Which projects may be used at all is `projectAccess.ts`, which is asked and
 * never re-derived here.
 */

interface IDialogLike {
  showOpenDialog: typeof dialog.showOpenDialog;
}

export interface IStudioProjectsIpcDeps {
  getMainWindow: () => BrowserWindow | null;
  userDataDir: string;
  /** The member's Documents folder, where projects go until they choose. */
  documentsDir: string;
  store: IMemberSceneStore;
  /** Read fresh on every call: the Studio is any signed-in account's. */
  accountId: () => string | undefined;
  /** The member scenes list changed: "Add to my looks" and a settings save. */
  announceScenes: () => void;
  logger?: { info(message: string): void; warn(message: string): void };
  dialogImpl?: IDialogLike;
  openPath?: (target: string) => Promise<string>;
  /** What was last published from a folder here (`publishedRecords.ts`). */
  publishedOf?: (folder: string) => Promise<IProjectPublished | undefined>;
  /**
   * Records the folders holding a publication this computer holds, which a
   * scene published before records existed has none of
   * (`publishedAdoption.ts`); true when one was.
   */
  adoptPublished?: (folders: readonly string[]) => Promise<boolean>;
  /**
   * What an earlier FluidEQ left in a project folder that belongs in
   * FluidEQ itself taken back out - its brief in the notes, its skills in
   * `.agents/skills` - for every project on the list, once at start.
   */
  tidyProject?: (folder: string) => void;
}

export interface IStudioProjectsIpcRegistration {
  /** The open project's folder, for export and publish. */
  activeFolder(): string | undefined;
  /** Whether the open project is a FluidEQ scene, opened only to look inside. */
  activeIsInspection(): boolean;
  /** Whether the open project may be used by who is asking (`projectAccess.ts`). */
  mayUseActive(): boolean;
  /** The member's own imported scene, back on the Studio's list. */
  restoreOwnProject(pack: IScenePack): Promise<TProjectRestore>;
  /** One of FluidEQ's own, written out as a project to look inside. */
  openInspection(pack: IScenePack): Promise<TInspection>;
  /** Another member's published scene, written out as a copy to look inside. */
  openMemberCopy(pack: IScenePack, mark: IMemberCopyMark): Promise<TInspection>;
  /** The project the member's AI names by folder, or the open one (`agentProject.ts`). */
  agentProject(folder?: string): TAgentProject;
  /** Whether a project's chat must ask before every command (`projectOrigin.ts`). */
  chatMustAsk(id: string): boolean;
  /** The folders of the member's own projects, never one only opened (`sceneRecovery.ts`). */
  ownProjectFolders(): readonly string[];
  /**
   * The account changed, or what it owns: the bench settles on a project
   * the account may use and the Studio is told.
   */
  accountChanged(): void;
  /** The Studio told again, so the bench shows its looks copy as it now is. */
  announceStudio(): void;
  /** A chat's reply ended: any project's files may have changed. */
  publishedMayHaveChanged(): void;
  dispose(): void;
}

const CHANNELS = [
  'studio-open',
  'studio-close',
  'studio-link-folder',
  'studio-select-project',
  'studio-forget-project',
  'studio-trust-project',
  'studio-rename-project',
  'studio-choose-root',
  'studio-create-project',
  'studio-add-to-looks',
  'studio-show-folder',
  'studio-write-source',
] as const;

const STUDIO_FILE = path.join('member-scenes', 'studio.json');

export const registerStudioProjectsIpc = ({
  getMainWindow,
  userDataDir,
  documentsDir,
  store,
  accountId,
  announceScenes,
  logger,
  dialogImpl = dialog,
  openPath = (target) => shell.openPath(target),
  publishedOf,
  adoptPublished,
  tidyProject,
}: IStudioProjectsIpcDeps): IStudioProjectsIpcRegistration => {
  const studioPath = path.join(userDataDir, STUDIO_FILE);

  let projects: IProjectList = readProjectList(studioPath);
  // Scenes opened to look inside are written by FluidEQ from their packs
  // and hold nothing to take back.
  projects.projects
    .filter((project) => !isLookInside(project))
    .forEach((project) => tidyProject?.(project.folder));
  let studioOpen = false;

  const activeProject = () =>
    projects.projects.find((project) => project.id === projects.active);
  const activeFolder = () => activeProject()?.folder;
  const activeIsInspection = () => {
    const active = activeProject();
    return active !== undefined && isLookInside(active);
  };

  /** Who is asking, for the access rules in `projectAccess.ts`. */
  const asking = (): IStudioAccess => ({
    signedIn: accountId() !== undefined,
  });

  const usable = (project: IStoredProject | undefined) =>
    project !== undefined && mayUseProject(asking());

  const mayUseActive = () => usable(activeProject());

  /** The project the page names, when the member may use it. */
  const usableProject = (id: string) => {
    const project = projects.projects.find((entry) => entry.id === id);
    return usable(project) ? project : undefined;
  };

  const settled = (list: IProjectList): IProjectList =>
    settledList(list, asking());

  const mayAddProject = () => mayAdd(asking());

  /**
   * Adding a project runs one call at a time. The list is read before the
   * folder is made or chosen and written after, and two calls in flight
   * together each wrote the list they had read, so one of the two projects
   * was lost.
   */
  let adding: Promise<unknown> = Promise.resolve();
  const oneAtATime = <T>(work: () => Promise<T>): Promise<T> => {
    const run = adding.then(work, work);
    adding = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  };

  const projectsRoot = () => projects.root ?? defaultProjectsRoot(documentsDir);

  const studioState = (): IStudioState => {
    const build = studioOpen ? bench.lastBuild() : undefined;
    const look = looksCopy.copyOf(build);
    const state = studioStateOf(projects, {
      mayAddProject: mayAddProject(),
      projectsRoot: projectsRoot(),
      names: bench.names,
      sceneIds: bench.sceneIds,
      usable,
      ...(build ? { build } : {}),
      ...(marks ? { publishedOf: marks.of } : {}),
    });
    return look ? { ...state, look } : state;
  };

  const tellStudio = () =>
    getMainWindow()?.webContents.send('studio-changed', studioState());

  // Each project's publication, read apart from any announcement
  // (`publishedMarks.ts`).
  const marks = publishedOf
    ? createPublishedMarks({
        stateOf: publishedOf,
        ...(adoptPublished ? { adopt: adoptPublished } : {}),
        folders: () =>
          projects.projects
            .filter((project) => !isLookInside(project))
            .map((project) => project.folder),
        isOpen: () => studioOpen,
        changed: tellStudio,
        ...(logger ? { logger } : {}),
      })
    : undefined;

  /** The Studio told; the open scene may have changed, so its mark is read. */
  const announceStudio = () => {
    tellStudio();
    const folder = activeFolder();
    if (folder && !activeIsInspection()) {
      marks?.refresh(folder);
    }
  };

  // The project's copy in the looks: kept from here, compared on the bench.
  const looksCopy = createStudioLooksCopy({
    store,
    accountId,
    activeFolder,
    activeIsInspection,
    announceScenes,
    announceStudio: () => announceStudio(),
    ...(logger ? { logger } : {}),
  });

  // What is watching the open project, and what it has read.
  const bench = createProjectBench({
    getMainWindow,
    list: () => projects,
    activeFolder,
    mayUseActive,
    isOpen: () => studioOpen,
    announce: announceStudio,
  });

  const adopt = (list: IProjectList) => {
    const next = settled(list);
    const switched = next.active !== projects.active;
    projects = next;
    writeProjectList(studioPath, next);
    if (switched || !bench.watching()) {
      bench.start();
    }
    // A folder just added may hold a scene published before records were
    // kept; one already compared costs a look at its pack.json.
    marks?.refresh();
  };

  // Making a project out of a scene, and the folder dialog both "open a
  // folder" paths use: `studioProjectMaking.ts`, which writes to the list
  // through `adopt` like everything else here.
  const { restoreOwnProject, openInspection, openMemberCopy, chooseFolder } =
    createProjectMaking({
      getMainWindow,
      list: () => projects,
      projectsRoot,
      adopt,
      refreshNames: bench.refreshNames,
      dialogImpl,
    });

  ipcMain.handle('studio-open', () => {
    studioOpen = true;
    // The list as saved may open on a project another account left open.
    adopt(projects);
    bench.start();
    bench.refreshNames().catch(() => undefined);
    return studioState();
  });

  ipcMain.handle('studio-close', () => {
    studioOpen = false;
    bench.stop();
  });

  ipcMain.handle('studio-link-folder', (): Promise<ILinkFolderResult> =>
    oneAtATime(async () => {
      if (!mayAddProject()) {
        return { state: studioState(), outcome: 'signed-out' };
      }
      const folder = await chooseFolder(['openDirectory']);
      if (!folder) {
        return { state: studioState(), outcome: 'cancelled' };
      }
      // A folder of scene folders lists every one of them, the first open.
      const found = await findProjectFolders(folder);
      if (!mayAddProject()) {
        return { state: studioState(), outcome: 'signed-out' };
      }
      adopt(withFolders(projects, found, Date.now()));
      await bench.refreshNames();
      return { state: studioState(), outcome: 'linked' };
    }),
  );

  ipcMain.handle('studio-select-project', (_event, id: unknown) => {
    const wanted = projects.projects.find((project) => project.id === id);
    if (typeof id === 'string' && usable(wanted)) {
      adopt(withActive(projects, id, Date.now()));
    }
    return studioState();
  });

  // The member says a scene from outside is theirs. From the Studio's own
  // page only, never from the chat: the AI has no way to this channel.
  ipcMain.handle('studio-trust-project', (_event, id: unknown) => {
    const project = projects.projects.find((entry) => entry.id === id);
    if (typeof id === 'string' && project && originOf(project) === 'outside') {
      adopt(withTrusted(projects, id));
    }
    return studioState();
  });

  // Takes the project off the list. Its folder, and every file in it, stays
  // exactly where it is. A FluidEQ scene opened to look inside and opened
  // again from its folder comes back as the member's own project; that gives
  // nothing away, because it plays outside the Studio only once published,
  // and the server refuses to publish a copy of FluidEQ's own
  // (`official_copy`).
  ipcMain.handle('studio-forget-project', (_event, id: unknown) => {
    const project = projects.projects.find((entry) => entry.id === id);
    if (typeof id === 'string' && project) {
      adopt(without(projects, id));
      bench.forget(id);
    }
    return studioState();
  });

  // Renames a project's scene and its folder, where the folder already is,
  // under the same id. The folder is let go of first — its watcher closed and
  // the build it was reading finished — and the project then opens again from
  // its new folder, or from the old one when the rename could not happen.
  ipcMain.handle(
    'studio-rename-project',
    async (
      _event,
      id: unknown,
      name: unknown,
    ): Promise<TRenameProjectResult> => {
      // A member's own project is theirs to rename; a scene opened to look
      // inside, FluidEQ's or another member's, is nobody's to rename.
      const project = projects.projects.find((entry) => entry.id === id);
      if (project && isLookInside(project)) {
        return 'refused';
      }
      if (!project || typeof name !== 'string') {
        return 'invalid';
      }
      if (bench.isRenaming()) {
        return 'failed';
      }
      bench.setRenaming(true);
      const holding =
        project.id === projects.active ? bench.watching() : undefined;
      if (holding) {
        bench.stop();
        await holding.settled();
      }
      try {
        const renamed = await renameProjectFolder(project.folder, name);
        if (!renamed.ok) {
          return renamed.reason;
        }
        adopt(withProjectFolder(projects, project.id, renamed.folder));
        return 'renamed';
      } catch (error) {
        logger?.warn(`Renaming a Studio project failed: ${String(error)}`);
        return 'failed';
      } finally {
        bench.setRenaming(false);
        if (!bench.watching()) {
          bench.start();
        }
        await bench.refreshNames();
      }
    },
  );

  // Where new projects go: chosen once, in the system dialog, opening on
  // the folder in use now.
  ipcMain.handle('studio-choose-root', async () => {
    if (!mayAddProject()) {
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
    (_event, name: unknown): Promise<TNewProjectResult> =>
      oneAtATime(async () => {
        if (!mayAddProject()) {
          return 'signed-out';
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
        await bench.refreshNames();
        return 'written';
      }),
  );

  ipcMain.handle('studio-show-folder', async () => {
    const folder = activeFolder();
    if (folder && mayUseActive()) {
      await openPath(folder);
    }
  });

  // The code pane's save: text only, into the open project's own source
  // file. The watcher rebuilds the stage from it like any other save.
  ipcMain.handle(
    'studio-write-source',
    async (_event, text: unknown): Promise<TSourceWrite> => {
      const folder = activeFolder();
      if (!mayUseActive() || !folder || typeof text !== 'string') {
        return 'failed';
      }
      return writeProjectSource(folder, text);
    },
  );

  // The notes, the Pictures card, the picture for the member's AI and the
  // scene's settings: `studioProjectPanes.ts`.
  const disposePanes = registerStudioProjectPanes({
    getMainWindow,
    usableProject,
    mayUseActive,
    activeFolder,
    // A settings save refreshes a copy already in the looks; that gives the
    // account nothing it did not have, so it asks only that this is the
    // member's own project.
    mayUpdateLook: () => !activeIsInspection(),
    accountId,
    store,
    announceScenes,
    dialogImpl,
    ...(logger ? { logger } : {}),
  });

  return {
    activeFolder,
    activeIsInspection,
    mayUseActive,
    restoreOwnProject,
    openInspection,
    openMemberCopy,
    agentProject: (folder) => findAgentProject(projects, folder, usable),
    chatMustAsk: (id) => {
      const project = projects.projects.find((entry) => entry.id === id);
      return project === undefined || originOf(project) === 'outside';
    },
    ownProjectFolders: () =>
      projects.projects
        .filter(
          (project) =>
            !isLookInside(project) &&
            originOf(project) === 'own' &&
            usable(project),
        )
        .map((project) => project.folder),
    accountChanged: () => {
      adopt(projects);
      bench.start();
      announceStudio();
    },
    announceStudio,
    publishedMayHaveChanged: () => marks?.refresh(),
    dispose: () => {
      bench.stop();
      disposePanes();
      CHANNELS.forEach((channel) => ipcMain.removeHandler(channel));
    },
  };
};

import { dialog, ipcMain, shell, type BrowserWindow } from 'electron';
import path from 'path';
import { STUDIO_TRIAL_PROJECTS } from '../../common/memberScenes';
import type { IScenePack } from '../../common/scenePacks';
import {
  readProject,
  writeProjectSource,
  type TSourceWrite,
} from '../memberScenes/project';
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
import type { IMemberSceneStore } from '../memberScenes/store';
import {
  readProjectList,
  withActive,
  withFolder,
  withFolders,
  withProjectFolder,
  without,
  withRoot,
  writeProjectList,
  type IProjectList,
  type IStoredProject,
} from '../memberScenes/studioProjects';
import {
  studioStateOf,
  type ILinkFolderResult,
  type IStudioState,
  type TAddOutcome,
  type TInspection,
  type TNewProjectResult,
  type TProjectRestore,
  type TRenameProjectResult,
} from './studioProjectTypes';
import { createProjectBench } from './studioProjectBench';
import { createProjectMaking } from './studioProjectMaking';
import { registerStudioNotesIpc } from './studioNotes';
import { registerStudioPicturesIpc } from './studioPictures';
import { registerStudioPreviewIpc } from './studioPreview';
import { registerStudioSettingsIpc } from './studioSettings';

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
 * Switching projects, closing the Studio or quitting stops the watcher, and
 * so does losing Plus on one of FluidEQ's own scenes opened to look inside;
 * the projects not open are a line in a list and cost nothing.
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
  /** Read fresh on every call, exactly as the Plus looks are. */
  accountId: () => string | undefined;
  entitled: () => boolean;
  /**
   * Whether this account has had a scene approved before. A maker keeps the
   * single-project bench once their earned month runs out, or publishing —
   * the only way they earn Plus — would be closed to them (`knownMakers.ts`).
   */
  isMaker: (accountId: string) => boolean;
  /** The member scenes list changed: "Add to my looks" and a settings save. */
  announceScenes: () => void;
  logger?: { info(message: string): void; warn(message: string): void };
  dialogImpl?: IDialogLike;
  openPath?: (target: string) => Promise<string>;
}

export interface IStudioProjectsIpcRegistration {
  /** The open project's folder, for export and publish. */
  activeFolder(): string | undefined;
  /** Whether the open project is a FluidEQ scene, opened only to look inside. */
  activeIsInspection(): boolean;
  /** The member's own imported scene, back on the Studio's list. */
  restoreOwnProject(pack: IScenePack): Promise<TProjectRestore>;
  /** One of FluidEQ's own, written out as a project to look inside. */
  openInspection(pack: IScenePack): Promise<TInspection>;
  /**
   * Plus came or went. Losing it moves the bench off a FluidEQ scene opened
   * to look inside and stops its watcher; gaining it (with the Studio open)
   * starts one. Either way the Studio is told.
   */
  entitlementChanged(): void;
  dispose(): void;
}

const CHANNELS = [
  'studio-open',
  'studio-close',
  'studio-link-folder',
  'studio-select-project',
  'studio-forget-project',
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
  entitled,
  isMaker,
  announceScenes,
  logger,
  dialogImpl = dialog,
  openPath = (target) => shell.openPath(target),
}: IStudioProjectsIpcDeps): IStudioProjectsIpcRegistration => {
  const studioPath = path.join(userDataDir, STUDIO_FILE);

  let projects: IProjectList = readProjectList(studioPath);
  let studioOpen = false;

  const activeProject = () =>
    projects.projects.find((project) => project.id === projects.active);
  const activeFolder = () => activeProject()?.folder;
  const activeIsInspection = () => activeProject()?.official !== undefined;

  const maker = () => {
    const me = accountId();
    return me !== undefined && isMaker(me);
  };

  /** Who is asking, for the access rules in `projectAccess.ts`. */
  const asking = (): IStudioAccess => ({
    entitled: entitled(),
    maker: maker(),
  });

  const usable = (project: IStoredProject | undefined) =>
    project !== undefined && mayUseProject(project, projects, asking());

  const mayUseActive = () => usable(activeProject());

  const settled = (list: IProjectList): IProjectList =>
    settledList(list, asking());

  const mayAddProject = () => mayAdd(projects, asking());

  /**
   * Adding a project runs one call at a time. The limit is read before the
   * folder is made or chosen and the list is written after, and two calls in
   * flight together both read a list with room in it: a page that sent them
   * both in one tick ended up with two projects without Plus.
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
    return studioStateOf(projects, {
      entitled: entitled(),
      mayAddProject: mayAddProject(),
      projectsRoot: projectsRoot(),
      names: bench.names,
      usable,
      ...(build ? { build } : {}),
    });
  };

  const announceStudio = () =>
    getMainWindow()?.webContents.send('studio-changed', studioState());

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
  };

  // Making a project out of a scene, and the folder dialog both "open a
  // folder" paths use: `studioProjectMaking.ts`, which writes to the list
  // through `adopt` like everything else here.
  const { restoreOwnProject, openInspection, chooseFolder } =
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
    // The list as saved may open on a project Plus has since left behind.
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
        return { state: studioState(), outcome: 'plus-only' };
      }
      const folder = await chooseFolder(['openDirectory']);
      if (!folder) {
        return { state: studioState(), outcome: 'cancelled' };
      }
      // A folder of scene folders lists every one of them, the first open.
      // Without Plus the first is the one the Studio keeps and the rest are
      // listed locked — seen, named, and Plus's to open — rather than
      // dropped by name with nothing said about them.
      const found = await findProjectFolders(folder);
      if (!mayAddProject()) {
        return { state: studioState(), outcome: 'plus-only' };
      }
      adopt(withFolders(projects, found, Date.now()));
      await bench.refreshNames();
      return {
        state: studioState(),
        outcome:
          !entitled() && found.length > STUDIO_TRIAL_PROJECTS
            ? 'one-opened'
            : 'linked',
      };
    }),
  );

  ipcMain.handle('studio-select-project', (_event, id: unknown) => {
    const wanted = projects.projects.find((project) => project.id === id);
    if (typeof id === 'string' && usable(wanted)) {
      adopt(withActive(projects, id, Date.now()));
    }
    return studioState();
  });

  // Takes the project off the list. Its folder, and every file in it, stays
  // exactly where it is. A FluidEQ scene opened to look inside is Plus's to
  // let go of: its mark lives on this list, and a project forgotten and then
  // opened again from its folder would come back as the member's own.
  ipcMain.handle('studio-forget-project', (_event, id: unknown) => {
    const project = projects.projects.find((entry) => entry.id === id);
    if (
      typeof id === 'string' &&
      project &&
      (entitled() || !project.official)
    ) {
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
      // A member's own project is theirs to rename with or without Plus;
      // FluidEQ's own, opened to look inside, is nobody's to rename.
      const project = projects.projects.find((entry) => entry.id === id);
      if (project?.official) {
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
          return 'plus-only';
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

  ipcMain.handle('studio-add-to-looks', async (): Promise<TAddOutcome> => {
    const me = accountId();
    if (!entitled() || !me) {
      return { ok: false, reason: 'not-entitled' };
    }
    const folder = activeFolder();
    if (!folder) {
      return { ok: false, reason: 'no-build' };
    }
    if (activeIsInspection()) {
      return { ok: false, reason: 'inspect-only' };
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

  // The Pictures card, and the scene's settings.
  const disposeNotes = registerStudioNotesIpc({
    // The folder of the project named, when that project may be used: the
    // notes are about one project, whichever is on the bench.
    folderFor: (id) => {
      const project = projects.projects.find((entry) => entry.id === id);
      return usable(project) ? project?.folder : undefined;
    },
  });
  const disposePictures = registerStudioPicturesIpc({
    getMainWindow,
    mayEdit: mayUseActive,
    activeFolder,
    dialogImpl,
    ...(logger ? { logger } : {}),
  });
  // A picture of the scene beside its files, for the member's AI to look at.
  // Only into a project that may be edited: one of FluidEQ's own, opened to
  // look inside, gains no file from being watched.
  const disposePreview = registerStudioPreviewIpc({
    // Decided about the project NAMED, never about the open one: asking
    // whether the OPEN project is an inspection would answer for the wrong
    // folder the moment the page names another, which is the same mistake
    // the notes reader carries a comment about.
    folderFor: (id) => {
      const project = projects.projects.find((entry) => entry.id === id);
      return usable(project) && project?.official === undefined
        ? project?.folder
        : undefined;
    },
    ...(logger ? { logger } : {}),
  });
  const disposeSettings = registerStudioSettingsIpc({
    mayEdit: mayUseActive,
    // The look a settings save refreshes is one Plus added; refreshing it is
    // adding it again, and adding is Plus's.
    mayUpdateLook: () => entitled() && !activeIsInspection(),
    activeFolder,
    accountId,
    store,
    announceScenes,
    ...(logger ? { logger } : {}),
  });

  return {
    activeFolder,
    activeIsInspection,
    restoreOwnProject,
    openInspection,
    entitlementChanged: () => {
      adopt(projects);
      bench.start();
      announceStudio();
    },
    dispose: () => {
      bench.stop();
      disposeNotes();
      disposePictures();
      disposePreview();
      disposeSettings();
      CHANNELS.forEach((channel) => ipcMain.removeHandler(channel));
    },
  };
};

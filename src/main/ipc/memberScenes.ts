import { dialog, ipcMain, shell, type BrowserWindow } from 'electron';
import fs from 'fs';
import path from 'path';
import { registerStudioNotesIpc } from './studioNotes';
import {
  parseMemberLookId,
  STUDIO_TRIAL_PROJECTS,
} from '../../common/memberScenes';
import type { IScenePack, TLocalizedName } from '../../common/scenePacks';
import type { IEntitlement } from '../account/entitlement';
import type { IAccountSession } from '../account/session';
import {
  readProject,
  readProjectNames,
  writeProjectSource,
  type TProjectBuild,
  type TSourceWrite,
} from '../memberScenes/project';
import { createSourceFeed } from '../memberScenes/sourceFeed';
import {
  createProjectFolder,
  defaultProjectsRoot,
  findProjectFolders,
} from '../memberScenes/projectFolders';
import { renameProjectFolder } from '../memberScenes/projectRename';
import {
  folderHoldingScene,
  writeRestoredProject,
} from '../memberScenes/projectRestore';
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
  withFolders,
  withProjectFolder,
  without,
  withRoot,
  writeProjectList,
  type IProjectList,
  type IStoredProject,
} from '../memberScenes/studioProjects';
import {
  mayAddProject as mayAdd,
  mayUseProject,
  settledList,
  type IStudioAccess,
} from '../memberScenes/projectAccess';
import { isSceneFailure, type TSceneFailure } from '../scenePackStore';
import { registerStudioPreviewIpc } from './studioPreview';
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
 * Switching projects, closing the Studio or quitting stops the watcher, and
 * so does losing Plus on one of FluidEQ's own scenes opened to look inside;
 * the projects not open are a line in a list and cost nothing.
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
  /**
   * A FluidEQ scene, opened to look inside and take ideas from: never added
   * to looks, exported or published.
   */
  official?: true;
  /**
   * Listed, and Plus's to open. Without Plus the Studio keeps one project on
   * the bench; the rest of a folder of several, the others of a Plus that
   * lapsed and FluidEQ's scenes opened to look inside wait here, in the
   * menu, with a lock.
   */
  locked?: true;
}

export interface IStudioState {
  entitled: boolean;
  /**
   * Whether another project may be started or opened. Plus has no limit;
   * without it the Studio keeps one project (`TRIAL_PROJECTS`), so the page
   * shows the ways to a second one locked rather than refusing on the press.
   * Decided here: the page is told, never asked.
   */
  mayAddProject: boolean;
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
  /** The one project the Studio keeps without Plus is already there. */
  | 'plus-only';

/**
 * What "Open a folder…" did. `one-opened`: the folder held several projects
 * and, without Plus, the first is on the bench and the rest are listed
 * locked. `plus-only`: without Plus the Studio keeps one project, and the
 * member has it.
 */
export interface ILinkFolderResult {
  state: IStudioState;
  outcome: 'linked' | 'one-opened' | 'cancelled' | 'plus-only';
}

export type TAddOutcome =
  | { ok: true; scene: IMemberSceneSummary }
  | {
      ok: false;
      reason: 'not-entitled' | 'no-build' | 'refused' | 'inspect-only';
    };

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

/**
 * What importing one's own scene did to the Studio's list: made a project of
 * it, found one already holding it, or could make none — no name left to
 * give its folder, or every numbered variant of that name taken.
 */
export type TProjectRestore = 'restored' | 'present' | 'invalid' | 'taken';

/**
 * What opening a FluidEQ scene in the Studio did: made a project of it, went
 * back to the one already made, or could make none.
 */
export type TInspection = 'opened' | 'present' | 'invalid' | 'taken';

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
  /**
   * A FluidEQ scene, verified as FluidEQ's by the caller, opened as a project
   * to look inside and take ideas from.
   */
  openInspection(pack: IScenePack): Promise<TInspection>;
  /** Tell the renderer the list of member scenes changed. */
  announce(): void;
  dispose(): void;
}

/**
 * How renaming a project went. `exists`: a folder of that name is already
 * beside it. `refused`: a FluidEQ scene opened to look inside.
 */
export type TRenameProjectResult =
  'renamed' | 'exists' | 'invalid' | 'failed' | 'refused';

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
  'studio-rename-project',
  'studio-choose-root',
  'studio-create-project',
  'studio-add-to-looks',
  'studio-show-folder',
  'studio-write-source',
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
  const sourceFeed = createSourceFeed((source) =>
    getMainWindow()?.webContents.send('studio-source-changed', source),
  );

  const activeProject = () =>
    projects.projects.find((project) => project.id === projects.active);
  const activeFolder = () => activeProject()?.folder;
  const activeIsInspection = () => activeProject()?.official !== undefined;

  const accountId = () => session.state().identity?.id;
  const entitled = () =>
    entitlement.status().state !== 'none' && accountId() !== undefined;

  /**
   * The Studio without Plus: one project, made and edited here like any
   * other, and nothing that leaves this window. A member, still: signed in,
   * as the Plus tab requires before it shows the Studio at all.
   *
   * Every refusal below is this process's, not the page's — the page is
   * source anybody can change, and it only draws what it is told. The two
   * things that reach other people are refused by the server as well: a
   * scene file is only importable once the server has signed it, and the
   * gallery checks the membership on the token it is given, so a changed
   * build can neither make a file another FluidEQ accepts nor publish. What
   * a changed build could do is play its own scene on its own machine, which
   * is true of every local feature on a computer somebody owns.
   */
  const member = () => accountId() !== undefined;

  /**
   * Who is asking, for the access rules in `projectAccess.ts`. They live
   * there, apart from the IPC, because the entitlement is worth reading
   * whole: it is the only place the Studio-without-Plus rule is spelled.
   */
  const asking = (): IStudioAccess => ({
    entitled: entitled(),
    member: member(),
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

  const loadVisible = (lookId: unknown): IScenePack | undefined => {
    const ref =
      typeof lookId === 'string' ? parseMemberLookId(lookId) : undefined;
    if (!ref || !entitled() || !isVisible(ref.authorId, ref.packId)) {
      return undefined;
    }
    return store.load(ref.authorId, ref.packId);
  };
  const sceneListeners = new Set<() => void>();

  const projectsRoot = () => projects.root ?? defaultProjectsRoot(documentsDir);

  // Every project, the ones the member may not use marked locked: they are
  // in the menu to be seen, and Plus's to open. The bench never holds one.
  const studioState = (): IStudioState => ({
    entitled: entitled(),
    mayAddProject: mayAddProject(),
    projectsRoot: projectsRoot(),
    projects: byRecent(projects).map((project) => {
      const names = projectNames.get(project.id);
      return {
        id: project.id,
        folderName: path.basename(project.folder),
        path: project.folder,
        ...(names ? { names } : {}),
        ...(project.official ? { official: true as const } : {}),
        ...(usable(project) ? {} : { locked: true as const }),
      };
    }),
    ...(projects.active && mayUseActive() ? { activeId: projects.active } : {}),
    ...(studioOpen && lastBuild ? { build: lastBuild } : {}),
  });

  const announceScenes = () => {
    getMainWindow()?.webContents.send('member-scenes-changed', listing());
    sceneListeners.forEach((listener) => listener());
  };
  const announceStudio = () =>
    getMainWindow()?.webContents.send('studio-changed', studioState());

  const stopWatching = () => {
    watcher?.close();
    watcher = undefined;
    sourceFeed.reset();
    lastBuild = undefined;
  };

  /**
   * While a project's folder is being renamed nothing may watch it: a watcher
   * reads the move as the folder being gone, and the stage said the scene's
   * files were missing until the project opened again.
   */
  let renaming = false;

  const startWatching = () => {
    stopWatching();
    const folder = activeFolder();
    const { active } = projects;
    if (!folder || !active || !studioOpen || !mayUseActive() || renaming) {
      return;
    }
    watcher = watchProject(
      folder,
      (build) => {
        lastBuild = build;
        // Held by the id this watcher started with, so a build that lands as
        // the member switches projects cannot rename the one they switched to.
        if (build.ok) {
          projectNames.set(active, build.pack.names);
        }
        announceStudio();
      },
      { read: sourceFeed.reader() },
    );
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

  const adopt = (list: IProjectList) => {
    const next = settled(list);
    const switched = next.active !== projects.active;
    projects = next;
    writeProjectList(studioPath, next);
    if (switched || !watcher) {
      startWatching();
    }
  };

  // An imported scene of the member's own, made a project in the projects
  // folder and opened. A project on the list that already holds the scene is
  // the member's working copy, newer than any file, and is left alone.
  const restoreOwnProject = async (
    pack: IScenePack,
  ): Promise<TProjectRestore> => {
    const folders = projects.projects.map((project) => project.folder);
    if (await folderHoldingScene(folders, pack.id)) {
      return 'present';
    }
    const made = await writeRestoredProject(
      projectsRoot(),
      pack.names.en,
      pack,
    );
    if (!made.ok) {
      return made.reason;
    }
    adopt(withFolder(projects, made.folder, Date.now()));
    await refreshNames();
    return 'restored';
  };

  // A FluidEQ scene written out as a project of its own, marked so it is
  // never added, exported or published, and opened. Asked again, the project
  // already made is opened instead, with whatever the member tried in it.
  const openInspection = async (pack: IScenePack): Promise<TInspection> => {
    const kept = projects.projects.find(
      (project) => project.official === pack.id,
    );
    if (kept && (await folderHoldingScene([kept.folder], pack.id))) {
      adopt(withActive(projects, kept.id, Date.now()));
      await refreshNames();
      return 'present';
    }
    const made = await writeRestoredProject(
      projectsRoot(),
      `${pack.names.en} (FluidEQ)`,
      pack,
    );
    if (!made.ok) {
      return made.reason;
    }
    adopt(withFolder(projects, made.folder, Date.now(), pack.id));
    await refreshNames();
    return 'opened';
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
    // Losing Plus moves the bench off a FluidEQ scene opened to look inside
    // and stops its watcher; gaining it (with the Studio open) starts one.
    // Either way both views are told.
    adopt(projects);
    startWatching();
    announceScenes();
    announceStudio();
  });

  ipcMain.handle('member-scenes-list', () => listing());

  ipcMain.handle('member-scenes-load', (_event, lookId: unknown) => {
    return loadVisible(lookId);
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

  ipcMain.handle('studio-open', () => {
    studioOpen = true;
    // The list as saved may open on a project Plus has since left behind.
    adopt(projects);
    startWatching();
    refreshNames().catch(() => undefined);
    return studioState();
  });

  ipcMain.handle('studio-close', () => {
    studioOpen = false;
    stopWatching();
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
      await refreshNames();
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
      projectNames.delete(id);
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
      if (renaming) {
        return 'failed';
      }
      renaming = true;
      const holding = project.id === projects.active ? watcher : undefined;
      if (holding) {
        stopWatching();
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
        renaming = false;
        if (!watcher) {
          startWatching();
        }
        await refreshNames();
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
        await refreshNames();
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
    store,
    loadVisible,
    subscribeScenes: (listener) => {
      sceneListeners.add(listener);
      return () => {
        sceneListeners.delete(listener);
      };
    },
    reportFailure,
    activeFolder,
    activeIsInspection,
    restoreOwnProject,
    openInspection,
    announce: announceScenes,
    dispose: () => {
      unsubscribe();
      stopWatching();
      disposeNotes();
      disposePictures();
      disposePreview();
      disposeSettings();
      CHANNELS.forEach((channel) => ipcMain.removeHandler(channel));
    },
  };
};

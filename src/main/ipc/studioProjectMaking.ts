/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { dialog } from 'electron';
import type { BrowserWindow } from 'electron';
import fs from 'fs';
import type { IScenePack } from '../../common/scenePacks';
import {
  folderHoldingScene,
  writeRestoredProject,
} from '../memberScenes/projectRestore';
import {
  withActive,
  withFolder,
  type IProjectList,
} from '../memberScenes/studioProjects';
import type { TInspection, TProjectRestore } from './studioProjectTypes';

/**
 * Making a project out of a scene, and asking the member for a folder.
 *
 * The three places the Studio writes to disk outside a project's own files,
 * kept together and away from the eleven handlers: a scene of the member's
 * own coming back from a file, one of FluidEQ's written out to look inside,
 * and the system folder dialog both of the "open a folder" paths use.
 */

export interface IProjectMakingDeps {
  getMainWindow: () => BrowserWindow | null;
  /** The list as it is now: these write to it through `adopt`. */
  list: () => IProjectList;
  projectsRoot: () => string;
  adopt: (list: IProjectList) => void;
  refreshNames: () => Promise<void>;
  dialogImpl?: { showOpenDialog: typeof dialog.showOpenDialog };
}

export const createProjectMaking = ({
  getMainWindow,
  list,
  projectsRoot,
  adopt,
  refreshNames,
  dialogImpl = dialog,
}: IProjectMakingDeps) => {
  // folder and opened. A project on the list that already holds the scene is
  // the member's working copy, newer than any file, and is left alone.
  const restoreOwnProject = async (
    pack: IScenePack,
  ): Promise<TProjectRestore> => {
    const folders = list().projects.map((project) => project.folder);
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
    adopt(withFolder(list(), made.folder, Date.now()));
    await refreshNames();
    return 'restored';
  };

  // A FluidEQ scene written out as a project of its own, marked so it is
  // never added, exported or published, and opened. Asked again, the project
  // already made is opened instead, with whatever the member tried in it.
  const openInspection = async (pack: IScenePack): Promise<TInspection> => {
    const kept = list().projects.find(
      (project) => project.official === pack.id,
    );
    if (kept && (await folderHoldingScene([kept.folder], pack.id))) {
      adopt(withActive(list(), kept.id, Date.now()));
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
    adopt(withFolder(list(), made.folder, Date.now(), pack.id));
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

  return { restoreOwnProject, openInspection, chooseFolder };
};

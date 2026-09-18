/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { BrowserWindow } from 'electron';
import type { TLocalizedName } from '../../common/scenePacks';
import { readProjectNames, type TProjectBuild } from '../memberScenes/project';
import {
  watchProject,
  type IProjectWatcher,
} from '../memberScenes/projectWatcher';
import { createSourceFeed } from '../memberScenes/sourceFeed';
import type { IProjectList } from '../memberScenes/studioProjects';

/**
 * What is watching the open project, and what it has read.
 *
 * Only the open project is watched, and only while the Studio is open.
 * Switching projects, closing the Studio or quitting stops the watcher, and
 * so does losing Plus on one of FluidEQ's own scenes opened to look inside;
 * the projects not open are a line in a list and cost nothing.
 */

export interface IProjectBenchDeps {
  getMainWindow: () => BrowserWindow | null;
  /** The list as it is now, and whether its open project may be used. */
  list: () => IProjectList;
  activeFolder: () => string | undefined;
  mayUseActive: () => boolean;
  /** Whether the Studio is on screen at all. */
  isOpen: () => boolean;
  /** A build landed, or a name changed: tell the page. */
  announce: () => void;
}

export interface IProjectBench {
  /** Each project's scene name, read from its `pack.json`, by project id. */
  readonly names: ReadonlyMap<string, TLocalizedName>;
  /** The latest build of the open project, while the Studio is open. */
  lastBuild(): TProjectBuild | undefined;
  /** The watcher now, for a rename that has to wait for it to settle. */
  watching(): IProjectWatcher | undefined;
  start(): void;
  stop(): void;
  refreshNames(): Promise<void>;
  forget(id: string): void;
  /**
   * While a project's folder is being renamed nothing may watch it: a watcher
   * reads the move as the folder being gone, and the stage said the scene's
   * files were missing until the project opened again.
   */
  setRenaming(renaming: boolean): void;
  isRenaming(): boolean;
  /** The source the code pane is shown, fed from the watcher's own reads. */
  readSource: ReturnType<typeof createSourceFeed>['reader'];
}

export const createProjectBench = ({
  getMainWindow,
  list,
  activeFolder,
  mayUseActive,
  isOpen,
  announce,
}: IProjectBenchDeps): IProjectBench => {
  const names = new Map<string, TLocalizedName>();
  let watcher: IProjectWatcher | undefined;
  let build: TProjectBuild | undefined;
  let renaming = false;
  const sourceFeed = createSourceFeed((source) =>
    getMainWindow()?.webContents.send('studio-source-changed', source),
  );

  const stop = () => {
    watcher?.close();
    watcher = undefined;
    sourceFeed.reset();
    build = undefined;
  };

  const start = () => {
    stop();
    const folder = activeFolder();
    const { active } = list();
    if (!folder || !active || !isOpen() || !mayUseActive() || renaming) {
      return;
    }
    watcher = watchProject(
      folder,
      (next) => {
        build = next;
        // Held by the id this watcher started with, so a build that lands as
        // the member switches projects cannot rename the one they switched to.
        if (next.ok) {
          names.set(active, next.pack.names);
        }
        announce();
      },
      { read: sourceFeed.reader() },
    );
  };

  /** Every project's name, read afresh: they are edited outside the app. */
  const refreshNames = async () => {
    await Promise.all(
      list().projects.map(async (project) => {
        const read = await readProjectNames(project.folder);
        if (read) {
          names.set(project.id, read);
        } else {
          names.delete(project.id);
        }
      }),
    );
    announce();
  };

  return {
    names,
    lastBuild: () => build,
    watching: () => watcher,
    start,
    stop,
    refreshNames,
    forget: (id) => names.delete(id),
    setRenaming: (next) => {
      renaming = next;
    },
    isRenaming: () => renaming,
    readSource: () => sourceFeed.reader(),
  };
};

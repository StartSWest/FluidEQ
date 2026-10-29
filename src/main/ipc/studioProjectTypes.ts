/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import path from 'path';
import type { TLocalizedName } from '../../common/scenePacks';
import type { TProjectBuild } from '../memberScenes/project';
import type { IMemberSceneSummary } from '../memberScenes/store';
import {
  byRecent,
  type IProjectList,
  type IStoredProject,
} from '../memberScenes/studioProjects';

/**
 * What the Studio's projects look like to the page, and what each of its
 * calls can answer.
 *
 * Apart from the handlers because the renderer imports every one of these
 * and should not be reaching into the IPC to get them.
 */

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
}

export interface IStudioState {
  /**
   * Whether another project may be started or opened: always, for an
   * account that is signed in. Decided here: the page is told, never asked.
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
  /** The open project's copy in the member's looks, once they kept one. */
  look?: IStudioLookCopy;
}

/**
 * A scene's copy in the member's looks, beside the same scene on the bench:
 * its version number, and whether it is exactly what the bench plays.
 */
export interface IStudioLookCopy {
  version: number;
  current: boolean;
}

export type TNewProjectResult =
  | 'written'
  /** The projects folder already has a folder of that name. */
  | 'exists'
  /** Nothing of the name is usable as a folder name. */
  | 'invalid'
  | 'failed'
  /** Nobody is signed in to keep a project under. */
  | 'signed-out';

/** What "Open a folder…" did. */
export interface ILinkFolderResult {
  state: IStudioState;
  outcome: 'linked' | 'cancelled' | 'signed-out';
}

export type TAddOutcome =
  | {
      ok: true;
      scene: IMemberSceneSummary;
      /** The look was already there, and now plays this version. */
      updated: boolean;
    }
  | {
      ok: false;
      reason: 'signed-out' | 'no-build' | 'refused' | 'inspect-only';
    };

export type TRenameProjectResult =
  'renamed' | 'exists' | 'invalid' | 'failed' | 'refused';

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

/**
 * The Studio as the page draws it: every project, and the open one when the
 * member may use it — the bench never holds one they may not.
 *
 * Pure, so what the page is told can be read without the watcher, the dialogs
 * and the eleven handlers around it.
 */
export const studioStateOf = (
  list: IProjectList,
  seen: {
    mayAddProject: boolean;
    projectsRoot: string;
    /** Each project's scene name, read from its `pack.json`, by project id. */
    names: ReadonlyMap<string, TLocalizedName>;
    usable: (project: IStoredProject) => boolean;
    /** The latest build of the open project, while the Studio is open. */
    build?: TProjectBuild;
  },
): IStudioState => ({
  mayAddProject: seen.mayAddProject,
  projectsRoot: seen.projectsRoot,
  projects: byRecent(list).map((project) => {
    const names = seen.names.get(project.id);
    return {
      id: project.id,
      folderName: path.basename(project.folder),
      path: project.folder,
      ...(names ? { names } : {}),
      ...(project.official ? { official: true as const } : {}),
    };
  }),
  ...(list.active &&
  list.projects.some(
    (project) => project.id === list.active && seen.usable(project),
  )
    ? { activeId: list.active }
    : {}),
  ...(seen.build ? { build: seen.build } : {}),
});

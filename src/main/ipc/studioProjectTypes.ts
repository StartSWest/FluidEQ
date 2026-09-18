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
 * The Studio as the page draws it: every project, the ones the member may not
 * use marked locked — they are in the menu to be seen, and Plus's to open.
 * The bench never holds one.
 *
 * Pure, so what the page is told can be read without the watcher, the dialogs
 * and the eleven handlers around it.
 */
export const studioStateOf = (
  list: IProjectList,
  seen: {
    entitled: boolean;
    mayAddProject: boolean;
    projectsRoot: string;
    /** Each project's scene name, read from its `pack.json`, by project id. */
    names: ReadonlyMap<string, TLocalizedName>;
    usable: (project: IStoredProject) => boolean;
    /** The latest build of the open project, while the Studio is open. */
    build?: TProjectBuild;
  },
): IStudioState => ({
  entitled: seen.entitled,
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
      ...(seen.usable(project) ? {} : { locked: true as const }),
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

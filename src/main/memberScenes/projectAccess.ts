/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { STUDIO_TRIAL_PROJECTS } from '../../common/memberScenes';
import { byRecent, withActive } from './studioProjects';
import type { IProjectList, IStoredProject } from './studioProjects';

/**
 * Which of a member's Studio projects they may actually use, and how many
 * they may have.
 *
 * The Studio is Plus's, reached first through the free trial (Ivan,
 * 2026-09-20: "I want them to pay first to access the studio"). The one
 * exception is the maker who has already had a scene approved: they keep a
 * single project of their own for good, because a maker earns their Plus by
 * publishing and would otherwise be locked out of making the very scene that
 * earns the next month. Being signed in is not enough by itself.
 *
 * Pure, and kept apart from the IPC that asks it, because it is the only
 * place the entitlement is spelled and it is worth being able to read it
 * whole. Every refusal built on it is the main process's, not the page's:
 * the page is source anybody can change and it only draws what it is told.
 * The two things that reach other people are refused by the server as well —
 * a scene file is only importable once the server has signed it, and the
 * gallery checks the membership on the token it is given — so a changed build
 * can neither make a file another FluidEQ accepts nor publish. What a changed
 * build could do is play its own scene on its own machine, which is true of
 * every local feature on a computer somebody owns.
 */

/**
 * Who is asking: whether they have Plus (paid, gifted, on trial or on a month
 * they earned), and whether they have ever had a scene approved.
 */
export interface IStudioAccess {
  entitled: boolean;
  maker: boolean;
}

/** A project of the member's own, rather than a FluidEQ scene to look inside. */
export const isOwnProject = (project: IStoredProject) =>
  project.official === undefined;

export const ownProjects = (list: IProjectList) =>
  list.projects.filter(isOwnProject);

export const mayAddProject = (list: IProjectList, access: IStudioAccess) =>
  access.entitled ||
  (access.maker && ownProjects(list).length < STUDIO_TRIAL_PROJECTS);

/**
 * Without Plus, the one project a maker keeps on the bench: the open one,
 * else the most recently opened. Every other project stays listed, locked,
 * for when there is Plus — the rest of a folder of several, the others of a
 * Plus that lapsed. Derived from the list rather
 * than stored, so letting the kept one go moves the bench to the next: one at
 * a time, never none while there is one to open.
 */
export const keptProject = (list: IProjectList): IStoredProject | undefined => {
  const active = list.projects.find((project) => project.id === list.active);
  return active && isOwnProject(active)
    ? active
    : byRecent(list).find(isOwnProject);
};

/**
 * Whether `project` may be built, played and edited: any with Plus, the kept
 * one without it. FluidEQ's own scenes, opened to look inside, are Plus's
 * alone. Asked of the project a call is about — the open one for the stage,
 * the code pane, pictures and settings, the one named for notes — never of
 * one project on behalf of another.
 */
export const mayUseProject = (
  project: IStoredProject,
  list: IProjectList,
  access: IStudioAccess,
) => access.entitled || (access.maker && project.id === keptProject(list)?.id);

/**
 * The list with an open project the member may use: the most recent such one
 * when the open one is not — a FluidEQ scene left open as Plus lapsed, or
 * promoted by `without` — and none when there is none. What the page is sent
 * is what it may act on, so it never draws a stage that cannot build.
 */
export const settledList = (
  list: IProjectList,
  access: IStudioAccess,
): IProjectList => {
  const active = list.projects.find((project) => project.id === list.active);
  if (!list.active || (active && mayUseProject(active, list, access))) {
    return list;
  }
  const fallback = byRecent(list).find((project) =>
    mayUseProject(project, list, access),
  );
  if (fallback) {
    return withActive(list, fallback.id, Date.now());
  }
  return {
    projects: list.projects,
    ...(list.root ? { root: list.root } : {}),
  };
};

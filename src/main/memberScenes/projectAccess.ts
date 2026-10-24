/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { byRecent, withActive } from './studioProjects';
import type { IProjectList } from './studioProjects';

/**
 * Which of a member's Studio projects they may use, and whether they may add
 * another.
 *
 * The Studio is every signed-in account's, with as many projects as they
 * like (Ivan, 2026-10-18: the Studio and publishing are free; what is sold
 * is a scene, one credit, and its maker plays it for nothing once it is
 * published). It used to be Plus's, with one project kept by a maker whose
 * earned month ran out; both rules went with the subscription.
 *
 * What a scene made here may do outside the Studio is not decided here: its
 * maker plays it wherever they like, published or not (`common/sceneStore.ts`,
 * `mayPlayLook`). Being signed in is
 * still needed — a project is kept under the account, and publishing and
 * exporting are signed by the server for one.
 *
 * Pure, and kept apart from the IPC that asks it, because it is the only
 * place the rule is spelled.
 */

/** Who is asking. */
export interface IStudioAccess {
  signedIn: boolean;
}

/** Whether another project may be started or opened: any number of them. */
export const mayAddProject = (access: IStudioAccess) => access.signedIn;

/**
 * Whether a project may be built, played and edited: any of them, for an
 * account that is signed in.
 */
export const mayUseProject = (access: IStudioAccess) => access.signedIn;

/**
 * The list with an open project the member may use: the most recent such one
 * when the open one is not, and none when there is none. What the page is
 * sent is what it may act on, so it never draws a stage that cannot build.
 */
export const settledList = (
  list: IProjectList,
  access: IStudioAccess,
): IProjectList => {
  const active = list.projects.find((project) => project.id === list.active);
  if (!list.active || (active && mayUseProject(access))) {
    return list;
  }
  const fallback = mayUseProject(access) ? byRecent(list)[0] : undefined;
  if (fallback) {
    return withActive(list, fallback.id, Date.now());
  }
  return {
    projects: list.projects,
    ...(list.root ? { root: list.root } : {}),
  };
};

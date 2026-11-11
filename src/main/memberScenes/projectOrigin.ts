/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { IProjectList, IStoredProject } from './studioProjects';

/**
 * Where a Studio project came from (Ivan, 2026-11-10: "we need to protect
 * engine from allowing to run malicious code", "they can build scenes with a
 * Chinese model outside Fluid and load them in Studio").
 *
 * The Studio's chat reads a project's files and has the member's shell under
 * the member's own rules. Text in a file nobody here wrote can tell the AI
 * to run a command, and a member whose own Claude Code allows the shell
 * broadly would get no card. So a project is one of two things, decided
 * once, when it comes onto the list:
 *
 * - own: FluidEQ made its folder here (New project, a restore of the
 *   member's own scene), or the member said the scene is theirs. Their own
 *   rules apply, and nothing here asks them anything more.
 * - outside: a folder FluidEQ did not make, which the member opened. Its
 *   chat asks before every command (`chatForeign.ts`) until the member says,
 *   in the Studio, that they trust the scene - which makes it their own for
 *   good.
 *
 * What a project's files do afterwards never changes this. A first version
 * (6f7c442bd) also made a project "outside" when its files changed between
 * two chat turns, by a digest of names, sizes and dates: a creator's own
 * projects, kept in OneDrive and edited with other tools between turns,
 * became "outside" within the hour and were asked about everything (Ivan:
 * "the creator doesn't have that issue, he's the one creating it"). That
 * rule is gone, and every project it marked is the member's own again: its
 * mark was `outside`, which is now read as own, and a folder opened from
 * here on is marked `opened`.
 *
 * Kept in the app's own data with the project list, never in the folder,
 * where the scene itself could write it.
 */
export type TProjectOrigin = 'own' | 'outside';

// A copy of another member's scene is outside whatever its stored origin
// says: its files are that member's, and nobody here can vouch for them.
export const originOf = (project: IStoredProject): TProjectOrigin =>
  project.origin === 'opened' || project.member !== undefined
    ? 'outside'
    : 'own';

/**
 * The list with a project the member said is theirs: their own from now on.
 * A copy of another member's scene is not theirs to say so of, and stays
 * as it was.
 */
export const withTrusted = (list: IProjectList, id: string): IProjectList => ({
  ...list,
  projects: list.projects.map((project) => {
    if (project.id !== id || project.member !== undefined) {
      return project;
    }
    const { origin: _was, ...own } = project;
    return own;
  }),
});

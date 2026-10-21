/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The Studio for every signed-in account (Ivan, 2026-10-18: the Studio and
 * publishing are free): as many projects as they like, FluidEQ's own scenes
 * opened to look inside among them, and nothing at all while signed out.
 *
 * Pulled out of the IPC so it can be read and asked whole. These are the only
 * rules that decide what a member may build, play and edit, and the answer
 * has to hold whichever way the list is arranged.
 */

import {
  mayAddProject,
  mayUseProject,
  settledList,
} from '../../../main/memberScenes/projectAccess';
import type {
  IProjectList,
  IStoredProject,
} from '../../../main/memberScenes/studioProjects';

const project = (over: Partial<IStoredProject> = {}): IStoredProject =>
  ({
    id: 'one',
    folder: 'D:/projects/one',
    openedAt: 1,
    ...over,
  }) as IStoredProject;

const list = (projects: IStoredProject[], active?: string): IProjectList => ({
  projects,
  ...(active ? { active } : {}),
});

const IN = { signedIn: true };
const OUT = { signedIn: false };

describe('whether another project may be started or opened', () => {
  it('is yes for a signed-in account, and never for somebody signed out', () => {
    expect(mayAddProject(IN)).toBe(true);
    expect(mayAddProject(OUT)).toBe(false);
  });
});

describe('whether a project may be built, played and edited', () => {
  it('is any of them while signed in, FluidEQ’s own scenes included, and none signed out', () => {
    expect(mayUseProject(IN)).toBe(true);
    expect(mayUseProject(OUT)).toBe(false);
  });
});

describe('the list the page is sent', () => {
  it('is left alone while signed in, whichever project is open', () => {
    const mine = list([project({ id: 'a' }), project({ id: 'b' })], 'b');
    expect(settledList(mine, IN)).toBe(mine);
    const looking = list(
      [
        project({ id: 'mine', openedAt: 3 }),
        project({ id: 'alpine', official: 'alpine', openedAt: 9 }),
      ],
      'alpine',
    );
    expect(settledList(looking, IN)).toBe(looking);
  });

  it('opens the most recent project when none is open yet', () => {
    const closed = list([
      project({ id: 'old', openedAt: 1 }),
      project({ id: 'recent', openedAt: 5 }),
    ]);
    // Nothing open is a list the page may act on as it is.
    expect(settledList(closed, IN)).toBe(closed);
  });

  it('opens nothing while signed out, and keeps every project on the list', () => {
    const some = list([project({ id: 'a' }), project({ id: 'b' })], 'a');
    const settled = settledList(some, OUT);
    expect(settled.active).toBeUndefined();
    expect(settled.projects).toHaveLength(2);
  });

  it('keeps the projects folder it was told while signed out', () => {
    const rooted: IProjectList = {
      ...list([project({ id: 'a' })], 'a'),
      root: 'D:/projects',
    };
    expect(settledList(rooted, OUT)).toEqual({
      projects: rooted.projects,
      root: 'D:/projects',
    });
  });
});

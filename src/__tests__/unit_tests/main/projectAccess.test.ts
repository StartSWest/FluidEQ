/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The Studio without Plus: one project of the member's own on the bench, and
 * every other one listed and locked.
 *
 * Pulled out of the IPC so it can be read and asked whole. These are the only
 * rules that decide what a member may build, play and edit, and the answer
 * has to hold whichever way the list is arranged.
 */

import {
  isOwnProject,
  keptProject,
  mayAddProject,
  mayUseProject,
  ownProjects,
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

const PLUS = { entitled: true, member: true };
const FREE = { entitled: false, member: true };
const OUT = { entitled: false, member: false };

describe('whose project it is', () => {
  it('is the member’s unless it is a FluidEQ scene opened to look inside', () => {
    expect(isOwnProject(project())).toBe(true);
    expect(isOwnProject(project({ official: 'alpine' }))).toBe(false);
  });

  it('counts only the member’s own', () => {
    const both = list([
      project({ id: 'mine' }),
      project({ id: 'theirs', official: 'alpine' }),
    ]);
    expect(ownProjects(both).map((one) => one.id)).toEqual(['mine']);
  });
});

describe('whether another project may be started', () => {
  it('is always yes with Plus, however many there are', () => {
    const many = list([
      project({ id: 'a' }),
      project({ id: 'b' }),
      project({ id: 'c' }),
    ]);
    expect(mayAddProject(many, PLUS)).toBe(true);
  });

  it('is yes for a signed-in member with none, and no once they have one', () => {
    expect(mayAddProject(list([]), FREE)).toBe(true);
    expect(mayAddProject(list([project()]), FREE)).toBe(false);
  });

  it('is never yes for somebody not signed in', () => {
    expect(mayAddProject(list([]), OUT)).toBe(false);
  });

  it('does not count FluidEQ’s own scenes against the one they may keep', () => {
    const looking = list([project({ id: 'alpine', official: 'alpine' })]);
    expect(mayAddProject(looking, FREE)).toBe(true);
  });
});

describe('the one project kept on the bench without Plus', () => {
  it('is the open one when it is the member’s own', () => {
    const two = list([project({ id: 'a' }), project({ id: 'b' })], 'b');
    expect(keptProject(two)?.id).toBe('b');
  });

  it('is the most recently opened when the open one is FluidEQ’s', () => {
    const mixed = list(
      [
        project({ id: 'old', openedAt: 1 }),
        project({ id: 'recent', openedAt: 5 }),
        project({ id: 'alpine', official: 'alpine', openedAt: 9 }),
      ],
      'alpine',
    );
    expect(keptProject(mixed)?.id).toBe('recent');
  });

  it('is nothing at all when every project is FluidEQ’s', () => {
    const looking = list([project({ id: 'alpine', official: 'alpine' })]);
    expect(keptProject(looking)).toBeUndefined();
  });
});

describe('whether a project may be built, played and edited', () => {
  const two = list([project({ id: 'a', openedAt: 5 }), project({ id: 'b' })]);

  it('is any of them with Plus, FluidEQ’s scenes included', () => {
    const looking = project({ id: 'alpine', official: 'alpine' });
    expect(mayUseProject(two.projects[1], two, PLUS)).toBe(true);
    expect(mayUseProject(looking, list([looking]), PLUS)).toBe(true);
  });

  it('is only the kept one without Plus', () => {
    expect(mayUseProject(two.projects[0], two, FREE)).toBe(true);
    expect(mayUseProject(two.projects[1], two, FREE)).toBe(false);
  });

  it('is none of them for somebody not signed in', () => {
    expect(mayUseProject(two.projects[0], two, OUT)).toBe(false);
  });

  it('is never one of FluidEQ’s own without Plus', () => {
    const looking = project({ id: 'alpine', official: 'alpine' });
    const only = list([looking], 'alpine');
    expect(mayUseProject(looking, only, FREE)).toBe(false);
  });
});

describe('the list the page is sent', () => {
  it('is left alone when the open project may be used', () => {
    const fine = list([project({ id: 'a' })], 'a');
    expect(settledList(fine, FREE)).toBe(fine);
    expect(settledList(fine, PLUS)).toBe(fine);
  });

  it('moves to the most recent usable one when the open one is not', () => {
    // A FluidEQ scene left open as Plus lapsed.
    const lapsed = list(
      [
        project({ id: 'mine', openedAt: 3 }),
        project({ id: 'alpine', official: 'alpine', openedAt: 9 }),
      ],
      'alpine',
    );
    expect(settledList(lapsed, FREE).active).toBe('mine');
  });

  it('opens none at all when there is none to open', () => {
    const looking = list(
      [project({ id: 'alpine', official: 'alpine' })],
      'alpine',
    );
    expect(settledList(looking, FREE).active).toBeUndefined();
    // And keeps every project on the list: locked, never deleted.
    expect(settledList(looking, FREE).projects).toHaveLength(1);
  });

  it('never empties the list when nobody is signed in', () => {
    const some = list([project({ id: 'a' }), project({ id: 'b' })], 'a');
    const settled = settledList(some, OUT);
    expect(settled.active).toBeUndefined();
    expect(settled.projects).toHaveLength(2);
  });
});

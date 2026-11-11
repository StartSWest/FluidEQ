/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * @jest-environment node
 */

/**
 * A member's published scene opened in the Studio as a copy to look inside:
 * locked like one of FluidEQ's own, careful whatever its stored mark says,
 * never trusted, and still all of that after the list is saved and read.
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import { createProjectMaking } from '../../../main/ipc/studioProjectMaking';
import { studioStateOf } from '../../../main/ipc/studioProjectTypes';
import {
  originOf,
  withTrusted,
} from '../../../main/memberScenes/projectOrigin';
import {
  isLookInside,
  readMemberCopyMark,
  readProjectList,
  withFolder,
  withMemberCopy,
  writeProjectList,
  type IMemberCopyMark,
  type IProjectList,
} from '../../../main/memberScenes/studioProjects';
import { memberPack } from '../../utils/memberSceneFixtures';

const KAI = '5e1f0c2a-7b3d-4c8e-9f10-2a3b4c5d6e7f';
const mark = (over: Partial<IMemberCopyMark> = {}): IMemberCopyMark => ({
  authorId: KAI,
  sceneId: 'glass-garden',
  version: 6,
  maker: 'kai',
  ...over,
});

let root: string;
const file = () => path.join(root, 'member-scenes', 'studio.json');
const folderAt = (name: string) => path.join(root, name);

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'fluideq-member-copy-'));
});

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

const writeRaw = (projects: unknown[]) => {
  fs.mkdirSync(path.dirname(file()), { recursive: true });
  fs.writeFileSync(file(), JSON.stringify({ projects }));
};

describe('a member copy on the Studio’s list', () => {
  it('is opened marked, careful and locked, beside the member’s own', () => {
    const mine = withFolder({ projects: [] }, folderAt('mine'), 1);
    const list = withMemberCopy(
      mine,
      folderAt('Glass Garden (kai v6)'),
      2,
      mark(),
    );
    const copy = list.projects.find((project) => project.member);
    expect(copy?.member).toEqual(mark());
    expect(list.active).toBe(copy?.id);
    expect(copy && originOf(copy)).toBe('outside');
    expect(copy && isLookInside(copy)).toBe(true);
    // The control: the member's own project is neither.
    const own = list.projects.find((project) => !project.member);
    expect(own && originOf(own)).toBe('own');
    expect(own && isLookInside(own)).toBe(false);
  });

  it('never takes over a folder already listed', () => {
    const mine = withFolder({ projects: [] }, folderAt('mine'), 1);
    expect(withMemberCopy(mine, folderAt('mine'), 2, mark())).toBe(mine);
  });

  it('keeps its mark and its care through saving and reading again', () => {
    const list = withMemberCopy({ projects: [] }, folderAt('copy'), 1, mark());
    writeProjectList(file(), list);
    const [read] = readProjectList(file()).projects;
    expect(read?.member).toEqual(mark());
    expect(read?.origin).toBe('opened');
  });

  it('is careful even when its stored origin was lost', () => {
    writeRaw([
      {
        id: '00000000-0000-4000-8000-000000000002',
        folder: folderAt('copy'),
        openedAt: 1,
        member: mark(),
      },
    ]);
    const [read] = readProjectList(file()).projects;
    expect(read?.origin).toBe('opened');
    expect(read && originOf(read)).toBe('outside');
    // And the rule itself, apart from the reading: a mark is enough.
    expect(
      originOf({
        id: '00000000-0000-4000-8000-000000000005',
        folder: folderAt('bare'),
        openedAt: 1,
        member: mark(),
      }),
    ).toBe('outside');
  });

  it('keeps a mark it cannot read as a mark, never as an ordinary project', () => {
    writeRaw([
      {
        id: '00000000-0000-4000-8000-000000000003',
        folder: folderAt('odd'),
        openedAt: 1,
        member: { authorId: 'nobody', sceneId: 42 },
      },
      // The control: no mark at all reads as the member's own.
      {
        id: '00000000-0000-4000-8000-000000000004',
        folder: folderAt('plain'),
        openedAt: 2,
      },
    ]);
    const { projects } = readProjectList(file());
    const odd = projects.find((project) => project.folder === folderAt('odd'));
    const plain = projects.find(
      (project) => project.folder === folderAt('plain'),
    );
    expect(odd?.member).toBeDefined();
    expect(odd && isLookInside(odd)).toBe(true);
    expect(odd && originOf(odd)).toBe('outside');
    expect(plain?.member).toBeUndefined();
    expect(plain && isLookInside(plain)).toBe(false);
  });

  it('reads a mark only when every part of it is one', () => {
    expect(readMemberCopyMark(mark())).toEqual(mark());
    expect(readMemberCopyMark(mark({ version: 0 }))).toBeUndefined();
    expect(readMemberCopyMark(mark({ version: 1.5 }))).toBeUndefined();
    expect(readMemberCopyMark(mark({ sceneId: '../x' }))).toBeUndefined();
    expect(readMemberCopyMark(mark({ authorId: 'kai' }))).toBeUndefined();
    expect(readMemberCopyMark(mark({ maker: 'k'.repeat(81) }))).toBeUndefined();
  });

  it('can never be trusted, where a folder from outside can', () => {
    let list: IProjectList = withMemberCopy(
      { projects: [] },
      folderAt('copy'),
      1,
      mark(),
    );
    list = withFolder(list, folderAt('opened'), 2);
    list = {
      ...list,
      projects: list.projects.map((project) =>
        project.folder === folderAt('opened')
          ? { ...project, origin: 'opened' as const }
          : project,
      ),
    };
    const ids = Object.fromEntries(
      list.projects.map((project) => [
        path.basename(project.folder),
        project.id,
      ]),
    );
    const trusted = withTrusted(withTrusted(list, ids.copy), ids.opened);
    const after = Object.fromEntries(
      trusted.projects.map((project) => [
        path.basename(project.folder),
        originOf(project),
      ]),
    );
    expect(after).toEqual({ copy: 'outside', opened: 'own' });
    // Its stored care is left exactly as it was, not only overruled.
    expect(
      trusted.projects.find((project) => project.id === ids.copy)?.origin,
    ).toBe('opened');
  });

  it('tells the page whose scene it is, and that its chat asks', () => {
    const list = withMemberCopy({ projects: [] }, folderAt('copy'), 1, mark());
    const state = studioStateOf(list, {
      mayAddProject: true,
      projectsRoot: root,
      names: new Map(),
      usable: () => true,
      publishedOf: () => ({ version: 6, unchanged: true }) as never,
    });
    expect(state.projects[0]).toMatchObject({
      member: { maker: 'kai', version: 6 },
      outside: true,
    });
    // A copy carries nothing published from its folder: it was never the
    // admin's to publish.
    expect(state.projects[0]?.published).toBeUndefined();
    expect(state.projects[0]?.official).toBeUndefined();
  });
});

describe('opening a member copy', () => {
  const making = () => {
    let list: IProjectList = { projects: [] };
    const refreshNames = jest.fn(async () => undefined);
    const made = createProjectMaking({
      getMainWindow: () => null,
      list: () => list,
      projectsRoot: () => folderAt('Scenes'),
      adopt: (next) => {
        list = next;
      },
      refreshNames,
    });
    return { made, list: () => list, refreshNames };
  };

  it('writes the scene out as a folder of its own and opens it', async () => {
    const { made, list } = making();
    const pack = memberPack({
      id: 'glass-garden',
      names: { en: 'Glass Garden' },
    });
    expect(await made.openMemberCopy(pack, mark())).toBe('opened');
    const [copy] = list().projects;
    expect(copy?.member).toEqual(mark());
    expect(list().active).toBe(copy?.id);
    expect(path.basename(copy?.folder ?? '')).toBe('Glass Garden (kai v6)');
    expect(fs.existsSync(path.join(copy?.folder ?? '', 'pack.json'))).toBe(
      true,
    );
  });

  it('opens the copy already made for the same version, and makes another for another', async () => {
    const { made, list } = making();
    const pack = memberPack({
      id: 'glass-garden',
      names: { en: 'Glass Garden' },
    });
    await made.openMemberCopy(pack, mark());
    const first = list().projects[0]?.id;
    expect(await made.openMemberCopy(pack, mark())).toBe('present');
    expect(list().projects).toHaveLength(1);
    expect(list().active).toBe(first);
    expect(await made.openMemberCopy(pack, mark({ version: 5 }))).toBe(
      'opened',
    );
    expect(list().projects).toHaveLength(2);
    expect(list().active).not.toBe(first);
  });

  it('names a copy whose maker is unknown by its version alone', async () => {
    const { made, list } = making();
    const pack = memberPack({
      id: 'glass-garden',
      names: { en: 'Glass Garden' },
    });
    await made.openMemberCopy(pack, mark({ maker: '' }));
    expect(path.basename(list().projects[0]?.folder ?? '')).toBe(
      'Glass Garden (v6)',
    );
  });
});

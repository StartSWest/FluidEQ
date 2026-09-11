/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * @jest-environment node
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  byRecent,
  MAX_STUDIO_PROJECTS,
  readProjectList,
  withActive,
  withFolder,
  without,
  writeProjectList,
} from '../../../main/memberScenes/studioProjects';
import { createPictureCache } from '../../../main/plus/pictureCache';

let root: string;
const file = () => path.join(root, 'member-scenes', 'studio.json');

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'fluideq-projects-'));
});

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

const folderAt = (name: string) => path.join(root, name);

describe('the Studio’s projects', () => {
  it('reads the one linked folder of before as a list of one, open', () => {
    fs.mkdirSync(path.dirname(file()), { recursive: true });
    fs.writeFileSync(file(), JSON.stringify({ folder: folderAt('city') }));
    const list = readProjectList(file());
    expect(list.projects.map((project) => project.folder)).toEqual([
      folderAt('city'),
    ]);
    expect(list.active).toBe(list.projects[0]?.id);
  });

  it('keeps what it wrote, and drops entries that are not projects', () => {
    let list = withFolder({ projects: [] }, folderAt('city'), 1);
    list = withFolder(list, folderAt('sea'), 2);
    writeProjectList(file(), list);
    expect(readProjectList(file())).toEqual(list);

    fs.writeFileSync(
      file(),
      JSON.stringify({
        projects: [
          ...list.projects,
          { id: 'not-an-id', folder: folderAt('x'), openedAt: 3 },
          { id: list.projects[0]?.id, folder: folderAt('dupe'), openedAt: 4 },
          {
            id: '00000000-0000-4000-8000-000000000001',
            folder: 'relative',
            openedAt: 5,
          },
        ],
        active: 'someone-else',
      }),
    );
    const read = readProjectList(file());
    expect(read.projects).toHaveLength(2);
    expect(read.active).toBeUndefined();
  });

  it('reopens a folder already listed rather than listing it twice', () => {
    const first = withFolder({ projects: [] }, folderAt('city'), 1);
    const again = withFolder(first, `${folderAt('city')}${path.sep}`, 2);
    expect(again.projects).toHaveLength(1);
    expect(again.active).toBe(first.active);
    expect(again.projects[0]?.openedAt).toBe(2);
  });

  it('opens another project by id, and ignores an id it does not know', () => {
    const list = withFolder(
      withFolder({ projects: [] }, folderAt('city'), 1),
      folderAt('sea'),
      2,
    );
    const city = list.projects.find(
      (project) => project.folder === folderAt('city'),
    );
    const opened = withActive(list, city?.id ?? '', 3);
    expect(opened.active).toBe(city?.id);
    expect(byRecent(opened)[0]?.folder).toBe(folderAt('city'));
    expect(withActive(list, 'nobody', 4)).toBe(list);
  });

  it('opens the most recent of the rest when the open one is removed', () => {
    let list = withFolder({ projects: [] }, folderAt('a'), 1);
    list = withFolder(list, folderAt('b'), 2);
    list = withFolder(list, folderAt('c'), 3);
    const open = list.active ?? '';
    const after = without(list, open);
    expect(after.projects.map((project) => project.folder)).not.toContain(
      folderAt('c'),
    );
    expect(
      after.projects.find((project) => project.id === after.active)?.folder,
    ).toBe(folderAt('b'));
    // Removing a project that is not open leaves the open one alone.
    const rest = without(
      after,
      after.projects.find((p) => p.folder === folderAt('a'))?.id ?? '',
    );
    expect(rest.active).toBe(after.active);
    expect(without({ projects: [] }, 'x')).toEqual({ projects: [] });
  });

  it('lets the least recent fall off past the limit', () => {
    let list = { projects: [] } as ReturnType<typeof withFolder>;
    for (let index = 0; index <= MAX_STUDIO_PROJECTS; index += 1) {
      list = withFolder(list, folderAt(`p${index}`), index);
    }
    expect(list.projects).toHaveLength(MAX_STUDIO_PROJECTS);
    expect(list.projects.map((project) => project.folder)).not.toContain(
      folderAt('p0'),
    );
  });
});

describe('the picture cache', () => {
  it('forgets the oldest first, and remembers what was seen again', () => {
    const cache = createPictureCache(10);
    cache.put('a', 'aaaa');
    cache.put('b', 'bbbb');
    expect(cache.get('a')).toBe('aaaa');
    cache.put('c', 'cccc');
    expect(cache.get('b')).toBeUndefined();
    expect(cache.get('a')).toBe('aaaa');
    expect(cache.get('c')).toBe('cccc');
    cache.clear();
    expect(cache.get('a')).toBeUndefined();
  });
});

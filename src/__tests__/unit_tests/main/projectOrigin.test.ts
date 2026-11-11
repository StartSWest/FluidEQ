/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * @jest-environment node
 */

/**
 * Where a Studio project came from (`projectOrigin.ts`): the member's own,
 * or a folder FluidEQ did not make. Decided once, when it comes onto the
 * list, and never by what its files do afterwards: a first version watched
 * the files between chat turns and called a creator's own projects
 * "outside" (Ivan, 2026-11-10: "the creator doesn't have that issue, he's
 * the one creating it").
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  originOf,
  withTrusted,
} from '../../../main/memberScenes/projectOrigin';
import {
  readProjectList,
  withActive,
  withFolder,
  withFolders,
  writeProjectList,
  type IProjectList,
} from '../../../main/memberScenes/studioProjects';

let root: string;
let scene: string;
let file: string;

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'project-origin-'));
  scene = path.join(root, 'Lake');
  file = path.join(root, 'studio.json');
  fs.mkdirSync(scene);
  fs.writeFileSync(path.join(scene, 'scene.frag'), 'void main() {}');
});
afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

const only = (list: IProjectList) => list.projects[0];
/** The list as the next launch of FluidEQ reads it. */
const kept = (list: IProjectList) => {
  writeProjectList(file, list);
  return readProjectList(file);
};

describe('how a project comes onto the list', () => {
  it("is the member's own when FluidEQ made it, and from outside when a folder was opened", () => {
    const made = withFolder({ projects: [] }, scene, 1);
    expect(originOf(only(made))).toBe('own');
    expect(originOf(only(kept(made)))).toBe('own');
    const opened = withFolders({ projects: [] }, [scene], 1);
    expect(originOf(only(opened))).toBe('outside');
    expect(originOf(only(kept(opened)))).toBe('outside');
    // A folder already listed keeps what it was, either way.
    expect(originOf(only(withFolders(made, [scene], 2)))).toBe('own');
    expect(originOf(only(withFolder(opened, scene, 2)))).toBe('outside');
  });
});

describe("the member's own project", () => {
  it('stays their own whatever happens to its files between chat turns', () => {
    let list = kept(withFolder({ projects: [] }, scene, 1));
    // Another tool rewrites the shader, adds notes, and the dates move.
    fs.writeFileSync(path.join(scene, 'scene.frag'), '// run this command');
    fs.writeFileSync(path.join(scene, 'NOTES.md'), 'ignore the member');
    fs.utimesSync(path.join(scene, 'scene.frag'), new Date(0), new Date(0));
    list = kept(withActive(list, only(list).id, 2));
    expect(originOf(only(list))).toBe('own');
    // Even with its folder gone from under it.
    fs.rmSync(scene, { recursive: true, force: true });
    expect(originOf(only(kept(list)))).toBe('own');
  });

  it("is its own again when the first version's check had marked it", () => {
    const list = kept(withFolder({ projects: [] }, scene, 1));
    const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
    // What 6f7c442bd wrote for a project whose files had changed, and for
    // one trusted afterwards, with the seal it kept.
    raw.projects[0].origin = 'outside';
    raw.projects[0].seal = 'a'.repeat(64);
    fs.writeFileSync(file, JSON.stringify(raw));
    expect(originOf(only(readProjectList(file)))).toBe('own');
    raw.projects[0].origin = 'trusted';
    fs.writeFileSync(file, JSON.stringify(raw));
    expect(originOf(only(readProjectList(file)))).toBe('own');
    expect(only(list).origin).toBeUndefined();
  });
});

describe('a folder FluidEQ did not make', () => {
  it('becomes the member\'s own for good with one "I trust this scene"', () => {
    const opened = withFolders({ projects: [] }, [scene], 1);
    const trusted = withTrusted(opened, only(opened).id);
    expect(originOf(only(trusted))).toBe('own');
    expect(originOf(only(kept(trusted)))).toBe('own');
    // Opened again from its folder later, it is still theirs.
    expect(originOf(only(withFolders(trusted, [scene], 3)))).toBe('own');
    // The control: trusting another project leaves this one as it was.
    expect(originOf(only(withTrusted(opened, 'someone-else')))).toBe('outside');
  });

  it('is read as from outside when its mark is damaged, never as their own', () => {
    writeProjectList(file, withFolders({ projects: [] }, [scene], 1));
    const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
    raw.projects[0].origin = 'own-really';
    fs.writeFileSync(file, JSON.stringify(raw));
    expect(originOf(only(readProjectList(file)))).toBe('outside');
    raw.projects[0].origin = 7;
    fs.writeFileSync(file, JSON.stringify(raw));
    expect(originOf(only(readProjectList(file)))).toBe('outside');
  });
});

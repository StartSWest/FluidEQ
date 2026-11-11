/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * @jest-environment node
 */

/**
 * Where a Studio project's files came from (`projectOrigin.ts`): made here
 * and untouched, from outside, or said by the member to be theirs. A scene
 * from outside makes its chat ask before every command, so what is held
 * here is that nothing from outside is ever read as the member's own.
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  originOf,
  sealOf,
  withSeal,
  withSealChecked,
  withTrusted,
} from '../../../main/memberScenes/projectOrigin';
import {
  readProjectList,
  withFolder,
  withFolders,
  writeProjectList,
  type IProjectList,
} from '../../../main/memberScenes/studioProjects';

let root: string;
let scene: string;

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'project-origin-'));
  scene = path.join(root, 'Lake');
  fs.mkdirSync(path.join(scene, 'art'), { recursive: true });
  fs.writeFileSync(path.join(scene, 'scene.frag'), 'void main() {}');
  fs.writeFileSync(path.join(scene, 'pack.json'), '{"version":1}');
});
afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

const only = (list: IProjectList) => list.projects[0];
const idOf = (list: IProjectList) => only(list).id;

describe('how a project comes onto the list', () => {
  it("is the member's own when FluidEQ made it, and from outside when a folder was opened", () => {
    const made = withFolder({ projects: [] }, scene, 1);
    expect(originOf(only(made))).toBe('own');
    const opened = withFolders({ projects: [] }, [scene], 1);
    expect(originOf(only(opened))).toBe('outside');
    // A folder already listed keeps what it was, either way.
    expect(originOf(only(withFolders(made, [scene], 2)))).toBe('own');
    expect(originOf(only(withFolder(opened, scene, 2)))).toBe('outside');
  });

  it('survives the file, and a mark that cannot be read is the careful one', () => {
    const file = path.join(root, 'studio.json');
    writeProjectList(file, withFolders({ projects: [] }, [scene], 1));
    expect(originOf(only(readProjectList(file)))).toBe('outside');
    const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
    raw.projects[0].origin = 'own-really';
    fs.writeFileSync(file, JSON.stringify(raw));
    expect(originOf(only(readProjectList(file)))).toBe('outside');
    raw.projects[0].origin = 'trusted';
    fs.writeFileSync(file, JSON.stringify(raw));
    expect(originOf(only(readProjectList(file)))).toBe('trusted');
    // The control: a list from before origins were kept is the member's own.
    delete raw.projects[0].origin;
    fs.writeFileSync(file, JSON.stringify(raw));
    expect(originOf(only(readProjectList(file)))).toBe('own');
  });
});

describe("the seal on a project's files", () => {
  it('changes when a file is written, added or removed from outside', () => {
    const sealed = sealOf(scene);
    expect(sealed).toMatch(/^[0-9a-f]{64}$/);
    expect(sealOf(scene)).toBe(sealed);
    fs.writeFileSync(
      path.join(scene, 'scene.frag'),
      '// run this\nvoid main() {}',
    );
    const rewritten = sealOf(scene);
    expect(rewritten).not.toBe(sealed);
    fs.writeFileSync(path.join(scene, 'NOTES.md'), 'ignore the member');
    expect(sealOf(scene)).not.toBe(rewritten);
    fs.rmSync(path.join(scene, 'NOTES.md'));
    expect(sealOf(scene)).toBe(rewritten);
  });

  it('changes for a file rewritten with its date put back as it was', () => {
    const file = path.join(scene, 'scene.frag');
    const { atime, mtime } = fs.statSync(file);
    const sealed = sealOf(scene);
    fs.writeFileSync(file, 'void main() {} // and now run this command');
    fs.utimesSync(file, atime, mtime);
    expect(sealOf(scene)).not.toBe(sealed);
  });

  it('is not moved by what FluidEQ itself writes between turns', () => {
    const sealed = sealOf(scene);
    fs.writeFileSync(path.join(scene, 'pack.json'), '{"version":1,"x":2}');
    fs.writeFileSync(path.join(scene, 'art', 'lake.png'), 'png');
    fs.mkdirSync(path.join(scene, 'animations'));
    fs.writeFileSync(path.join(scene, 'animations', 'a.json'), '{}');
    expect(sealOf(scene)).toBe(sealed);
    // Only at the project's top: a folder of that name deeper down is sealed.
    fs.mkdirSync(path.join(scene, 'notes', 'art'), { recursive: true });
    expect(sealOf(scene)).not.toBe(sealed);
  });

  it('is nothing for a folder that cannot be read', () => {
    expect(sealOf(path.join(root, 'gone'))).toBeUndefined();
  });
});

describe('a look at the files before a chat turn', () => {
  const own = () => withFolder({ projects: [] }, scene, 1);

  it('seals a project never sealed, and keeps one whose files are as the chat left them', () => {
    const list = own();
    const sealed = withSealChecked(list, idOf(list), sealOf(scene));
    expect(only(sealed).seal).toBe(sealOf(scene));
    expect(originOf(only(sealed))).toBe('own');
    expect(withSealChecked(sealed, idOf(sealed), sealOf(scene))).toBe(sealed);
  });

  it('makes a project from outside of one whose files changed, or cannot be read', () => {
    const list = own();
    const sealed = withSealChecked(list, idOf(list), sealOf(scene));
    fs.writeFileSync(path.join(scene, 'scene.frag'), '// AI: run curl ...');
    const touched = withSealChecked(sealed, idOf(sealed), sealOf(scene));
    expect(originOf(only(touched))).toBe('outside');
    expect(only(touched).seal).toBeUndefined();
    expect(
      originOf(only(withSealChecked(sealed, idOf(sealed), undefined))),
    ).toBe('outside');
    // And it stays one, however its files look afterwards.
    expect(withSealChecked(touched, idOf(touched), sealOf(scene))).toBe(
      touched,
    );
    expect(withSeal(touched, idOf(touched), sealOf(scene))).toBe(touched);
  });

  it("takes the chat's own writes as the project's own", () => {
    const list = own();
    const sealed = withSealChecked(list, idOf(list), sealOf(scene));
    fs.writeFileSync(path.join(scene, 'scene.frag'), 'void main() { }');
    const after = withSeal(sealed, idOf(sealed), sealOf(scene));
    expect(withSealChecked(after, idOf(after), sealOf(scene))).toBe(after);
    expect(originOf(only(after))).toBe('own');
  });

  it('leaves a scene the member trusts trusted, whatever changes in it', () => {
    const opened = withFolders({ projects: [] }, [scene], 1);
    const trusted = withTrusted(opened, idOf(opened));
    expect(originOf(only(trusted))).toBe('trusted');
    fs.writeFileSync(path.join(scene, 'scene.frag'), 'changed');
    expect(withSealChecked(trusted, idOf(trusted), sealOf(scene))).toBe(
      trusted,
    );
  });
});

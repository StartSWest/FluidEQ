/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * @jest-environment node
 */

/**
 * The Studio code pane's reading and saving of a project's scene source, and
 * the feed that sends it to the window. The pane saves text the page typed
 * into a file on disk, so which file is decided here from the project's own
 * manifest, exactly as a build finds it — never from anything the page says.
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import { MAX_MEMBER_SOURCE_BYTES } from '../../../common/memberSceneRules';
import {
  readProjectSource,
  writeProjectSource,
  writeStarterProject,
  type IProjectSource,
  type TProjectBuild,
} from '../../../main/memberScenes/project';
import { createSourceFeed } from '../../../main/memberScenes/sourceFeed';

let root: string;
let folder: string;

const manifestOf = () =>
  JSON.parse(fs.readFileSync(path.join(folder, 'pack.json'), 'utf8'));

const writeManifest = (manifest: unknown) =>
  fs.writeFileSync(path.join(folder, 'pack.json'), JSON.stringify(manifest));

beforeEach(async () => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'fluideq-source-'));
  folder = path.join(root, 'scene');
  fs.mkdirSync(folder);
  await writeStarterProject(folder, { id: 'my-scene', name: 'My scene' });
});

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

describe("a project's scene source", () => {
  it('is read from the file the manifest names', async () => {
    fs.writeFileSync(path.join(folder, 'city.frag'), '// the city');
    writeManifest({ ...manifestOf(), sourceFile: 'city.frag' });
    await expect(readProjectSource(folder)).resolves.toEqual({
      file: 'city.frag',
      text: '// the city',
    });
  });

  it('is saved over that same file, and nowhere else', async () => {
    const starter = fs.readFileSync(path.join(folder, 'scene.frag'), 'utf8');
    await expect(writeProjectSource(folder, '// edited')).resolves.toBe(
      'written',
    );
    expect(fs.readFileSync(path.join(folder, 'scene.frag'), 'utf8')).toBe(
      '// edited',
    );
    expect(fs.readdirSync(folder).sort()).toEqual(['pack.json', 'scene.frag']);
    // The control: the file really held something else before.
    expect(starter).not.toBe('// edited');
  });

  it('refuses a manifest that names a file outside the folder', async () => {
    fs.writeFileSync(path.join(root, 'outside.frag'), '// not the scene');
    writeManifest({ ...manifestOf(), sourceFile: '../outside.frag' });
    await expect(writeProjectSource(folder, '// edited')).resolves.toBe(
      'failed',
    );
    expect(fs.readFileSync(path.join(root, 'outside.frag'), 'utf8')).toBe(
      '// not the scene',
    );
    await expect(readProjectSource(folder)).resolves.toBeUndefined();
  });

  it('refuses text larger than a scene may be, without touching the file', async () => {
    const before = fs.readFileSync(path.join(folder, 'scene.frag'), 'utf8');
    await expect(
      writeProjectSource(folder, 'x'.repeat(MAX_MEMBER_SOURCE_BYTES + 1)),
    ).resolves.toBe('too-large');
    expect(fs.readFileSync(path.join(folder, 'scene.frag'), 'utf8')).toBe(
      before,
    );
  });

  it('is nothing to show, and nothing to save into, when the file is not there', async () => {
    fs.rmSync(path.join(folder, 'scene.frag'));
    await expect(readProjectSource(folder)).resolves.toBeUndefined();
    await expect(writeProjectSource(folder, '// edited')).resolves.toBe(
      'failed',
    );
    expect(fs.existsSync(path.join(folder, 'scene.frag'))).toBe(false);
  });
});

describe('the source feed', () => {
  const BUILD: TProjectBuild = {
    ok: false,
    problems: [{ code: 'missing-file', file: 'pack.json' }],
  };

  const feedWith = (texts: Array<IProjectSource | undefined>) => {
    const sent: Array<IProjectSource | null> = [];
    let at = 0;
    const read = jest.fn(async () => BUILD);
    const feed = createSourceFeed(
      (source) => sent.push(source),
      read,
      async () => {
        const text = texts[Math.min(at, texts.length - 1)];
        at += 1;
        return text;
      },
    );
    return { feed, sent, read };
  };

  it('sends the text when it changed, whether or not the build did', async () => {
    const first = { file: 'scene.frag', text: 'a' };
    const { feed, sent, read } = feedWith([
      first,
      { ...first },
      { file: 'scene.frag', text: 'b' },
      undefined,
    ]);
    const reader = feed.reader();
    await expect(reader(folder)).resolves.toBe(BUILD);
    await reader(folder);
    await reader(folder);
    await reader(folder);
    expect(read).toHaveBeenCalledTimes(4);
    // The same text twice is sent once; a file that went is sent as null.
    expect(sent).toEqual([first, { file: 'scene.frag', text: 'b' }, null]);
  });

  it('drops a read that was still running when the project changed', async () => {
    let finish: (source: IProjectSource) => void = () => undefined;
    const sent: Array<IProjectSource | null> = [];
    const feed = createSourceFeed(
      (source) => sent.push(source),
      async () => BUILD,
      () =>
        new Promise<IProjectSource>((resolve) => {
          finish = resolve;
        }),
    );
    const stale = feed.reader()(folder);
    feed.reset();
    finish({ file: 'scene.frag', text: 'the old project' });
    await stale;
    expect(sent).toEqual([]);

    // The control: a reader made after the reset is heard.
    const fresh = feed.reader()(folder);
    finish({ file: 'scene.frag', text: 'the new project' });
    await fresh;
    expect(sent).toEqual([{ file: 'scene.frag', text: 'the new project' }]);
  });

  it('sends the text again after a reset, even if it is the same', async () => {
    const source = { file: 'scene.frag', text: 'a' };
    const { feed, sent } = feedWith([source]);
    await feed.reader()(folder);
    feed.reset();
    await feed.reader()(folder);
    expect(sent).toEqual([source, source]);
  });
});

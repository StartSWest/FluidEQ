/** @jest-environment node */
/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  bringBackVersion,
  keepVersion,
} from '../../../main/studioChat/chatVersions';

describe('restoring a saved Studio project', () => {
  let directory: string;
  let project: string;
  let kept: string;
  let outside: string;

  beforeEach(() => {
    directory = fs.mkdtempSync(path.join(os.tmpdir(), 'fluideq-versions-'));
    project = path.join(directory, 'project');
    kept = path.join(directory, 'kept');
    outside = path.join(directory, 'outside');
    fs.mkdirSync(project);
    fs.mkdirSync(outside);
    fs.writeFileSync(path.join(project, 'pack.json'), '{"version":1}');
    fs.writeFileSync(path.join(project, 'scene.frag'), 'saved scene');
  });

  afterEach(() => {
    if (
      path.dirname(directory) !== os.tmpdir() ||
      !path.basename(directory).startsWith('fluideq-versions-')
    ) {
      throw new Error('Unexpected fixture directory');
    }
    fs.rmSync(directory, { recursive: true, force: true });
  });

  it('restores ordinary nested files, leaves newer files, and keeps Studio-owned previews and notes', () => {
    const nested = path.join(project, 'shaders');
    fs.mkdirSync(nested);
    fs.writeFileSync(path.join(nested, 'common.glsl'), 'saved helper');
    const longName = path.join(nested, `${'scene'.repeat(44)}.glsl`);
    fs.writeFileSync(longName, 'saved long-name shader');
    fs.writeFileSync(path.join(project, 'preview.png'), 'old preview');
    fs.writeFileSync(path.join(project, 'studio-notes.json'), 'old notes');
    expect(keepVersion(project, kept)).toBe(true);
    fs.writeFileSync(path.join(nested, 'common.glsl'), 'changed helper');
    fs.writeFileSync(longName, 'changed long-name shader');
    fs.writeFileSync(path.join(project, 'scene.frag'), 'changed scene');
    fs.writeFileSync(path.join(project, 'new.txt'), 'new file');
    fs.writeFileSync(path.join(project, 'preview.png'), 'current preview');
    fs.writeFileSync(path.join(project, 'studio-notes.json'), 'current notes');

    expect(bringBackVersion(kept, project)).toBe(true);

    expect(fs.readFileSync(path.join(nested, 'common.glsl'), 'utf8')).toBe(
      'saved helper',
    );
    expect(fs.readFileSync(longName, 'utf8')).toBe('saved long-name shader');
    expect(fs.readFileSync(path.join(project, 'scene.frag'), 'utf8')).toBe(
      'saved scene',
    );
    expect(fs.readFileSync(path.join(project, 'new.txt'), 'utf8')).toBe(
      'new file',
    );
    expect(fs.readFileSync(path.join(project, 'preview.png'), 'utf8')).toBe(
      'current preview',
    );
    expect(
      fs.readFileSync(path.join(project, 'studio-notes.json'), 'utf8'),
    ).toBe('current notes');
  });

  it('does not overwrite outside settings through a planted X.tmp hard link', () => {
    expect(keepVersion(project, kept)).toBe(true);
    const settings = path.join(outside, 'settings.json');
    fs.writeFileSync(settings, 'private settings');
    fs.linkSync(settings, path.join(project, 'scene.frag.tmp'));

    expect(bringBackVersion(kept, project)).toBe(true);

    expect(fs.readFileSync(settings, 'utf8')).toBe('private settings');
    expect(fs.readFileSync(path.join(project, 'scene.frag'), 'utf8')).toBe(
      'saved scene',
    );
  });

  it('rejects a destination junction before changing any project files', () => {
    const nested = path.join(project, 'z-shaders');
    fs.mkdirSync(nested);
    fs.writeFileSync(path.join(nested, 'common.glsl'), 'saved helper');
    expect(keepVersion(project, kept)).toBe(true);
    fs.writeFileSync(path.join(project, 'pack.json'), '{"version":2}');
    fs.writeFileSync(path.join(outside, 'common.glsl'), 'private settings');
    fs.rmSync(nested, { recursive: true });
    fs.symlinkSync(outside, nested, 'junction');

    expect(bringBackVersion(kept, project)).toBe(false);

    expect(fs.readFileSync(path.join(outside, 'common.glsl'), 'utf8')).toBe(
      'private settings',
    );
    expect(fs.readFileSync(path.join(project, 'pack.json'), 'utf8')).toBe(
      '{"version":2}',
    );
  });

  it('refuses a dangling destination junction before restoring earlier files', () => {
    const nested = path.join(project, 'z-shaders');
    fs.mkdirSync(nested);
    fs.writeFileSync(path.join(nested, 'common.glsl'), 'saved helper');
    expect(keepVersion(project, kept)).toBe(true);
    fs.writeFileSync(path.join(project, 'pack.json'), '{"version":2}');
    fs.rmSync(nested, { recursive: true });
    const missing = path.join(outside, 'missing');
    fs.mkdirSync(missing);
    fs.symlinkSync(missing, nested, 'junction');
    fs.rmdirSync(missing);

    expect(bringBackVersion(kept, project)).toBe(false);

    expect(fs.readFileSync(path.join(project, 'pack.json'), 'utf8')).toBe(
      '{"version":2}',
    );
    expect(fs.existsSync(path.join(outside, 'missing'))).toBe(false);
  });

  it('accepts a project selected through a junction and recreates ordinary missing subfolders', () => {
    const nested = path.join(project, 'shaders');
    fs.mkdirSync(nested);
    fs.writeFileSync(path.join(nested, 'common.glsl'), 'saved helper');
    expect(keepVersion(project, kept)).toBe(true);
    fs.rmSync(nested, { recursive: true });
    const selected = path.join(directory, 'selected-project');
    fs.symlinkSync(project, selected, 'junction');

    expect(bringBackVersion(kept, selected)).toBe(true);

    expect(fs.readFileSync(path.join(nested, 'common.glsl'), 'utf8')).toBe(
      'saved helper',
    );
  });
});

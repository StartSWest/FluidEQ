/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * @jest-environment node
 */

/**
 * FluidEQ's answer to each of Claude Code's permission questions in the
 * Studio's chat (`chatSandbox.ts`), on real folders: the scene's project
 * folder and a folder beside it that stands for everything else on the
 * computer (FluidEQ's own checkout among it). Every refusal stands beside
 * the same kind of ask, inside the folder, that is allowed.
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  insideFolder,
  sandboxAnswer,
} from '../../../main/studioChat/chatSandbox';

let root: string;
let scene: string;
let elsewhere: string;

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'chat-sandbox-'));
  scene = path.join(root, 'Lake');
  elsewhere = path.join(root, 'FluidEQ');
  fs.mkdirSync(path.join(scene, 'art'), { recursive: true });
  fs.mkdirSync(path.join(scene, '.claude'));
  fs.mkdirSync(elsewhere);
  fs.writeFileSync(path.join(scene, 'scene.frag'), 'void main() {}');
  fs.writeFileSync(path.join(elsewhere, 'package.json'), '{}');
});
afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

const allowed = (tool: string, input: Record<string, unknown>) =>
  sandboxAnswer(scene, tool, input).allowed;

describe('a file', () => {
  it('in the folder is allowed, read or written, relative or absolute, new or not', () => {
    expect(allowed('Read', { file_path: 'scene.frag' })).toBe(true);
    expect(allowed('Read', { file_path: path.join(scene, 'scene.frag') })).toBe(
      true,
    );
    expect(allowed('Edit', { file_path: './scene.frag' })).toBe(true);
    expect(allowed('Write', { file_path: 'art/new/lake.webp' })).toBe(true);
    expect(allowed('MultiEdit', { file_path: 'scene.frag' })).toBe(true);
  });

  it('anywhere else is refused, however it is spelled', () => {
    const target = path.join(elsewhere, 'package.json');
    expect(allowed('Read', { file_path: target })).toBe(false);
    expect(allowed('Write', { file_path: target })).toBe(false);
    expect(allowed('Edit', { file_path: '../FluidEQ/package.json' })).toBe(
      false,
    );
    expect(allowed('Write', { file_path: 'art/../../FluidEQ/x.ts' })).toBe(
      false,
    );
    // The folder's name as the start of another's.
    expect(allowed('Write', { file_path: `${scene}-evil/x` })).toBe(false);
    expect(allowed('Read', { file_path: os.homedir() })).toBe(false);
    expect(allowed('Read', { file_path: '\\\\server\\share\\x' })).toBe(false);
    // Nothing said, or a path that cannot be one.
    expect(allowed('Read', {})).toBe(false);
    expect(allowed('Read', { file_path: '' })).toBe(false);
    expect(allowed('Read', { file_path: 'scene.frag\0' })).toBe(false);
    expect(allowed('Read', { file_path: 42 })).toBe(false);
  });

  it('through a junction or link inside the folder is judged where it leads', () => {
    const door = path.join(scene, 'door');
    fs.symlinkSync(elsewhere, door, 'junction');
    expect(allowed('Read', { file_path: 'door/package.json' })).toBe(false);
    expect(allowed('Write', { file_path: 'door/new-file.ts' })).toBe(false);
    expect(insideFolder(scene, 'door')).toBeUndefined();
    // The control: a junction that leads back inside is the folder.
    const back = path.join(scene, 'back');
    fs.symlinkSync(path.join(scene, 'art'), back, 'junction');
    expect(allowed('Write', { file_path: 'back/lake.webp' })).toBe(true);
  });

  it("in the project's .claude or .git is read, never written", () => {
    expect(allowed('Read', { file_path: '.claude/settings.json' })).toBe(true);
    expect(allowed('Write', { file_path: '.claude/settings.json' })).toBe(
      false,
    );
    expect(allowed('Edit', { file_path: '.CLAUDE/settings.json' })).toBe(
      process.platform !== 'win32',
    );
    expect(allowed('Write', { file_path: '.git/hooks/pre-commit' })).toBe(
      false,
    );
    // A file merely named like one is the scene's.
    expect(allowed('Write', { file_path: 'art/.claude-notes.txt' })).toBe(true);
  });
});

describe('a search', () => {
  it('of the folder is allowed; of anywhere else, or by a pattern that climbs out, is not', () => {
    expect(allowed('Glob', { pattern: '**/*.frag' })).toBe(true);
    expect(allowed('Glob', { pattern: '*.json', path: 'art' })).toBe(true);
    expect(allowed('Grep', { pattern: 'main', glob: '*.frag' })).toBe(true);

    expect(allowed('Glob', { pattern: '*.json', path: elsewhere })).toBe(false);
    expect(allowed('Glob', { pattern: '../FluidEQ/**' })).toBe(false);
    expect(allowed('Glob', { pattern: `${elsewhere}/**` })).toBe(false);
    expect(allowed('Glob', { pattern: 'C:/Users/**' })).toBe(false);
    expect(allowed('Glob', { pattern: '~/.ssh/*' })).toBe(false);
    // Rooted with no drive letter: the top of the drive, or another machine.
    expect(allowed('Glob', { pattern: '/Users/**' })).toBe(false);
    expect(
      allowed('Grep', { pattern: 'x', glob: '\\\\server\\share\\**' }),
    ).toBe(false);
    expect(allowed('Grep', { pattern: 'token', path: '..' })).toBe(false);
    expect(allowed('Grep', { pattern: 'token', glob: '../**' })).toBe(false);
  });
});

describe('a tool that is not a file', () => {
  it("is refused, but for a skill and FluidEQ's own tools", () => {
    expect(allowed('Skill', { skill: 'fluideq-3d-world' })).toBe(true);
    expect(allowed('mcp__fluideq__look_at_scene', {})).toBe(true);

    expect(allowed('Bash', { command: 'ls' })).toBe(false);
    expect(allowed('PowerShell', { command: 'ls' })).toBe(false);
    expect(allowed('WebFetch', { url: 'https://example.com' })).toBe(false);
    expect(allowed('WebSearch', { query: 'x' })).toBe(false);
    expect(allowed('Task', { prompt: 'x' })).toBe(false);
    // Another tool server, even one whose name starts like FluidEQ's.
    expect(allowed('mcp__fluideq_evil__write', {})).toBe(false);
    expect(allowed('mcp__github__create_repository', {})).toBe(false);
    expect(allowed('NotebookEdit', { notebook_path: 'x.ipynb' })).toBe(false);
  });
});

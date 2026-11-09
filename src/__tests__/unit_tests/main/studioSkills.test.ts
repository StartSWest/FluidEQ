/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * FluidEQ's agent skills (Ivan, 2026-11-09: "do this as agents skills that
 * works for any agent gpt, claude, etc"): folders in the open Agent Skills
 * format, shipped with the app, loaded by the Studio chat as a plugin of
 * FluidEQ's own and written into each project's .agents/skills for any
 * other agent - never through a link a scene folder may hold.
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import { claudeCodeCommand } from '../../../main/studioChat/chatLaunch';
import {
  placeChatSkills,
  placeProjectSkills,
  readShippedSkills,
} from '../../../main/studioChat/studioSkills';

const SHIPPED = path.join(__dirname, '../../../../assets/studio/skills');
let scratch: string;

beforeEach(() => {
  scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'fluideq-skills-'));
});
afterEach(() => {
  fs.rmSync(scratch, { recursive: true, force: true });
});

/** A SKILL.md's frontmatter, as the open format reads it. */
const frontmatter = (text: string) => {
  const head = /^---\n([\s\S]*?)\n---\n/.exec(text.replace(/\r\n/g, '\n'));
  const fields = new Map<string, string>();
  head?.[1].split('\n').forEach((line) => {
    const at = line.indexOf(':');
    if (at > 0) {
      fields.set(line.slice(0, at).trim(), line.slice(at + 1).trim());
    }
  });
  return fields;
};

describe('the skills FluidEQ ships', () => {
  it('are each a folder whose SKILL.md names it and says when to use it', () => {
    const skills = readShippedSkills(SHIPPED);
    expect(skills.map(({ name }) => name)).toEqual([
      'fluideq-3d-world',
      'fluideq-photo-3d',
    ]);
    skills.forEach(({ name, files }) => {
      const skill = files.find(({ relative }) => relative === 'SKILL.md');
      const fields = frontmatter(String(skill?.bytes));
      expect(fields.get('name')).toBe(name);
      const description = fields.get('description') ?? '';
      expect(description.length).toBeGreaterThan(80);
      expect(description.length).toBeLessThanOrEqual(1024);
    });
  });
});

describe("a project's copy", () => {
  it('is written into .agents/skills, and not again when it is the same', () => {
    const skills = readShippedSkills(SHIPPED);
    expect(placeProjectSkills(scratch, skills)).toBe(true);
    const file = path.join(
      scratch,
      '.agents',
      'skills',
      'fluideq-photo-3d',
      'SKILL.md',
    );
    expect(fs.readFileSync(file, 'utf8')).toContain('name: fluideq-photo-3d');
    const before = fs.statSync(file).mtimeMs;
    const old = new Date(before - 60_000);
    fs.utimesSync(file, old, old);
    expect(placeProjectSkills(scratch, skills)).toBe(true);
    expect(fs.statSync(file).mtimeMs).toBe(old.getTime());
  });

  it('is never written through a link where .agents goes', () => {
    const elsewhere = path.join(scratch, 'elsewhere');
    const project = path.join(scratch, 'project');
    fs.mkdirSync(elsewhere);
    fs.mkdirSync(project);
    fs.symlinkSync(elsewhere, path.join(project, '.agents'), 'junction');

    expect(placeProjectSkills(project, readShippedSkills(SHIPPED))).toBe(false);
    expect(fs.readdirSync(elsewhere)).toEqual([]);

    // The control: the same project without the link takes the skills.
    fs.unlinkSync(path.join(project, '.agents'));
    expect(placeProjectSkills(project, readShippedSkills(SHIPPED))).toBe(true);
  });

  it('leaves alone what is not FluidEQ’s', () => {
    const theirs = path.join(scratch, '.agents', 'skills', 'their-own');
    fs.mkdirSync(theirs, { recursive: true });
    fs.writeFileSync(path.join(theirs, 'SKILL.md'), 'mine');
    placeProjectSkills(scratch, readShippedSkills(SHIPPED));
    expect(fs.readFileSync(path.join(theirs, 'SKILL.md'), 'utf8')).toBe('mine');
  });
});

describe("the Studio chat's plugin", () => {
  it('is a plugin folder of FluidEQ’s own, handed to Claude Code', () => {
    const plugin = placeChatSkills(scratch, readShippedSkills(SHIPPED));
    expect(plugin).toBe(path.join(scratch, 'skills-plugin'));
    const manifest = JSON.parse(
      fs.readFileSync(
        path.join(scratch, 'skills-plugin', '.claude-plugin', 'plugin.json'),
        'utf8',
      ),
    ) as { name: string };
    expect(manifest.name).toBe('fluideq');
    expect(
      fs.existsSync(
        path.join(
          scratch,
          'skills-plugin',
          'skills',
          'fluideq-3d-world',
          'SKILL.md',
        ),
      ),
    ).toBe(true);

    const launch = {
      own: scratch,
      folder: scratch,
      executable: 'claude',
      brief: 'brief',
      tools: undefined,
      model: 'default' as const,
      effort: 'default' as const,
      sessionId: undefined,
    };
    const { args } = claudeCodeCommand({ ...launch, skills: plugin });
    expect(args.slice(args.indexOf('--plugin-dir'))).toEqual(
      expect.arrayContaining(['--plugin-dir', plugin]),
    );
    // The control: none placed, none named.
    expect(claudeCodeCommand(launch).args).not.toContain('--plugin-dir');
  });

  it('is none when FluidEQ ships no skills', () => {
    expect(placeChatSkills(scratch, [])).toBeUndefined();
  });
});

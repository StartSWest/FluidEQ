/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * FluidEQ's agent skills live in FluidEQ and update with it (Ivan,
 * 2026-11-09: "we created skills and all that needs to ship with fluid"):
 * a plugin folder shipped in `assets/studio/fluideq`, which the Studio chat
 * loads where it is, and never a copy in a scene folder. What the first
 * version placed in projects' `.agents/skills` and in the chat's own folder
 * is taken back - only what is, byte for byte, FluidEQ's.
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import { claudeCodeCommand } from '../../../main/studioChat/chatLaunch';
import {
  readShippedSkills,
  removeOldChatPlugin,
  removePlacedSkills,
  skillsDigest,
} from '../../../main/studioChat/studioSkills';

const SHIPPED = path.join(__dirname, '../../../../assets/studio/fluideq');
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

/** The project as the first version left it: FluidEQ's skills copied in. */
/** The two skills the first version copied into a project; later ones never were. */
const FIRST_PLACED = ['fluideq-3d-world', 'fluideq-photo-3d'];

const placeAsTheFirstVersionDid = (folder: string) => {
  readShippedSkills(SHIPPED)
    .filter(({ name }) => FIRST_PLACED.includes(name))
    .forEach(({ name, files }) => {
      files.forEach(({ relative, bytes }) => {
        const file = path.join(folder, '.agents', 'skills', name, relative);
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(file, bytes);
      });
    });
};

describe('the skills FluidEQ ships', () => {
  it('are a plugin folder of skills, each naming itself and saying when to use it', () => {
    const skills = readShippedSkills(SHIPPED);
    expect(skills.map(({ name }) => name)).toEqual([
      'fluideq-3d-world',
      'fluideq-animation',
      'fluideq-finish',
      'fluideq-motion',
      'fluideq-night-and-day',
      'fluideq-photo-3d',
      'fluideq-views',
    ]);
    skills.forEach(({ name, files }) => {
      const skill = files.find(({ relative }) => relative === 'SKILL.md');
      const fields = frontmatter(String(skill?.bytes));
      expect(fields.get('name')).toBe(name);
      const description = fields.get('description') ?? '';
      expect(description.length).toBeGreaterThan(80);
      expect(description.length).toBeLessThanOrEqual(1024);
    });
    // Loaded where it is: no manifest, so Claude Code names it after its
    // folder, and nothing in it needs writing by FluidEQ.
    expect(path.basename(SHIPPED)).toBe('fluideq');
    expect(fs.existsSync(path.join(SHIPPED, '.claude-plugin'))).toBe(false);
  });

  it('change their digest when what they say changes, and only then', () => {
    const skills = readShippedSkills(SHIPPED);
    expect(skillsDigest(readShippedSkills(SHIPPED))).toBe(skillsDigest(skills));
    const edited = skills.map((skill, index) =>
      index === 0
        ? {
            ...skill,
            files: skill.files.map((file) => ({
              ...file,
              bytes: Buffer.concat([file.bytes, Buffer.from('\nA new line.')]),
            })),
          }
        : skill,
    );
    expect(skillsDigest(edited)).not.toBe(skillsDigest(skills));
  });

  it('reach the Studio chat as the shipped folder itself', () => {
    const { args } = claudeCodeCommand({
      own: scratch,
      folder: scratch,
      executable: 'claude',
      brief: 'brief',
      tools: undefined,
      model: 'default',
      effort: 'default',
      sessionId: undefined,
      skills: SHIPPED,
    });
    expect(args[args.indexOf('--plugin-dir') + 1]).toBe(SHIPPED);
  });
});

describe('what the first version placed', () => {
  it('is taken back out of a project, and .agents with it once empty', () => {
    placeAsTheFirstVersionDid(scratch);
    expect(removePlacedSkills(scratch, readShippedSkills(SHIPPED))).toBe(true);
    expect(fs.existsSync(path.join(scratch, '.agents'))).toBe(false);
    // Nothing is left to take back the second time.
    expect(removePlacedSkills(scratch, readShippedSkills(SHIPPED))).toBe(false);
  });

  it('leaves a copy the member changed or added to, and anything else in .agents', () => {
    placeAsTheFirstVersionDid(scratch);
    const changed = path.join(
      scratch,
      '.agents',
      'skills',
      'fluideq-3d-world',
      'SKILL.md',
    );
    fs.appendFileSync(changed, '\nMy own rule.');
    const added = path.join(
      scratch,
      '.agents',
      'skills',
      'fluideq-photo-3d',
      'notes.md',
    );
    fs.writeFileSync(added, 'mine');
    const theirs = path.join(
      scratch,
      '.agents',
      'skills',
      'their-own',
      'SKILL.md',
    );
    fs.mkdirSync(path.dirname(theirs), { recursive: true });
    fs.writeFileSync(theirs, 'mine');

    expect(removePlacedSkills(scratch, readShippedSkills(SHIPPED))).toBe(false);
    expect(fs.readFileSync(changed, 'utf8')).toContain('My own rule.');
    expect(fs.readFileSync(added, 'utf8')).toBe('mine');
    expect(fs.readFileSync(theirs, 'utf8')).toBe('mine');
  });

  it('is never followed through a link', () => {
    const elsewhere = path.join(scratch, 'elsewhere');
    const project = path.join(scratch, 'project');
    fs.mkdirSync(project);
    placeAsTheFirstVersionDid(elsewhere);
    fs.symlinkSync(
      path.join(elsewhere, '.agents'),
      path.join(project, '.agents'),
      'junction',
    );
    expect(removePlacedSkills(project, readShippedSkills(SHIPPED))).toBe(false);
    expect(
      fs.existsSync(
        path.join(
          elsewhere,
          '.agents',
          'skills',
          'fluideq-3d-world',
          'SKILL.md',
        ),
      ),
    ).toBe(true);
    fs.unlinkSync(path.join(project, '.agents'));
  });

  it('in the chat’s own folder goes whole', () => {
    const copy = path.join(
      scratch,
      'skills-plugin',
      'skills',
      'fluideq-3d-world',
    );
    fs.mkdirSync(copy, { recursive: true });
    fs.writeFileSync(path.join(copy, 'SKILL.md'), 'old');
    removeOldChatPlugin(scratch);
    expect(fs.existsSync(path.join(scratch, 'skills-plugin'))).toBe(false);
  });
});

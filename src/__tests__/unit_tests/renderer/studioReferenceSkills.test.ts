/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The reference parts of the Studio's brief that its chat loads as skills
 * (`aiPromptReference.ts`; Ivan, 2026-11-11: "review the rules to make sure
 * they are perfect"): a third of the brief was formats and bounds a scene
 * needs only when it uses that thing, read at the start of every chat.
 *
 * The sections stay written in code, where their numbers are the engine's
 * own. Each skill's file is that text written out, and this holds the two
 * together byte for byte: a file that fell behind its section would teach
 * the chat a bound the engine no longer has.
 *
 * TO WRITE THE FILES AGAIN after changing a section, run this file once with
 * WRITE_STUDIO_SKILLS=1:
 *
 *   WRITE_STUDIO_SKILLS=1 node node_modules/jest/bin/jest.js \
 *     src/__tests__/unit_tests/renderer/studioReferenceSkills.test.ts
 *
 * (a script outside Jest cannot read the brief: its modules are the
 * window's, with the window's import names). Never edit the files by hand.
 */

import fs from 'fs';
import path from 'path';
import { promptWithIdea } from '../../../renderer/studio/aiPrompt';
import {
  REFERENCE_SKILLS,
  referenceSkillFile,
} from '../../../renderer/studio/aiPromptReference';
import {
  readSkillText,
  skillsSection,
} from '../../../renderer/studio/aiPromptSkills';
import chatBrief from '../../../renderer/studio/chat/chatBrief';

const SKILLS = path.join(__dirname, '../../../../assets/studio/fluideq/skills');
const fileOf = (name: string) => path.join(SKILLS, name, 'SKILL.md');

/** Beside the file and renamed over it, so nothing ever reads half of one. */
const writeWhole = (file: string, text: string) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(`${file}.tmp`, text);
  fs.renameSync(`${file}.tmp`, file);
};

const COPIED = promptWithIdea('a lake at night', 'C:/Scenes/Lake', {
  url: 'http://127.0.0.1:1/mcp',
  key: 'k',
});
const PLAIN = promptWithIdea('a lake at night');
const CHAT = chatBrief();

it('are the four parts a scene needs only when it uses them', () => {
  expect(REFERENCE_SKILLS.map(({ name }) => name)).toEqual([
    'fluideq-hands',
    'fluideq-artwork',
    'fluideq-world-format',
    'fluideq-ambient',
  ]);
});

describe.each(REFERENCE_SKILLS.map((skill) => [skill.name, skill] as const))(
  '%s',
  (name, skill) => {
    it('ships exactly as the brief says it', () => {
      const text = referenceSkillFile(skill);
      if (process.env.WRITE_STUDIO_SKILLS === '1') {
        writeWhole(fileOf(name), text);
      }
      expect(fs.readFileSync(fileOf(name), 'utf8')).toBe(text);
    });

    it('reads back as a skill: its name, when to load it, and the section', () => {
      const read = readSkillText(referenceSkillFile(skill));
      expect(read.name).toBe(name);
      expect(read.description).toBe(skill.description);
      expect(read.body).toBe(skill.body.trim());
      // One line each, or the frontmatter would end at the first break; and
      // no ": ", which a strict YAML reader takes for a key.
      expect(skill.description).not.toMatch(/[\r\n]|: /);
      expect(skill.description.length).toBeGreaterThan(120);
      expect(skill.description.length).toBeLessThanOrEqual(1024);
    });

    it('is whole in a prompt copied for another AI, once, where it stood', () => {
      [COPIED, PLAIN].forEach((prompt) => {
        expect(prompt.split(skill.body)).toHaveLength(2);
        expect(prompt).not.toContain(skill.inChat);
        // Not handed over a second time among the skills.
        expect(prompt).not.toContain(`=== SKILL ${name} ===`);
      });
      expect(skillsSection('copied')).not.toContain(skill.body.trim());
    });

    it('is named in the chat, which loads it, and not carried there', () => {
      expect(CHAT.split(skill.inChat)).toHaveLength(2);
      expect(skill.inChat).toContain(`${name} skill`);
      expect(skill.inChat).toMatch(/load (it|BOTH) BEFORE/);
      expect(CHAT).not.toContain(skill.body.trim());
      // Nothing of the section but what the few lines repeat on purpose - a
      // rule that holds whether or not the skill is loaded: under a tenth
      // of its longer lines are still in the chat's brief.
      const lines = skill.body
        .split('\n')
        .filter((line) => line.trim().length > 60);
      expect(lines.length).toBeGreaterThan(20);
      expect(lines.filter((line) => CHAT.includes(line)).length).toBeLessThan(
        lines.length / 10,
      );
    });

    it('keeps the heading the rest of the brief sends the reader to', () => {
      const heading = skill.body.split('\n')[0].replace(/ \(.*$|:.*$/, '');
      expect(heading).toMatch(/^[A-Z0-9' ]{6,}$/);
      expect(skill.inChat.split('\n')[0]).toContain(heading);
    });
  },
);

it('halves nothing by accident: the chat reads a third less at its start', () => {
  const moved = REFERENCE_SKILLS.reduce(
    (sum, { body, inChat }) => sum + body.length - inChat.length,
    0,
  );
  expect(moved).toBeGreaterThan(30000);
  expect(CHAT.length).toBeLessThan(75000);
  // The control: everything else the chat is told is still there.
  [
    'WHAT THE SCENE RECEIVES',
    'DAY AND NIGHT',
    'DANCING TO THE MUSIC',
    'RULES (FluidEQ refuses the scene otherwise)',
    "FLUIDEQ'S SKILLS",
    "YOU ARE IN FLUIDEQ STUDIO'S CHAT",
  ].forEach((heading) => expect(CHAT).toContain(heading));
});

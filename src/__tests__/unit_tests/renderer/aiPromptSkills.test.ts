/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The skills a prompt for another AI carries are the very files FluidEQ
 * ships and the Studio chat loads (`assets/studio/fluideq`): one source, so
 * the two never differ and an update reaches both.
 */

import fs from 'fs';
import path from 'path';
import { promptWithIdea } from '../../../renderer/studio/aiPrompt';
import { REFERENCE_SKILLS } from '../../../renderer/studio/aiPromptReference';
import {
  readSkillText,
  SHIPPED_SKILL_TEXTS,
  skillsSection,
} from '../../../renderer/studio/aiPromptSkills';
import chatBrief from '../../../renderer/studio/chat/chatBrief';

const SKILLS = path.join(__dirname, '../../../../assets/studio/fluideq/skills');

/**
 * The skills that are parts of the brief itself (`aiPromptReference.ts`):
 * a copied prompt carries those where they stand, not among the skills,
 * and the chat's brief names each where its section stood.
 */
const REFERENCE = new Set(REFERENCE_SKILLS.map(({ name }) => name));

it('carries every skill FluidEQ ships, word for word, and only those', () => {
  const shipped = fs
    .readdirSync(SKILLS)
    .sort()
    .map((name) =>
      fs.readFileSync(path.join(SKILLS, name, 'SKILL.md'), 'utf8'),
    );
  expect([...SHIPPED_SKILL_TEXTS].sort()).toEqual([...shipped].sort());

  const copied = skillsSection('copied');
  const prompt = promptWithIdea('a lake at night', 'C:/Scenes/Lake');
  const read = shipped.map(readSkillText);
  const craft = read.filter(({ name }) => !REFERENCE.has(name));
  const reference = read.filter(({ name }) => REFERENCE.has(name));
  // The control: both kinds are among what ships.
  expect(craft.length).toBeGreaterThan(0);
  expect(reference).toHaveLength(REFERENCE.size);
  craft.forEach(({ name, body }) => {
    expect(copied).toContain(`=== SKILL ${name} ===`);
    expect(copied).toContain(body);
  });
  reference.forEach(({ name, body }) => {
    expect(copied).not.toContain(`=== SKILL ${name} ===`);
    expect(prompt).toContain(body);
  });
});

it('only names them to the Studio chat, which loads them as its own', () => {
  const chat = skillsSection('chat');
  const brief = chatBrief();
  const read = SHIPPED_SKILL_TEXTS.map(readSkillText);
  read.forEach(({ body }) => expect(brief).not.toContain(body));
  read
    .filter(({ name }) => !REFERENCE.has(name))
    .forEach(({ name, description }) =>
      expect(chat).toContain(`- ${name}: ${description}`),
    );
  // A part of the brief is named where its section stood, not listed again.
  read
    .filter(({ name }) => REFERENCE.has(name))
    .forEach(({ name }) => {
      expect(chat).not.toContain(name);
      expect(brief).toContain(`${name} skill`);
    });
});

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
import {
  readSkillText,
  SHIPPED_SKILL_TEXTS,
  skillsSection,
} from '../../../renderer/studio/aiPromptSkills';

const SKILLS = path.join(__dirname, '../../../../assets/studio/fluideq/skills');

it('carries every skill FluidEQ ships, word for word, and only those', () => {
  const shipped = fs
    .readdirSync(SKILLS)
    .sort()
    .map((name) =>
      fs.readFileSync(path.join(SKILLS, name, 'SKILL.md'), 'utf8'),
    );
  expect([...SHIPPED_SKILL_TEXTS].sort()).toEqual([...shipped].sort());

  const copied = skillsSection('copied');
  shipped.map(readSkillText).forEach(({ name, body }) => {
    expect(copied).toContain(`=== SKILL ${name} ===`);
    expect(copied).toContain(body);
  });
});

it('only names them to the Studio chat, which loads them as its own', () => {
  const chat = skillsSection('chat');
  SHIPPED_SKILL_TEXTS.map(readSkillText).forEach(
    ({ name, description, body }) => {
      expect(chat).toContain(`- ${name}: ${description}`);
      expect(chat).not.toContain(body);
    },
  );
});

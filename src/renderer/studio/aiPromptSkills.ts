import animationSkill from '../../../assets/studio/fluideq/skills/fluideq-animation/SKILL.md';
import motionSkill from '../../../assets/studio/fluideq/skills/fluideq-motion/SKILL.md';
import worldSkill from '../../../assets/studio/fluideq/skills/fluideq-3d-world/SKILL.md';
import photoSkill from '../../../assets/studio/fluideq/skills/fluideq-photo-3d/SKILL.md';
import type { TPromptReach } from './aiPromptLook';

/**
 * FluidEQ's agent skills in the brief, read from the very files FluidEQ
 * ships (`assets/studio/fluideq`), so the two never differ and both update
 * with FluidEQ (Ivan, 2026-11-09: "we created skills and all that needs to
 * ship with fluid"). Nothing of them is ever written into a scene folder: a
 * copy there is a copy an update never reaches.
 *
 * The Studio's chat loads them as skills of its own (`studioSkills.ts`,
 * `--plugin-dir`), so its brief only names them and the brief stays the
 * same for every message, where the prompt cache holds it. A prompt copied
 * for another AI has no such way in, so it carries each one whole.
 *
 * A skill added under `assets/studio/fluideq/skills` is added here too:
 * `aiPromptSkills.test.ts` fails while the two lists differ.
 */
export const SHIPPED_SKILL_TEXTS: readonly string[] = [
  worldSkill,
  photoSkill,
  animationSkill,
  motionSkill,
];

interface ISkillText {
  name: string;
  description: string;
  body: string;
}

/** A SKILL.md read as the open format writes it: frontmatter, then the body. */
export const readSkillText = (text: string): ISkillText => {
  const normal = text.replace(/\r\n/g, '\n');
  const head = /^---\n([\s\S]*?)\n---\n/.exec(normal);
  const field = (key: string) =>
    head?.[1]
      .split('\n')
      .find((line) => line.startsWith(`${key}:`))
      ?.slice(key.length + 1)
      .trim() ?? '';
  return {
    name: field('name'),
    description: field('description'),
    body: (head ? normal.slice(head[0].length) : normal).trim(),
  };
};

export const skillsSection = (reach: TPromptReach): string => {
  const skills = SHIPPED_SKILL_TEXTS.map(readSkillText);
  if (reach === 'chat') {
    return `FLUIDEQ'S SKILLS. FluidEQ ships skills for the hard parts, loaded as your
own skills from FluidEQ itself - they are not in the project folder:
${skills.map(({ name, description }) => `- ${name}: ${description}`).join('\n')}
Load the one that fits before you build that kind of thing: every recipe in
them was measured in this engine.

`;
  }
  return `FLUIDEQ'S SKILLS. FluidEQ ships these guides for the hard parts, here in
full - they are not in the project folder. Read the one that fits before you
build that kind of thing: every recipe in them was measured in this engine.

${skills
  .map(
    ({ name, description, body }) =>
      `=== SKILL ${name} ===\nWhen to use it: ${description}\n\n${body}\n=== END OF ${name} ===`,
  )
  .join('\n\n')}

`;
};

/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Everything the engine hands a scene is somewhere the Studio's AI can read
 * of it: every uniform of the scene contract, every signal a 3D world's
 * formulas may use, every tool FluidEQ gives the chat, every skill it ships.
 *
 * The brief is long, and is about to be made shorter by moving reference
 * out of it into skills (Ivan, 2026-11-11: "review the rules to make sure
 * they are perfect"). A uniform that is in neither afterwards is one no
 * scene will ever use again, and nothing else would say so: the brief's
 * other tests hold sentences, not the list.
 */

import type { IScenePack } from '../../../common/scenePacks';
import { assembleSceneDeclarations } from '../../../common/sceneUniformContract';
import { WORLD_SIGNALS } from '../../../common/sceneWorld';
import { SHIPPED_SKILL_TEXTS } from '../../../renderer/studio/aiPromptSkills';
import { promptWithIdea } from '../../../renderer/studio/aiPrompt';
import chatBrief from '../../../renderer/studio/chat/chatBrief';

/** What the chat can read: its brief, and the skills FluidEQ loads for it. */
const CHAT = [chatBrief(), ...SHIPPED_SKILL_TEXTS].join('\n');
/** What an AI outside FluidEQ is handed: the one prompt, skills inside it. */
const COPIED = promptWithIdea('a lake at night', 'C:/Scenes/Lake');

const BARE = { params: [], palettes: [], colours: [] } as unknown as IScenePack;

/** Every uniform the contract declares for any scene. */
const UNIFORMS = [
  ...assembleSceneDeclarations(BARE).matchAll(
    /uniform\s+\w+\s+(u[A-Z]\w*)\s*;/g,
  ),
].map((match) => match[1]);

/**
 * Uniforms a scene is declared and never told of, each with why. Anything
 * added here is a uniform no AI will use: say what it is for.
 */
const UNSAID: Record<string, string> = {
  uSceneFade:
    "FluidEQ's own fade across a change of look, multiplied in after sceneColour: a scene that used it would fade twice.",
};

/** The tools the Studio's chat is given, by the names it calls them. */
const TOOLS = [
  'look_at_scene',
  'look_at_views',
  'watch_scene',
  'hear_the_music',
  'pack_artwork',
  'build_sheet',
  'pose_sheet',
  'look_at_animation',
];

const named = (text: string, name: string) =>
  new RegExp(`(?<![A-Za-z0-9_])${name}(?![A-Za-z0-9_])`).test(text);

describe('what the Studio tells its AI of', () => {
  it('finds the contract’s uniforms to check', () => {
    expect(UNIFORMS.length).toBeGreaterThanOrEqual(20);
    expect(UNIFORMS).toContain('uRhythm');
    expect(UNIFORMS).toContain('uSpectrum');
  });

  it('names every uniform a scene is handed, in the chat and in the copied prompt', () => {
    const told = UNIFORMS.filter((name) => !(name in UNSAID));
    expect(told.filter((name) => !named(CHAT, name))).toEqual([]);
    expect(told.filter((name) => !named(COPIED, name))).toEqual([]);
  });

  it('keeps its list of unsaid uniforms to ones the contract still has', () => {
    expect(
      Object.keys(UNSAID).filter((name) => !UNIFORMS.includes(name)),
    ).toEqual([]);
  });

  it('names every signal a 3D world’s formulas may use', () => {
    expect(WORLD_SIGNALS.filter((name) => !named(CHAT, name))).toEqual([]);
    expect(WORLD_SIGNALS.filter((name) => !named(COPIED, name))).toEqual([]);
  });

  it('names every tool the chat is given', () => {
    expect(TOOLS.filter((name) => !named(chatBrief(), name))).toEqual([]);
  });

  // The control: the check does fail for a name nobody wrote.
  it('would miss a uniform that is not there', () => {
    expect(named(CHAT, 'uNobodyWroteThis')).toBe(false);
    expect(named('reads uBands.z here', 'uBands')).toBe(true);
    expect(named('reads uBandsWide here', 'uBands')).toBe(false);
  });
});

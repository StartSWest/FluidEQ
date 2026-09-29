/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  MAX_POINTER_BURST,
  MAX_POINTER_PIECES,
  MAX_POINTER_TRAIL,
  POINTER_SHAPES,
} from '../../../common/scenePointer';
import { promptWithIdea } from '../../../renderer/studio/aiPrompt';

/**
 * The brief a member's AI builds a scene from knows what the engine can do
 * now (Ivan, 2026-09-28: "update studio prompt with latest capabilities
 * including day and night"; "the agent prompt needs to be aware"): the
 * pieces a scene throws from the hand, keeping its important part in view on
 * a narrow panel, a 3D world, and turning from night to day with the
 * window's Brightness. Its numbers are the engine's own, so the brief cannot
 * promise what the reader clamps away.
 */
describe('the Studio’s brief for a member’s AI', () => {
  const brief = promptWithIdea('a flower that opens with the chorus');

  it('ends with the member’s idea', () => {
    expect(
      brief.trimEnd().endsWith('a flower that opens with the chorus'),
    ).toBe(true);
  });

  it('says what a scene may throw from the hand, within the engine’s ceilings', () => {
    expect(brief).toContain('THROWN FROM THE HAND (pack.json "pointer"');
    expect(brief).toContain('Pointer sparks switch');
    expect(brief).toContain(POINTER_SHAPES.join(', '));
    expect(brief).toContain(`at most ${MAX_POINTER_TRAIL} pieces`);
    expect(brief).toContain(`at most ${MAX_POINTER_BURST}`);
    expect(brief).toContain(`${MAX_POINTER_PIECES} pieces in the air`);
  });

  it('asks for a framing, so a narrow panel slides the picture', () => {
    expect(brief).toContain('"framing"');
    expect(brief).toMatch(/narrowest/);
  });

  it('describes a 3D world, and the time of day for worlds and shaders alike', () => {
    expect(brief).toContain('A 3D WORLD (optional)');
    expect(brief).toContain('DAY AND NIGHT');
    expect(brief).toContain('uParam_daylight');
    expect(brief).toContain('p.daylight');
  });
});

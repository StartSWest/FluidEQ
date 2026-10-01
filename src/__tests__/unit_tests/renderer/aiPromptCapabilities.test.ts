/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  MAX_SCENE_ARTWORK_BYTES,
  MAX_SCENE_ARTWORK_EDGE,
} from '../../../common/sceneArtwork';
import {
  MAX_POINTER_BURST,
  MAX_POINTER_PIECES,
  MAX_POINTER_TRAIL,
  POINTER_SHAPES,
} from '../../../common/scenePointer';
import {
  MAX_STUDIO_DESCRIPTION,
  MAX_STUDIO_PROMPT,
  parseStudioNotes,
} from '../../../common/studioNotes';
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

  // Ivan, 2026-09-30: "make sure the prompt is updated so the AI uses image
  // gen available or 3D models from any free resources".
  it('lets the AI make or fetch its own art, only what a sold app may ship, packed to the reader’s limits', () => {
    expect(brief).toContain('YOUR OWN ART');
    expect(brief).toContain('IF YOU CAN MAKE IMAGES');
    expect(brief).toContain('CC0 or public domain only');
    expect(brief).toContain('credits.txt');
    expect(brief).toContain(`W and H at most ${MAX_SCENE_ARTWORK_EDGE}`);
    expect(brief).toContain(
      `the file at most ${MAX_SCENE_ARTWORK_BYTES / (1024 * 1024)} MB`,
    );
    expect(brief).toContain('vec4(x / W, 1 - (y + h) / H, w / W, h / H)');
    // Listed pieces are what keeps the Studio from offering the whole image
    // as one place for a photo (`readPictureAtlas`).
    expect(brief).toContain('"artworkRegions"');
  });

  it('tells a world what three.js lends its GLSL, and the traps FluidEQ’s own worlds hit', () => {
    expect(brief).toContain('no JavaScript reaches a scene');
    expect(brief).toContain('instanceMatrix');
    expect(brief).toContain('floor(s.instance.z + 0.5)');
    expect(brief).toContain('pow(max(x, 0.0), k)');
    expect(brief).toContain('"fog": false');
  });
});

// The project's notes keep the brief beside the scene, for an assistant that
// opens the folder later. Past MAX_STUDIO_PROMPT a save keeps the
// description and drops the brief, which is what every save did once the
// brief outgrew the old 64000.
it('fits the project’s notes with the longest description and a long folder', () => {
  const description = 'x'.repeat(MAX_STUDIO_DESCRIPTION);
  const longest = promptWithIdea(
    description,
    `C:\\Users\\${'a'.repeat(240)}\\FluidEQ Studio\\scene`,
  );
  expect(longest.length).toBeLessThanOrEqual(MAX_STUDIO_PROMPT);
  expect(parseStudioNotes({ description, prompt: longest })?.prompt).toBe(
    longest,
  );
});

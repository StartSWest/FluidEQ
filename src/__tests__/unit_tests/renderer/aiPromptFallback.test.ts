/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * No member and no member's AI ever sees or sets a fallback look (Ivan,
 * 2026-11-14: "we cannot have fallbacks, so remove all related to that").
 * His Studio chat was told by the brief to pick a fallbackStyle, picked one
 * the app refused, took it out, and the scene stopped playing - then put one
 * back and told him "FluidEQ requires it". The brief, a new project's
 * files and a restored project's files name none; the app fills what older
 * FluidEQ needs where a project becomes a pack (`sceneFallbackGone.test.ts`).
 */

import { normalizeScenePack } from '../../../common/scenePacks';
import { restoredManifest } from '../../../main/memberScenes/projectRestore';
import { starterManifest } from '../../../main/memberScenes/starterScene';
import { promptWithIdea } from '../../../renderer/studio/aiPrompt';

const mentionsFallback = (text: string) => /fallback/i.test(text);

const SOURCE = `vec4 sceneColour(vec2 uv) {
  return vec4(uAccent * texture(uSpectrumSlow, vec2(uv.x, 0.5)).r, 1.0);
}
`;

describe('what a scene author and their AI read', () => {
  it('the brief names no fallback anywhere', () => {
    const brief = promptWithIdea('a lighthouse on a stormy night');
    expect(mentionsFallback(brief)).toBe(false);
    // The control: the brief does describe the pack's other fields.
    expect(brief).toContain('"swatch"');
    expect(brief).toContain('- swatch:');
  });

  it('a new project’s pack.json has no fallback in it', () => {
    const manifest = starterManifest('Lighthouse', 'lighthouse');
    expect(mentionsFallback(manifest)).toBe(false);
    expect(JSON.parse(manifest)).toHaveProperty('swatch');
  });

  it('a project restored from a published pack has none either', () => {
    const pack = normalizeScenePack({
      schema: 1,
      id: 'lighthouse',
      version: 4,
      names: { en: 'Lighthouse' },
      fallbackStyle: 'skyline',
      swatch: ['#000000', '#ffffff'],
      source: SOURCE,
    });
    if (!pack) {
      throw new Error('the pack reads');
    }
    const manifest = restoredManifest(pack);
    expect(mentionsFallback(manifest)).toBe(false);
    expect(JSON.parse(manifest)).toHaveProperty('names');
  });
});

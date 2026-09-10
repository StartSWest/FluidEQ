/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  checkMemberScene,
  isMemberLookId,
  MAX_MEMBER_NAME_LENGTH,
  memberLookId,
  parseMemberLookId,
  sanitizeDisplayText,
} from '../../../common/memberScenes';
import { SCENE_PACK_SCHEMA } from '../../../common/scenePacks';
import { SCENE_CONTRACT_VERSION } from '../../../common/sceneUniformContract';

const AUTHOR = '4f1c2b9e-8d3a-4e7b-9c11-2a6f0d5e7b30';

const SOURCE = `const int RAYS = 6;
vec4 sceneColour(vec2 uv) {
  float light = 0.0;
  for (int i = 0; i < RAYS; i++) {
    light += texture(uSpectrumSlow, vec2(float(i) / 6.0, 0.5)).r;
  }
  return vec4(uAccent * light * uLevel / 6.0, 1.0);
}
`;

const raw = (over: Record<string, unknown> = {}) => ({
  schema: SCENE_PACK_SCHEMA,
  id: 'neon-city',
  version: 1,
  contract: SCENE_CONTRACT_VERSION,
  names: { en: 'Neon City', es: 'Ciudad de neón' },
  fallbackStyle: 'skyline',
  swatch: ['#050a1a', '#00e5cf', '#ef1684'],
  source: SOURCE,
  params: [{ id: 'glow', names: { en: 'Glow' }, min: 0, max: 1, value: 0.5 }],
  ...over,
});

const problemCodes = (value: unknown) => {
  const result = checkMemberScene(value);
  return result.ok ? [] : result.problems.map((problem) => problem.code);
};

describe('member look ids', () => {
  it('round-trips an author and a pack', () => {
    const id = memberLookId(AUTHOR, 'neon-city');
    expect(id).toBe(`member:${AUTHOR}:neon-city`);
    expect(isMemberLookId(id)).toBe(true);
    expect(parseMemberLookId(id)).toEqual({
      authorId: AUTHOR,
      packId: 'neon-city',
    });
  });

  it('refuses anything that is not a member id', () => {
    expect(isMemberLookId('premium:alpine')).toBe(false);
    expect(parseMemberLookId('premium:alpine')).toBeUndefined();
    expect(parseMemberLookId('member:not an id:neon-city')).toBeUndefined();
    expect(parseMemberLookId(`member:${AUTHOR}:Bad Id`)).toBeUndefined();
    expect(parseMemberLookId(`member:${AUTHOR}`)).toBeUndefined();
  });
});

describe('display text', () => {
  it('keeps ordinary text in any script', () => {
    expect(sanitizeDisplayText('Ciudad de neón')).toBe('Ciudad de neón');
    expect(sanitizeDisplayText('阿尔卑斯')).toBe('阿尔卑斯');
  });

  it('removes what makes one string display as another', () => {
    // Right-to-left override, zero-width space, a control character.
    expect(sanitizeDisplayText('Neon\u202E City\u200B\u0007')).toBe(
      'Neon City',
    );
    expect(sanitizeDisplayText('  two   spaces  ')).toBe('two spaces');
    expect(sanitizeDisplayText('\u200B\u202E')).toBeUndefined();
    expect(sanitizeDisplayText(42)).toBeUndefined();
  });
});

describe('checking a member scene', () => {
  // The positive control every refusal below depends on.
  it('accepts a complete scene and cleans its names', () => {
    const result = checkMemberScene(
      raw({ names: { en: 'Neon\u200B City', es: 'Ciudad de neón' } }),
    );
    expect(result).toMatchObject({
      ok: true,
      pack: {
        id: 'neon-city',
        names: { en: 'Neon City', es: 'Ciudad de neón' },
        params: [{ id: 'glow' }],
      },
    });
  });

  it.each([
    ['a bad id', { id: 'Neon City' }, 'bad-id'],
    ['no English name', { names: { es: 'Ciudad' } }, 'names-missing'],
    [
      'a name over the limit',
      { names: { en: 'x'.repeat(MAX_MEMBER_NAME_LENGTH + 1) } },
      'name-too-long',
    ],
    ['an unknown fallback', { fallbackStyle: 'lasers' }, 'bad-fallback'],
    ['one swatch colour', { swatch: ['#000000'] }, 'bad-swatch'],
    [
      'a contract from the future',
      { contract: SCENE_CONTRACT_VERSION + 1 },
      'contract-too-new',
    ],
    [
      'broken artwork',
      { artwork: { mime: 'image/png', width: 2, height: 2, data: 'AAAA' } },
      'bad-artwork',
    ],
    [
      'a preprocessor line',
      { source: `#define X 1\n${SOURCE}` },
      'preprocessor',
    ],
  ])('refuses %s', (_name, over, code) => {
    expect(problemCodes(raw(over))).toContain(code);
    expect(problemCodes(raw())).toEqual([]);
  });

  it('names the line in the shader', () => {
    const result = checkMemberScene(
      raw({ source: `${SOURCE}\nvoid main() {}\n` }),
    );
    expect(result).toMatchObject({
      ok: false,
      problems: expect.arrayContaining([
        { code: 'main', file: 'source', line: 10 },
      ]),
    });
  });

  it('refuses something that is not a pack at all', () => {
    expect(problemCodes('a screenshot')).toEqual(['not-a-pack']);
    expect(problemCodes(null)).toEqual(['not-a-pack']);
  });
});

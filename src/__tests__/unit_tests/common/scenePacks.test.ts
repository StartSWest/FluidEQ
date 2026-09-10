/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  isPremiumLookId,
  isScenePackEnvelope,
  MAX_SCENE_PARAMS,
  MAX_SHADER_BYTES,
  normalizeScenePack,
  packIdOfLook,
  parseScenePackPayload,
  premiumLookId,
  resolveSceneName,
  SCENE_PACK_SCHEMA,
} from '../../../common/scenePacks';
import {
  assembleFragmentSource,
  SCENE_VERTEX_SOURCE,
  uniformNameForParam,
} from '../../../common/sceneUniformContract';

const SOURCE = `
float glow(vec2 p) { return 1.0 - length(p); }
vec4 sceneColour(vec2 uv) {
  return vec4(uAccent * glow(uv - 0.5) * uLevel, 1.0);
}
`;

const pack = (over: Record<string, unknown> = {}) => ({
  schema: SCENE_PACK_SCHEMA,
  id: 'aurora',
  version: 3,
  contract: 1,
  names: { en: 'Aurora', es: 'Aurora boreal' },
  fallbackStyle: 'area',
  swatch: ['#00E5CF', '#9CFFF4', '#ff3cac'],
  source: SOURCE,
  params: [{ id: 'speed', names: { en: 'Speed' }, min: 0.1, max: 3, value: 1 }],
  ...over,
});

describe('scene pack ids', () => {
  it('round-trips through the premium prefix and stays out of GraphStyle', () => {
    expect(premiumLookId('aurora')).toBe('premium:aurora');
    expect(isPremiumLookId('premium:aurora')).toBe(true);
    expect(isPremiumLookId('custom:aurora')).toBe(false);
    expect(isPremiumLookId('aurora')).toBe(false);
    expect(packIdOfLook('premium:aurora')).toBe('aurora');
  });
});

describe('normalising a scene pack', () => {
  // The positive control. Every rejection below is meaningless without it.
  it('accepts a complete pack and keeps what was given', () => {
    const result = normalizeScenePack(pack());
    expect(result).not.toBeNull();
    expect(result).toMatchObject({
      id: 'aurora',
      version: 3,
      names: { en: 'Aurora', es: 'Aurora boreal' },
      fallbackStyle: 'area',
      swatch: ['#00e5cf', '#9cfff4', '#ff3cac'],
    });
    expect(result?.params).toHaveLength(1);
  });

  it('declines a schema newer than this build understands', () => {
    expect(
      normalizeScenePack(pack({ schema: SCENE_PACK_SCHEMA + 1 })),
    ).toBeNull();
  });

  it.each([
    ['no English name', { names: { es: 'Aurora' } }],
    ['no names at all', { names: undefined }],
    ['an unknown fallback form', { fallbackStyle: 'lasers' }],
    ['a missing id', { id: undefined }],
    ['an id with capitals', { id: 'Aurora' }],
    ['a source with no entry point', { source: 'void main() {}' }],
    [
      'a source that supplies its own #version',
      { source: `#version 300 es\n${SOURCE}` },
    ],
    ['a source that is not text', { source: 42 }],
    ['not an object', null],
  ])('refuses a pack with %s', (_label, over) => {
    const raw = over === null ? null : pack(over as Record<string, unknown>);
    expect(normalizeScenePack(raw)).toBeNull();
  });

  it('refuses a shader over the size bound', () => {
    const oversized = `${SOURCE}\n// ${'x'.repeat(MAX_SHADER_BYTES)}`;
    expect(normalizeScenePack(pack({ source: oversized }))).toBeNull();
  });

  /**
   * A retired form names its replacement rather than being refused: the same
   * mechanism a saved look from an older version already relies on.
   */
  it('canonicalises a retired fallback form', () => {
    expect(
      normalizeScenePack(pack({ fallbackStyle: 'ribbon' }))?.fallbackStyle,
    ).toBe('area');
  });

  it('clamps what it can rather than refusing', () => {
    const result = normalizeScenePack(
      pack({
        version: 0,
        contract: -2,
        swatch: [
          '#00e5cf',
          'not a colour',
          '#FFFFFF',
          '#1',
          '#aaaaaa',
          '#bbbbbb',
        ],
        params: [
          { id: 'speed', names: { en: 'Speed' }, min: 5, max: 1, value: 99 },
        ],
      }),
    );
    expect(result?.version).toBe(1);
    expect(result?.contract).toBe(1);
    // Invalid colours dropped, the rest capped at four.
    expect(result?.swatch).toEqual([
      '#00e5cf',
      '#ffffff',
      '#aaaaaa',
      '#bbbbbb',
    ]);
    // max below min is lifted to min; value is clamped into the range.
    expect(result?.params[0]).toMatchObject({ min: 5, max: 5, value: 5 });
  });

  it('drops malformed and duplicate parameters and caps the count', () => {
    const params = Array.from({ length: MAX_SCENE_PARAMS + 4 }, (_, i) => ({
      id: `p${i}`,
      names: { en: `P ${i}` },
      min: 0,
      max: 1,
      value: 0.5,
    }));
    const result = normalizeScenePack(
      pack({
        params: [
          ...params,
          { id: 'p0', names: { en: 'dup' }, min: 0, max: 1, value: 0 },
          { id: 'Bad Id', names: { en: 'x' } },
          { id: 'noname', names: {} },
        ],
      }),
    );
    expect(result?.params).toHaveLength(MAX_SCENE_PARAMS);
    expect(result?.params.map((param) => param.id)).toEqual(
      params.slice(0, MAX_SCENE_PARAMS).map((param) => param.id),
    );
  });
});

describe('parsing a payload', () => {
  it('never throws, and answers null for anything that is not a pack', () => {
    expect(parseScenePackPayload('not json')).toBeNull();
    expect(parseScenePackPayload('{"schema":1}')).toBeNull();
    expect(parseScenePackPayload('[]')).toBeNull();
    expect(parseScenePackPayload('')).toBeNull();
  });

  it('parses what it produced', () => {
    expect(parseScenePackPayload(JSON.stringify(pack()))?.id).toBe('aurora');
  });
});

describe('the signed envelope shape', () => {
  const envelope = {
    schema: SCENE_PACK_SCHEMA,
    keyId: 'fluideq-2026-09',
    algorithm: 'ed25519',
    payload: 'eyJhIjoxfQ==',
    signature: 'AAAA',
  };

  it('recognises a well-formed envelope', () => {
    expect(isScenePackEnvelope(envelope)).toBe(true);
  });

  it.each([
    ['another algorithm', { algorithm: 'rsa' }],
    ['a key id with spaces', { keyId: 'my key' }],
    ['a payload that is not base64', { payload: 'not base64!' }],
    ['a missing signature', { signature: undefined }],
    ['a different schema', { schema: 2 }],
  ])('refuses %s', (_label, over) => {
    expect(isScenePackEnvelope({ ...envelope, ...over })).toBe(false);
  });
});

describe('names at runtime', () => {
  it('falls back from the locale to English', () => {
    const result = normalizeScenePack(pack());
    if (!result) {
      throw new Error('fixture did not normalise');
    }
    expect(resolveSceneName(result, 'es')).toBe('Aurora boreal');
    expect(resolveSceneName(result, 'ja')).toBe('Aurora');
  });
});

describe('the assembled program', () => {
  it('owns the version line, the uniforms and main, and declares each parameter', () => {
    const result = normalizeScenePack(pack());
    if (!result) {
      throw new Error('fixture did not normalise');
    }
    const { source, sourceLineOffset } = assembleFragmentSource(result);

    expect(source.startsWith('#version 300 es')).toBe(true);
    expect(source.match(/#version/g)).toHaveLength(1);
    expect(source).toContain(`uniform float ${uniformNameForParam('speed')};`);
    expect(source).toContain('void main()');
    expect(source).toContain(SOURCE.trim());
    expect(source).toContain('uSceneFade');

    // The offset points a driver's error line into the author's own source:
    // the line after the offset is the first line of what they wrote.
    const lines = source.split('\n');
    expect(lines[sourceLineOffset]).toBe(SOURCE.split('\n')[0]);
  });

  it('draws its one triangle from the vertex index with no attributes', () => {
    expect(SCENE_VERTEX_SOURCE).toContain('gl_VertexID');
    expect(SCENE_VERTEX_SOURCE).not.toContain('in vec');
  });
});

/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The copy check behind "FluidEQ's scenes are to learn from, not to publish".
 *
 * What is held here: renaming, retuning, reformatting, reordering or padding a
 * scene leaves it a copy; a scene that takes one idea, or only uses the helper
 * code FluidEQ's scenes share with each other, is not one; and a scene of its
 * own is nowhere near. The thresholds themselves were measured on the real
 * collection (see the constants' comments); these scenes are written for the
 * test, in the collection's style.
 */

import {
  closestReference,
  COPY_COVERAGE,
  isOfficialCopy,
  sceneFingerprint,
  sceneTokens,
  type IReferenceScene,
} from '../../../common/sceneFingerprint';

/** Helpers several scenes share, as the collection's own library is shared. */
const LIBRARY = `
const float FX_PI = 3.14159265359;
float fxHash(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
float fxNoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(fxHash(i), fxHash(i + vec2(1, 0)), f.x),
             mix(fxHash(i + vec2(0, 1)), fxHash(i + 1.0), f.x), f.y);
}
mat2 fxRot(float a) {
  float s = sin(a), c = cos(a);
  return mat2(c, -s, s, c);
}
float fxFbm(vec2 p) {
  float n = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) {
    n += a * fxNoise(p);
    p = mat2(1.6, 1.2, -1.2, 1.6) * p + 11.7;
    a *= 0.5;
  }
  return n;
}
`;

const AURORA = `${LIBRARY}
// Curtains of light over a dark ridge, swaying with the bass.
float curtain(vec2 uv, float offset, float bass) {
  float wave = sin(uv.x * 3.1 + uTime * 0.21 + offset) * 0.18;
  wave += fxFbm(vec2(uv.x * 2.4 + offset, uTime * 0.05)) * 0.35;
  float band = smoothstep(0.55 + wave, 0.2 + wave, uv.y);
  band *= smoothstep(0.02, 0.35 + bass * 0.2, uv.y - wave * 0.4);
  return band * (0.6 + 0.4 * sin(uv.x * 40.0 + uTime));
}
vec3 ridge(vec2 uv) {
  float height = 0.18 + fxNoise(vec2(uv.x * 6.0, 1.0)) * 0.08;
  float land = step(uv.y, height);
  return mix(vec3(0.0), vec3(0.01, 0.02, 0.03), land);
}
vec4 sceneColour(vec2 uv) {
  float bass = texture(uSpectrum, vec2(0.04, 0.5)).r;
  vec3 sky = mix(vec3(0.01, 0.02, 0.06), vec3(0.0, 0.05, 0.1), uv.y);
  float green = curtain(uv, 0.0, bass);
  float violet = curtain(uv + vec2(0.13, 0.04), 2.1, bass * 0.7);
  vec3 colour = sky + green * uAccent + violet * vec3(0.5, 0.2, 0.8);
  colour += fxHash(uv * 900.0 + uTime) * 0.015;
  colour = mix(colour, ridge(uv), step(uv.y, 0.26));
  return vec4(colour, 1.0);
}
`;

const TUNNEL = `${LIBRARY}
// A tunnel of rings rushing forward on the beat.
vec3 ringColour(float depth, float treble) {
  float hue = fract(depth * 0.07 + uTime * 0.03);
  vec3 base = 0.5 + 0.5 * cos(6.2831 * (hue + vec3(0.0, 0.33, 0.67)));
  return base * (0.4 + treble * 1.6);
}
vec4 sceneColour(vec2 uv) {
  vec2 p = (uv - 0.5) * vec2(uResolution.x / uResolution.y, 1.0);
  float radius = length(p);
  float angle = atan(p.y, p.x);
  float treble = texture(uSpectrum, vec2(0.8, 0.5)).r;
  float depth = 0.3 / max(radius, 0.001) + uTime * (1.2 + uBeat * 2.0);
  float rings = abs(fract(depth) - 0.5);
  float glow = smoothstep(0.08, 0.0, rings) / (1.0 + radius * 4.0);
  float spokes = pow(abs(sin(angle * 8.0 + depth)), 12.0) * 0.3;
  vec3 colour = ringColour(floor(depth), treble) * (glow + spokes);
  colour *= smoothstep(0.0, 0.2, radius);
  colour += vec3(1.0) * pow(max(0.0, 1.0 - radius * 1.8), 6.0) * uBeat;
  return vec4(colour, 1.0);
}
`;

const OCEAN = `${LIBRARY}
// Rolling sea under a low moon, waves taller with the level.
float waves(vec2 p, float level) {
  float h = 0.0;
  float amplitude = 0.12 + level * 0.1;
  for (int k = 0; k < 5; k++) {
    h += sin(p.x * (1.7 + float(k) * 0.9) + uTime * (0.6 + float(k) * 0.2)) * amplitude;
    p = fxRot(0.7) * p;
    amplitude *= 0.55;
  }
  return h;
}
vec4 sceneColour(vec2 uv) {
  float level = texture(uSpectrumSlow, vec2(0.3, 0.5)).r;
  vec2 sea = vec2(uv.x * 8.0, 0.0);
  float surface = 0.42 + waves(sea, level) * 0.2;
  vec3 sky = mix(vec3(0.05, 0.06, 0.12), vec3(0.2, 0.18, 0.3), uv.y);
  vec2 moon = uv - vec2(0.72, 0.78);
  sky += vec3(0.9, 0.85, 0.7) * smoothstep(0.06, 0.05, length(moon));
  vec3 water = mix(vec3(0.0, 0.05, 0.1), vec3(0.1, 0.3, 0.45), uv.y / surface);
  float sparkle = pow(fxNoise(uv * vec2(80.0, 20.0) + uTime), 8.0) * level;
  vec3 colour = uv.y > surface ? sky : water + sparkle;
  return vec4(colour, 1.0);
}
`;

const EMBER = `${LIBRARY}
// Sparks rising from a bed of coals, more of them on loud passages.
float spark(vec2 uv, float seed) {
  vec2 cell = floor(uv * vec2(24.0, 12.0));
  float lifetime = fract(fxHash(cell + seed) + uTime * 0.3);
  vec2 centre = vec2(fxHash(cell * 1.7), lifetime);
  vec2 local = fract(uv * vec2(24.0, 12.0)) - centre;
  return smoothstep(0.08, 0.0, length(local)) * (1.0 - lifetime);
}
vec4 sceneColour(vec2 uv) {
  float loud = texture(uSpectrum, vec2(0.15, 0.5)).r;
  float coals = fxFbm(vec2(uv.x * 10.0, uTime * 0.4)) * smoothstep(0.25, 0.0, uv.y);
  float sparks = spark(uv + vec2(0.0, -uTime * 0.2), 1.0);
  sparks += spark(uv * 1.3 + vec2(0.4, -uTime * 0.35), 7.0) * loud;
  vec3 heat = vec3(1.0, 0.35, 0.05) * coals * (0.8 + loud);
  vec3 colour = heat + vec3(1.0, 0.7, 0.3) * sparks;
  return vec4(colour, 1.0);
}
`;

/** A member's own scene, sharing none of the collection's code. */
const MEMBER_OWN = `
// Bars that bounce with each band, drawn my own way.
vec4 sceneColour(vec2 uv) {
  float columns = 32.0;
  float column = floor(uv.x * columns);
  float band = texture(uSpectrum, vec2((column + 0.5) / columns, 0.5)).r;
  float height = band * 0.9;
  float bar = step(uv.y, height) * step(0.1, fract(uv.x * columns));
  vec3 low = vec3(0.1, 0.9, 0.6);
  vec3 high = vec3(0.9, 0.2, 0.7);
  vec3 colour = mix(low, high, uv.y) * bar;
  colour += vec3(0.02) * (1.0 - uv.y);
  return vec4(colour, 1.0);
}
`;

const REFERENCES: IReferenceScene[] = [
  { id: 'aurora', fingerprint: sceneFingerprint(AURORA) },
  { id: 'tunnel', fingerprint: sceneFingerprint(TUNNEL) },
  { id: 'ocean', fingerprint: sceneFingerprint(OCEAN) },
  { id: 'ember', fingerprint: sceneFingerprint(EMBER) },
];

const closest = (source: string) =>
  closestReference(sceneFingerprint(source), REFERENCES);

/** Every name the author chose, renamed; numbers nudged; spacing changed. */
const disguise = (source: string) => {
  const names = new Map<string, string>();
  return source
    .replace(/\/\/[^\n]*/g, '// my scene')
    .replace(/(\.?)\b([A-Za-z_]\w*)\b/g, (whole, dot: string, word: string) => {
      if (dot || sceneTokens(word)[0] !== '$') {
        return whole;
      }
      if (!names.has(word)) {
        names.set(word, `my${names.size}Thing`);
      }
      return names.get(word) ?? word;
    })
    .replace(
      /\b(\d+)\.(\d+)\b/g,
      (_n, whole: string, part: string) => `${whole}.${part}7`,
    )
    .replace(/;\s*/g, ';\n    ')
    .replace(/,\s*/g, ' , ');
};

/** The top-level functions of a scene, as text. */
const functionsOf = (source: string) =>
  source.match(
    /\n(?:float|vec2|vec3|vec4|mat2)\s+\w+\s*\([^)]*\)\s*\{[\s\S]*?\n\}/g,
  ) ?? [];

describe("a scene's tokens", () => {
  it('are the same whatever the scene’s names, numbers, spacing and comments', () => {
    expect(sceneTokens(disguise(TUNNEL))).toEqual(sceneTokens(TUNNEL));
  });

  it('keep the language, the contract and swizzles, so a real change changes them', () => {
    const tokens = sceneTokens('vec4 c = texture(uSpectrum, p.xy) * 2.0;');
    expect(tokens).toEqual([
      'vec4',
      '$',
      '=',
      'texture',
      '(',
      'uSpectrum',
      ',',
      '$',
      '.',
      'xy',
      ')',
      '*',
      '0',
      ';',
    ]);
    // The control: a different operation is a different token.
    expect(sceneTokens('vec4 c = texture(uSpectrum, p.xy) + 2.0;')).not.toEqual(
      tokens,
    );
  });
});

describe("a scene's fingerprint", () => {
  it('is a sorted set of 32-bit integers, the same every time', () => {
    const fingerprint = sceneFingerprint(OCEAN);
    expect(fingerprint.length).toBeGreaterThan(20);
    expect(fingerprint).toEqual(
      [...new Set(fingerprint)].sort((a, b) => a - b),
    );
    // What a Postgres integer holds.
    expect(
      fingerprint.every(
        (hash) =>
          Number.isInteger(hash) && hash >= -(2 ** 31) && hash < 2 ** 31,
      ),
    ).toBe(true);
    expect(sceneFingerprint(OCEAN)).toEqual(fingerprint);
  });

  it('is empty for code too short to hold a run', () => {
    expect(sceneFingerprint('')).toEqual([]);
    expect(sceneFingerprint('float a;')).toEqual([]);
  });
});

describe('the copy check', () => {
  it.each([
    ['exact', (s: string) => s],
    ['renamed, retuned and reformatted', disguise],
    [
      'with its functions in another order',
      (s: string) => {
        const functions = functionsOf(s);
        const rest = functions.reduce((text, fn) => text.replace(fn, ''), s);
        return `${[...functions].reverse().join('\n')}\n${rest}`;
      },
    ],
    [
      'padded with code that does nothing',
      (s: string) =>
        `${Array.from({ length: 60 }, (_, k) => `float pad${k}(float x) { return x * ${k}.0 + sin(x); }`).join('\n')}\n${disguise(s)}`,
    ],
  ])('finds a copy of a FluidEQ scene %s', (_how, make) => {
    const found = closest(make(AURORA));
    expect(found?.id).toBe('aurora');
    expect(found?.coverage).toBeGreaterThanOrEqual(COPY_COVERAGE);
    expect(isOfficialCopy(found)).toBe(true);
  });

  it('lets a member take an idea: one of a scene’s functions in their own scene', () => {
    const idea = functionsOf(OCEAN).find((fn) => fn.includes('waves('));
    expect(idea).toBeDefined();
    const found = closest(`${disguise(idea ?? '')}\n${MEMBER_OWN}`);
    expect(isOfficialCopy(found)).toBe(false);
  });

  it('never counts the helper code FluidEQ’s scenes share with each other', () => {
    const helpersOnly = `${LIBRARY}\n${MEMBER_OWN}`;
    expect(isOfficialCopy(closest(helpersOnly))).toBe(false);
    // The control: counted as any one scene's own, the helpers alone would
    // be a large share of it.
    const unfiltered = closestReference(
      sceneFingerprint(helpersOnly),
      REFERENCES,
      Number.POSITIVE_INFINITY,
    );
    expect(unfiltered?.coverage ?? 0).toBeGreaterThan(
      closest(helpersOnly)?.coverage ?? 0,
    );
  });

  it('finds nothing of FluidEQ’s in a member’s own scene', () => {
    expect(closest(MEMBER_OWN)?.coverage ?? 0).toBeLessThan(0.1);
    expect(isOfficialCopy(closest(MEMBER_OWN))).toBe(false);
    expect(isOfficialCopy(undefined)).toBe(false);
  });
});

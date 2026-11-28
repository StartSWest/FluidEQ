/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * A line across Neon City's sky, one pixel row at the middle of the picture
 * (2026-11-28: "there are some weird lines appearing on some scenes"). Along
 * that row the clouds were gone. Direct3D's shader compiler, which ANGLE
 * hands every scene to on Windows, turns the noise's `fract(y * 16.0 + 5.0)`
 * into `fract(y * 16.0)` while its `floor` keeps the rounded `+ 5.0`; on a row
 * a hair under the noise's lattice the two disagree, and the noise reads the
 * next cell up. fxc's output for the scene's own noise shows it, and Neon
 * City drawn on Ivan's RTX 4080 through ANGLE's Direct3D 11 showed the line
 * with the builtin and none with the definition below; SwiftShader, which
 * has no such compiler, drew the row clean either way.
 *
 * So every piece of a scene's own GLSL reads `fract` as GLSL defines it,
 * `x - floor(x)` (`FRACT_DECLARATIONS`), which leaves the compiler one
 * rounded sum to take both from. Only the scene's own code: the wrapper and
 * three.js' chunks keep theirs. A test of where the definition reaches,
 * because what it changes only a Direct3D compiler can show.
 */

import { ShaderLib } from 'three';
import {
  assembleFragmentSource,
  assembleSceneFunctions,
} from '../../../common/sceneUniformContract';
import type { IScenePack } from '../../../common/scenePacks';
import { spliceWorldHooks } from '../../../renderer/graph/world/worldShaderHooks';

const NOISE = `float cell(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  return mix(f.x, f.y, i.x);
}`;

const SCENE = `${NOISE}
vec4 sceneColour(vec2 uv) {
  return vec4(vec3(cell(vec2(uv.x * 3.3, uv.y * 16.0 + 5.0))), 1.0);
}`;

const pack = {
  source: SCENE,
  params: [],
} as unknown as IScenePack;

/**
 * Each `fract(` in `glsl`, and whether the preprocessor reads it as the
 * definition there: between `#define fract fluideqFract` and `#undef fract`.
 */
const fractCalls = (glsl: string) => {
  let defined = false;
  return glsl.split('\n').flatMap((line) => {
    if (/^\s*#define\s+fract\s+fluideqFract\s*$/.test(line)) {
      defined = true;
      return [];
    }
    if (/^\s*#undef\s+fract\s*$/.test(line)) {
      defined = false;
      return [];
    }
    return [...line.matchAll(/\bfract\s*\(/g)].map(() => ({ line, defined }));
  });
};

/** Whether `marker` stands where `fract` is GLSL's own again. */
const isOutsideDefinition = (glsl: string, marker: string) => {
  const before = glsl.slice(0, glsl.indexOf(marker));
  return (
    before.lastIndexOf('#undef fract') > before.lastIndexOf('#define fract')
  );
};

describe("a scene's fract, read as GLSL defines it", () => {
  it('reaches every fract in a shader scene, after its definition and before the wrapper', () => {
    const { source, sourceLineOffset } = assembleFragmentSource(pack);

    const calls = fractCalls(source);
    expect(calls.length).toBeGreaterThan(0);
    expect(calls.every(({ defined }) => defined)).toBe(true);
    expect(
      source.indexOf('vec2 fluideqFract(vec2 x) { return x - floor(x); }'),
    ).toBeGreaterThan(-1);
    expect(source.indexOf('fluideqFract(vec2 x)')).toBeLessThan(
      source.indexOf('#define fract'),
    );
    expect(isOutsideDefinition(source, 'void main()')).toBe(true);
    // A driver's error line still points into what the author wrote.
    expect(source.split('\n')[sourceLineOffset]).toBe(SCENE.split('\n')[0]);
  });

  it("reaches a world sky's shader the same way", () => {
    const sky = assembleSceneFunctions(pack);

    expect(fractCalls(sky).every(({ defined }) => defined)).toBe(true);
    expect(sky).toContain('fluideqFract(vec2 x)');
    expect(sky.trimEnd().endsWith('#undef fract')).toBe(true);
  });

  it("reaches a world material's own GLSL, and none of three.js' own", () => {
    const vertex = `vec3 worldDisplace(vec3 p, vec3 n, WorldVertex v) { return p + n * fract(v.uv.x * 4.0 + 2.0); }`;
    const fragment = `void worldSurface(inout vec4 colour, inout vec3 emissive, WorldSurface s) {
  colour.rgb *= fract(s.uv.y * 16.0 + 5.0);
}`;
    const spliced = spliceWorldHooks(
      {
        vertexShader: ShaderLib.standard.vertexShader,
        fragmentShader: ShaderLib.standard.fragmentShader,
      },
      { vertex, fragment, terrain: false, unlit: false, mirror: false },
      '',
    );

    [spliced.vertexShader, spliced.fragmentShader].forEach((glsl) => {
      const calls = fractCalls(glsl);
      expect(calls.length).toBeGreaterThan(0);
      expect(calls.every(({ defined }) => defined)).toBe(true);
      expect(glsl).toContain('fluideqFract(vec2 x)');
      expect(isOutsideDefinition(glsl, 'void main()')).toBe(true);
    });
  });
});

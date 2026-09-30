/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { ShaderLib, Texture } from 'three';
import type { IScenePack } from '../../../common/scenePacks';
import { createWorldInputs } from '../../../renderer/graph/world/worldInputs';
import { spliceWorldHooks } from '../../../renderer/graph/world/worldShaderHooks';

/**
 * A material's own GLSL tiles its textures from the pack's artwork (Ivan,
 * 2026-09-30: "improve forest tree and ground texture, generate nice
 * texture image"): a `map` repeats the artwork only when its region is the
 * whole picture, so a world with bark and ground in one atlas could tile
 * neither. The hooks see `uArtwork` as the sky does - declared in the GLSL
 * they are spliced into, and bound to the pack's artwork.
 */
describe('the artwork in a world material’s own GLSL', () => {
  const HOOK = `void worldSurface(inout vec4 colour, inout vec3 emissive, WorldSurface s) {
  colour.rgb = texture(uArtwork, s.uv).rgb;
}`;

  const declaresArtwork = (glsl: string) =>
    /\buniform\s+sampler2D\s+uArtwork\s*;/.test(glsl);

  it('is declared ahead of a fragment hook, lit or unlit', () => {
    [false, true].forEach((unlit) => {
      const three = unlit ? ShaderLib.basic : ShaderLib.standard;
      const spliced = spliceWorldHooks(
        {
          vertexShader: three.vertexShader,
          fragmentShader: three.fragmentShader,
        },
        { fragment: HOOK, terrain: false, unlit, mirror: false },
        '',
      );
      expect(declaresArtwork(spliced.fragmentShader)).toBe(true);
      // Before the hook that reads it: GLSL knows only what came above.
      expect(
        spliced.fragmentShader.indexOf('uniform sampler2D uArtwork'),
      ).toBeLessThan(spliced.fragmentShader.indexOf('void worldSurface'));
    });
  });

  it('is declared for a vertex hook too', () => {
    const spliced = spliceWorldHooks(
      {
        vertexShader: ShaderLib.standard.vertexShader,
        fragmentShader: ShaderLib.standard.fragmentShader,
      },
      {
        vertex:
          'vec3 worldDisplace(vec3 p, vec3 n, WorldVertex v) { return p + n * texture(uArtwork, v.uv).r; }',
        terrain: false,
        unlit: false,
        mirror: false,
      },
      '',
    );
    expect(declaresArtwork(spliced.vertexShader)).toBe(true);
  });

  it('is bound to the pack’s own artwork, in the uniforms every hook gets', () => {
    const artwork = new Texture();
    const inputs = createWorldInputs(
      { params: [] } as unknown as IScenePack,
      artwork,
    );
    expect(inputs.uniforms.uArtwork.value).toBe(artwork);
    inputs.dispose();
  });
});

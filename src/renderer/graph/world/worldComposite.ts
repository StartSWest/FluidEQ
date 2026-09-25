/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  Color,
  DataTexture,
  GLSL3,
  LinearSRGBColorSpace,
  NoBlending,
  RawShaderMaterial,
  ShaderChunk,
  type Texture,
} from 'three';
import type { IScenePack } from 'common/scenePacks';
import type { ISceneWorld, TWorldToneMapping } from 'common/sceneWorld';
import { assembleSceneFunctions } from 'common/sceneUniformContract';
import type { IWorldInputs } from './worldInputs';
import { WORLD_PASS_VERTEX } from './worldPasses';

/**
 * The last pass: the world's light brought down to the screen, laid over the
 * pack's own shader as its sky, the glow on top.
 *
 * The world is drawn in linear light with no ceiling, so a lamp can be ten
 * times brighter than a wall and the glow can tell. Here that light is tone
 * mapped — the curve film and games use to fit it onto a screen without
 * clipping the highlights flat. The sky is a display picture (it is what the
 * shader-only path shows), so it is brought into linear light, laid in behind
 * whatever the world does not cover, and comes out exactly as it went in
 * wherever the world adds nothing.
 *
 * The glow is added as a screen, not a sum: it lightens toward white and
 * never past it, so a glow over a bright sky does not burn a hole in it.
 *
 * What comes out is what the shader-only path's `main()` produces: clamped,
 * premultiplied, times the app's fade. Everything after this pass — the
 * brightness limiter, FSR, FXAA — sees a scene like any other.
 */

/**
 * Every name this pass adds to the pack's own source carries this prefix.
 * The pass is the pack's shader with the world laid over it, in one file,
 * and three's tone-mapping functions, its exposure uniform and this pass's
 * own names were plain — `ACESFilmicToneMapping`, `RRTAndODTFit`, `uWorld`
 * — so a sky that brought its own copy of the common ACES fit failed to
 * compile as a world and quietly played as its shader.
 */
const PREFIX = 'fqw_';

/**
 * Three's tone mapping (`tonemapping_pars_fragment`) with every name it
 * declares at the top level prefixed: its functions, its uniform, its
 * constants and the `saturate` it may define.
 */
const prefixedToneMapping = (() => {
  const chunk = ShaderChunk.tonemapping_pars_fragment;
  const declared = new Set<string>();
  const patterns = [
    /^#define\s+([A-Za-z_]\w*)/gm,
    /^#ifndef\s+([A-Za-z_]\w*)/gm,
    /^uniform\s+\w+\s+([A-Za-z_]\w*)/gm,
    /^(?:const\s+)?(?:vec3|vec4|float|mat3|bool)\s+([A-Za-z_]\w*)\s*[(=]/gm,
  ];
  patterns.forEach((pattern) => {
    [...chunk.matchAll(pattern)].forEach((match) => declared.add(match[1]));
  });
  return [...declared].reduce(
    (text, name) =>
      text.replace(new RegExp(`\\b${name}\\b`, 'g'), `${PREFIX}${name}`),
    chunk,
  );
})();

const TONE_MAP_CALL: Record<TWorldToneMapping, string> = {
  aces: `${PREFIX}ACESFilmicToneMapping(c)`,
  agx: `${PREFIX}AgXToneMapping(c)`,
  neutral: `${PREFIX}NeutralToneMapping(c)`,
  none: `${PREFIX}LinearToneMapping(c)`,
};

const compositeMain = (world: ISceneWorld) => `
uniform sampler2D fqw_world;
uniform sampler2D fqw_bloom;
uniform float fqw_bloomStrength;
uniform float fqw_vignette;
uniform vec3 fqw_backdrop;
${prefixedToneMapping}
vec3 fqw_toneMap(vec3 c) { return ${TONE_MAP_CALL[world.toneMapping]}; }
vec3 fqw_encode(vec3 linear) {
  vec3 c = clamp(linear, 0.0, 1.0);
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}
vec3 fqw_decode(vec3 shown) {
  vec3 c = clamp(shown, 0.0, 1.0);
  return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(0.04045, c));
}
// Whether the world hides the sky at every pixel of this 2x2 block. The
// sky is then never seen there (it is weighted by 1 - cover, which is 0),
// so it is not worked out: over a floor, a city or a mountain the scene's
// shader runs only where some of it shows. Decided for the whole block, the
// way the GPU shades it, so a shader's texture() and fwidth() still read
// their neighbours at the edge of a hidden region, and nothing on screen
// differs from working it out everywhere.
bool fqw_skyHidden() {
  ivec2 last = textureSize(fqw_world, 0) - 1;
  ivec2 block = ivec2(gl_FragCoord.xy) & ivec2(~1);
  float least = min(
    min(texelFetch(fqw_world, min(block, last), 0).a,
        texelFetch(fqw_world, min(block + ivec2(1, 0), last), 0).a),
    min(texelFetch(fqw_world, min(block + ivec2(0, 1), last), 0).a,
        texelFetch(fqw_world, min(block + ivec2(1, 1), last), 0).a));
  return least >= 1.0;
}
void main() {
${
  world.backdrop === 'shader'
    ? '  vec4 back = fqw_skyHidden() ? vec4(0.0) : clamp(sceneColour(vUv), 0.0, 1.0);'
    : '  vec4 back = vec4(fqw_backdrop, 1.0);'
}
  vec4 drawn = texture(fqw_world, vUv);
  float cover = clamp(drawn.a, 0.0, 1.0);
  vec3 rgb = max(drawn.rgb, vec3(0.0));
  // In linear light throughout, so a glow over empty sky adds to the sky
  // rather than vanishing with the coverage it never had. The multisampled
  // picture arrives averaged, and tone mapping a bright edge's average made
  // it as bright as the object's middle, every sample of its smoothing
  // lost: an edge covering half a pixel or more is the object's own light,
  // tone mapped, times its coverage. A glow has no coverage to divide by,
  // so below half the two are blended towards the plain curve.
  vec3 solid = fqw_toneMap(rgb / max(cover, 1e-3)) * cover;
  vec3 light = mix(fqw_toneMap(rgb), solid, smoothstep(0.0, 0.5, cover));
  vec3 base = light + fqw_decode(back.rgb) * (1.0 - cover);
  vec3 glow = fqw_toneMap(texture(fqw_bloom, vUv).rgb * fqw_bloomStrength);
  vec3 shown = fqw_encode(1.0 - (1.0 - clamp(base, 0.0, 1.0)) * (1.0 - glow));
  float alpha = cover + back.a * (1.0 - cover);
  alpha = max(alpha, max(shown.r, max(shown.g, shown.b)));
  vec2 centred = (vUv - 0.5) * vec2(uResolution.x / max(uResolution.y, 1.0), 1.0);
  float corner = smoothstep(0.35, 1.15, length(centred));
  shown *= 1.0 - fqw_vignette * corner;
  fragColor = clamp(vec4(shown, alpha), 0.0, 1.0) * uSceneFade;
}
`;

export interface IWorldComposite {
  material: RawShaderMaterial;
  set(
    drawn: Texture,
    bloom: Texture | null,
    bloomStrength: number,
    exposure: number,
  ): void;
  dispose(): void;
}

export const createWorldComposite = (
  pack: IScenePack,
  world: ISceneWorld,
  inputs: IWorldInputs,
): IWorldComposite => {
  const { source } = assembleSceneFunctions(pack);
  const black = new DataTexture(new Uint8Array(4), 1, 1);
  black.needsUpdate = true;
  // Laid in as the display shows it, beside the sky, so it is read raw
  // rather than converted into the renderer's linear light.
  const backdrop = new Color().setStyle(
    world.backdrop === 'shader' ? '#000000' : world.backdrop,
    LinearSRGBColorSpace,
  );
  const material = new RawShaderMaterial({
    glslVersion: GLSL3,
    vertexShader: WORLD_PASS_VERTEX,
    fragmentShader: `${source}${compositeMain(world)}`,
    uniforms: {
      ...inputs.uniforms,
      fqw_world: { value: black },
      fqw_bloom: { value: black },
      fqw_bloomStrength: { value: 0 },
      fqw_vignette: { value: world.vignette },
      fqw_backdrop: { value: backdrop },
      fqw_toneMappingExposure: { value: 1 },
    },
    depthTest: false,
    depthWrite: false,
    blending: NoBlending,
  });
  return {
    material,
    set: (drawn, bloom, bloomStrength, exposure) => {
      material.uniforms.fqw_world.value = drawn;
      material.uniforms.fqw_bloom.value = bloom ?? black;
      material.uniforms.fqw_bloomStrength.value = bloom ? bloomStrength : 0;
      material.uniforms.fqw_toneMappingExposure.value = exposure;
    },
    dispose: () => {
      material.dispose();
      black.dispose();
    },
  };
};

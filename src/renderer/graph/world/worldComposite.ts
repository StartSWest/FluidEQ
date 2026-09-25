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

const TONE_MAP_CALL: Record<TWorldToneMapping, string> = {
  aces: 'ACESFilmicToneMapping(c)',
  agx: 'AgXToneMapping(c)',
  neutral: 'NeutralToneMapping(c)',
  none: 'LinearToneMapping(c)',
};

const compositeMain = (world: ISceneWorld) => `
uniform sampler2D uWorld;
uniform sampler2D uBloom;
uniform float uBloomStrength;
uniform float uVignette;
uniform vec3 uBackdrop;
${ShaderChunk.tonemapping_pars_fragment}
vec3 worldToneMap(vec3 c) { return ${TONE_MAP_CALL[world.toneMapping]}; }
vec3 worldEncode(vec3 linear) {
  vec3 c = clamp(linear, 0.0, 1.0);
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}
vec3 worldDecode(vec3 shown) {
  vec3 c = clamp(shown, 0.0, 1.0);
  return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(0.04045, c));
}
void main() {
${
  world.backdrop === 'shader'
    ? '  vec4 back = clamp(sceneColour(vUv), 0.0, 1.0);'
    : '  vec4 back = vec4(uBackdrop, 1.0);'
}
  vec4 drawn = texture(uWorld, vUv);
  float cover = clamp(drawn.a, 0.0, 1.0);
  // In linear light throughout, so an edge half covered is half of each and
  // a glow over empty sky adds to the sky rather than vanishing with the
  // coverage it never had.
  vec3 light = worldToneMap(max(drawn.rgb, vec3(0.0)));
  vec3 base = light + worldDecode(back.rgb) * (1.0 - cover);
  vec3 glow = worldToneMap(texture(uBloom, vUv).rgb * uBloomStrength);
  vec3 shown = worldEncode(1.0 - (1.0 - clamp(base, 0.0, 1.0)) * (1.0 - glow));
  float alpha = cover + back.a * (1.0 - cover);
  alpha = max(alpha, max(shown.r, max(shown.g, shown.b)));
  vec2 centred = (vUv - 0.5) * vec2(uResolution.x / max(uResolution.y, 1.0), 1.0);
  float corner = smoothstep(0.35, 1.15, length(centred));
  shown *= 1.0 - uVignette * corner;
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
      uWorld: { value: black },
      uBloom: { value: black },
      uBloomStrength: { value: 0 },
      uVignette: { value: world.vignette },
      uBackdrop: { value: backdrop },
      toneMappingExposure: { value: 1 },
    },
    depthTest: false,
    depthWrite: false,
    blending: NoBlending,
  });
  return {
    material,
    set: (drawn, bloom, bloomStrength, exposure) => {
      material.uniforms.uWorld.value = drawn;
      material.uniforms.uBloom.value = bloom ?? black;
      material.uniforms.uBloomStrength.value = bloom ? bloomStrength : 0;
      material.uniforms.toneMappingExposure.value = exposure;
    },
    dispose: () => {
      material.dispose();
      black.dispose();
    },
  };
};

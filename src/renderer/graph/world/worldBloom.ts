/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  CustomBlending,
  GLSL3,
  HalfFloatType,
  LinearFilter,
  NoBlending,
  OneFactor,
  RawShaderMaterial,
  UnsignedByteType,
  Vector2,
  WebGLRenderTarget,
  type Texture,
  type WebGLRenderer,
} from 'three';
import { WORLD_PASS_VERTEX, type IWorldPass } from './worldPasses';

/**
 * The glow: light brighter than the threshold, spread wide and soft.
 *
 * Built the way film and game engines build it (Jimenez, "Next Generation
 * Post Processing in Call of Duty", 2014): the bright part halved again and
 * again down a chain of smaller pictures, each step a thirteen-tap filter,
 * then climbed back up with a tent filter, each level added onto the one
 * above. The wide glow is the smallest pictures' and costs almost nothing;
 * a single wide blur at full size would cost the whole frame.
 *
 * The first step weights each tap by one over its own brightness (Karis's
 * average), so a single blazing pixel — a spark, a specular glint — cannot
 * turn into a flickering square of light as it moves between pixels.
 */

const DOWN_SOURCE = `precision highp float;
uniform sampler2D uSource;
uniform vec2 uTexel;
uniform float uThreshold;
uniform float uFirst;
in vec2 vUv;
out vec4 fragColor;
vec3 tap(vec2 offset) { return texture(uSource, vUv + uTexel * offset).rgb; }
float karis(vec3 c) { return 1.0 / (1.0 + max(c.r, max(c.g, c.b))); }
vec3 bright(vec3 c) {
  float peak = max(c.r, max(c.g, c.b));
  float knee = max(uThreshold * 0.5, 1e-4);
  float soft = clamp(peak - uThreshold + knee, 0.0, 2.0 * knee);
  soft = soft * soft / (4.0 * knee);
  return c * max(soft, peak - uThreshold) / max(peak, 1e-4);
}
void main() {
  vec3 a = tap(vec2(-2.0, 2.0)); vec3 b = tap(vec2(0.0, 2.0)); vec3 c = tap(vec2(2.0, 2.0));
  vec3 d = tap(vec2(-2.0, 0.0)); vec3 e = tap(vec2(0.0, 0.0)); vec3 f = tap(vec2(2.0, 0.0));
  vec3 g = tap(vec2(-2.0, -2.0)); vec3 h = tap(vec2(0.0, -2.0)); vec3 i = tap(vec2(2.0, -2.0));
  vec3 j = tap(vec2(-1.0, 1.0)); vec3 k = tap(vec2(1.0, 1.0));
  vec3 l = tap(vec2(-1.0, -1.0)); vec3 m = tap(vec2(1.0, -1.0));
  vec3 colour;
  if (uFirst > 0.5) {
    vec3 g0 = (a + b + d + e) * 0.25; vec3 g1 = (b + c + e + f) * 0.25;
    vec3 g2 = (d + e + g + h) * 0.25; vec3 g3 = (e + f + h + i) * 0.25;
    vec3 g4 = (j + k + l + m) * 0.25;
    float w0 = karis(g0) * 0.125; float w1 = karis(g1) * 0.125;
    float w2 = karis(g2) * 0.125; float w3 = karis(g3) * 0.125;
    float w4 = karis(g4) * 0.5;
    colour = (g0 * w0 + g1 * w1 + g2 * w2 + g3 * w3 + g4 * w4) / (w0 + w1 + w2 + w3 + w4);
    colour = bright(colour);
  } else {
    colour = e * 0.125 + (a + c + g + i) * 0.03125 + (b + d + f + h) * 0.0625
      + (j + k + l + m) * 0.125;
  }
  fragColor = vec4(max(colour, vec3(0.0)), 1.0);
}
`;

const UP_SOURCE = `precision highp float;
uniform sampler2D uSource;
uniform vec2 uTexel;
uniform float uWeight;
in vec2 vUv;
out vec4 fragColor;
vec3 tap(vec2 offset) { return texture(uSource, vUv + uTexel * offset).rgb; }
void main() {
  vec3 sum = tap(vec2(0.0)) * 4.0
    + (tap(vec2(-1.0, 0.0)) + tap(vec2(1.0, 0.0)) + tap(vec2(0.0, -1.0)) + tap(vec2(0.0, 1.0))) * 2.0
    + tap(vec2(-1.0, -1.0)) + tap(vec2(1.0, -1.0)) + tap(vec2(-1.0, 1.0)) + tap(vec2(1.0, 1.0));
  fragColor = vec4(sum / 16.0 * uWeight, 1.0);
}
`;

/** Enough levels that the widest glow is a sixty-fourth of the picture. */
const LEVELS = 6;

export interface IWorldBloom {
  /** The glow of `source`, a `width × height` picture, half its size. */
  render(source: Texture, width: number, height: number): Texture;
  setShape(threshold: number, radius: number): void;
  /** Frees the glow's pictures; the next `render` makes them again. */
  release(): void;
  dispose(): void;
}

export const createWorldBloom = (
  renderer: WebGLRenderer,
  pass: IWorldPass,
  floatTargets: boolean,
): IWorldBloom => {
  const targets: WebGLRenderTarget[] = [];
  const down = new RawShaderMaterial({
    glslVersion: GLSL3,
    vertexShader: WORLD_PASS_VERTEX,
    fragmentShader: DOWN_SOURCE,
    uniforms: {
      uSource: { value: null },
      uTexel: { value: new Vector2() },
      uThreshold: { value: 0.8 },
      uFirst: { value: 1 },
    },
    depthTest: false,
    depthWrite: false,
    blending: NoBlending,
  });
  const up = new RawShaderMaterial({
    glslVersion: GLSL3,
    vertexShader: WORLD_PASS_VERTEX,
    fragmentShader: UP_SOURCE,
    uniforms: {
      uSource: { value: null },
      uTexel: { value: new Vector2() },
      uWeight: { value: 1 },
    },
    depthTest: false,
    depthWrite: false,
    blending: CustomBlending,
    blendSrc: OneFactor,
    blendDst: OneFactor,
    transparent: true,
  });
  let radius = 0.5;

  const ensure = (width: number, height: number) => {
    let w = width;
    let h = height;
    for (let level = 0; level < LEVELS; level += 1) {
      w = Math.max(1, Math.floor(w / 2));
      h = Math.max(1, Math.floor(h / 2));
      const known = targets[level];
      if (!known) {
        targets.push(
          new WebGLRenderTarget(w, h, {
            type: floatTargets ? HalfFloatType : UnsignedByteType,
            minFilter: LinearFilter,
            magFilter: LinearFilter,
            depthBuffer: false,
            generateMipmaps: false,
          }),
        );
      } else if (known.width !== w || known.height !== h) {
        known.setSize(w, h);
      }
    }
  };

  const draw = (target: WebGLRenderTarget) => {
    renderer.setRenderTarget(target);
    renderer.render(pass.scene, pass.camera);
  };

  return {
    render: (source, width, height) => {
      ensure(width, height);
      pass.use(down);
      let sourceTexture = source;
      let sourceWidth = width;
      let sourceHeight = height;
      targets.forEach((target, level) => {
        down.uniforms.uSource.value = sourceTexture;
        (down.uniforms.uTexel.value as Vector2).set(
          1 / sourceWidth,
          1 / sourceHeight,
        );
        down.uniforms.uFirst.value = level === 0 ? 1 : 0;
        draw(target);
        sourceTexture = target.texture;
        sourceWidth = target.width;
        sourceHeight = target.height;
      });
      pass.use(up);
      // Wider as it climbs: the radius decides how much of each smaller,
      // wider level reaches the one above.
      up.uniforms.uWeight.value = 0.35 + 0.65 * radius;
      for (let level = targets.length - 1; level > 0; level -= 1) {
        const smaller = targets[level];
        up.uniforms.uSource.value = smaller.texture;
        (up.uniforms.uTexel.value as Vector2).set(
          1 / smaller.width,
          1 / smaller.height,
        );
        draw(targets[level - 1]);
      }
      return targets[0].texture;
    },
    setShape: (threshold, spread) => {
      down.uniforms.uThreshold.value = threshold;
      radius = spread;
    },
    // A disposed target is made again by three the next time it is drawn
    // into, at the size it kept.
    release: () => targets.forEach((target) => target.dispose()),
    dispose: () => {
      targets.forEach((target) => target.dispose());
      down.dispose();
      up.dispose();
    },
  };
};

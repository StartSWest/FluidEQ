/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The Cover Flow scene's shaders. Every colour leaves premultiplied, because
 * the canvas is transparent and the Library's own surface shows through it:
 * the row sits on whatever the window's colours are, light or dark, instead
 * of on a black box of its own.
 *
 * Covers are lit in linear light (their textures are sRGB and sampled as
 * linear) and converted once on the way out (`colorspace_fragment`).
 */

/** Shared by the covers and their reflections. */
export const COVER_VERTEX = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vView;
  void main() {
    vUv = uv;
    vec4 world = modelMatrix * vec4(position, 1.0);
    vNormal = normalize(mat3(modelMatrix) * normal);
    vView = normalize(cameraPosition - world.xyz);
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

/** The rounded sleeve's signed distance, in the cover's own 0-1 square. */
const ROUNDED = /* glsl */ `
  float sleeveDistance(vec2 uv, float radius) {
    vec2 q = abs(uv - 0.5) - (0.5 - radius);
    return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - radius;
  }
`;

/**
 * A cover: rounded corners antialiased by their own distance field (the
 * canvas has no multisampling, so this is what keeps a turned edge smooth),
 * a hairline of light round the edge, a broad sheen whose place follows the
 * turn, shade and colour falling off away from the centre, and the accent
 * ring round the cover the music is coming from.
 */
export const COVER_FRAGMENT = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vView;
  uniform sampler2D uMap;
  uniform float uShade;
  uniform float uSaturation;
  uniform float uSheen;
  uniform float uRing;
  uniform vec3 uRingColour;
  uniform float uRadius;
  ${ROUNDED}
  void main() {
    vec4 texel = texture2D(uMap, vUv);
    vec3 colour = texel.rgb;
    float luma = dot(colour, vec3(0.2126, 0.7152, 0.0722));
    colour = mix(vec3(luma), colour, uSaturation);
    float facing = clamp(dot(normalize(vNormal), normalize(vView)), 0.0, 1.0);
    float band = exp(-pow((vUv.x + vUv.y * 0.55) - (0.75 + uSheen * 0.9), 2.0) * 18.0);
    colour = colour * mix(0.42, 1.0, facing) * uShade + vec3(band * 0.12 * facing);
    float d = sleeveDistance(vUv, uRadius);
    float pixel = max(fwidth(d), 1e-5);
    float inside = -d / pixel;
    colour += (1.0 - smoothstep(0.0, 1.5, inside)) * 0.10 * facing;
    colour = mix(colour, uRingColour, uRing * (1.0 - smoothstep(2.0, 3.0, inside)));
    float alpha = (1.0 - smoothstep(-pixel, pixel, d)) * texel.a;
    if (alpha < 0.003) discard;
    gl_FragColor = vec4(colour, alpha);
    #include <colorspace_fragment>
    gl_FragColor.rgb *= gl_FragColor.a;
  }
`;

/** A cover's reflection in the floor: strongest where it touches, gone a
 * little past halfway down. */
export const REFLECTION_FRAGMENT = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vView;
  uniform sampler2D uMap;
  uniform float uShade;
  uniform float uRadius;
  uniform float uStrength;
  ${ROUNDED}
  void main() {
    vec4 texel = texture2D(uMap, vUv);
    float d = sleeveDistance(vUv, uRadius);
    float pixel = max(fwidth(d), 1e-5);
    float fade = 1.0 - smoothstep(0.0, 0.62, vUv.y);
    float alpha = (1.0 - smoothstep(-pixel, pixel, d)) * texel.a * fade * 0.3 * uShade * uStrength;
    if (alpha < 0.003) discard;
    gl_FragColor = vec4(texel.rgb * 0.85, alpha);
    #include <colorspace_fragment>
    gl_FragColor.rgb *= gl_FragColor.a;
  }
`;

/** The light behind the row: the centre cover's colour, a soft halo
 * around where the centre cover stands, low and quiet. Drawn straight in
 * clip space.
 *
 * Kept off the top: at 0.36 and spread over the whole stage it washed the
 * space above the row in the cover's colour, which read as a coloured sky
 * over the covers (Ivan, 2026-11-15: "let's not have too much glow on cover
 * art, at least not on top"). It is half as strong, tighter, and fades out
 * above the centre cover, so it lights only what the row stands in front of
 * and the floor under it. */
export const HALO_VERTEX = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

export const HALO_FRAGMENT = /* glsl */ `
  varying vec2 vUv;
  uniform vec3 uGlow;
  uniform float uAspect;
  uniform float uAnchor;
  void main() {
    vec2 p = vUv - vec2(0.5, uAnchor);
    p.x *= uAspect;
    float halo = exp(-dot(p, p) * 8.0);
    // Full below the centre, gone a quarter of the stage above it.
    float below = 1.0 - smoothstep(uAnchor - 0.05, uAnchor + 0.25, vUv.y);
    gl_FragColor = vec4(uGlow, halo * below * 0.18);
    #include <colorspace_fragment>
    gl_FragColor.rgb *= gl_FragColor.a;
  }
`;

/** The floor: a faint gloss under the row, and a pool of the same light. */
export const FLOOR_VERTEX = /* glsl */ `
  varying vec3 vWorld;
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorld = world.xyz;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

export const FLOOR_FRAGMENT = /* glsl */ `
  varying vec3 vWorld;
  uniform vec3 uGlow;
  void main() {
    float d = length(vec2(vWorld.x * 0.45, vWorld.z + 0.6));
    float pool = exp(-d * d * 0.9);
    float reach = smoothstep(-9.0, -2.0, vWorld.z) * (1.0 - smoothstep(2.5, 5.5, vWorld.z));
    float alpha = (0.16 + pool * 0.2) * reach;
    vec3 colour = mix(vec3(0.0), uGlow, pool * 0.8);
    gl_FragColor = vec4(colour, alpha);
    #include <colorspace_fragment>
    gl_FragColor.rgb *= gl_FragColor.a;
  }
`;

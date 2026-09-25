/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { ShaderChunk } from 'three';

/**
 * The GLSL a world's material may add to three.js's own lit materials, and
 * where it goes.
 *
 * A world's author writes two functions, never a shader: `worldDisplace`
 * moves a vertex, `worldSurface` colours a pixel and gives it light of its
 * own. They are spliced into three's physically based materials at fixed
 * points, so the lighting, shadows, fog and reflections are three's and the
 * author's code runs inside them — a pillar lit by the stage's lights whose
 * top glows with the treble, rather than a flat shader pretending to be lit.
 *
 * Each gets the whole shader contract (`uSpectrum`, `uBands`, ...), the
 * pack's parameters and the world's variables as `uVar_<name>`, and a struct
 * of where it is, so a field added later is a new member rather than a new
 * argument that breaks every function already written.
 */

/**
 * Fog that thins into the sky instead of painting over it.
 *
 * Patched once, into this bundle's own copy of three, behind a define no
 * material outside a world sets: a distant tower fades to transparent, and
 * the shader behind the world shows through it, because a world's sky is a
 * picture and fading everything to one flat colour in front of a nebula reads
 * as a grey wall.
 */
const FOG_MIX =
  'gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );';
if (
  ShaderChunk.fog_fragment.includes(FOG_MIX) &&
  !ShaderChunk.fog_fragment.includes('WORLD_FOG_TO_BACKDROP')
) {
  ShaderChunk.fog_fragment = ShaderChunk.fog_fragment.replace(
    FOG_MIX,
    `#ifdef WORLD_FOG_TO_BACKDROP
	gl_FragColor *= 1.0 - fogFactor;
#else
	${FOG_MIX}
#endif`,
  );
}

const TERRAIN_FUNCTIONS = `
uniform sampler2D uTerrainHistory;
uniform float uTerrainHead;
uniform float uTerrainRows;
uniform float uTerrainHeight;
uniform vec2 uTerrainBand;
uniform float uTerrainMirror;
uniform float uTerrainValley;
uniform vec2 uTerrainStep;
uniform vec2 uTerrainSize;
float worldTerrainHeight(vec2 at) {
  float across = abs(at.x * 2.0 - 1.0);
  float along = uTerrainMirror > 0.5 ? across : at.x;
  float band = mix(uTerrainBand.x, uTerrainBand.y, along);
  float age = (1.0 - at.y) * (uTerrainRows - 2.0);
  float row = (uTerrainHead - age + 0.5) / uTerrainRows;
  float level = texture(uTerrainHistory, vec2(band, row)).r;
  float floorKept = uTerrainValley > 0.0
    ? smoothstep(uTerrainValley * 0.45, uTerrainValley, across)
    : 1.0;
  return level * floorKept * uTerrainHeight;
}
vec3 worldTerrainNormal(vec2 at) {
  float left = worldTerrainHeight(at - vec2(uTerrainStep.x, 0.0));
  float right = worldTerrainHeight(at + vec2(uTerrainStep.x, 0.0));
  float near = worldTerrainHeight(at - vec2(0.0, uTerrainStep.y));
  float far = worldTerrainHeight(at + vec2(0.0, uTerrainStep.y));
  float slopeAcross = (right - left) / (2.0 * uTerrainStep.x * uTerrainSize.x);
  float slopeAlong = (far - near) / (2.0 * uTerrainStep.y * uTerrainSize.y);
  return normalize(vec3(-slopeAcross, 1.0, slopeAlong));
}
`;

const CONTRACT_UNIFORMS = `
uniform float uTime;
uniform float uLevel;
uniform float uBeat;
uniform vec3 uBands;
uniform vec3 uAccent;
uniform vec2 uMusicAccent;
uniform vec2 uMusicRun;
uniform sampler2D uSpectrum;
uniform sampler2D uSpectrumSlow;
uniform sampler2D uWaveform;
uniform vec4 uRhythm;
uniform vec3 uDrums;
uniform vec4 uSong;
uniform vec2 uStereo;
uniform vec3 uVoice;
uniform vec4 uPointer;
uniform vec4 uTap;
uniform vec3 uCamera;
`;

export interface IWorldHookSource {
  vertex?: string;
  fragment?: string;
  terrain: boolean;
  /** Unlit materials have no emissive term; theirs is added after lighting. */
  unlit: boolean;
  /** Adds the floor's reflection (`worldMirror.ts`) as light it gives off. */
  mirror: boolean;
}

/** Whether a material needs anything spliced into it at all. */
export const needsHooks = (source: IWorldHookSource): boolean =>
  source.vertex !== undefined ||
  source.fragment !== undefined ||
  source.terrain ||
  source.mirror;

const VARYINGS = `
varying vec2 vWorldUv;
varying vec3 vWorldPos;
varying vec3 vWorldLocal;
varying vec4 vWorldInstance;
varying vec3 vWorldTint;
`;

const VERTEX_HEAD = `
struct WorldVertex { vec2 uv; vec4 instance; };
#ifdef USE_INSTANCING
attribute vec4 aWorldInstance;
#endif
`;

const FRAGMENT_HEAD = `
struct WorldSurface { vec2 uv; vec3 position; vec3 local; vec4 instance; vec3 tint; };
`;

const VERTEX_BODY = `#include <begin_vertex>
#ifdef USE_INSTANCING
  vec4 worldInstance = aWorldInstance;
#else
  vec4 worldInstance = vec4(0.0, 0.0, 0.0, 1.0);
#endif
#ifdef WORLD_TERRAIN
  transformed.y += worldTerrainHeight(uv);
#endif
#ifdef WORLD_VERTEX
  transformed = worldDisplace(transformed, normal, WorldVertex(uv, worldInstance));
#endif
`;

const VERTEX_TAIL = `#include <fog_vertex>
  vWorldUv = uv;
  vWorldLocal = transformed;
  vWorldInstance = worldInstance;
#ifdef USE_INSTANCING
  vWorldPos = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;
#else
  vWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
#endif
#ifdef USE_INSTANCING_COLOR
  vWorldTint = instanceColor;
#else
  vWorldTint = vec3(1.0);
#endif
`;

/**
 * The reflection, read where this pixel's point lands in the mirrored
 * camera's picture, blurred by sampling a smaller copy of it, and stronger
 * at a grazing angle as a real wet floor is (Schlick's curve, sharpened).
 */
const MIRROR_UNIFORMS = `
uniform sampler2D uMirror;
uniform mat4 uMirrorMatrix;
uniform float uMirrorStrength;
uniform float uMirrorBlur;
`;

const MIRROR_BODY = `
  {
    vec4 mirrorAt = uMirrorMatrix * vec4(vWorldPos, 1.0);
    vec2 mirrorUv = mirrorAt.xy / max(mirrorAt.w, 1e-4);
    float facing = clamp(dot(normalize(vViewPosition), normal), 0.0, 1.0);
    float fresnel = 0.18 + 0.82 * pow(1.0 - facing, 4.0);
    vec3 reflected = textureLod(uMirror, mirrorUv, uMirrorBlur * 6.0).rgb;
    totalEmissiveRadiance += reflected * uMirrorStrength * fresnel;
  }
`;

const SURFACE_CALL =
  'WorldSurface(vWorldUv, vWorldPos, vWorldLocal, vWorldInstance, vWorldTint)';

export interface IWorldShaderSources {
  vertexShader: string;
  fragmentShader: string;
}

/**
 * Three's sources for a material with `source` spliced in. `declarations`
 * are the pack's parameter and the world's variable uniforms, declared in
 * both stages.
 */
export const spliceWorldHooks = (
  three: IWorldShaderSources,
  source: IWorldHookSource,
  declarations: string,
): IWorldShaderSources => {
  const shared = `${CONTRACT_UNIFORMS}${declarations}`;
  const defines = [
    source.vertex ? '#define WORLD_VERTEX' : '',
    source.terrain ? '#define WORLD_TERRAIN' : '',
  ].join('\n');
  const vertexShader = [
    defines,
    shared,
    VERTEX_HEAD,
    VARYINGS,
    source.terrain ? TERRAIN_FUNCTIONS : '',
    source.vertex ?? '',
    three.vertexShader
      .replace(
        '#include <beginnormal_vertex>',
        `#include <beginnormal_vertex>
#ifdef WORLD_TERRAIN
  objectNormal = worldTerrainNormal(uv);
#endif`,
      )
      .replace('#include <begin_vertex>', VERTEX_BODY)
      .replace('#include <fog_vertex>', VERTEX_TAIL),
  ].join('\n');
  if (source.fragment === undefined && !source.mirror) {
    return { vertexShader, fragmentShader: three.fragmentShader };
  }
  const surface = source.fragment
    ? `worldSurface(diffuseColor, totalEmissiveRadiance, ${SURFACE_CALL});`
    : '';
  const fragmentBody = source.unlit
    ? three.fragmentShader
        .replace(
          '#include <color_fragment>',
          `#include <color_fragment>
  vec3 worldEmissive = vec3(0.0);
  worldSurface(diffuseColor, worldEmissive, ${SURFACE_CALL});`,
        )
        .replace(
          '#include <opaque_fragment>',
          `outgoingLight += worldEmissive;
#include <opaque_fragment>`,
        )
    : three.fragmentShader.replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
  ${surface}
${source.mirror ? MIRROR_BODY : ''}`,
      );
  return {
    vertexShader,
    fragmentShader: [
      shared,
      FRAGMENT_HEAD,
      VARYINGS,
      source.mirror ? MIRROR_UNIFORMS : '',
      source.fragment ?? '',
      fragmentBody,
    ].join('\n'),
  };
};

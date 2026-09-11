import { SCENE_CONTRACT_VERSION } from '../../common/sceneUniformContract';

/**
 * What "New project" writes: a scene that already moves with the
 * music, so the stage has something alive on it before anybody has asked an
 * AI for anything — and a working example of every channel for the AI to
 * build on. Aurora curtains follow the slow spectrum, stars answer the treble,
 * the lake ripples with the waveform, and a beat lifts the light. The scene
 * clock keeps running in silence, so only the slow drift of the curtains goes
 * on then — every bright or fast movement is driven by the music, which is
 * what a calm silence needs.
 *
 * It keeps the member rules (`memberSceneRules.ts`): no `#` lines, one loop
 * with a constant bound, nothing outside plain ASCII. A test holds it to them.
 */

/** The starter's `pack.json`, named for the project it starts. */
export const starterManifest = (name: string, id: string) =>
  `${JSON.stringify(
    {
      id,
      version: 1,
      contract: SCENE_CONTRACT_VERSION,
      names: { en: name },
      fallbackStyle: 'ridge',
      swatch: ['#030414', '#19f2b3', '#8c4dff'],
      sourceFile: 'scene.frag',
      params: [],
    },
    null,
    2,
  )}\n`;

export const STARTER_SOURCE = `// My first FluidEQ scene. Ask your AI to change anything in it.
// uv runs 0..1 across the panel, origin bottom-left. Return premultiplied
// colour with alpha 1.0.

const float TAU = 6.2831853;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}

// Slow spectrum: smooth light that does not flicker. f = 0 is the bass end.
float band(float f) { return texture(uSpectrumSlow, vec2(clamp(f, 0.0, 1.0), 0.5)).r; }

// A moonlit night sky: deep blue overhead, violet towards the horizon, so the
// mountains stand out against it even in silence.
vec3 sky(vec2 uv, float aspect) {
  vec3 colour = mix(vec3(0.230, 0.130, 0.400), vec3(0.020, 0.030, 0.105),
                    smoothstep(0.30, 1.0, uv.y));
  // The moon: a light that never moves with the music.
  vec2 moon = vec2(0.82 * aspect, 0.80);
  float far = length(vec2(uv.x * aspect, uv.y) - moon);
  colour += vec3(0.34, 0.38, 0.66) * exp(-far * 5.0) * 0.8;
  colour += vec3(1.00, 0.97, 0.90) * smoothstep(0.042, 0.036, far);
  // A fixed star field; the treble makes it sparkle.
  vec2 cell = floor(vec2(uv.x * aspect, uv.y) * 90.0);
  float seed = hash(cell);
  float star = step(0.984, seed) * smoothstep(0.42, 1.0, uv.y);
  float twinkle = 0.6 + 0.4 * sin(uTime * 3.0 + seed * TAU);
  return colour + vec3(0.85, 0.90, 1.00) * star * (0.45 + uBands.z * 0.9 * twinkle);
}

// Three curtains, each lit by its own part of the spectrum. They glow gently
// in silence and burn when their part of the music is loud.
vec3 aurora(vec2 uv) {
  vec3 light = vec3(0.0);
  for (int i = 0; i < 3; i++) {
    float layer = float(i);
    float x = uv.x + layer * 0.13;
    float energy = band(0.15 + 0.30 * layer + 0.25 * x);
    float crest = 0.64 + 0.06 * sin(x * 5.0 + uTime * 0.25 + layer)
                + 0.05 * noise(vec2(x * 3.0, uTime * 0.1 + layer));
    float tall = 0.16 + 0.30 * energy;
    float curtain = smoothstep(crest - tall, crest, uv.y)
                  * (1.0 - smoothstep(crest, crest + 0.025, uv.y));
    float folds = 0.55 + 0.45 * noise(vec2(x * 18.0 + layer * 7.0, uv.y * 2.0 - uTime * 0.2));
    vec3 tint = mix(vec3(0.10, 0.95, 0.70), vec3(0.60, 0.32, 1.00), layer / 2.0);
    light += tint * curtain * folds * (0.62 + energy * 1.4 + uBeat * 0.18);
  }
  return light;
}

// Two ranges, far and near, so the land has depth.
float ridgeFar(float x) {
  return 0.40 + 0.06 * noise(vec2(x * 3.0, 4.0)) + 0.02 * noise(vec2(x * 11.0, 5.0));
}

float ridgeNear(float x) {
  return 0.34 + 0.07 * noise(vec2(x * 4.0, 1.0)) + 0.03 * noise(vec2(x * 13.0, 2.0));
}

vec3 land(vec3 colour, vec2 p, vec3 glow) {
  float farTop = ridgeFar(p.x);
  float nearTop = ridgeNear(p.x);
  // The far range takes a little of the sky's colour; the near one is ink.
  colour = mix(colour, vec3(0.095, 0.075, 0.210) + glow * 0.16, step(p.y, farTop));
  colour = mix(colour, vec3(0.020, 0.020, 0.050) + glow * 0.04, step(p.y, nearTop));
  // Rim light: the aurora catching the edge of each ridge.
  colour += glow * 0.55 * exp(-pow((p.y - farTop) * 160.0, 2.0));
  colour += glow * 0.35 * exp(-pow((p.y - nearTop) * 200.0, 2.0));
  return colour;
}

vec4 sceneColour(vec2 uv) {
  float aspect = uResolution.x / max(1.0, uResolution.y);
  float horizon = 0.30;
  vec2 p = uv;
  bool lake = uv.y < horizon;
  float depth = 0.0;
  if (lake) {
    // Mirror the sky into the water, rippled by the waveform and the level.
    depth = (horizon - uv.y) / horizon;
    float wave = texture(uWaveform, vec2(uv.x, 0.5)).r;
    p.x += sin(uv.y * 180.0 + uTime * 2.0) * 0.004 * (0.3 + uLevel + wave) * depth;
    p.y = horizon + (horizon - uv.y) * 1.15;
  }
  vec3 curtains = aurora(p);
  vec3 glow = curtains + vec3(0.10, 0.30, 0.35) * 0.2;
  vec3 colour = land(sky(p, aspect) + curtains, p, glow);
  if (lake) {
    colour *= 0.78 * (1.0 - depth * 0.5);
    // Long glints on the water, brighter when the music is.
    float glint = pow(0.5 + 0.5 * sin(uv.y * 260.0 - uTime * 1.5 + noise(vec2(uv.x * 40.0, uv.y * 8.0)) * 6.0), 12.0);
    colour += glow * glint * (0.10 + uLevel * 0.35) * (1.0 - depth);
    float shore = exp(-pow((uv.y - horizon) * 120.0, 2.0));
    colour += vec3(0.10, 0.60, 0.60) * shore * (0.06 + uLevel * 0.25);
  }
  return vec4(colour, 1.0);
}
`;

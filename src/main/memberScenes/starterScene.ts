import { SCENE_CONTRACT_VERSION } from '../../common/sceneUniformContract';

/**
 * What "Create starter project" writes: a scene that already moves with the
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

export const STARTER_MANIFEST = `${JSON.stringify(
  {
    id: 'my-first-scene',
    version: 1,
    contract: SCENE_CONTRACT_VERSION,
    names: { en: 'My First Scene' },
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

vec3 sky(vec2 uv, float aspect) {
  vec3 colour = mix(vec3(0.045, 0.030, 0.110), vec3(0.012, 0.016, 0.055),
                    smoothstep(0.35, 1.0, uv.y));
  // A fixed star field; the treble makes it sparkle.
  vec2 cell = floor(vec2(uv.x * aspect, uv.y) * 90.0);
  float seed = hash(cell);
  float star = step(0.985, seed) * smoothstep(0.45, 1.0, uv.y);
  float twinkle = 0.6 + 0.4 * sin(uTime * 3.0 + seed * TAU);
  return colour + vec3(0.85, 0.90, 1.00) * star * (0.35 + uBands.z * 0.9 * twinkle);
}

// Three curtains, each lit by its own part of the spectrum.
vec3 aurora(vec2 uv) {
  vec3 light = vec3(0.0);
  for (int i = 0; i < 3; i++) {
    float layer = float(i);
    float x = uv.x + layer * 0.13;
    float energy = band(0.15 + 0.30 * layer + 0.25 * x);
    float crest = 0.62 + 0.06 * sin(x * 5.0 + uTime * 0.25 + layer)
                + 0.05 * noise(vec2(x * 3.0, uTime * 0.1 + layer));
    float tall = 0.08 + 0.28 * energy;
    float curtain = smoothstep(crest - tall, crest, uv.y)
                  * (1.0 - smoothstep(crest, crest + 0.02, uv.y));
    float folds = 0.6 + 0.4 * noise(vec2(x * 18.0 + layer * 7.0, uv.y * 2.0 - uTime * 0.2));
    vec3 tint = mix(vec3(0.10, 0.95, 0.70), vec3(0.55, 0.30, 1.00), layer / 2.0);
    light += tint * curtain * folds * (0.25 + energy * 1.2 + uBeat * 0.15);
  }
  return light;
}

float ridge(float x) {
  return 0.34 + 0.07 * noise(vec2(x * 4.0, 1.0)) + 0.03 * noise(vec2(x * 13.0, 2.0));
}

vec4 sceneColour(vec2 uv) {
  float aspect = uResolution.x / max(1.0, uResolution.y);
  float horizon = 0.30;
  vec2 p = uv;
  bool lake = uv.y < horizon;
  if (lake) {
    // Mirror the sky into the water, rippled by the waveform and the level.
    float depth = (horizon - uv.y) / horizon;
    float wave = texture(uWaveform, vec2(uv.x, 0.5)).r;
    p.x += sin(uv.y * 180.0 + uTime * 2.0) * 0.004 * (0.3 + uLevel + wave) * depth;
    p.y = horizon + (horizon - uv.y) * 1.2;
  }
  vec3 colour = sky(p, aspect) + aurora(p);
  colour = mix(colour, vec3(0.010, 0.012, 0.030), step(p.y, ridge(p.x)));
  if (lake) {
    float depth = (horizon - uv.y) / horizon;
    colour *= 0.45 * (1.0 - depth * 0.6);
    float shore = exp(-pow((uv.y - horizon) * 90.0, 2.0));
    colour += vec3(0.0, 0.9, 0.8) * shore * (0.15 + uLevel * 0.4);
  }
  return vec4(colour, 1.0);
}
`;

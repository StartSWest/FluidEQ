import { SCENE_CONTRACT_VERSION } from 'common/sceneUniformContract';
import type { TranslationKey } from 'common/i18n';

/**
 * What "Copy AI prompt" puts on the clipboard.
 *
 * English on purpose, in every language the app speaks: it is read by a
 * model, not by the member, and every current model follows English
 * instructions best. The member writes their idea after the last line in any
 * language they like. The buttons around it are translated.
 *
 * It describes the engine exactly as it is — the uniform contract in
 * `sceneUniformContract.ts` and the member rules in `memberSceneRules.ts` —
 * and changes in the same commit as either. A prompt that promises a uniform
 * the app does not upload produces scenes that fail for reasons nobody can see.
 */
export const AI_PROMPT = `You are writing a visualizer for FluidEQ Plus, a music app. The visualizer is a
GLSL ES 3.00 fragment-shader body that FluidEQ runs on the listener's GPU while
music plays. Reply with the complete contents of each file and nothing else:
first pack.json, then scene.frag. If my idea needs a picture, also describe
exactly how I should lay out artwork.webp (see ARTWORK). Do not explain unless
I ask.

FILES
  pack.json     metadata (format below)
  scene.frag    the shader body
  artwork.webp  optional picture atlas that I make myself

pack.json:
{
  "id": "lowercase-with-dashes",
  "version": 1,
  "contract": ${SCENE_CONTRACT_VERSION},
  "names": { "en": "Short Name" },
  "fallbackStyle": "bars",
  "swatch": ["#rrggbb", "#rrggbb", "#rrggbb"],
  "sourceFile": "scene.frag",
  "params": []
}
- id: 2-48 characters, a-z, 0-9 and dashes, starting with a letter.
- version: raise it by one every time you change the scene.
- names: English required; add es, pt, fr, de, it, ru, zh, ja, hi if you can.
  At most 40 characters each.
- swatch: 2 to 4 colours that represent the scene.
- fallbackStyle: drawn when a computer cannot run the scene. Use one of: bars,
  line, area, dots, spikes, ridge, skyline, flames, bubbles, rain, starfield,
  canyon.
- params: up to 8 sliders the listener can adjust, each
  { "id": "glow", "names": { "en": "Glow" }, "min": 0, "max": 1, "value": 0.5 }.
  Each becomes "uniform float uParam_<id>;" automatically. Do not declare it.
- With artwork add: "artworkFile": "artwork.webp", "artworkWidth": W,
  "artworkHeight": H (the exact pixel size of the image).

scene.frag must define exactly this function and may define helpers above it:
  vec4 sceneColour(vec2 uv)
- uv runs 0..1 across the panel, origin at the bottom-left, y up.
- Return premultiplied colour: rgb already multiplied by alpha, all in 0..1.
  Return alpha 1.0 for an opaque background.
- FluidEQ already declares everything below and writes main(). Never write
  #version, main(), or any line starting with #. Use const instead of #define.

WHAT THE SCENE RECEIVES (already declared; just use them)
  float uTime        seconds since the scene appeared; keeps running in
                     silence and wraps at 3600. Use it for slow ambient drift;
                     use periods that divide 3600 so nothing jumps.
  vec2  uResolution  the drawing size in pixels. Use it for aspect ratio and
                     for one-pixel line widths.
  float uLevel       overall loudness, 0..1, eased.
  float uBeat        1.0 at a detected beat, falling to 0.
  vec3  uBands       x = bass, y = mids, z = treble, each 0..1.
  sampler2D uSpectrum      frequency energy: texture(uSpectrum, vec2(f, 0.5)).r,
                           f = 0 is 16 Hz, f = 1 is 25 kHz, log-spaced. Fast.
  sampler2D uSpectrumSlow  the same, eased (180 ms up, 420 ms down). Use for
                           light and glow that must not flicker.
  vec2  uMusicAccent x = envelope 0..1 of a rare, strong musical moment (at
                     least ~5 s apart); y = its event number. Use y as a random
                     seed so each moment looks different (where lightning
                     strikes, which way a comet flies).
  sampler2D uWaveform  recent waveform envelope: texture(uWaveform, vec2(t, 0.5)).r
  vec3  uAccent      the app's theme colour, if you want to match it.
  vec4  uSpectrumRect  where the app's live frequency axis sits:
                       (left, right, floor, ceiling) in uv units.
  sampler2D uArtwork   the artwork atlas, if pack.json names one. Origin at the
                       bottom-left, premultiplied RGBA. Do not use it otherwise.

RULES (FluidEQ refuses the scene otherwise)
- Loops: only for (int i = 0; i < N; i++) with N a constant of at most 128
  (counting down is fine too). Never assign to i inside the loop. No while,
  no do, no recursion.
- Plain ASCII outside comments. At most 64 KB.
- In silence the scene must be calm: only slow drift from uTime. Every bright,
  fast or big movement must come from the music.
- Never flash the whole picture. Let a beat move or light a part of it.
- It runs for every pixel, every frame, on ordinary laptops. Keep loops short,
  sample textures sparingly, and prefer smooth maths to many layers.

HELPERS YOU MAY COPY
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x),
               mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
  }
  float band(float f) { return texture(uSpectrumSlow, vec2(clamp(f, 0.0, 1.0), 0.5)).r; }

ARTWORK AND MASKS
A photo comes alive by masking its parts and giving each part its own channel.
Put the picture in one region of the atlas and paint masks beside it: white
where a part is, black elsewhere, one mask per moving part (for example red
channel = ears, green = tail, blue = eyes). In the shader, sample the mask at
the same place as the picture and use it to move, bend, brighten or tint only
that part - e.g. ears twitch with uBeat, the tail sways with uBands.x, the eyes
glow with uBands.z. Tell me the exact atlas layout: the image size, where the
picture goes, and what each mask must cover. WebP, not animated, at most 4096
pixels wide and 4096 x 2048 in total, at most 6 MB.

MY IDEA:`;

/** One-tap starters: a label for the chip, and the idea it appends. */
export const AI_IDEAS: ReadonlyArray<{
  label: TranslationKey;
  idea: TranslationKey;
}> = [
  { label: 'studio.idea.pet.label', idea: 'studio.idea.pet.text' },
  { label: 'studio.idea.city.label', idea: 'studio.idea.city.text' },
  { label: 'studio.idea.sea.label', idea: 'studio.idea.sea.text' },
  { label: 'studio.idea.vinyl.label', idea: 'studio.idea.vinyl.text' },
  { label: 'studio.idea.fire.label', idea: 'studio.idea.fire.text' },
  { label: 'studio.idea.aurora.label', idea: 'studio.idea.aurora.text' },
];

/** The prompt with an idea written after its last line. */
export const promptWithIdea = (idea: string): string =>
  idea.trim() ? `${AI_PROMPT} ${idea.trim()}\n` : `${AI_PROMPT}\n`;

import { SCENE_CONTRACT_VERSION } from 'common/sceneUniformContract';
import type { TranslationKey } from 'common/i18n';

/**
 * What "Copy AI prompt" puts on the clipboard.
 *
 * Written for both kinds of AI a member has: an assistant opened in the
 * project's folder, which edits the files there and needs no copying back,
 * and a chat, which answers with the files for the member to save.
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
music plays.

If you can edit files, you are working in my FluidEQ project folder. It
already holds a working pack.json and scene.frag: rewrite both for my idea,
keep the file names, and save them there. FluidEQ plays every save at once,
and if it shows me a problem I will paste it to you; fix exactly that. If you
cannot edit files, reply with the complete contents of each file and nothing
else: first pack.json, then scene.frag. If my idea is about photos of mine,
write the scene for them (see ARTWORK) and tell me in one line to choose
them under "Pictures in the scene" in FluidEQ. Do not explain unless I ask.

FILES
  pack.json     metadata (format below)
  scene.frag    the shader body
  artwork.webp  optional: my photos, which FluidEQ puts together (see ARTWORK)

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
  I tune them in FluidEQ, which writes my values back as "value": when you
  rewrite pack.json, keep each existing param's "value" unless I ask.
- response (optional): how the scene answers the music, which I also tune in
  FluidEQ: { "sensitivity": 1, "threshold": 0.05, "attack": 40,
  "release": 300 }. sensitivity 0.25-4 scales what it hears; threshold 0-0.6
  silences everything below it; attack 0-1000 and release 0-3000 are the
  milliseconds a rise and a fall take. Set it only if the idea needs it (a
  scene that should rest through quiet parts, a slow glow), and keep an
  existing "response" unless I ask.
- With photos add: "artworkFile": "artwork.webp", "artworkWidth": W,
  "artworkHeight": H, and "pictures" naming each photo's place in it (see
  ARTWORK).

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
  sampler2D uArtwork   my photos, if pack.json names them. Origin at the
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

ARTWORK
A scene may use photos of mine: my pet, a place, a poster. They all live in
one image, artwork.webp, W x H pixels, each photo a named place in it:
  "pictures": [
    { "id": "pet", "names": { "en": "Your pet" },
      "x": 0, "y": 0, "width": 1280, "height": 1280 }
  ]
- x, y, width, height: pixels from the image's top-left corner, inside it.
  id: a-z, 0-9, - and _, starting with a letter. Up to 8 photos; one may
  cover the whole image. Name each for what I should put there, in every
  language you can.
- Optional per photo: "fit": "cover" (fill the place, cropping) or
  "contain" (the whole photo, clear margins), and "focus": [x, y], the point
  of the photo kept at the centre as fractions from its top-left - [0.5, 0.4]
  keeps a pet's face in view. I can reframe each photo in FluidEQ.
- I choose any photo for each place in FluidEQ, which crops it to fill the
  place, centred, and saves the image. You never make, lay out or split the
  image, and I will not paint masks. W at most 4096, W x H at most
  4096 x 2048. Size each place for its photo: 1280 x 1280 for a pet,
  1920 x 1080 for a landscape.
- In the shader, a place's own q (0..1, origin bottom-left) is at
    vec2 a = (vec2(x, H - y - height) + q * vec2(width, height)) / vec2(W, H);
  and its colour is texture(uArtwork, a).
Bring each photo alive from what is in it: find parts by brightness, colour,
edges (compare neighbouring samples) or distance from the centre, where the
subject usually is, and move, bend, light or tint them with the music - the
photo breathing with uBands.x, a glow along its edges on uBeat, colours
warming with uBands.y, particles in front with uBands.z. Keep each photo
recognisable: light and move parts of it, never wash it out.

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

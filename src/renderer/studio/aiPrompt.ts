import {
  MAX_MEMBER_LOOP_ITERATIONS,
  MAX_MEMBER_PIXEL_WORK,
} from 'common/memberSceneRules';
import {
  AMBIENT_AREAS,
  AMBIENT_FIELDS,
  AMBIENT_MUSIC,
  AMBIENT_SHAPES,
  MAX_AMBIENT_COLOURS,
  MAX_AMBIENT_COUNT,
  MAX_AMBIENT_ELEMENTS,
  MAX_AMBIENT_FRAME_EDGE,
  MAX_AMBIENT_FRAMES,
  MAX_AMBIENT_PARAMS,
  MAX_AMBIENT_PATH_LENGTH,
  MAX_AMBIENT_SIZE,
  MAX_AMBIENT_TOTAL,
  MIN_AMBIENT_FRAME_EDGE,
  MIN_AMBIENT_SIZE,
} from 'common/sceneAmbient';
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
already holds a working pack.json and scene.frag; read both first. If
scene.frag starts with "// My first FluidEQ scene", it is only FluidEQ's
starter: rewrite both for my idea. Otherwise the scene is mine: change what
my idea asks for and keep everything else as it is - its look, its sliders
and their values, its response and its photos. Keep the file names.

WORK IN PLACE. FluidEQ is showing this folder on my screen and plays every
save of scene.frag and pack.json the moment it lands, so I watch the scene
come together while you write it. These two files are the work itself, not
temporary files: write straight into them, here. Never draft in a temporary,
scratch or copied folder, never write new files to copy or rename over them
at the end, and never hold the work back until you are finished. Save a first
rough version of the whole idea early, then improve it in place, saving after
each meaningful step, and keep each save a whole scene where you can. A save
that does not compile does no harm: FluidEQ keeps playing the last version
that worked and shows me the problem. There is nothing to run or test outside
FluidEQ; its stage is the test.

If FluidEQ shows me a problem I will paste it to you; fix exactly that. If you
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
- version: raise it by one every time you change the scene. When you change a
  scene that already existed, also give me one line of at most 140
  characters saying what changed, as a listener would notice it ("the peaks
  no longer get cut on wide panels"): FluidEQ shows it as the version's
  "What's new" when I publish. If you reply with the files, put it after them.
- names: English required; add es, pt, fr, de, it, ru, zh, ja, hi if you can.
  At most 40 characters each.
- swatch: 2 to 4 colours that represent the scene.
- fallbackStyle: drawn when a computer cannot run the scene. Use one of: bars,
  line, area, dots, spikes, ridge, skyline, flames, bubbles, rain, starfield,
  canyon.
- params: the scene's own sliders, up to 8, which FluidEQ shows me by
  itself with the names you give them. Add one for each thing my idea is
  worth adjusting - its size, speed, density, glow, colour, how strongly a
  part answers the music - and none that do nothing. Each is
  { "id": "glow", "names": { "en": "Glow" }, "min": 0, "max": 1, "value": 0.5 }.
  id: a-z, 0-9 and _, starting with a letter, at most 24 characters (no
  dashes). min below max, value between them, names at most 40 characters.
  Each becomes "uniform float uParam_<id>;" automatically. Do not declare it,
  use every one, and keep the scene correct over each slider's whole range:
  no division by zero or vanished picture at either end.
  I tune them in FluidEQ, which writes my values back as "value": when you
  rewrite pack.json, keep each existing param's "value" unless I ask.
- response (optional): how the scene answers the music, which I also tune in
  FluidEQ: { "sensitivity": 1, "threshold": 0.05, "attack": 40,
  "release": 300 }. sensitivity 0.25-4 scales what it hears; threshold 0-0.6
  silences everything below it; attack 0-1000 and release 0-3000 are the
  milliseconds a rise and a fall take. Set it only if the idea needs it (a
  scene that should rest through quiet parts, a slow glow), and keep an
  existing "response" unless I ask.
- spectrumRange (optional, rare): [bottom, top] in uv, top - bottom at least
  0.2, for a scene whose spectrum must stay in one part of the picture, such
  as a sky. My wave height and position then move r inside that band instead
  of the whole panel, so leave it out unless the idea cannot work without.
- ambient (optional): the scene's elements around the app (see AMBIENT).
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
  vec4  uSpectrumRect  where my wave is drawn: .x = left and .y = right end
                       of the frequency axis, .z = the height of the quietest
                       level and .w = of the loudest, all in uv (see FIT THE
                       PANEL AND MY WAVE).
  sampler2D uArtwork   my photos, if pack.json names them. Origin at the
                       bottom-left, premultiplied RGBA. Do not use it otherwise.

FIT THE PANEL AND MY WAVE
- The panel can be any shape, from a narrow column to a wide strip, and
  changes while the scene plays. Scale by uResolution so circles stay round,
  and keep the main subject whole at every shape: never cut it at an edge.
- FluidEQ has two sliders for my wave, its height and its position, and I
  can turn it upside down; the scene gets them as uSpectrumRect (r below).
  Build the scene around that band so both sliders visibly change it: the
  main subject (whatever my idea is about: bars, a flower, a skyline, a
  creature, the brightest region) stands in the band, sized by
  abs(r.w - r.z) and centred on vec2(r.x + r.y, r.z + r.w) * 0.5. r.w below
  r.z means the wave hangs from the top. Even at 5% height the subject stays
  visible, only smaller. Clamp its position so the whole of it stays inside
  the panel. The background may still fill everything.
- A wave, a ribbon or a line is the subject too, not the background: keep it
  in the middle of the band at about half its height, over a background of
  its own, and let it fade out before the panel's sides. Stretched from the
  bottom of the panel to the top and from edge to edge, it hides the
  background and looks pulled out of shape.
- Anything drawn along the spectrum lines up with it: frequency f is at
  uv.x = mix(r.x, r.y, f), and a reading v (0..1) at uv.y = mix(r.z, r.w, v).

ANSWERING THE MUSIC
- Answer it in more than one way: let bass, mids and treble each move or
  light a different part, and let separate elements follow their own place
  in the spectrum.
- Real music is not flat. The bass reads high nearly all the time and the top
  octaves stay low, so read each region against its own usual range (subtract
  its floor, rescale) or bass parts never rest and treble parts never move.
- Big areas, and anything that changes brightness, follow uSpectrumSlow or
  uBands, never uSpectrum or uBeat directly, or they blink. Keep uBeat for
  small, quick accents and uMusicAccent.x for the rare big moment.
- Light that comes up with the music eases back down; nothing snaps from
  bright to dark in one frame.
- Give the scene a clear main colour, not grey: the colour covering most of
  the picture tints FluidEQ's window around it, and my desk lights take their
  colours from the scene.

RULES (FluidEQ refuses the scene otherwise)
- Loops: only for (int i = 0; i < N; i++) with N a number or a const int
  declared once in the file, at most ${MAX_MEMBER_LOOP_ITERATIONS} turns (counting down is fine too).
  Never change i inside the loop, not even through a function's out or inout
  parameter. No while, no do, no recursion.
- Loops inside loops multiply, and a function called in a loop costs all of
  its own loops on every turn: counting every turn and every call of your
  own functions, one pixel may do at most ${MAX_MEMBER_PIXEL_WORK}.
- Plain ASCII outside comments. At most 64 KB.
- In silence the scene must be calm: only slow drift from uTime. Every bright,
  fast or big movement must come from the music.
- Nothing flashes. No region bigger than a small detail may swing between
  bright and dark, or to and from saturated red, more than three times a
  second, and no pattern (stripes, checks, rings) may invert on the beat:
  flashing like that can cause seizures, and FluidEQ holds any region that
  does, which freezes and smears it on screen. Let a beat move something or
  light a small part; let big areas follow uSpectrumSlow.
- It runs for every pixel, every frame, on ordinary laptops, and FluidEQ
  lowers its resolution when it is slow, which blurs it. It may also fill a
  whole monitor as my desktop background, so it has to stay cheap at 4K. Keep
  loops short, never nest loops that sample textures or noise, skip work
  early for pixels it cannot touch, and prefer smooth maths to many layers.
  A frame so heavy that the graphics driver resets stops the scene wherever it
  was playing, every time it is played.

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

AMBIENT (optional, in pack.json)
The scene's own elements in the window around it, drawn faintly over the app
when I choose the Ambient mode: birds for a mountain scene, petals for a
flower, stars for a city. FluidEQ draws them from this description; none of it
is code. Add them when the idea has something that belongs around it:
  "ambient": {
    "elements": [
      { "id": "gulls", "shape": "bird", "colours": ["#dfe9ff"], "count": 6,
        "size": [14, 24], "opacity": 0.7, "motion": "fly", "speed": 0.35,
        "area": "top", "flap": 0.7, "turn": 0.3, "music": "mid", "react": 0.3 }
    ],
    "params": [
      { "id": "flock", "names": { "en": "Birds" }, "value": 0.6,
        "targets": [ { "element": "gulls", "field": "count", "min": 2, "max": 10 } ] }
    ]
  }
- elements: up to ${MAX_AMBIENT_ELEMENTS}. id: a-z, 0-9 and _, starting with a letter.
  shape: ${AMBIENT_SHAPES.join(', ')}. For path, add "path": an outline
  in a box from -1 to 1, only the commands M L H V C S Q T Z and numbers from
  -2 to 2, at most ${MAX_AMBIENT_PATH_LENGTH} characters.
  For picture, the element is drawn from artwork.webp itself - the scene's
  own bird, petal or lantern flying around the app. Add "frames": up to ${MAX_AMBIENT_FRAMES}
  places [x, y, width, height] in the artwork's pixels from its top-left
  (the same pixels as "pictures"), all one size, ${MIN_AMBIENT_FRAME_EDGE} to ${MAX_AMBIENT_FRAME_EDGE} pixels a side,
  inside the image. They play in order, one cycle per wingbeat or flutter
  (flap sets the pace), each blending into the next: the poses of one
  wingbeat, or one frame for a still picture. Optional "rest": the index of
  the pose it holds while gliding. "facing": "right" or "left" if the
  picture looks that way, so it turns to face where it flies; "none"
  otherwise. colours are not needed for it. Use places whose ground is
  transparent: FluidEQ fades every edge, but a photo still reads as a
  faint square. size is its longer side.
  motion: fly (crosses the window in arcs, wings beating), drift (rides one
  slow wind), wander (turns on a walk of its own), twinkle (stays put and
  breathes), fall, rise, sway (bobs where it stands).
  colours: 1 to ${MAX_AMBIENT_COLOURS} like #rrggbb, from the scene. count: 1 to ${MAX_AMBIENT_COUNT} each, ${MAX_AMBIENT_TOTAL}
  in all. size: [smallest, largest] in pixels, ${MIN_AMBIENT_SIZE} to ${MAX_AMBIENT_SIZE}. opacity, speed, flap (wing
  beat, flutter or twinkle), turn (how much each turns and differs) and react:
  0 to 1. area: ${AMBIENT_AREAS.join(', ')}. music: ${AMBIENT_MUSIC.join(', ')}.
- params: up to ${MAX_AMBIENT_PARAMS} sliders for these elements, which FluidEQ shows me.
  Each moves its targets - a field (${AMBIENT_FIELDS.join(', ')}) of an
  element - from its min to its max as the slider goes from 0 to 1. "value"
  is where it stands, 0 to 1; I tune it in FluidEQ, so keep it unless I ask.
- They are the background, never the point. FluidEQ keeps them faint and out
  of the scene's own panel; choose soft colours, modest counts and slow speeds
  so they read as the room the music is playing in.

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
  { label: 'studio.idea.sunset.label', idea: 'studio.idea.sunset.text' },
];

/** The prompt with an idea written after its last line. */
export const promptWithIdea = (idea: string): string =>
  idea.trim() ? `${AI_PROMPT} ${idea.trim()}\n` : `${AI_PROMPT}\n`;

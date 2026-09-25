import {
  MAX_MEMBER_LOOP_ITERATIONS,
  MAX_MEMBER_LOOPS,
  MAX_MEMBER_PIXEL_WORK,
} from 'common/memberSceneRules';
import { PREVIEW_FILE } from 'common/memberScenes';
import {
  SCENE_CONTRACT_VERSION,
  SCENE_TAP_AGE_LIMIT_S,
} from 'common/sceneUniformContract';
import { RUN_MAX_TURNS } from 'common/spectrumEnergy';
import { MAX_VERSION_NOTE } from 'common/sceneVersionNote';
import type { TranslationKey } from 'common/i18n';
import { AMBIENT_SECTION } from './aiPromptAmbient';
import { connectSection, type IPromptConnection } from './aiPromptConnect';
import { AIM_HIGH } from './aiPromptCraft';
import { HEAR_SECTION } from './aiPromptHear';
import { lookSection } from './aiPromptLook';
import { MOTION_SECTIONS } from './aiPromptMotion';

/**
 * What "Copy AI prompt" puts on the clipboard.
 *
 * Written for both kinds of AI a member has: an assistant opened in the
 * project's folder, which edits the files there and needs no copying back,
 * and a chat, which answers with the files for the member to save.
 *
 * It names the project's folder when there is one, because FluidEQ made that
 * folder and knows exactly where it is: an assistant told the path writes
 * into the folder FluidEQ is watching, and every save appears on the stage a
 * second later. Without it, the same assistant guesses — and a scene written
 * into a folder nothing is watching looks, from this side, like an AI that
 * did nothing at all.
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
 *
 * Six parts live beside it: the bar and the technique (`aiPromptCraft.ts`),
 * which is what turns a one-line idea into a piece instead of clip-art; the
 * music's time and the viewer's hands (`aiPromptMotion.ts`); the ambient
 * elements (`aiPromptAmbient.ts`); looking at what it made
 * (`aiPromptLook.ts`); hearing the song it is made for (`aiPromptHear.ts`);
 * and the connection that lets it look and hear, which a copy carries and
 * nothing saved ever does (`aiPromptConnect.ts`). It names the Studio's
 * look_at_scene and hear_the_music tools (`main/studioAgent/studioTools.ts`)
 * and the card's switch by their exact names, which change with them.
 */
const promptFor = (
  folder?: string,
  connection?: IPromptConnection,
) => `You are a senior real-time graphics artist, writing a visualizer for FluidEQ
Plus, a music app. The visualizer is a GLSL ES 3.00 fragment-shader body that
FluidEQ runs on the listener's GPU while music plays.

${
  folder
    ? `THE FOLDER TO WORK IN, which already exists:
  ${folder}
Every file named below is in it, and nothing you write belongs anywhere else.
Start by reading the pack.json and scene.frag that are already there.`
    : `If you can edit files, you are working in my FluidEQ project folder. It
already holds a working pack.json and scene.frag; read both first.`
} If
scene.frag starts with "// My first FluidEQ scene", it is only FluidEQ's
starter: rewrite both for my idea, as a new scene - an id and names of its
own, version 1, and no whatsNew line. Otherwise the scene is mine: change what
my idea asks for and keep everything else as it is - its look, its sliders
and their values, its response and its photos. Keep the file names.

WORK IN PLACE. FluidEQ is showing ${folder ? 'that folder' : 'this folder'} on my screen and plays every
save of scene.frag and pack.json the moment it lands, so I watch the scene
come together while you write it - each save is on screen in a second or two.
These two files are the work itself, not temporary files: write straight into
them, there. Never draft in a temporary, scratch or copied folder, never
write new files to copy or rename over them at the end, never keep copies or
backups of them anywhere else - not beside them, not in the folder above, not
in a temp folder - and never hold the work back until you are finished. I am
watching every save live in FluidEQ's Studio: a save made anywhere else is
one I never see, and a version worth keeping is kept in your own notes of
this conversation, not on my disk. Save a first rough version of the whole
idea early, then improve it in place, saving after each meaningful step, and
keep each save a whole scene where you can. A save that does not compile does
no harm: FluidEQ keeps playing the last version that worked and shows me the
problem. There is nothing to run or test outside FluidEQ; its stage is the
test.

${connection ? connectSection(connection, folder) : ''}${AIM_HIGH}${lookSection(
  connection !== undefined,
)}${connection ? HEAR_SECTION : ''}
If FluidEQ shows me a problem I will paste it to you; fix exactly that. If you
cannot edit files, reply with the complete contents of each file and nothing
else: first pack.json, then scene.frag. If my idea is about photos of mine,
write the scene for them (see ARTWORK) and tell me in one line to choose
them under "Pictures in the scene" in FluidEQ. Do not explain unless I ask.

FILES
  pack.json     metadata (format below)
  scene.frag    the shader body
  artwork.webp  optional: my photos, which FluidEQ puts together (see ARTWORK)
  ${PREVIEW_FILE}   FluidEQ writes this after each build: your scene, to look at

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
- contract: the version of WHAT THE SCENE RECEIVES the scene was written
  for. Write ${SCENE_CONTRACT_VERSION}; raise an older scene's to it when you give it anything
  new to ${SCENE_CONTRACT_VERSION} (uRhythm, uDrums, uSong, uStereo, uVoice, uPointer, uTap, uCamera). It
  refuses nothing: a scene written for an older one plays as it always did.
- version: raise it by one each time you hand me a changed scene - once for
  each request of mine, however many saves it took. Every time you change a
  scene that already existed, WRITE ME THE LINE THAT GOES WITH IT.
  One line, at most ${MAX_VERSION_NOTE} characters, saying what changed as a listener
  would notice it - "the peaks no longer get cut on wide panels", not "fixed
  the uv clamp". FluidEQ asks me for that line before it will publish an
  update, and by then I have forgotten what you changed; you have not.
  Put it in studio-notes.json beside the scene, as "whatsNew", and change
  NOTHING else in that file - it also holds my description and the prompt,
  and rewriting the whole file loses them. If the file is not there yet,
  make it with just that one key. FluidEQ fills the "What's new" box with
  it, for me to edit or replace. If you reply with the files instead of
  writing them, put the line after them.
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
  EVERY SLIDER HAS TO SHOW. Put it to its bottom, then to its top, and look at
  the two pictures: if I could not tell them apart across the room, the slider
  is wrong however honest the number behind it is. The usual mistake is
  wiring one to a quantity that is real but small - the width of a colour
  fringe, a coefficient inside a formula - so that the whole travel changes a
  pixel in a hundred. Wire it to what its name promises, over a range wide
  enough to reach both extremes of it: a Glow that goes from unlit to
  blazing, a Fire from silver to full spectrum, a Speed from nearly still to
  streaking, a Density from a handful to a crowd. The middle of the range is
  the scene as you would have made it anyway.
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
- camera (optional): how far the viewer may turn the scene and move in and
  out (see THE VIEWER'S HANDS). Leave it out and the scene cannot be turned.
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
  #version or main(), and never a # or a backslash anywhere outside a
  comment: use const instead of #define.
- The whole of GLSL ES 3.00 is yours besides: gl_FragCoord (the pixel's own
  position, for dithering), dFdx, dFdy and fwidth, textureLod and texelFetch,
  const arrays, structs, switch, break and continue, and integer maths.

WHAT THE SCENE RECEIVES (already declared; just use them)
  float uTime        seconds since the scene appeared; keeps running in
                     silence and wraps at 3600. Use it for slow ambient drift;
                     use periods that divide 3600 so nothing jumps.
  vec2  uResolution  the drawing size in pixels. Use it for aspect ratio and
                     for one-pixel line widths.
  float uLevel       overall loudness, 0..1, eased.
  float uBeat        1.0 at a detected beat, falling to 0 over 200 ms.
  vec3  uBands       x = bass (20-160 Hz), y = mids (160 Hz-2 kHz), z = treble
                     (2-16 kHz), each 0..1 and each already read against its
                     own recent range.
  sampler2D uSpectrum      frequency energy: texture(uSpectrum, vec2(f, 0.5)).r,
                           f = 0 is 20 Hz, f = 1 is 20 kHz, log-spaced; 0..1
                           spans the 40 dB under the song's own peak. Fast.
  sampler2D uSpectrumSlow  the same, eased (180 ms up, 420 ms down). Use for
                           light and glow that must not flicker.
  vec2  uMusicAccent x = envelope 0..1 of a rare, strong musical moment (at
                     least 7 s apart); y = its event number. Use y as a random
                     seed so each moment looks different (where lightning
                     strikes, which way a comet flies).
  vec2  uMusicRun    a flywheel the music winds. x = where it stands, in turns,
                     always inside one turn, so TAU * uMusicRun.x is an angle
                     that never jumps. y = how fast it is going, in turns a
                     second. Every kick and every loud passage winds it up, it
                     coasts down when they stop, and it is capped at ${RUN_MAX_TURNS}
                     turns a second - one turn in twelve seconds - so a cycle
                     that must come faster multiplies it: 24 turns is a step
                     about every half second at full speed. THIS IS THE
                     ONLY WAY TO BE CARRIED ALONG BY THE MUSIC: you are given
                     the music of one frame, so anything you build from uBeat
                     or uLevel yourself is a nudge that fades, never a chorus
                     that speeds the picture up and a quiet bar that lets it
                     settle. Multiply x by a WHOLE number of turns only, or it
                     jumps where the wheel wraps. Use y to answer your own
                     speed - softening or dimming what you flash as you run.
  sampler2D uWaveform  recent waveform envelope: texture(uWaveform, vec2(t, 0.5)).r
  vec3  uAccent      the app's theme colour, if you want to match it.
  vec4  uSpectrumRect  where my wave is drawn: .x = left and .y = right end
                       of the frequency axis, .z = the height of the quietest
                       level and .w = of the loudest, all in uv (see FIT THE
                       PANEL AND MY WAVE).
  sampler2D uArtwork   my photos, if pack.json names them. Origin at the
                       bottom-left, premultiplied RGBA. Do not use it otherwise.
  vec4  uRhythm      the music's time (see DANCING TO THE MUSIC): x = where in
                     the beat, 0 on a beat rising evenly to 1 where the next
                     is due; y = the same over a bar of four beats; z = the
                     tempo in beats a minute, 0 until one is heard; w = how
                     sure all three are, 0..1.
  vec3  uDrums       x = kick, y = snare and claps, z = hats and cymbals: each
                     1 on its hit, then halving every 40 to 70 ms.
  vec4  uSong        the song's shape: x = how intense this part is against
                     the rest of the song, 0..1; y = building towards
                     something, 0..1; z = a drop landing: 1, then halving
                     every 0.7 s, at least 8 s apart; w = how many so far.
  vec2  uStereo      x = where the music leans, -1 left to 1 right; y = how
                     wide it is, 0 for mono to 1.
  vec3  uVoice       the singer (see DANCING TO THE MUSIC): x = how open a
                     mouth is now, 0..1, syllable by syllable; y = the note,
                     0 at 80 Hz to 1 at 1 kHz, held between notes; z = how
                     sure it is that somebody is singing, 0..1.
  vec4  uPointer     the viewer's pointer (see THE VIEWER'S HANDS): xy where,
                     in uv; z held down, 0..1; w over the panel, 0..1.
  vec4  uTap         the last tap: xy where, in uv; z seconds since it, up to
                     ${SCENE_TAP_AGE_LIMIT_S}, and ${SCENE_TAP_AGE_LIMIT_S} before the first; w how many so far.
  vec3  uCamera      the viewer's camera, where pack.json lets them turn it:
                     x yaw and y pitch in radians, z zoom; (0, 0, 1) is your
                     own view, and always is when nobody has turned it.

FIT THE PANEL AND MY WAVE
- The panel can be any shape, from a narrow column to a wide strip, and
  changes while the scene plays. Scale by uResolution so circles stay round,
  and keep the main subject whole at every shape: never cut it at an edge.
- FluidEQ has two sliders for my wave, its height and its position, and I
  can turn it upside down; the scene gets them as uSpectrumRect (r below).
  Unless pack.json says otherwise the wave fills the panel - height 1,
  position 0, r = (0, 1, 0, 1) - and look_at_scene says what r came to for
  any wave you give it.
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
- In a 3D scene, fit the subject to the band with the lens (the 1.6 in the
  ray's forward term: larger is narrower) or by moving the subject, never by
  backing the camera away: a small band took one camera out of its own
  stage, and it showed the room from outside.

ANSWERING THE MUSIC
- Answer it in more than one way: let bass, mids and treble each move or
  light a different part, and let separate elements follow their own place
  in the spectrum.
- Real music is not flat. In uSpectrum the bass reads high nearly all the
  time and the top octaves stay low, so read each region against its own
  usual range (subtract its floor, rescale) or bass parts never rest and
  treble parts never move. uBands has done this already.
- Big areas, and anything that changes brightness, follow uSpectrumSlow or
  uBands, never uSpectrum or uBeat directly, or they blink. Keep uBeat for
  small, quick accents and uMusicAccent.x for the rare big moment.
- Light that comes up with the music eases back down; nothing snaps from
  bright to dark in one frame.
- Give the scene a clear main colour, not grey: the colour covering most of
  the picture tints FluidEQ's window around it, and my desk lights take their
  colours from the scene.

${MOTION_SECTIONS}RULES (FluidEQ refuses the scene otherwise)
- Loops: only for (int i = 0; i < N; i++) with N a number or a const int
  declared once in the file, at most ${MAX_MEMBER_LOOP_ITERATIONS} turns (counting down is fine too),
  and at most ${MAX_MEMBER_LOOPS} loops in the file. Never change i inside the loop, and never
  hand i itself to a function that has an out or inout parameter, even as
  one of its plain arguments: FluidEQ cannot tell which one it goes to, and
  refuses the scene. Pass float(i) or a copy (int k = i;) instead. No while,
  no do, no recursion, and never use while or do as a word outside comments,
  not even in a name.
- Loops inside loops multiply, and a function called in a loop costs all of
  its own loops on every turn: counting every turn, every call of your own
  functions, every texture read and every 32 operations, one pixel may do at
  most ${MAX_MEMBER_PIXEL_WORK}.
- Plain ASCII outside comments. At most 256 KB, which is far more than any
  scene needs: length is not what costs.
- In silence the scene must be calm: only slow drift from uTime. Every bright,
  fast or big movement must come from the music, or from the viewer's hand.
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
- READING A PICTURE IS THE EXPENSIVE PART, not arithmetic, and the budget
  above cannot tell them apart. Measured on an integrated laptop chip, both
  at the very limit that budget allows: a loop doing nothing but sums draws a
  1920x1080 frame in 0.27 seconds, while the same loop spending its budget on
  texture reads whose position comes from the read before it takes 3.74 - long
  enough to reset the driver. Reads at positions worked out before the loop
  runs are nearly free; a chain where each read waits on the last is not.
  Never feed one read's result into the next one's position inside a loop.

HOW TO KEEP IT QUICK TO BUILD
A scene has to be compiled on the machine that plays it - there is no way to
ship it ready-made, because a compiled shader belongs to one graphics card and
one driver version. FluidEQ builds it once, in the background, the moment
somebody adds it, and every play after that is instant. But a scene that takes
half a minute to build is half a minute of somebody's machine, and if they open
it before that is done they watch a still picture until it finishes. These are
measured on my own scenes, not guessed, and they matter far more than length:

- CALL AN EXPENSIVE FUNCTION ONCE. A driver compiles a FRESH COPY of a
  function's body at EVERY place it is called from. Drawing five boats by
  calling one boat function five times compiles five boats. Measured: five
  boat calls and two whale calls in one scene cost eleven seconds of building;
  calling each body once took the same scene to four and a half.
- So when several things share a drawing, first work out CHEAPLY which one
  this pixel belongs to - a few compares, no textures, no sprite work - and
  then call the expensive body once, with that one's index. A small function
  called from several places is fine; a big one is not.
- A loop whose bound is a plain number may be unrolled into that many copies
  of its body, which costs the same way. Keep a loop's BODY small; put the
  heavy work after the loop, once, on what the loop picked.
- Length itself is nearly free: the same scene at 51 KB and at 64 KB built in
  11.32 and 11.29 seconds. Do not contort the scene to be short. Do not split
  one body into many small ones either, if that means calling them from many
  places.
- Ask yourself, before you finish: which of my functions is the biggest, and
  how many places call it? If the answer is more than one, change it.

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
photo breathing on the beat (uRhythm), a glow along its edges on uBeat,
colours warming with uBands.y, particles in front glinting with uBands.z.
Keep each photo recognisable: light and move parts of it, never wash it out.

${AMBIENT_SECTION}
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

/**
 * The prompt with an idea written after its last line; with `connection`,
 * the one that goes to the clipboard, which connects the AI by itself.
 */
export const promptWithIdea = (
  idea: string,
  folder?: string,
  connection?: IPromptConnection,
): string => {
  const prompt = promptFor(folder, connection);
  return idea.trim() ? `${prompt} ${idea.trim()}\n` : `${prompt}\n`;
};

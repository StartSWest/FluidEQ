import { SCENE_DAYLIGHT_PARAM } from 'common/sceneDaylight';
import {
  WORLD_INSTANCE_SIGNALS,
  WORLD_LIMITS,
  WORLD_SIGNALS,
} from 'common/sceneWorld';
import { MAX_EXPRESSION_LENGTH } from 'common/worldExpression';

/**
 * The A 3D WORLD section of the Studio's AI prompt (`aiPrompt.ts`): a world
 * drawn by three.js in front of the scene's shader, which the Studio has
 * read from a project's files since worlds were given to members, and which
 * the brief never mentioned (Ivan, 2026-09-28: "update the studio prompt with
 * the latest capabilities"). Every bound in it is `WORLD_LIMITS`, every name
 * a formula may use is `WORLD_SIGNALS` and `WORLD_INSTANCE_SIGNALS`, and the
 * format is `docs/scene-worlds.md`'s: change it with them.
 *
 * The craft notes at its end were each learned on FluidEQ's own worlds: a
 * sky that ghosts the world's foreground, a field of points whose formulas
 * cost six of a frame's eight milliseconds, a camel in the moon's shadow
 * that read as a black blob, the music bolted on as bright new surfaces
 * where it belonged in the materials.
 */

const MB = 1024 * 1024;
const KB = 1024;

/**
 * Names laid out after `lead` in lines of the prompt's width, the lines
 * after the first under `indent`: the signals alone are forty names, and on
 * one line they ran past every other line of the brief.
 */
const wrapNames = (lead: string, names: readonly string[], indent: string) => {
  const lines: string[] = [];
  let line = lead;
  names.forEach((name, index) => {
    const word = `${name}${index < names.length - 1 ? ',' : ''}`;
    if (`${line} ${word}`.length > 76) {
      lines.push(line);
      line = `${indent}${word}`;
    } else {
      line = `${line} ${word}`;
    }
  });
  lines.push(line);
  return lines.join('\n');
};

export const WORLD_SECTION = `A 3D WORLD (optional)
A scene may add a real 3D world, drawn by FluidEQ's 3D engine (three.js) in
front of scene.frag, which becomes its sky. Reach for one when the idea is a
place with depth and solid things in it - a desert with an obelisk and a
caravan, a harbour at night, a street in the rain - lit by real lights,
casting shadows, with models that walk and a camera that travels. Keep to
scene.frag alone for flat, graphic, painterly or abstract ideas; they need
none of this.

scene.frag stays essential. It is the world's sky, and on a FluidEQ older
than worlds, or a computer that cannot build the world, it is the whole
scene: it must be worth watching alone - the sky, the far horizon, a small
far view of the place. But the sky cannot tell where the world stands in
front of it, and the world's fog shows the sky through every distant pixel:
never draw in scene.frag anything the world draws nearer (it shows through
as a ghost beside its 3D twin). Keep what is only in the sky where the world
never is - the far horizon, the heavens.

FILES. The world goes in world.json, named in pack.json as
"worldFile": "world.json". A material's own GLSL goes in files of its own,
named from the material as "fragmentFile": "sand.frag" and
"vertexFile": "sand.vert"; a model is a binary glTF in the folder, named in
"models" as { "file": "camel.glb" }. Everything else in the world is data.

world.json:
{
  "vars":   { "kick": "decay(beat, 0.3)", "orbit": "integrate(0.03 + level * 0.1) * tau" },
  "camera": { "fov": 45, "position": ["sin(orbit) * 30", 8, "cos(orbit) * 30"], "target": [0, 2, 0] },
  "backdrop": "shader",
  "fog": { "colour": "#0b0716", "near": 30, "far": 110, "toBackdrop": true },
  "environment": "studio", "environmentIntensity": 0.2,
  "toneMapping": "aces", "exposure": "1 + kick * 0.1",
  "bloom": { "strength": "0.4 + kick * 0.4", "radius": 0.7, "threshold": 1.2 },
  "vignette": 0.4,
  "materials": { "stone": { "kind": "standard", "colour": "#b5a084", "roughness": 0.9 } },
  "models": { "camel": { "file": "camel.glb" } },
  "nodes": [ ... ]
}
- backdrop: "shader" (scene.frag behind the world) or a colour. toBackdrop
  fog thins the distance into the sky instead of a flat colour.
- camera: fov in degrees, position, target and roll may be formulas; near
  and far are numbers. With a "camera" in pack.json the viewer's turn and
  zoom are applied after your formulas, about what the camera looks at.
- toneMapping "aces", "agx", "neutral" or "none"; environment "studio" (soft
  reflections) or "none".

FORMULAS. Any number may be a string that is a formula, worked out every
frame:
${wrapNames('- names:', WORLD_SIGNALS, '  ')};
  p.<id> for each of pack.json's params (p.${SCENE_DAYLIGHT_PARAM} among them); and your
  vars. For copies, points and ribbons also:
${wrapNames(' ', WORLD_INSTANCE_SIGNALS, '  ')}.
  They mean what the shader's uniforms mean: level and beat as uLevel and
  uBeat, bass mid treble as uBands, accent and accentId as uMusicAccent, run
  and runSpeed as uMusicRun, beatPhase barPhase tempo tempoSure as uRhythm,
  drumKick drumSnare drumHat as uDrums, songIntensity songBuild songDrop
  songDrops as uSong, and so on through the voice, the pointer, the tap and
  the view.
- functions: sin cos tan asin acos atan atan2 abs sign floor ceil round
  fract sqrt exp log pow min max clamp saturate mix step smoothstep mod hash
  noise; spec(u) (the spectrum now), slow(u) (eased) and wave(u); and three
  that remember: smooth(x, s) eases toward x with a half-life of s seconds,
  decay(x, s) jumps up to x and falls back with that half-life, and
  integrate(x) adds x up per second - a speed that follows the music without
  the position ever jumping: "integrate(0.1 + bass) * tau".
- operators + - * / % ^, comparisons (1 or 0), && || !, and a ? b : c;
  constants pi, tau, e. Each formula at most ${MAX_EXPRESSION_LENGTH} characters, 240 tokens
  and 40 levels deep. A division by nought reads 0; nothing ever breaks a
  frame.
- vars: at most ${WORLD_LIMITS.vars}, each may use those before it, and each is also
  uVar_<name> in the material GLSL. Never name one like a signal above
  ("drumKick" is taken; "kick" is yours). ${WORLD_LIMITS.vars} goes quickly in a busy world:
  inline what only one place uses.

NODES. Every node has position, rotation (radians), scale, visible (drawn
while above 0.5), castShadow, receiveShadow, children and an optional name.
- mesh: geometry and material.
- instances: many copies of one shape - geometry, material, layout, and
  "instance" with per-copy position (default [x, y, z]), rotation, scale and
  colour.
- points: soft glowing dots - layout, instance (position and colour only),
  size in world units, colour, opacity, additive.
- ribbon: a band facing the camera - segments, point (a formula of u),
  width, colour, material (glows unless you give one).
- terrain: ground raised by the spectrum, the recent past rolling toward
  the viewer - size, segments, height, rows, rate, mirror, valley, band,
  material.
- model: a placed glTF from "models", with clip (a name or a number) and
  speed for its animation.
- light: "light": { "kind": ambient | hemisphere | directional | point |
  spot, colour, intensity, distance, decay, angle, penumbra, target, shadow,
  groundColour }. Intensity is physical: a point light ten metres from what
  it lights wants hundreds. A directional or spot light aims at "target", a
  point in the space it is placed in. At most ${WORLD_LIMITS.lights} lights, ${WORLD_LIMITS.shadowLights} casting shadows.
- group: only a transform and children.
Geometry: box (size), sphere, icosahedron, octahedron, tetrahedron,
dodecahedron (radius, detail 0-6), torus (radius, tube), torusKnot (knot
[p, q]), cylinder (radius top, tube bottom, size[1] height), cone and capsule
(radius, size[1]), plane (size), ring (tube inner, radius outer); segments
[around, along], 1 to ${WORLD_LIMITS.geometrySegments}; "open" leaves a cylinder or cone without caps.
Layouts: grid (count per axis, spacing), ring (count, radius, arc, height),
spiral (turns, radius, height), line (from, to), scatter (box, seed),
sphere (radius).

MATERIALS. kind "standard" or "physical" (lit, shadows, reflections),
"basic" (unlit) or "glow" (light itself; colour times emissiveIntensity, and
past 1 is what the bloom picks up). colour, emissive, emissiveIntensity,
roughness, metalness, opacity, clearcoat, transmission and the rest may be
formulas; also transparent, flatShading, side, additive, fog, and map /
emissiveMap ([x, y, width, height] of the artwork). A "mirror" (0..1) makes
the first flat plane or ring wearing it reflect the world; a physical
material with transmission is glass. Both draw the world again, and the
budget below counts them.
A material's own GLSL, held to every rule scene.frag is (loops, ASCII, no #
line): a fragmentFile defines
  void worldSurface(inout vec4 colour, inout vec3 emissive, WorldSurface s)
  // s.uv, s.position (world), s.local (object), s.instance, s.tint
and a vertexFile defines
  vec3 worldDisplace(vec3 position, vec3 normal, WorldVertex v)
  // v.uv, v.instance = (u, rand, index, count); return the new position
Both see uTime, uLevel, uBeat, uBands, uAccent, uMusicAccent, uMusicRun,
uSpectrum, uSpectrumSlow, uWaveform, uRhythm, uDrums, uSong, uStereo,
uVoice, uPointer, uTap and uCamera, the params as uParam_<id> and the vars as
uVar_<name>. Use fwidth for lines that stay a pixel or two wide at any
distance. At most ${WORLD_LIMITS.hookBytes / KB} KB a file and ${WORLD_LIMITS.hookTotalBytes / KB} KB for all of them.

MODELS. A binary glTF 2 (.glb) carrying everything it needs, one scene:
triangles only; no file or URL named anywhere inside it; every accessor
inside its own bytes, none sparse; no compressed meshes or textures, no GPU
instancing, no lights of its own (the world's lights are the world's);
extensions only KHR_materials_*, KHR_texture_transform and
KHR_mesh_quantization; images PNG, JPEG or WebP, at most ${WORLD_LIMITS.modelImageSide} pixels a
side. At most ${WORLD_LIMITS.models} models, and between them ${WORLD_LIMITS.modelBytes / MB} MB and ${WORLD_LIMITS.modelTriangles.toLocaleString('en-US')}
triangles. FluidEQ says in the Studio, and look_at_scene says to you, which
model it could not read and why; the world plays without it. When no plain
geometry can be the subject - a creature, a vehicle, a figure - make the
model: build the mesh in a script of your own, kept outside this folder,
and write only the finished .glb here.

BOUNDS AND THE FRAME'S BUDGET. ${WORLD_LIMITS.nodes} nodes, ${WORLD_LIMITS.depth} deep; ${WORLD_LIMITS.instances.toLocaleString('en-US')} copies and
points in all; ${WORLD_LIMITS.materials} materials; ribbons of ${WORLD_LIMITS.ribbonSegments} segments; the pack at most
9 MB. Every frame may draw ${(WORLD_LIMITS.frameVertices / 1_000_000).toString()} million vertices across everything - the
world again for a mirror and again behind glass, a shadow caster again for
every pass of a light that shadows it (six for a point light), each placed
model the whole model again - and work out ${WORLD_LIMITS.frameFormulas.toLocaleString('en-US')} per-copy and
per-point formulas. Past a bound a part is left out, not the world.

WHAT A WORLD COSTS, AND HOW TO MAKE IT GOOD - learned on FluidEQ's own:
- Per-copy and per-point formulas are the cost, not the count. A field of
  6000 blowing grains, each worked out every frame, took six of a frame's
  eight milliseconds; the world without them, 1.6. Keep point sets small and
  near, give them a plain colour, or move their motion into a vertex file,
  where v.instance gives each copy its place and it costs next to nothing.
- A ribbon, a set of copies or points that is only sometimes there gets a
  "visible" formula: hidden, it does no work at all. Keep its formulas
  free of smooth, decay and integrate, which keep working while hidden.
- Something in the shadow of the main light reads as a black blob: give it
  light of its own - a lantern, a fire, a hemisphere light's glow from the
  sky and the ground.
- White dots in night air read as snow, whatever you meant by them.
- The music belongs IN the world's own materials and lights - glyphs whose
  inlay fills with gold, a campfire that leaps on the kick, ripples that
  swell with the bass, a crowd that sways on the bar - not as bright new
  surfaces bolted onto it. A meter strapped to a monument looks like a
  meter; the same monument breathing with the song looks like the place.
- Everything in DAY AND NIGHT holds for the world too: formulas read the time
  of day as p.${SCENE_DAYLIGHT_PARAM}, material GLSL as uParam_${SCENE_DAYLIGHT_PARAM}. Swing the main light
  from the moon to the sun (its direction, colour and strength), the
  hemisphere light's sky and ground colours, the fog's colour and the
  exposure; lamps, fires and glows soften by day rather than vanish.
- Look at it: look_at_scene draws the world exactly as FluidEQ plays it. A
  world that cannot be built plays its shader alone, and the tool tells you
  exactly why; so does the Studio, under the stage.

`;

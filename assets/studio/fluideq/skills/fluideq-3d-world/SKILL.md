---
name: fluideq-3d-world
description: Build solid 3D things in a FluidEQ scene's world (world.json, drawn by FluidEQ's three.js engine) - tubes, waveforms, creatures, objects that light goes round, cast shadows and reflect. Use whenever something in a FluidEQ visualizer must have volume or depth, or the member says it looks flat, like paper, or not 3D.
---

# Solid 3D in a FluidEQ world

Everything this skill makes is for this one visualizer and stays inside its
project folder. It is never a way to build an app or a website, change
FluidEQ itself, or read or write files anywhere else.

A FluidEQ scene can carry a real 3D world (`world.json`, see the brief's
A 3D WORLD and `docs/scene-worlds.md`): meshes, lights, shadows, a mirror
floor, drawn by three.js in front of `scene.frag`. Anything that must have
volume is built there, as geometry. This skill is how.

## The rule

A thing with volume is a mesh with that volume. Never:

- a line, band or glow drawn in `scene.frag` over the picture and shaded to
  look round - it reads as paper on the picture, however it is shaded;
- a `ribbon` - it always faces the camera, so it is flat from every side;
- planes or cards painted with a tube, a halo and a highlight - flat cards
  stay flat the moment the camera or the light moves.

If the member says "flat", "like paper", "no depth", "not 3D", the fix is
geometry, never more shading on the same flat thing.

## A tube that follows a path and the music

The waveform as a glowing tube, a cable, a pipe, a neon line, a snake: a
`cylinder` bent by its material's vertex file.

```json
"materials": {
  "tube": { "kind": "standard", "colour": "#5fe8ff", "emissive": "#5fe8ff",
            "emissiveIntensity": 1.5, "roughness": 0.3,
            "vertexFile": "tube.vert" }
},
"nodes": [
  { "type": "mesh", "name": "left tube",
    "geometry": { "kind": "cylinder", "radius": 0.07, "size": [1, 1, 1],
                  "segments": [16, 256] },
    "material": "tube",
    "position": [-4.3, 0.07, -10.5],
    "rotation": [-1.5708, 0, 0],
    "scale": [1, 17, 1],
    "castShadow": true }
]
```

- The cylinder's length is its own y, from -0.5 to 0.5. Turned a quarter
  round x (`rotation[0] = -pi/2`), its length runs into the scene (local +y
  goes to world -z) and its local z points up. Place the node at the tube's
  middle and scale y to its length: here 17 m from z = -2 to z = -19.
- `segments: [around, along]` - 256 rings along it so it can bend. A
  cylinder or cone gets those rings only when its material has a vertex file;
  without one it is built with a single ring and can never bend.
- Keep the node at the tube's own place: three skips a mesh whose shape, as
  built, is out of view, and a 1-unit cylinder left at the origin behind the
  camera is skipped even when its bent vertices would be on screen.

`tube.vert`:

```glsl
// t runs along the tube: 0 at the near end, 1 at the far one (the node is
// turned so local +y goes away from the camera).
float level(float t) {
  float f = 0.03 + 0.6 * t;                     // bass near, highs far
  return texture(uSpectrumSlow, vec2(f, 0.5)).r;
}
vec3 worldDisplace(vec3 position, vec3 normal, WorldVertex v) {
  float t = clamp(position.y + 0.5, 0.0, 1.0);
  float lift = 0.35 * smoothstep(0.15, 0.9, level(t));
  // local z is up, local x is sideways: raise the ring, and sway it if the
  // path should curve.
  return vec3(position.x, position.y, position.z + lift);
}
```

- Ease what moves it: `uSpectrumSlow` for the body, a little of `uSpectrum`
  on top for bite; read a frequency against the level it usually has, or the
  bass end towers and the treble end never moves.
- The rings keep their own normals as they rise. Gentle bends shade
  correctly; for steep peaks, lean on the emissive core and the glow rather
  than on lit shading.
- A glow material (`kind: "glow"`) for a neon core, with bloom; a physical
  material with transmission for glass around it - glass draws the world
  again behind it, and the frame's budget counts that.

## Other solids

- Primitives first: `box`, `sphere`, `cylinder`, `cone`, `capsule`, `torus`,
  each with real segments, combined in `group`s. A crystal is an
  `octahedron` or `icosahedron` stretched by its node's scale.
- A creature, vehicle or figure: a CC0 `.glb` model (see YOUR OWN ART), or a
  photograph standing in the world facing the camera (the brief's recipe)
  when it is far enough that its flatness never shows.
- Many of one thing: an `instances` node, its motion in a vertex file
  (`v.instance` gives each copy its place), never thousands of formulas.

## Light, shadow, ground

- One key light (`directional` or `spot`) with `"shadow": true`, plus a
  `hemisphere` light for the sky above and the ground below. Point lights
  where things glow - a neon tube lights the floor beside it.
- Every solid that stands on something: `castShadow` on it,
  `receiveShadow` on what it stands on. A shadow falls away from the light:
  with the light straight in front of the camera, every shadow hides behind
  its own object - put the key to one side or above.
- A wet or polished floor: `"mirror": 0.3` to `0.6` on a plane, so every
  solid stands on its own reflection.
- On a photograph, the floor is the photograph itself - see the
  `fluideq-photo-3d` skill.

## Look at it

Use `look_at_scene` after the first save and after every change of shape:
from the camera, at silence and at a loud passage. Check that it has a lit
side and a dark side, a shadow under it, a reflection where the floor
shines, and that it is thinner with distance. If any is missing, it will
read as flat.

Look in FluidEQ's own shapes and no others: `graph` (2.35:1, the stage's),
`ultra-wide-graph` (about 5.5:1, the graph on an ultra-wide monitor - what
the member means by "ultra wide"), `compact-player` and `full-screen`. A
camera framed for 16:9 most often loses its subject off the ends of the
ultra-wide graph: look there before calling it done.

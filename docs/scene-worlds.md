# 3D worlds in a scene pack

A scene pack may carry a `world` beside its shader. The world is drawn by the
3D engine (three.js) in front of the shader, which becomes its sky. A FluidEQ
older than worlds ignores the field and plays the shader alone, and so does
any machine that cannot build the world, so **the shader must still be a
scene worth watching on its own**.

Everything is data. Nothing in a world is code except the optional GLSL a
material may add, which is held to the same rules as the scene's shader.

The world is read forgivingly (`src/common/sceneWorldRead.ts`): a part this
version cannot use is dropped and the rest still plays. In the Studio, a world
with nothing left to draw is reported as a problem.

## Shape

```jsonc
"world": {
  "vars":   { "kick": "decay(beat, 0.3)", "orbit": "integrate(0.03 + level * 0.1) * tau" },
  "camera": { "fov": 45, "position": ["sin(orbit) * 30", 8, "cos(orbit) * 30"], "target": [0, 2, 0] },
  "backdrop": "shader",                     // or a colour, "#0a0612"
  "fog": { "colour": "#0b0716", "near": 30, "far": 110, "toBackdrop": true },
  "environment": "studio",                  // soft reflections; or "none"
  "environmentIntensity": 0.2,
  "toneMapping": "aces",                    // "agx", "neutral", "none"
  "exposure": "1 + kick * 0.1",
  "bloom": { "strength": "0.4 + kick * 0.4", "radius": 0.7, "threshold": 1.2 },
  "vignette": 0.4,
  "multisample": false,                     // a world of glows: see How it is drawn
  "materials": { "floor": { ... } },
  "models": { "ship": { "data": "<base64 .glb>" } },
  "nodes": [ ... ]
}
```

`toBackdrop` fog thins distant things into the shader's sky instead of
painting them a flat colour; with a colour for a backdrop there is no sky to
thin into, and the fog is its own colour.

The camera's `fov` (degrees), `position`, `target` and `roll` (radians) may
be formulas; `near` (0.001 to 100) and `far` are numbers.

`vars`: at most 32, each named with a letter and then letters, digits or `_`,
24 characters at most; each may use the ones before it.

## Formulas

Any number may instead be a formula in a string. Values:

| name                    | meaning                                               |
| ----------------------- | ----------------------------------------------------- |
| `time`, `dt`            | seconds, and seconds since the last frame             |
| `level`, `beat`         | loudness 0..1; 1 on a beat, falling                   |
| `bass`, `mid`, `treble` | the three bands, 0..1                                 |
| `accent`, `accentId`    | the rare big moment's envelope, and its number        |
| `run`, `runSpeed`       | the flywheel the music winds, in turns, and its speed |
| `aspect`                | width / height of the scene's panel (the graph)       |
| `p.<id>`                | a pack parameter                                      |
| any `vars` name         | a variable; each may use those before it              |

The music's time and shape, the listener's hands and the viewer's camera
(contract 8; the shader's `uRhythm`, `uDrums`, `uSong`, `uStereo`, `uVoice`,
`uPointer`, `uTap` and `uCamera`, which a material's GLSL sees too):

| name                                                 | meaning                                                                |
| ---------------------------------------------------- | ---------------------------------------------------------------------- |
| `beatPhase`, `barPhase`                              | 0 on a beat (the first of a bar), rising evenly to 1 at the next       |
| `tempo`, `tempoSure`                                 | beats a minute (0 until heard), and how sure, 0..1                     |
| `drumKick`, `drumSnare`, `drumHat`                   | each drum, 1 at its hit and falling away                               |
| `songIntensity`, `songBuild`                         | this part against the rest of the song; 0..1 while building            |
| `songDrop`, `songDrops`                              | 1 as a drop lands, falling; how many so far                            |
| `stereoPan`, `stereoWidth`                           | where the music leans, -1..1; how wide, 0..1                           |
| `voiceOpen`, `voiceNote`, `voiceSure`                | the singing voice: how open, the note (80 Hz..1 kHz as 0..1), how sure |
| `pointerX`, `pointerY`, `pointerHeld`, `pointerOver` | the pointer over the panel, in uv                                      |
| `tapX`, `tapY`, `tapAge`, `taps`                     | the last tap, seconds since, how many                                  |
| `viewYaw`, `viewPitch`, `viewZoom`                   | the viewer's turn of the camera                                        |

They are named with their group because a variable named like a signal is
dropped: `kick` stays yours.

A pack's `camera` (`src/common/sceneCamera.ts`) lets the viewer drag the
scene round: the world's camera is then turned about what it looks at, raised
to look down and moved in or out, after its own formulas, the way a shader is
told to read `uCamera`, so the world and its sky turn together. Allow only
what looks designed from every angle it reaches.

Per copy (instances, points, ribbons) also: `i`, `n`, `u` (0..1 along the
set), `rand`, `rand2`, `rand3` (repeatable per copy), `x`, `y`, `z` (the
layout's place) and `angle` (round the vertical axis).

Functions: `sin cos tan asin acos atan atan2 abs sign floor ceil round fract
sqrt exp log pow min max clamp saturate mix step smoothstep mod hash noise`,
the music `spec(u)` (spectrum now), `slow(u)` (eased spectrum) and `wave(u)`
(waveform), and three that remember:

- `smooth(x, s)` eases toward `x` with a half-life of `s` seconds;
- `decay(x, s)` jumps up to `x` and falls back with that half-life;
- `integrate(x)` adds up `x` per second — a speed that follows the music
  without the position jumping: `integrate(0.1 + bass) * tau`.

Operators: `+ - * / % ^`, comparisons (1 or 0), `&& || !`, and `a ? b : c`.
Constants `pi`, `tau`, `e`.

A formula is at most 400 characters, 240 tokens and 40 levels deep. A
division or `mod` by nought and nought to a negative power read 0, and so
does any result that is not a finite number; `smooth`, `decay` and
`integrate` keep only finite values, so one bad frame never sticks.

## Nodes

Every node has `position`, `rotation` (radians), `scale` (one number or
three), `visible` (shown when above 0.5), `castShadow`, `receiveShadow`,
`children`, and may have a `name` (64 characters, for its author; a
published scene does not keep it). Every position, size and distance is
held within ±10,000. Kinds:

- `mesh` — `geometry` and `material`.
- `instances` — many copies of a shape: `geometry`, `material`, `layout`, and
  `instance` with per-copy `position` (default `[x, y, z]`), `rotation`,
  `scale` and `colour`.
- `points` — a field of soft glowing dots: `layout`, `instance`, `size`
  (world units), `colour`, `opacity`, `additive`. A point has a place and a
  colour: its `instance.rotation` and `instance.scale` are not read.
- `ribbon` — a band through space facing the camera: `segments`, `point`
  (a formula of `u`), `width`, `colour`, `material` (glows by default).
- `terrain` — ground raised by the spectrum, the recent past rolling toward
  the viewer: `size`, `segments`, `height`, `rows`, `rate` (rows a second),
  `mirror`, `valley` (share of the width kept low in the middle), `band`
  (which part of the spectrum), `material`.
- `model` — a placed glTF from `models`, with `clip` (its name or number;
  the first when unsaid) and `speed` for its animation. See Models below.
- `light` — `light.kind` of `ambient`, `hemisphere`, `directional`, `point`
  or `spot`, with `colour`, `intensity` (physical units: a point light at ten
  metres wants hundreds), `distance`, `decay`, `angle`, `penumbra`, `target`,
  `shadow`, and a hemisphere light's `groundColour` (the colour from below).
  Only a directional, spot or point light casts a shadow. A directional or
  spot light aims at `target`, a point in the
  space the light is placed in — the world's, for a light at the top, so
  `[0, 0, 0]` is the middle of the world. To aim a moving light the way it
  faces, put it in a `group` that moves and give it a target in the group's
  own space.
- `group` — only its transform and children.

Geometry kinds: `box` (`size`), `sphere`, `icosahedron`, `octahedron`,
`tetrahedron`, `dodecahedron` (`radius`, `detail` 0 to 6), `torus`
(`radius`, `tube`), `torusKnot` (`knot` as `[p, q]`, 1 to 16 each),
`cylinder` (`radius` top, `tube` bottom, `size[1]` height), `cone` and
`capsule` (`radius`, `size[1]` height), `plane` (`size`), `ring` (`tube`
inner, `radius` outer). `segments` is `[around, along]` or one number for
both, 1 to 256; `open` leaves a cylinder or cone without its caps.

Layouts: `grid` (`count` per axis, `spacing`), `ring` (`count`, `radius`,
`arc`, `height`), `spiral` (`turns`, `radius`, `height`), `line` (`from`,
`to`), `scatter` (`box`, `seed`), `sphere` (`radius`).

## Materials

`kind`: `standard` or `physical` (lit, with shadows and reflections), `basic`
(unlit) or `glow` (light itself: its colour times `emissiveIntensity`, past 1
is what the bloom picks up). Numbers may be formulas: `colour`, `emissive`,
`emissiveIntensity`, `roughness`, `metalness`, `opacity`, `clearcoat`,
`clearcoatRoughness`, `transmission`, `thickness`, `iridescence`, `sheen`.
Also `ior`, `transparent`, `wireframe`, `flatShading`, `side`, `additive`,
`fog`, `map` / `emissiveMap` (`[x, y, width, height]` of the pack's artwork)
and `repeat` (`[u, v]`, how many times the map tiles). A `physical` material
with `transmission` is glass: three draws the world's solid things a second
time behind it, which the frame's budget counts.

`mirror` (0..1, may be a formula) makes a flat floor reflect the world, and
`mirrorBlur` (0..1) softens the reflection. The first `plane` or `ring` mesh
wearing a mirror is the floor, and only it reflects: anything else wearing
the same material is drawn without the reflection.

Colours: `"#rrggbb"`, `{ "hsl": [h, s, l] }` or `{ "rgb": [r, g, b] }`, each
channel a formula (hue 0..1 wraps).

### A material's own GLSL

`vertex` defines where a vertex goes, in the object's own space:

```glsl
vec3 worldDisplace(vec3 position, vec3 normal, WorldVertex v) {
  // v.uv, v.instance = (u, rand, index, count)
  return position + normal * texture(uSpectrumSlow, vec2(v.uv.x, 0.5)).r;
}
```

`fragment` colours a surface and gives it light of its own:

```glsl
void worldSurface(inout vec4 colour, inout vec3 emissive, WorldSurface s) {
  // s.uv, s.position (world), s.local (object), s.instance, s.tint (copy colour)
  emissive += s.tint * smoothstep(0.45, 0.5, s.local.y) * 4.0;
}
```

Both see the shader contract's uniforms (`uTime`, `uLevel`, `uBeat`,
`uBands`, `uAccent`, `uMusicAccent`, `uMusicRun`, `uSpectrum`,
`uSpectrumSlow`, `uWaveform`, and the pack's artwork `uArtwork`), the
pack's `uParam_<id>` and the world's variables as `uVar_<name>`.

A `map` repeats the artwork only when its region is the whole picture, so
a world with several tiling textures in one atlas tiles them itself from
`uArtwork`: bottom-left origin, premultiplied, and in sRGB, so a colour
read from it is taken to light before it is used. Sample with
`textureGrad` and the derivatives of the unwrapped coordinate, or every
tile's edge shows as a seam where the mip level jumps:

```glsl
vec3 bark(vec2 at) {
  // The bark tile's place in the atlas: x, y, width, height, in 0..1.
  vec4 tile = vec4(0.0, 0.5, 0.5, 0.5);
  vec2 inTile = tile.xy + fract(at) * tile.zw;
  vec3 srgb = textureGrad(uArtwork, inTile, dFdx(at) * tile.zw, dFdy(at) * tile.zw).rgb;
  return pow(srgb, vec3(2.2));
}
```

Leave each tile a gutter of its own wrapped pixels in the picture, so a
distant mip level never mixes two textures.

In a Studio project, write them in their own
files and name them from `pack.json` as `vertexFile` / `fragmentFile`; a
model is `{ "file": "ship.glb" }`. A world too big for `pack.json` (64 KB)
goes in a file of its own, named as `"worldFile": "world.json"` in place of
`"world"`; the names inside it are read from the same folder. A scene opened
in the Studio from a file or from FluidEQ's own is written out that way, in
the reader's own words: variables as a list of `{ "name", "value" }`,
colours as `{ "hex" }`, counts as three numbers and every default written
in. It reads back as the same world; it is the same world said in full.

A piece may not carry a `#version` line (with or without space after the
`#`): three writes its own, and a second one fails the whole material.

Use `fwidth` for lines that stay a pixel or two wide at every distance:

```glsl
vec2 at = s.position.xz / 4.0;
vec2 cell = abs(fract(at - 0.5) - 0.5) / max(fwidth(at), vec2(1e-4));
float line = 1.0 - clamp(min(cell.x, cell.y) - 0.5, 0.0, 1.0);
```

## Models

A model is a binary glTF (`.glb`) carrying everything it needs, read from its
own table of contents before anything parses it
(`src/common/worldModelCheck.ts`) — in the Studio, by the engine and on the
server alike. It must be glTF 2 with exactly one scene; one JSON chunk and at
most one binary chunk, filling the file exactly; nothing anywhere naming a
file or a URL; every buffer view and accessor inside the bytes it carries
(no sparse accessors); triangles, strips or fans, not points or lines; a
node tree with no loops, no node under two parents, and the scene's roots
nobody's children (three would build such a root under its parent and clone
it into the scene as well); and extensions only from those that need nothing
loaded: the `KHR_materials_*` family three reads, `KHR_texture_transform`
and `KHR_mesh_quantization`. No compressed meshes or textures (their
decoders are files fetched from somewhere), no GPU instancing and no lights
of its own — the world's lights are the world's. Images are PNG, JPEG or
WebP, each at most 4096 pixels a side, measured from its own header.

Each place a model is put is the whole model again in the frame's budget,
its clip played again too: its shaded vertices (each morph target counting
them again), or half its triangles where those are more — the two triangles
a vertex every grid three builds draws.

## Bounds

512 nodes, 8 deep; 60,000 copies and points in all; 64 materials; 16 lights,
2 casting shadows; ribbons of up to 2048 segments, geometry of up to 256,
terrain up to 256 by 256 with 256 rows. Models: 16, and between them 6 MB,
500,000 triangles and 16 million pixels of pictures; each at most 1024
nodes, 8 morph targets a mesh and 1024 channels in a clip. 32 KB per GLSL
piece and 256 KB for all of a world's GLSL together; material and model ids
distinct however they are capitalised; the pack as a whole at most 9 MB.

And a frame's budget (`src/common/sceneWorldCost.ts`): 2 million vertices
across every mesh, copy, point, ribbon, terrain and model placement — the
world counted again for a mirror and again behind glass, and each shadow
caster once more for every pass of a light that shadows it (six for a point
light); 100,000 per-copy and per-point formulas worked out a frame, a
colour counting all three channels when one of them follows the music;
1 million slots kept by `smooth`, `decay` and `integrate`. A point is one
vertex and a low-poly copy a dozen, so a field of dust wants `points`, not
spheres.

Past a bound, a part is left out, not the world — and past the budget with
its shadows counted, the last shadow casters stop casting before anything is
left out. Two bounds are the whole scene's, not a part's: a pack over 9 MB
cannot travel, and in the Studio a file too large, a model that is not one
FluidEQ reads, models too heavy together or a pack too large stop the build
and say which.

## How it is drawn

The world renders into targets of its own — four times multisampled, in
half-float light — then the glow, then one pass that tone maps it and lays it
over the shader's sky into whatever the app bound: so the brightness limiter,
FSR, supersampling and FXAA treat a world exactly as they treat a shader.
The engine is its own file, loaded only when a world is shown.

The multisampling is for the edges of solid things. A world made only of
glows and soft sprites - a galaxy of stars, a nebula, an explosion - has no
hard edge to smooth, and multisampling still writes every sample of every
glow: on an Intel UHD at 1080p Galaxy's world took 16 ms with it and 1.1
without, for the same picture to within a few levels at the rim of a star.
Such a world says `"multisample": false`. A FluidEQ older than the field
multisamples it as before.

A world that cannot be built plays its shader, and the Studio says why under
the stage — and tells the Studio's AI the same through `look_at_scene`; a
model left out is named there too, and the world still plays. A picture of
a world (a gallery card, a Publish cover, the Studio's preview) renders it
in strips, each finished before the next, so no single job holds the GPU.

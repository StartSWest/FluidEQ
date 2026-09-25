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
  "materials": { "floor": { ... } },
  "models": { "ship": { "data": "<base64 .glb>" } },
  "nodes": [ ... ]
}
```

`toBackdrop` fog thins distant things into the shader's sky instead of
painting them a flat colour.

## Formulas

Any number may instead be a formula in a string. Values:

| name                    | meaning                                               |
| ----------------------- | ----------------------------------------------------- |
| `time`, `dt`            | seconds, and seconds since the last frame             |
| `level`, `beat`         | loudness 0..1; 1 on a beat, falling                   |
| `bass`, `mid`, `treble` | the three bands, 0..1                                 |
| `accent`, `accentId`    | the rare big moment's envelope, and its number        |
| `run`, `runSpeed`       | the flywheel the music winds, in turns, and its speed |
| `aspect`                | width / height of the picture                         |
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

## Nodes

Every node has `position`, `rotation` (radians), `scale` (one number or
three), `visible` (shown when above 0.5), `castShadow`, `receiveShadow` and
`children`. Kinds:

- `mesh` — `geometry` and `material`.
- `instances` — many copies of a shape: `geometry`, `material`, `layout`, and
  `instance` with per-copy `position` (default `[x, y, z]`), `rotation`,
  `scale` and `colour`.
- `points` — a field of soft glowing dots: `layout`, `instance`, `size`
  (world units), `colour`, `opacity`, `additive`.
- `ribbon` — a band through space facing the camera: `segments`, `point`
  (a formula of `u`), `width`, `colour`, `material` (glows by default).
- `terrain` — ground raised by the spectrum, the recent past rolling toward
  the viewer: `size`, `segments`, `height`, `rows`, `rate` (rows a second),
  `mirror`, `valley` (share of the width kept low in the middle), `band`
  (which part of the spectrum), `material`.
- `model` — a placed glTF from `models`, with `clip` and `speed` for its
  animation. Models must be binary `.glb` with everything embedded.
- `light` — `light.kind` of `ambient`, `hemisphere`, `directional`, `point`
  or `spot`, with `colour`, `intensity` (physical units: a point light at ten
  metres wants hundreds), `distance`, `decay`, `angle`, `penumbra`, `target`,
  `shadow`. A directional or spot light aims at `target`, a point in the
  space the light is placed in — the world's, for a light at the top, so
  `[0, 0, 0]` is the middle of the world. To aim a moving light the way it
  faces, put it in a `group` that moves and give it a target in the group's
  own space.
- `group` — only its transform and children.

Geometry kinds: `box` (`size`), `sphere`, `icosahedron`, `octahedron`,
`tetrahedron`, `dodecahedron` (`radius`, `detail`), `torus` (`radius`,
`tube`), `torusKnot`, `cylinder` (`radius` top, `tube` bottom, `size[1]`
height), `cone`, `plane` (`size`), `ring` (`tube` inner, `radius` outer),
`capsule`.

Layouts: `grid` (`count` per axis, `spacing`), `ring` (`count`, `radius`,
`arc`, `height`), `spiral` (`turns`, `height`), `line` (`from`, `to`),
`scatter` (`box`, `seed`), `sphere` (`radius`).

## Materials

`kind`: `standard` or `physical` (lit, with shadows and reflections), `basic`
(unlit) or `glow` (light itself: its colour times `emissiveIntensity`, past 1
is what the bloom picks up). Numbers may be formulas: `colour`, `emissive`,
`emissiveIntensity`, `roughness`, `metalness`, `opacity`, `clearcoat`,
`clearcoatRoughness`, `transmission`, `thickness`, `iridescence`, `sheen`.
Also `ior`, `transparent`, `wireframe`, `flatShading`, `side`, `additive`,
`fog`, `map` / `emissiveMap` (`[x, y, width, height]` of the pack's artwork).

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
`uSpectrumSlow`, `uWaveform`), the pack's `uParam_<id>` and the world's
variables as `uVar_<name>`. In a Studio project, write them in their own
files and name them from `pack.json` as `vertexFile` / `fragmentFile`; a
model is `{ "file": "ship.glb" }`. A world too big for `pack.json` (64 KB)
goes in a file of its own, named as `"worldFile": "world.json"` in place of
`"world"`; the names inside it are read from the same folder. A scene opened
in the Studio from a file or from FluidEQ's own is written out that way.

Use `fwidth` for lines that stay a pixel or two wide at every distance:

```glsl
vec2 at = s.position.xz / 4.0;
vec2 cell = abs(fract(at - 0.5) - 0.5) / max(fwidth(at), vec2(1e-4));
float line = 1.0 - clamp(min(cell.x, cell.y) - 0.5, 0.0, 1.0);
```

## Bounds

512 nodes, 8 deep; 60,000 copies and points in all; 64 materials; 16 lights,
2 casting shadows; 16 models, 8 MB and 500,000 triangles between them; 32 KB
per GLSL piece and 256 KB for all of a world's GLSL together; material and
model ids distinct however they are capitalised; the pack as a whole at most
9 MB. And a frame's budget (`src/common/sceneWorldCost.ts`): 2 million
vertices across every mesh, copy, point, ribbon and terrain, a mirrored world
counted twice; 100,000 per-copy and per-point formulas worked out a frame;
1 million slots kept by `smooth`, `decay` and `integrate`. A point is one
vertex and a low-poly copy a dozen, so a field of dust wants `points`, not
spheres. Past a bound, a part is left out, not the world.

## How it is drawn

The world renders into targets of its own — four times multisampled, in
half-float light — then the glow, then one pass that tone maps it and lays it
over the shader's sky into whatever the app bound: so the brightness limiter,
FSR, supersampling and FXAA treat a world exactly as they treat a shader.
The engine is its own file, loaded only when a world is shown.

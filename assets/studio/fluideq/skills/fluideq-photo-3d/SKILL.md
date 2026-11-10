---
name: fluideq-photo-3d
description: Set real 3D things into a photograph in a FluidEQ scene, the way film set extensions and game skies are made - match the world camera to the photo, give the photo's floor shadows and reflections, keep the seams invisible. Use whenever a FluidEQ scene has a photograph (or a made picture) as its background and anything 3D must stand in it, touch its ground or move through it.
---

# A photograph and a 3D world, together

Everything this skill makes is for this one visualizer and stays inside its
project folder. It is never a way to build an app or a website, change
FluidEQ itself, or read or write files anywhere else.

Films and games make realistic places this way: a picture for what is far
or does not move (a matte painting, a sky), real 3D for what is near, has
volume or moves - built to match the picture so the two read as one place.
In FluidEQ the picture is the sky (`scene.frag`) and the 3D is the world
(`world.json`). Build the 3D itself with the `fluideq-3d-world` skill; this
one is how to set it into the photo.

Everything below was measured in FluidEQ's own engine on a photographed
ice cave: done this way, the floor matched the photograph pixel for pixel
and still caught a box's shadow and the tubes' reflections.

## 1. Decide what is picture and what is 3D

- Picture: the far distance, walls and rock the camera never sees around,
  the sky. Painted once, perfect, free.
- 3D: what the music moves, what has volume, what must cast a shadow or be
  reflected - the waveform tube, a crystal, an animal close by.
- Never paint a solid as a line or a glow in `scene.frag` over the photo.

## 2. The photo as the sky, filling the panel by its height

```glsl
const vec4 PHOTO = vec4(x, y, w, h);      // its region in the artwork, from the bottom-left
const float PIC = 1920.0 / 1080.0;        // the photo's own width over height
vec4 sceneColour(vec2 uv) {
  float aspect = uResolution.x / max(uResolution.y, 1.0);
  vec2 q = vec2(0.5 + (uv.x - 0.5) * aspect / PIC, uv.y);
  vec4 t = texture(uArtwork, PHOTO.xy + clamp(q, 0.0, 1.0) * PHOTO.zw);
  return vec4(t.rgb / max(t.a, 1e-3), 1.0);
}
```

Height-fit and centred: the photo's vertical extent is exactly the world
camera's field of view, at every panel shape. Everything below depends on
this mapping; never crop the photo vertically or zoom it in `scene.frag`.
(Past its left and right edges, extend it - mirror or darken - for panels
wider than the photo.)

## 3. Match the world camera to the photo

1. Find the vanishing point: where the floor's parallel edges (a corridor's
   sides, a road's lines, a cave floor's edges) meet. Its height from the
   bottom of the photo, `vp` (0..1), is the horizon.
2. Field of view: `fov` is the photo's vertical angle. 50 degrees is a good
   start for an ordinary photograph; a wide-angle one is 60 to 70.
3. Tilt: the camera looks UP when the horizon is BELOW the middle.
   `tan(tilt) = (0.5 - vp) * 2 * tan(fov / 2)`; aim the camera from
   `eye = (0, h, 0)` at `(0, h + 10 * tan(tilt), -10)`.
4. Height and sizes: with the eye at a person's height (`h = 1.6`), a floor
   edge whose image falls `s` pixels for every pixel sideways from the
   vanishing point is `h / s` metres to the side. Work in real metres.
5. Put a grey test box on the floor and look: it must sit on the photo's
   floor, not float or sink, and shrink toward the horizon exactly as the
   photo's own things do. Fix the camera before building anything else.

The viewer can turn the camera (`camera` in pack.json): with a photo
behind, keep that turn small or leave it out - a photograph has no other
side.

## 4. A floor that catches shadows and reflections

The ground the 3D stands on is a plane laid exactly on the photo's floor,
painted with the photograph itself, projected from where the camera rests.
Where nothing shades it, it is the photo, so it disappears; where a 3D
thing stands, it darkens with its shadow and shows its reflection.

```json
"toneMapping": "none",
"materials": {
  "floor": { "kind": "physical", "ior": 1, "specularIntensity": 0,
             "roughness": 1, "metalness": 0, "fog": false,
             "mirror": 0.5, "mirrorBlur": 0.15,
             "fragmentFile": "floor.frag" }
},
"nodes": [
  { "type": "light", "position": [-9, 7, -4],
    "light": { "kind": "directional", "intensity": 5.29,
               "target": [0, 0, -7], "shadow": true } },
  { "type": "mesh", "name": "photo floor",
    "geometry": { "kind": "plane", "size": [40, 60, 1] },
    "material": "floor", "position": [0, 0, -20],
    "rotation": [-1.5708, 0, 0], "receiveShadow": true }
]
```

`floor.frag` - the same constants as the camera in world.json:

```glsl
const vec4 PHOTO = vec4(x, y, w, h);
const float PIC = 1920.0 / 1080.0;
const vec3 EYE = vec3(0.0, 1.6, 0.0);       // the camera's position
const vec3 AIM = vec3(0.0, 2.328, -10.0);   // what it looks at
const float FOV = 50.0;                     // its fov
const float SHADOW = 0.65;                  // how dark a full shadow is, 0..1

vec3 decodeSrgb(vec3 c) {
  return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(0.04045, c));
}
vec3 photoAt(vec3 p) {
  vec3 f = normalize(AIM - EYE);
  vec3 r = normalize(cross(f, vec3(0.0, 1.0, 0.0)));
  vec3 u = cross(r, f);
  vec3 d = p - EYE;
  vec2 q = vec2(dot(d, r), dot(d, u)) / (max(dot(d, f), 1e-3) * tan(radians(FOV) * 0.5));
  vec2 uv = vec2(0.5 + 0.5 * q.x / PIC, 0.5 + 0.5 * q.y);
  vec4 t = texture(uArtwork, PHOTO.xy + clamp(uv, 0.0, 1.0) * PHOTO.zw);
  return decodeSrgb(t.rgb / max(t.a, 1e-3));
}
void worldSurface(inout vec4 colour, inout vec3 emissive, WorldSurface s) {
  vec3 photo = photoAt(s.position);
  colour.rgb = photo * SHADOW;          // the part the key light lights
  emissive = photo * (1.0 - SHADOW);    // the part that stays in shadow
}
```

What each part is for - all of them are needed:

- `specularIntensity: 0` and `ior: 1`: the floor reflects no light of its
  own. Without them the key light's grazing glare lifted a night floor's
  blacks from 2 to 25 of 255, and the floor showed as a grey slab.
- `toneMapping: "none"`: the world's colours pass as they are, so the floor
  meets the photo around it. A tone curve changes only the world's pixels.
- `fog: false` on the floor: fog would tint the photo it already is.
- The key light's intensity is `pi / cos(a)`, `a` the angle between the
  light's direction and straight up: then the lit part comes back as exactly
  `photo * SHADOW`, and with the emissive part the unshadowed floor is the
  photo. Here `(-9, 7, -4)` to `(0, 0, -7)`: `cos(a) = 7 / 11.83`, so 5.29.
- Exact sRGB decoding, not `pow(c, 2.2)`: the composite decodes the sky the
  same way, and the dark end of a night photo shows the difference.
- `mirror`: the floor reflects the world - every tube and object stands on
  its own reflection. The photo's own reflections are already in it.

Shape the floor to the photo's floor: where the plane runs under the
photo's walls it is still invisible (it shows the walls), but shadows and
reflections would land there too - keep the 3D off it, or fade `SHADOW`
and the mirror to nothing outside the floor.

## 5. Light the 3D as the photo is lit

- The key comes from where the photo's light comes from - its shadows
  point away from it - in its colour: warm sun, cold moon, orange lamp.
- A `hemisphere` light with the photo's sky colour above and its floor's
  colour below fills the shadow side of every 3D thing.
- A light straight in front of the camera hides every shadow behind its
  own object; from the side or above, the shadows show.
- What glows in the 3D lights the photo's floor: a point light at a neon
  tube, colour of the tube.

## 6. Make the two read as one picture

- Darks: a 3D thing's darkest dark is no darker than the photo's darks at
  that distance; its brightest no brighter than the photo's highlights,
  except what emits light.
- Distance: the world's `fog` in the colour of the photo's far haze, so
  3D things fade with distance as the photo's do (never on the floor).
- Edges: keep solid edges smoothed (multisampling on) and nothing sharper
  than the photo: a razor-sharp 3D edge on a soft photo looks pasted on.
- Glow: bloom only on what emits light - the photo has no bloom of its own.
- Something in the photo that stands in front of the 3D (a pillar, a rock):
  give it a simple mesh in the same place painted with the same projection
  (all emissive): it hides the 3D behind it and still looks like the photo.

## 7. Look

`look_at_scene` at rest: the floor's outline must be invisible, the test
box must stand on the floor, shadows must fall away from the photo's light.
Check the seam at silence and at a loud passage, in the `graph` and
`ultra-wide-graph` shapes (2.35:1 and about 5.5:1 - "ultra wide" means that
one) and in `compact-player`: those, with `full-screen`, are the only shapes
FluidEQ shows a scene in. Then take the test box out.

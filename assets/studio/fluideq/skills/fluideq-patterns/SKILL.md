---
name: fluideq-patterns
description: Short worked patterns for the moves a good FluidEQ scene is built from - the song's five states, a move on the beat clock, a build and its drop, a night-to-day swing, a pointer and tap response, and a 3D-world light on the bass - each a few lines to adapt, never to paste whole. Load before you write a new scene's answer to the music, when watch_the_song says the drop does not show or nothing answers the music, and whenever the member says "dance", "on the beat", "the drop", "build up", "react more", "more alive", "day and night", "follow my mouse" or "lights with the bass".
---

# Patterns a FluidEQ scene is built from

Six small pieces, each one move done right. They are written for this skill,
in the shape FluidEQ's own scenes use; none is a scene. Take the idea and the
arithmetic, rename everything for the scene in hand, and change the numbers
until `watch_scene` and `watch_the_song` say it reads. Every helper is plain
GLSL ES 3.00 that goes above `sceneColour`, and uses only what the scene is
already handed.

## 1. The song's five states

Decide the picture in silence, in a verse, through a build, at the drop and
after it before any signal is wired. Then read the five as numbers once, at
the top of `sceneColour`, and let everything else be built from them.

```glsl
// x: 1 while nothing plays; y: how big this part of the song is; z: the
// build; w: the drop, 1 as it lands.
vec4 songState() {
  float rest = 1.0 - smoothstep(0.02, 0.12, uLevel);
  return vec4(rest, uSong.x * (1.0 - rest), uSong.y, uSong.z);
}
```

- Silence (`x`): the scene settles to its idle - slow drift on `uTime`,
  lights low. It never freezes and never keeps dancing.
- Verse to chorus (`y`): scale the whole performance by it - how far things
  move, how many lights are on, how wide the camera sits.
- Build (`z`) and drop (`w`): pattern 3.

## 2. A move on the beat clock

A step that is on its way down before the kick and lands on it, and comes to
rest when there is no beat to dance to.

```glsl
// How high a body stands, 0 to 1: lowest exactly on the beat, eased both
// ways so it is at rest there; a slow breath when no beat is sure.
float beatLift() {
  float sure = smoothstep(0.25, 0.65, uRhythm.w);
  float bob = 0.5 - 0.5 * cos(6.2832 * uRhythm.x);
  float breath = 0.5 + 0.5 * sin(6.2832 * uTime / 6.0);
  return mix(0.2 * breath, bob, sure) * (0.35 + 0.65 * uSong.x);
}

// Where it leans, -1 to 1: one way on the first beat of the bar, the other
// on the third, and upright when the clock is unsure.
float barSway() {
  float sure = smoothstep(0.25, 0.65, uRhythm.w);
  return sin(6.2832 * 2.0 * uRhythm.y) * sure;
}
```

- Bodies move by `uRhythm` only. `uDrums` and `uBeat` arrive after the hit:
  give them light - a floor pulse on the kick, a glint on the hats - never a
  limb.
- Every curve is the same at phase 0 and at 1, or the body pops as the
  phase wraps.
- Above about 140 BPM use `fract(uRhythm.y * 2.0)` as the phase (half time);
  below about 80, `fract(uRhythm.x * 2.0)`.

## 3. A build and its drop

Something gathers while `uSong.y` rises, and is let go when `uSong.z` lands.
The gathering is what makes the release read: without it the drop arrives
from nowhere.

```glsl
// col: the scene so far, linear. p and subject: the pixel and the subject
// in the same aspect-corrected space.
vec3 buildAndDrop(vec3 col, vec2 p, vec2 subject) {
  float build = uSong.y;
  float drop = uSong.z;
  float since = -0.7 * log2(max(drop, 0.001));
  float seed = fract(sin(uSong.w * 91.7) * 43758.5453);
  float away = length(p - subject);

  // The build: the light closes in on the subject and the edges go dark.
  float held = 1.0 - smoothstep(0.0, mix(1.6, 0.5, build), away);
  col *= mix(1.0, 0.35 + 0.65 * held, build);

  // The drop: a ring leaves the subject and the whole picture opens a
  // little, in a colour of this drop's own. Both ease away with drop.
  vec3 hue = mix(vec3(1.0, 0.55, 0.2), vec3(0.3, 0.7, 1.0), seed);
  float ring = 1.0 - smoothstep(0.0, 0.05, abs(away - 0.9 * since));
  return col + hue * drop * (1.2 * ring + 0.12);
}
```

- `since` is the time since the drop in seconds: time a jump's arc, a
  camera's pull-back or a burst of particles by it.
- `uSong.w` counts the drops: hash it so no two look alike.
- The lift over the whole picture stays small (the 0.12): large areas must
  not flash. The ring carries the brightness, where it is narrow.

## 4. Night, dusk and day

Three times of day that each look designed, with every value between a real
moment between. The three weights always add up to 1.

```glsl
// x night, y dusk, z day.
vec3 hours() {
  float day = uParam_daylight / 100.0;
  float up = smoothstep(0.0, 0.45, day);
  float high = smoothstep(0.55, 1.0, day);
  return vec3(1.0 - up, up - high, high);
}

// A sky for uv.y from the horizon (0) to the top (1), linear.
vec3 skyAt(float height) {
  vec3 h = hours();
  vec3 low = h.x * vec3(0.006, 0.005, 0.012)
           + h.y * vec3(0.95, 0.42, 0.18)
           + h.z * vec3(0.72, 0.84, 0.95);
  vec3 top = h.x * vec3(0.0, 0.002, 0.008)
           + h.y * vec3(0.10, 0.07, 0.22)
           + h.z * vec3(0.22, 0.48, 0.90);
  return mix(low, top, smoothstep(0.0, 0.9, height));
}

// How strong the scene's own lamps and glows are: full at night, softened
// by day, never gone.
float lampStrength() {
  return mix(1.0, 0.3, smoothstep(0.3, 0.9, uParam_daylight / 100.0));
}
```

- The night's colours are near black on purpose: `look_at_scene` at
  daylight 0 in silence must say the Night check PASSES (6% or under). What
  is bright at night is only what gives off light.
- Dusk is its own colours, not the two ends mixed.
- Multiply every emitter by `lampStrength()`, and the music's own element
  too: it should be as easy to read at noon as at midnight.

## 5. The pointer and a tap

A gift for the listener who reaches in, and nothing at all when nobody
does - which is always the case on the desktop background.

```glsl
// col: the scene so far, linear; uv as sceneColour is given it.
vec3 underTheHand(vec3 col, vec2 uv) {
  vec2 aspect = vec2(uResolution.x / uResolution.y, 1.0);
  vec2 p = uv * aspect;

  // A soft light under the pointer, warmer while it is held down. It fades
  // with uPointer.w, so it is gone when the hand leaves.
  vec2 hand = p - uPointer.xy * aspect;
  float near = exp(-18.0 * dot(hand, hand)) * uPointer.w;
  col += vec3(1.0, 0.86, 0.66) * near * (0.2 + 0.3 * uPointer.z);

  // A ring that leaves each tap and is gone in two seconds, in that tap's
  // own colour. uTap.z reads 60 before the first tap: nothing shows.
  float age = uTap.z;
  float away = length(p - uTap.xy * aspect);
  float ring = exp(-2.0 * age)
             * (1.0 - smoothstep(0.0, 0.015, abs(away - 0.6 * age)));
  float tint = fract(sin(uTap.w * 12.9898) * 43758.5453);
  return col + mix(vec3(0.4, 0.8, 1.0), vec3(1.0, 0.5, 0.8), tint) * ring * 0.8;
}
```

- Better than a light when the scene has a subject: eyes that turn to
  `uPointer.xy`, water that ripples under it, fur that parts.
- To let the listener turn a 3D scene, that is `uCamera` and "camera" in
  pack.json: the fluideq-hands skill.

## 6. A 3D-world light on the bass

In a world, the music belongs in the lights and materials that are already
there - never in new bright things bolted on. A lamp that swells with the
bass and ticks with the kick, in world.json:

```json
"vars": {
  "weight": "smooth(bass, 0.3)",
  "thump": "decay(drumKick, 0.2)",
  "dark": "1 - smoothstep(20, 80, p.daylight)"
},
"nodes": [
  { "type": "light", "name": "bass lamp", "position": [0, 2.4, 1.5],
    "light": { "kind": "point", "colour": "#ff7a3c",
               "intensity": "(6 + 34 * weight + 8 * thump) * (0.3 + 0.7 * dark)",
               "distance": 14, "decay": 2 } }
]
```

- `smooth` makes the bass a swell and `decay` makes the kick a tick that
  falls away: the raw signals would flicker the whole room.
- Intensity is physical. These numbers suit a lamp about three metres from
  what it lights; ten metres away it wants hundreds.
- `dark` keeps it a lamp by day - softened, not gone - and lets it carry the
  scene at night, where it is one of the few things allowed to be bright.
- "weight", "thump" and "dark" are this world's own names. Never name a var
  like a signal ("bass", "drumKick"): it would be dropped.
- Put what answers the treble in a material's glow and what answers the
  build in the fog or the exposure, the same way.

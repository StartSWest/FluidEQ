/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The scene "New project" writes to scene.frag (its pack.json is
 * `main/memberScenes/starterScene.ts`). Here rather than beside the manifest
 * because the Studio reads it too: while a project's scene is still this
 * text, it knows where the orb, the ring and the floor are, and labels them
 * on the stage (`StudioStarterLabels`).
 *
 * Short, and written as a lesson (Ivan, 2026-10-21: "lets load some pritty
 * basic project that moves with the music"): four numbered parts, each
 * answering one thing in the music, with a TRY line giving a first change
 * worth making. The hanami night that started every project before it was a
 * finished piece of 780 lines; it is the lighting page's demo now
 * (`main/lighting/lanternNightSource.ts`).
 *
 * It is a template literal: no backtick, backslash or dollar-brace may
 * appear in it, and nothing outside plain ASCII, as in every member scene.
 * Its first line is how the AI prompt tells the starter from a member's own
 * scene (`aiPrompt.ts`): keep it.
 */
const STUDIO_STARTER_SOURCE = `// My first FluidEQ scene. Ask your AI to change anything in it.
//
// Pulse: a glowing orb over a dark floor, a ring of light around it, and
// sparks rising in the air. It is short on purpose and written as a lesson:
// four numbered parts, each listening to one thing in the music. Read one,
// change one number, save, and watch the stage. The lines marked TRY are
// changes worth making first.
//
//   1. SKY     listens to the mids: it warms as voices and guitars fill in.
//   2. ORB     listens to the bass: it swells and its light reaches further.
//   3. RING    draws the spectrum: the deepest bass at the bottom, the
//              highest treble at the top. A drop opens it and turns its
//              colours.
//   4. FLOOR   listens to the beat: a ripple runs out on every beat.
//   And the SPARKS in the air twinkle with the treble.
//
// The Studio's Labels button shows all of this live, over the stage.
//
// What the music gives every scene, each 0..1 unless it says otherwise:
//   uLevel         how loud it is now
//   uBands         x the bass, y the mids, z the treble
//   uSpectrum      the whole spectrum as a texture; x = 0 is the deepest bass
//   uSpectrumSlow  the same, eased, for light that must never flicker
//   uRhythm        x the beat: 0 on a beat, rising to 1 by the next one
//   uDrums         x kick, y snare, z hats: 1 at a hit, then falling away
//   uSong          z a drop landing (1, then falling); w how many so far
//   uTime          seconds, wrapping every hour
//
// The dials are in pack.json ("params"); each is uParam_ and its id here.
// The first, Daylight, is the time of day FluidEQ sets from the window's
// Brightness: 0 is night and 100 is day, and the whole scene follows it.
//
// uv runs 0..1 across the panel, origin bottom-left. Return the colour with
// alpha 1.0.

const float PI = 3.14159265;
const float TAU = 6.2831853;
const int RING_BARS = 32;    // bars down each side of the ring
const int SPARK_LAYERS = 3;  // near, middle and far sparks

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

// An angle that turns a whole number of times an hour. uTime wraps every
// hour, so anything it moves has to be back where it started by then.
float cycle(float turnsPerHour) { return TAU * floor(turnsPerHour) * uTime / 3600.0; }

// ---- What the music is doing ------------------------------------------------

float slowAt(float f) { return texture(uSpectrumSlow, vec2(clamp(f, 0.0, 1.0), 0.5)).r; }

// Songs are loud in the bass and quiet in the treble. This reads one part of
// the spectrum against what songs usually do there, so every bar of the
// ring gets to move, not only the bass ones.
float heard(float f, float reading) {
  float lift = smoothstep(0.03, 0.14, f);
  float quiet = max(0.0, mix(0.45, 0.67, lift) - 1.25 * max(f - 0.2, 0.0));
  float loud = mix(0.8, 0.93, lift) - 0.92 * max(f - 0.14, 0.0);
  return smoothstep(quiet, max(loud, quiet + 0.1), reading);
}

float gBass;    // eased: the orb
float gMids;    // eased: the sky
float gTreble;  // quick: the sparks
float gPlaying; // 0 in silence, 1 with music playing
float gDay;     // 0 at night, 1 by day

void listen() {
  gBass = heard(0.17, slowAt(0.17));
  gMids = heard(0.52, slowAt(0.52));
  // uBands.z is the mean of 2-16 kHz: near 0.03 in a typical song and 0.18
  // when the hi-hats are busy.
  gTreble = smoothstep(0.02, 0.18, uBands.z);
  gPlaying = smoothstep(0.01, 0.08, uLevel);
  gDay = smoothstep(0.0, 1.0, clamp(uParam_daylight / 100.0, 0.0, 1.0));
}

// ---- Where everything is ----------------------------------------------------
// Lengths are in panel heights and x runs 0..aspect, so circles stay round
// on any panel shape.

float gAspect;
float gPx;       // one pixel
float gHorizon;  // where the floor meets the sky
vec2 gCentre;    // the orb's middle
float gRadius;   // the orb at rest

void place() {
  gAspect = uResolution.x / max(1.0, uResolution.y);
  gPx = 1.0 / max(1.0, uResolution.y);
  gHorizon = 0.26;
  gCentre = vec2(gAspect * 0.5, 0.6);
  // A tall, narrow panel gets a smaller orb, so its ring still fits.
  gRadius = min(0.11, gAspect * 0.14);
}

// ---- 1. SKY: listens to the mids --------------------------------------------
// gMids is near 0 in a quiet passage and near 1 when the song is full.

const vec3 NIGHT_HIGH = vec3(0.015, 0.02, 0.07);
const vec3 NIGHT_LOW = vec3(0.09, 0.045, 0.15);
const vec3 DUSK = vec3(0.45, 0.12, 0.32);
// TRY: change DUSK to vec3(0.05, 0.38, 0.3) for a green aurora.

vec3 sky(vec2 p) {
  float h = clamp((p.y - gHorizon) / (1.0 - gHorizon), 0.0, 1.0);
  vec3 c = mix(NIGHT_LOW, NIGHT_HIGH, smoothstep(0.0, 0.8, h));
  // The mids pour warm colour up from the horizon.
  c += DUSK * (0.15 + 0.6 * gMids) * exp(-h * 2.4);
  vec3 day = mix(vec3(0.82, 0.87, 0.94), vec3(0.34, 0.55, 0.86), smoothstep(0.0, 0.9, h));
  day += vec3(0.22, 0.1, 0.04) * gMids * exp(-h * 2.6);
  return mix(c, day, gDay);
}

// ---- 2. ORB: listens to the bass --------------------------------------------
// gBass jumps with every kick and bass note, eased so the orb breathes
// instead of flickering. uParam_glow is the Glow dial.
// TRY: change 0.25 to 0.5 in orbRadius, and every kick hits twice as hard.

float orbRadius() { return gRadius * (1.0 + 0.25 * gBass + 0.012 * sin(cycle(1200.0))); }

vec3 orbTint() { return mix(vec3(1.0, 0.38, 0.62), vec3(1.0, 0.72, 0.42), gDay); }

// The light the orb throws around itself, added to whatever is behind.
vec3 orbLight(vec2 p) {
  float d = max(length(p - gCentre) - orbRadius(), 0.0);
  float reach = gRadius * (0.5 + 2.2 * uParam_glow) * (1.0 + 0.8 * gBass);
  float strength = (0.12 + 0.5 * gBass) * (0.35 + 0.9 * uParam_glow);
  return orbTint() * strength * exp(-d / reach) * (1.0 - 0.5 * gDay);
}

vec3 orb(vec3 c, vec2 p) {
  float r = orbRadius();
  vec2 q = (p - gCentre) / r;
  float d = length(q);
  if (d > 1.05) {
    return c;
  }
  // Lit from the upper left, so it reads as a pearl and not a flat disc.
  vec3 normal = vec3(q, sqrt(max(0.0, 1.0 - d * d)));
  float lit = clamp(dot(normal, normalize(vec3(-0.45, 0.55, 0.8))), 0.0, 1.0);
  vec3 face = mix(orbTint() * 0.85, vec3(1.0, 0.96, 0.9), pow(lit, 1.6));
  face *= 0.8 + 0.3 * gBass;
  return mix(c, face, smoothstep(1.0, 1.0 - 1.5 * gPx / r, d));
}

// ---- 3. RING: draws the spectrum --------------------------------------------
// One bar for each part of the music, the same down both sides: the deepest
// bass at the bottom, the highest treble at the top. uParam_ring is the Ring
// dial. When a drop lands (uSong.z) the ring opens, and each drop turns its
// colours on (uSong.w counts them).
// TRY: lay the bars along the horizon instead, as a classic equalizer.

vec3 barColour(float f) {
  // Folded, so turning the colours never puts a seam in the ring.
  float t = 1.0 - abs(2.0 * fract(f * 0.5 + 0.25 * uSong.w) - 1.0);
  vec3 pink = vec3(1.0, 0.3, 0.58);
  vec3 gold = vec3(1.0, 0.72, 0.3);
  vec3 cyan = vec3(0.32, 0.86, 1.0);
  return t < 0.5 ? mix(pink, gold, t * 2.0) : mix(gold, cyan, t * 2.0 - 1.0);
}

vec3 ring(vec3 c, vec2 p) {
  vec2 d = p - gCentre;
  float dist = length(d);
  float inner = orbRadius() * 1.35 + 0.012 + 0.06 * uSong.z;
  float longest = 0.16;
  if (dist < inner - 0.03 || dist > inner + longest + 0.04) {
    return c;
  }
  // 0 at the bottom of the ring and 1 at its top, the same on either side.
  float around = acos(clamp(-d.y / max(dist, 0.0001), -1.0, 1.0)) / PI;
  float bars = float(RING_BARS);
  float slot = min(floor(around * bars), bars - 1.0);
  float f = mix(0.04, 0.88, (slot + 0.5) / bars);
  float level = heard(f, slowAt(f));
  float reach = 0.008 + longest * uParam_ring * level;
  // Into the bar's own frame: across it, and out along it from the ring.
  float across = (around - (slot + 0.5) / bars) * PI * dist;
  float along = dist - inner;
  float width = PI * inner / bars * 0.32;
  float edge = length(vec2(across, along - clamp(along, 0.0, reach))) - width;
  // By day a quiet bar stays bright: dimmed, it went brown against the sky.
  vec3 colour = barColour(f) * mix(0.55 + 0.75 * level, 0.85 + 0.25 * level, gDay);
  c = mix(c, colour, smoothstep(gPx, -gPx, edge));
  // A soft glow round each bar, brighter as it grows.
  return c + barColour(f) * exp(-max(edge, 0.0) / 0.012) * 0.22 * level * (1.0 - 0.6 * gDay);
}

// ---- 4. FLOOR: listens to the beat ------------------------------------------
// uRhythm.x rises from 0 on a beat to 1 by the next, so a ring drawn that far
// out leaves the orb's foot on every beat. Each ring lives two beats, so the
// last beat's ring is still out there, further and fainter. uRhythm.w is how
// sure the beat is. uParam_ripples is the Ripples dial.
// TRY: use uRhythm.y (the bar) for uRhythm.x, and one wave goes out a bar.

// phase is a ring's age, 0 when it leaves the foot and 1 when it is gone.
float ripple(vec2 p, float phase) {
  vec2 foot = vec2(gCentre.x, gHorizon - 0.05);
  // Squashed, so the rings lie flat on the floor.
  float d = length((p - foot) * vec2(1.0, 4.5));
  float radius = phase * gAspect * 0.55;
  float width = gPx * 1.5 + 0.004 * phase;
  return exp(-abs(d - radius) / width) * (1.0 - phase);
}

vec3 floorColour(vec2 p) {
  float depth = clamp((gHorizon - p.y) / gHorizon, 0.0, 1.0);
  vec3 c = mix(vec3(0.03, 0.025, 0.07), vec3(0.008, 0.008, 0.02), depth);
  c = mix(c, mix(vec3(0.55, 0.6, 0.68), vec3(0.4, 0.45, 0.52), depth), gDay);
  // The orb, its ring and its light, mirrored in the polished floor and
  // fading with distance from the horizon.
  vec2 mirrored = vec2(p.x, 2.0 * gHorizon - p.y);
  float shine = (1.0 - depth) * (1.0 - depth);
  c += orbLight(mirrored) * 0.45 * (1.0 - depth);
  c += ring(vec3(0.0), mirrored) * 0.3 * shine;
  c += orb(vec3(0.0), mirrored) * 0.22 * shine;
  c += DUSK * gMids * 0.12 * (1.0 - depth) * (1.0 - gDay);
  float sure = 0.35 + 0.65 * uRhythm.w;
  float waves = ripple(p, 0.5 * uRhythm.x) + ripple(p, 0.5 + 0.5 * uRhythm.x);
  float strength = uParam_ripples * sure * gPlaying * (0.7 + 0.6 * uDrums.x);
  c += mix(vec3(0.55, 0.65, 1.0), vec3(0.2, 0.3, 0.55), gDay) * waves * strength;
  // A thin line of light where the floor meets the sky.
  return c + orbTint() * exp(-(gHorizon - p.y) / 0.004) * 0.25 * (1.0 - 0.5 * gDay);
}

// ---- The sparks: listen to the treble ---------------------------------------
// Three layers of sparks drifting up, each a little smaller and further back.
// gTreble makes them twinkle. uParam_sparks is the Sparks dial: how many.

vec3 sparks(vec3 c, vec2 p) {
  float above = smoothstep(gHorizon, gHorizon + 0.1, p.y);
  if (above <= 0.0) {
    return c;
  }
  for (int layer = 0; layer < SPARK_LAYERS; layer++) {
    float fl = float(layer);
    float cell = 0.075 + 0.045 * fl;
    // Each layer rises a whole number of cells an hour: seamless at the wrap.
    vec2 g = p / cell - vec2(0.0, (300.0 + 180.0 * fl) * uTime / 3600.0);
    vec2 base = floor(g);
    float seed = hash(base + fl * 17.0);
    if (seed > uParam_sparks * 0.55) {
      continue;
    }
    vec2 at = base + 0.2 + 0.6 * vec2(hash(base + 3.1), hash(base + 7.7));
    at.x += 0.12 * sin(cycle(900.0 + 300.0 * floor(seed * 3.0)) + seed * TAU);
    float d = length(g - at) * cell;
    float size = gPx * (1.6 - 0.4 * fl) + 0.001;
    float twinkle = 0.3 + 0.7 * gTreble * (0.5 + 0.5 * sin(cycle(2400.0 + 1200.0 * floor(seed * 4.0)) + seed * 20.0));
    float light = smoothstep(size * 1.8, size * 0.4, d) + 0.35 * exp(-d / (size * 3.0));
    c += vec3(1.0, 0.86, 0.95) * light * twinkle * (0.85 - 0.2 * fl) * above * (1.0 - 0.65 * gDay);
  }
  return c;
}

vec4 sceneColour(vec2 uv) {
  listen();
  place();
  vec2 p = vec2(uv.x * gAspect, uv.y);
  vec3 c = p.y >= gHorizon ? sky(p) : floorColour(p);
  c = sparks(c, p);
  c += orbLight(p) * step(gHorizon, p.y);
  c = ring(c, p);
  c = orb(c, p);
  // A gentle vignette, a soft shoulder for the brightest light, and a little
  // grain so the dark sky never bands.
  vec2 v = (uv - 0.5) * vec2(0.9, 1.1);
  c *= 1.0 - 0.3 * dot(v, v);
  vec3 over = max(c - 0.8, 0.0);
  c = min(c, 0.8) + 0.2 * (1.0 - exp(-over / 0.2));
  c += (hash(uv * uResolution) - 0.5) / 255.0;
  return vec4(clamp(c, 0.0, 1.0), 1.0);
}
`;

export default STUDIO_STARTER_SOURCE;

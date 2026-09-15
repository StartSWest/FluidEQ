/**
 * The scene "New project" writes to scene.frag (its pack.json is
 * `starterScene.ts`). One string, because a shader has no seam to split at.
 *
 * It is a template literal: no backtick, backslash or dollar-brace may
 * appear in it, and nothing outside plain ASCII, as in every member scene.
 */
const STARTER_SOURCE = `// My first FluidEQ scene. Ask your AI to change anything in it.
//
// Hanami at night: paper lanterns strung under cherry blossom, a pagoda on
// the far shore of a pond, the moon, and petals on the air. Every part of the
// music has its own job, so each of the Studio's test buttons moves
// something different:
//
//   Spectrum  the lanterns, bass on the left to treble on the right. Each
//             one glows with its own part of the music, flickers brighter as
//             a note starts in it, and lays its light on the water. The
//             string hangs where your wave is: change the wave's height or
//             position and the lanterns follow.
//   Bass      the moon's halo, and its path on the water, swell.
//   Mids      the blossom warms in the lantern light.
//   Treble    stars twinkle and falling petals catch the light.
//   Beat      the candles flare inside the lanterns.
//   Accent    a shooting star, on a new path every time.
//   Waveform  ripples run across the pond.
//   Silence   only slow things move: the breeze, the petals, the clouds.
//
// The sliders are in pack.json ("params"), and so are the petals it lets
// drift around the app in Ambient mode ("ambient").
//
// uv runs 0..1 across the panel, origin bottom-left. Return premultiplied
// colour with alpha 1.0.

const float TAU = 6.2831853;
const int LANTERNS = 11;
const int NEAREST = 3;
const int CLUMPS = 14;
const int FLOWER_CELLS = 9;
const int PETAL_LAYERS = 3;
const int ROOFS = 5;
const int TREES = 3;
const int STAR_LAYERS = 2;

// The lanterns cover the spectrum from about 27 Hz to 8 kHz. Above that,
// songs leave the spectrum nearly empty: a lantern at 15 kHz stayed dark
// through seven songs of every kind.
const float LOWEST = 0.04;
const float HIGHEST = 0.88;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}

// Noise that repeats every "period" cells along x. uTime wraps every hour, so
// anything the clock slides must be back where it started by then, or it
// jumps.
float loopNoise(vec2 p, float period) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float x0 = mod(i.x, period);
  float x1 = mod(i.x + 1.0, period);
  return mix(mix(hash(vec2(x0, i.y)), hash(vec2(x1, i.y)), u.x),
             mix(hash(vec2(x0, i.y + 1.0)), hash(vec2(x1, i.y + 1.0)), u.x), u.y);
}

// An angle that turns a whole number of times an hour, for the same reason.
float cycle(float turnsPerHour) { return TAU * floor(turnsPerHour) * uTime / 3600.0; }

float boxCover(vec2 q, vec2 lo, vec2 hi, float aa) {
  vec2 inside = smoothstep(lo - aa, lo + aa, q) * (1.0 - smoothstep(hi - aa, hi + aa, q));
  return inside.x * inside.y;
}

float segment(vec2 p, vec2 a, vec2 b, float ra, float rb) {
  vec2 pa = p - a;
  vec2 ba = b - a;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * h) - mix(ra, rb, h);
}

// ---- What the music is doing ------------------------------------------------

// uSpectrum answers at once: use it for small, quick things. uSpectrumSlow is
// eased: use it for light and glow, which must never flicker. f = 0 is bass.
float fastAt(float f) { return texture(uSpectrum, vec2(clamp(f, 0.0, 1.0), 0.5)).r; }
float slowAt(float f) { return texture(uSpectrumSlow, vec2(clamp(f, 0.0, 1.0), 0.5)).r; }

// How loud a part of the spectrum is against what songs usually do there.
// Real music is not flat: through seven songs (pop, dance, rock, metal, jazz,
// a ballad) the bass sat between about 0.67 and 0.93 while 5 kHz sat between
// 0 and 0.35. Read against one range for all of it, the bass lanterns never
// rested and the treble ones never lit.
float heard(float f, float reading) {
  float lift = smoothstep(0.03, 0.14, f);
  float quiet = max(0.0, mix(0.45, 0.67, lift) - 1.25 * max(f - 0.2, 0.0));
  float loud = mix(0.8, 0.93, lift) - 0.92 * max(f - 0.14, 0.0);
  return smoothstep(quiet, max(loud, quiet + 0.1), reading);
}

float gBass;    // eased: the moon's halo
float gMids;    // eased: the blossom's warmth
float gTreble;  // quick: stars and petals
float gBody;    // eased: the whole song, for the mist and the far lights

void listen() {
  gBass = heard(0.17, slowAt(0.17));
  gMids = heard(0.52, slowAt(0.52));
  // uBands.z is the mean of 2-16 kHz: near 0.03 in a typical song, 0.18 when
  // the hi-hats are busy.
  gTreble = smoothstep(0.02, 0.18, uBands.z);
  gBody = (gBass + gMids + heard(0.75, slowAt(0.75))) / 3.0;
}

// ---- Where everything is ----------------------------------------------------
// Lengths are in panel heights and x runs 0..aspect, so circles stay round on
// any panel shape.

float gAspect;
float gPx;           // one pixel
float gScale;        // 1 with the wave at full height, smaller with a shorter one
float gWater;        // the far shore of the pond
float gLeft;         // where the spectrum starts and ends across the panel
float gRight;
float gSpacing;      // from one lantern to the next
float gSize;         // a lantern's paper, half its height
float gString;       // how high the string is tied
float gSag;
vec2 gMoonAt;
float gRipple;       // the pond's surface here, for the light that lands on it
float gLanternLight; // how brightly the lanterns above this column shine

void place() {
  vec4 r = uSpectrumRect;
  gAspect = uResolution.x / max(1.0, uResolution.y);
  gPx = 1.0 / max(1.0, uResolution.y);
  float band = clamp(abs(r.w - r.z), 0.0, 1.0);
  float middle = clamp((r.z + r.w) * 0.5, 0.0, 1.0);
  gScale = mix(0.42, 1.0, band);
  gLeft = r.x * gAspect;
  gRight = r.y * gAspect;
  gSpacing = max(gPx, (gRight - gLeft) * (HIGHEST - LOWEST) / float(LANTERNS - 1));
  // As tall as the wave allows, and never so wide that two lanterns touch.
  gSize = min(0.042 * gScale, gSpacing * 0.5);
  gSag = 0.03 * gScale;
  gWater = clamp(middle - 0.24 * gScale, 0.07, 0.28);
  // The lanterns' middle stands at the wave's middle; the whole string stays
  // inside the panel and clear of the water.
  float hang = gSize * 4.4 + gSag;
  gString = clamp(middle + gSize * 2.2 + gSag * 0.5, gWater + hang + 0.03, 0.97);
  float wide = smoothstep(0.9, 1.6, gAspect);
  gMoonAt = vec2(gAspect * mix(0.7, 0.62, wide), mix(0.7, 0.8, wide));
}

// Where along the string a lantern hangs: frequency f is at uv.x = mix(r.x,
// r.y, f), as on the graph.
float lanternX(float f) { return mix(gLeft, gRight, f); }

// How far along the row of lanterns x is, 0 at the first and LANTERNS - 1 at
// the last.
float slotAt(float x) {
  float f = (x - gLeft) / max(0.0001, gRight - gLeft);
  return (f - LOWEST) / (HIGHEST - LOWEST) * float(LANTERNS - 1);
}

float toneFrequency(float slot) { return mix(LOWEST, HIGHEST, slot / float(LANTERNS - 1)); }

// How loud one lantern's part of the music is.
float lanternLevel(float f) { return heard(f, slowAt(f)); }

// The light the lanterns throw on everything around them: between the two
// nearest, each as bright as it is itself. Read straight from the spectrum at
// every column instead, its fine detail streaked the sky in vertical lines.
float lanternLightAt(float x) {
  float slot = clamp(slotAt(x), 0.0, float(LANTERNS - 1));
  float i = floor(slot);
  float next = min(i + 1.0, float(LANTERNS - 1));
  return mix(lanternLevel(toneFrequency(i)), lanternLevel(toneFrequency(next)), smoothstep(0.0, 1.0, slot - i));
}

// ---- The sliders (pack.json "params") ---------------------------------------
// uParam_glow      Lantern light
// uParam_petals    Falling petals
// uParam_breeze    Breeze
// uParam_moon      Moonlight
// uParam_blossom   Blossom colour, white to deep pink

// ---- Sky --------------------------------------------------------------------

const float MOON_R = 0.045;

vec3 skyColour(vec2 p) {
  float h = clamp((p.y - gWater) / max(0.2, 1.0 - gWater), 0.0, 1.0);
  vec3 c = mix(vec3(0.17, 0.09, 0.21), vec3(0.055, 0.045, 0.13), smoothstep(0.0, 0.45, h));
  c = mix(c, vec3(0.012, 0.016, 0.055), smoothstep(0.4, 1.0, h));
  // Moonlight scattered round the moon: wider and brighter with the bass.
  float d = length(p - gMoonAt);
  c += vec3(0.22, 0.27, 0.55) * exp(-d / (0.12 + 0.16 * gBass)) * (0.04 + 0.5 * gBass) * uParam_moon;
  c += vec3(0.55, 0.62, 0.95) * exp(-max(d - MOON_R, 0.0) / 0.014) * 0.22 * uParam_moon;
  // The lanterns warm the air they hang in.
  float air = exp(-abs(p.y - gString + gSize * 2.0) / (0.08 * gScale + 0.03));
  return c + vec3(0.3, 0.11, 0.05) * air * gLanternLight * (0.15 + 0.4 * uParam_glow);
}

vec3 stars(vec3 c, vec2 p) {
  float fade = smoothstep(gWater + 0.12, gWater + 0.4, p.y) * smoothstep(0.06, 0.25, length(p - gMoonAt));
  if (fade <= 0.0) {
    return c;
  }
  for (int layer = 0; layer < STAR_LAYERS; layer++) {
    float fl = float(layer);
    float cellSize = mix(0.11, 0.04, fl);
    vec2 cell = floor(p / cellSize);
    float seed = hash(cell + fl * 31.7);
    if (seed > mix(0.22, 0.4, fl)) {
      continue;
    }
    // A few bright stars, and a dust of faint ones.
    float bright = mix(0.15 + 0.85 * pow(hash(cell + 11.3), 3.0), 0.08 + 0.14 * hash(cell + 11.3), fl);
    vec2 at = (cell + 0.2 + 0.6 * vec2(hash(cell + 5.3), hash(cell + 9.1))) * cellSize;
    float d = length(p - at);
    float radius = min(gPx * mix(0.8, 1.7, bright), 0.0025);
    float twinkle = 1.0 - (0.1 + 0.6 * gTreble) * (0.5 + 0.5 * sin(cycle(700.0 + seed * 2000.0) + seed * TAU));
    float light = smoothstep(radius * 1.6, radius * 0.3, d) + 0.3 * bright * exp(-d / (radius * 3.5));
    c += vec3(0.8, 0.85, 1.0) * light * bright * twinkle * fade;
  }
  return c;
}

vec3 moonDisc(vec3 c, vec2 p) {
  vec2 q = p - gMoonAt;
  float d = length(q);
  if (d > MOON_R + 0.004) {
    return c;
  }
  float inside = smoothstep(MOON_R + gPx, MOON_R - gPx, d);
  float limb = sqrt(max(0.0, 1.0 - (d * d) / (MOON_R * MOON_R)));
  float maria = smoothstep(0.5, 0.8, noise(q / MOON_R * 2.2 + 7.0)) * 0.7
              + smoothstep(0.55, 0.9, noise(q / MOON_R * 5.0 + 1.0)) * 0.3;
  vec3 face = vec3(1.0, 0.97, 0.91) * (0.86 + 0.14 * limb) * (1.0 - 0.12 * maria);
  return mix(c, face * mix(0.55, 1.0, uParam_moon), inside);
}

// Thin clouds drifting across the upper sky, silvered near the moon.
vec3 clouds(vec3 c, vec2 p) {
  float band = smoothstep(gWater + 0.25, gWater + 0.45, p.y) * (1.0 - smoothstep(0.9, 1.0, p.y));
  if (band <= 0.0) {
    return c;
  }
  float shape = loopNoise(vec2(p.x * 1.8 - uTime * 90.0 / 3600.0, p.y * 6.0), 18.0) * 0.62
              + noise(vec2(p.x * 5.0, p.y * 15.0)) * 0.38;
  float wisp = smoothstep(0.6, 0.86, shape) * band;
  float lit = exp(-length(p - gMoonAt) / 0.28) * uParam_moon;
  vec3 colour = vec3(0.06, 0.055, 0.11) + vec3(0.5, 0.52, 0.72) * lit * (0.6 + 0.4 * gBass);
  return mix(c, colour, wisp * 0.6);
}

// A shooting star for the rare big moment. Its envelope lasts about a third of
// a second, so the star crosses in that time; the event number picks its path.
vec3 shootingStar(vec3 c, vec2 p) {
  float envelope = uMusicAccent.x;
  if (envelope <= 0.0) {
    return c;
  }
  float seed = uMusicAccent.y;
  float progress = 1.0 - envelope;
  float side = hash(vec2(seed, 1.3)) < 0.5 ? -1.0 : 1.0;
  vec2 start = vec2(gAspect * mix(0.25, 0.75, hash(vec2(seed, 2.1))), mix(0.82, 0.95, hash(vec2(seed, 3.7))));
  vec2 dir = normalize(vec2(side, -mix(0.25, 0.55, hash(vec2(seed, 4.9)))));
  float travel = mix(0.35, 0.6, hash(vec2(seed, 6.1)));
  vec2 head = start + dir * travel * progress;
  vec2 rel = p - head;
  float along = -dot(rel, dir);
  float across = abs(dot(rel, vec2(-dir.y, dir.x)));
  float tail = travel * 0.5 * min(1.0, progress * 3.0 + 0.05);
  float taper = clamp(1.0 - along / tail, 0.0, 1.0);
  float width = gPx * 1.2 + 0.003 * taper;
  float behind = step(0.0, along) * taper;
  float streak = behind * exp(-pow(across / width, 2.0)) + 0.25 * behind * taper * exp(-across / 0.006);
  float glow = exp(-length(rel) / 0.01);
  float fade = envelope * smoothstep(0.0, 0.08, progress);
  return c + vec3(0.85, 0.9, 1.0) * (streak + glow * 0.9) * fade * smoothstep(gWater + 0.05, gWater + 0.2, p.y);
}

// ---- The far shore ----------------------------------------------------------

float ridgeTop(float x) {
  return gWater + 0.055 + 0.05 * noise(vec2(x * 1.4, 3.7)) + 0.015 * noise(vec2(x * 5.0, 1.3));
}

// Tree crowns along the shore, one per cell: round ones, and pointed cedars.
float treeTop(float x) {
  float w = 0.022;
  float top = gWater + 0.01 + 0.004 * noise(vec2(x * 40.0, 2.0));
  for (int k = 0; k < TREES; k++) {
    float id = floor(x / w) + float(k) - 1.0;
    float seed = hash(vec2(id, 7.3));
    float u = (x - (id + 0.5 + (seed - 0.5) * 0.5) * w) / (w * (0.55 + 0.55 * hash(vec2(id, 2.9))));
    if (abs(u) < 1.0) {
      float crown = seed > 0.72 ? 1.0 - abs(u) : sqrt(1.0 - u * u);
      top = max(top, gWater + 0.008 + w * (0.5 + 1.5 * hash(vec2(id, 5.1))) * crown);
    }
  }
  return top;
}

// Five roofs sweeping up at the eaves, a spire and a few lit windows: a far
// building needs no more than its silhouette.
vec3 pagoda(vec3 c, vec2 p) {
  float height = 0.17;
  vec2 q = (p - vec2(gAspect * mix(0.3, 0.25, smoothstep(0.9, 1.6, gAspect)), gWater + 0.008)) / height;
  if (q.y < 0.0 || q.y > 1.15 || abs(q.x) > 0.34) {
    return c;
  }
  float aa = gPx / height;
  float solid = 0.0;
  float windows = 0.0;
  for (int i = 0; i < ROOFS; i++) {
    float t = float(i);
    float y0 = 0.03 + t * 0.165;
    float storey = 0.09 - t * 0.006;
    float w = 0.12 - t * 0.013;
    solid = max(solid, boxCover(q, vec2(-w, y0), vec2(w, y0 + storey), aa));
    float eave = w * 1.85 + 0.03;
    float ax = clamp(abs(q.x) / eave, 0.0, 1.0);
    float curl = ax * ax * ax;
    float under = y0 + storey + 0.04 * curl;
    float over = y0 + storey + 0.07 - 0.045 * ax + 0.03 * curl;
    solid = max(solid, smoothstep(eave + aa, eave - aa, abs(q.x))
                     * smoothstep(under - aa, under + aa, q.y)
                     * smoothstep(over + aa, over - aa, q.y));
    windows += step(0.4, hash(vec2(t, 4.0)))
             * smoothstep(0.022, 0.006, length((q - vec2(0.0, y0 + storey * 0.45)) * vec2(1.0, 0.75)));
  }
  float spire = boxCover(q, vec2(-0.007, 0.84), vec2(0.007, 1.12), aa);
  float rings = boxCover(q, vec2(-0.02, 0.88), vec2(0.02, 1.0), aa) * step(0.5, fract(q.y * 50.0));
  solid = max(solid, max(spire, rings));
  c = mix(c, vec3(0.035, 0.028, 0.07), solid);
  return c + vec3(1.0, 0.6, 0.28) * windows * (0.35 + 0.5 * gBody);
}

vec3 shoreLights(vec3 c, vec2 p) {
  float w = 0.05;
  float id = floor(p.x / w);
  float seed = hash(vec2(id, 41.0));
  if (seed > 0.3) {
    return c;
  }
  vec2 at = vec2((id + 0.2 + 0.6 * hash(vec2(id, 3.0))) * w, gWater + 0.005 + 0.008 * hash(vec2(id, 8.0)));
  float twinkle = 0.75 + 0.25 * sin(cycle(300.0 + seed * 900.0) + seed * 20.0);
  float d = length((p - at) * vec2(1.0, 1.4));
  return c + vec3(1.0, 0.66, 0.35) * exp(-d / (gPx * 1.6 + 0.0008)) * 0.6 * twinkle * (0.5 + 0.5 * gBody);
}

vec3 shore(vec3 c, vec2 p) {
  if (p.y > gWater + 0.21) {
    return c;
  }
  // The far range, pale with distance; the pagoda; the trees on the shore.
  float ridge = smoothstep(gPx, -gPx, p.y - ridgeTop(p.x));
  c = mix(c, mix(c, vec3(0.07, 0.055, 0.14), 0.75), ridge);
  c = pagoda(c, p);
  float trees = smoothstep(gPx, -gPx, p.y - treeTop(p.x));
  c = mix(c, vec3(0.016, 0.014, 0.035), trees);
  c = shoreLights(c, p);
  // Mist along the far edge of the water, drifting, lifted by the song.
  float mist = exp(-pow((p.y - gWater - 0.015) / 0.045, 2.0));
  float drift = loopNoise(vec2(p.x * 3.0 - uTime * 480.0 / 3600.0, p.y * 10.0), 24.0);
  vec3 tint = mix(vec3(0.36, 0.32, 0.58), vec3(0.9, 0.45, 0.25), gLanternLight * 0.6);
  return c + tint * mist * (0.35 + 0.65 * drift) * (0.07 + 0.16 * gBody);
}

// ---- The lanterns: the spectrum ---------------------------------------------

float stringAt(float x) {
  float first = lanternX(LOWEST);
  float last = lanternX(HIGHEST);
  float k = (x - (first + last) * 0.5) / max(0.1, (last - first) * 0.5 + gSpacing * 0.5);
  // One long drape across, and a little one between every two lanterns.
  float t = fract((x - first) / gSpacing);
  float inner = step(first, x) * step(x, last);
  return gString - gSag * (1.0 - k * k) - gSize * 0.3 * inner * 4.0 * t * (1.0 - t);
}

struct Lantern {
  vec2 hook;
  float swing;
  float size;
  float light;  // eased: how loud its part of the music is
  float onset;  // quick: a note starting in its part
  float flare;  // quick: its candle on a beat
  float tone;   // 0 at the bass end, 1 at the treble end
};

Lantern lanternAt(int i) {
  Lantern l;
  float fi = float(i);
  float seed = hash(vec2(fi, 17.0));
  float f = toneFrequency(fi);
  float fast = fastAt(f);
  float slow = slowAt(f);
  l.tone = fi / float(LANTERNS - 1);
  l.hook = vec2(lanternX(f), stringAt(lanternX(f)));
  l.size = gSize * (0.92 + 0.16 * seed);
  l.light = heard(f, slow);
  // The fast spectrum ahead of the eased one is a note arriving. Only the
  // small candle answers it; the halo and the water keep to the eased light.
  l.onset = smoothstep(0.02, 0.2, fast - slow);
  l.flare = heard(f, fast) * uBeat;
  l.swing = uParam_breeze * 0.07 * sin(cycle(480.0 + 120.0 * floor(seed * 4.0)) + fi * 2.1);
  return l;
}

// Bass lanterns red, the middle ones orange, treble ones gold.
vec3 paperOf(float tone) {
  vec3 red = vec3(0.92, 0.13, 0.06);
  vec3 orange = vec3(1.0, 0.42, 0.1);
  vec3 gold = vec3(1.0, 0.74, 0.3);
  return tone < 0.5 ? mix(red, orange, tone * 2.0) : mix(orange, gold, tone * 2.0 - 1.0);
}

vec2 paperCentre(Lantern l) {
  return l.hook + vec2(sin(l.swing), -cos(l.swing)) * l.size * 1.47;
}

// The light a lantern throws round itself. It is gone before the next lantern
// but one, because only the nearest three are looked at for any pixel.
vec3 lanternHalo(Lantern l, vec2 p) {
  float d = length((p - paperCentre(l)) * vec2(1.0, 0.85));
  float edge = gSpacing * 1.45;
  float fade = 1.0 - smoothstep(edge * 0.5, edge, d);
  float strength = (0.04 + 0.85 * l.light) * (0.35 + 0.9 * uParam_glow);
  vec3 tint = paperOf(l.tone) * 0.6 + vec3(0.4, 0.3, 0.2);
  return tint * fade * strength * (0.5 * exp(-d / (l.size * 0.8)) + 0.18 * exp(-d / (l.size * 2.4)));
}

vec3 lanternBody(vec3 c, vec2 p, Lantern l) {
  // Into the lantern's own frame, hanging straight down from its hook.
  vec2 d = p - l.hook;
  float s = sin(l.swing);
  float k = cos(l.swing);
  vec2 q = vec2(k * d.x + s * d.y, -s * d.x + k * d.y);
  float h = l.size;
  float wire = h * 0.35;
  vec2 n = (q - vec2(0.0, -wire - h * 1.12)) / vec2(h * 0.84, h);
  if (abs(n.x) > 1.3 || n.y > 1.6 || n.y < -2.4) {
    return c;
  }
  float aa = gPx / h * 1.3;
  // A paper barrel, fuller than an ellipse, with black caps and a tassel.
  float shape = pow(pow(abs(n.x), 2.3) + pow(abs(n.y), 3.0), 1.0 / 2.6);
  float body = smoothstep(1.0 + aa, 1.0 - aa, shape);
  float caps = max(boxCover(n, vec2(-0.5, 0.9), vec2(0.5, 1.16), aa),
                   boxCover(n, vec2(-0.56, -1.18), vec2(0.56, -0.9), aa));
  float cord = boxCover(n, vec2(-max(0.035, gPx / h), -1.72), vec2(max(0.035, gPx / h), -1.18), aa);
  float tuftWidth = 0.07 + 0.16 * clamp((-1.7 - n.y) / 0.55, 0.0, 1.0);
  float tuft = boxCover(n, vec2(-tuftWidth, -2.25), vec2(tuftWidth, -1.7), aa);
  float hanger = smoothstep(gPx * 1.2, gPx * 0.3, abs(q.x)) * step(-wire - h * 0.2, q.y) * step(q.y, 0.0);

  // The candle inside: paper brightest where it faces you, a hoop of bamboo
  // every few centimetres with the paper bulging between. A low candle
  // lights the paper orange whatever its colour; a bright one, white.
  float facing = sqrt(max(0.0, 1.0 - min(1.0, n.x * n.x)));
  float band = fract(n.y * 5.5 + 0.5);
  float bulge = 0.82 + 0.18 * sin(3.14159 * band);
  float rib = (1.0 - smoothstep(0.0, 0.12, min(band, 1.0 - band))) * smoothstep(gPx * 12.0, gPx * 25.0, h);
  vec3 paper = paperOf(l.tone);
  vec3 flame = mix(vec3(1.0, 0.56, 0.3), vec3(1.0), smoothstep(0.0, 0.7, l.light));
  // A note arriving lifts the candle a little: at a quarter more and twice
  // this on the hot core, the brightest lantern-sized patch jumped twice as
  // far in one frame as it did without.
  float candle = 0.3 + (0.5 + 0.9 * uParam_glow) * (1.2 * l.light + 0.14 * l.onset);
  vec3 col = paper * flame * candle * (0.22 + 0.78 * pow(facing, 1.8)) * bulge * (1.0 - 0.45 * rib);
  float hot = exp(-(n.x * n.x * 2.4 + n.y * n.y * 1.2) * 1.6);
  col += mix(vec3(1.0, 0.55, 0.25), vec3(1.0, 0.88, 0.62), l.light) * hot
       * (0.12 + 0.6 * l.light * (0.5 + 0.7 * uParam_glow) + 0.28 * l.onset + 0.55 * l.flare);
  c = mix(c, col, body);
  c = mix(c, vec3(0.025, 0.018, 0.02) + paper * 0.05 * candle, caps);
  c = mix(c, paper * (0.25 + 0.35 * candle), max(cord, tuft));
  return mix(c, vec3(0.05, 0.035, 0.04), hanger * 0.9);
}

// A lantern's light on the pond: a column of glints under it, longer when its
// part of the music is loud.
vec3 lanternOnWater(vec3 c, vec2 p, Lantern l) {
  float below = gWater - p.y;
  float reach = gScale * (0.04 + 0.26 * l.light) * (0.55 + 0.6 * uParam_glow);
  float width = l.size * (0.5 + 0.5 * clamp(below / reach, 0.0, 1.0));
  float across = (p.x - l.hook.x - gRipple * 0.004) / width;
  float column = exp(-across * across * 2.2) * (1.0 - smoothstep(reach * 0.2, reach, below));
  float dash = smoothstep(0.42, 0.82, loopNoise(vec2(below * 420.0 - uTime * 2160.0 / 3600.0, p.x * 70.0), 60.0));
  vec3 tint = paperOf(l.tone) * 0.7 + vec3(0.3, 0.2, 0.1);
  return c + tint * column * (0.2 + 0.8 * dash) * (0.1 + 0.9 * l.light) * (0.35 + 0.8 * uParam_glow);
}

vec3 lanterns(vec3 c, vec2 p) {
  bool water = p.y < gWater;
  float top = gString + gSpacing * 1.45;
  float bottom = gString - gSag - gSize * 4.6 - gSpacing * 1.45;
  if (!water && (p.y > top || p.y < bottom)) {
    return c;
  }
  if (!water) {
    float cover = smoothstep(gPx * 1.5, gPx * 0.5, abs(p.y - stringAt(p.x)));
    c = mix(c, vec3(0.06, 0.04, 0.045) + vec3(0.25, 0.1, 0.04) * gLanternLight, cover * 0.9);
  }
  // Only the nearest lantern and its two neighbours can reach this pixel.
  int nearest = int(floor(slotAt(p.x) + 0.5));
  for (int k = 0; k < NEAREST; k++) {
    int i = nearest - 1 + k;
    if (i < 0 || i >= LANTERNS) {
      continue;
    }
    Lantern l = lanternAt(i);
    if (water) {
      c = lanternOnWater(c, p, l);
    } else {
      c += lanternHalo(l, p);
      c = lanternBody(c, p, l);
    }
  }
  return c;
}

// ---- The pond ---------------------------------------------------------------

vec3 pond(vec2 p) {
  float depth = clamp((gWater - p.y) / max(0.05, gWater), 0.0, 1.0);
  float nearness = 0.12 + depth;
  // The water recedes toward the middle of the panel, so its ripples do.
  vec2 rp = vec2((gWater - p.y) * 150.0 / nearness, (p.x - gAspect * 0.5) * 10.0 / nearness);
  // Ripples slide toward you with the clock, and the waveform stirs them.
  float slide = uTime * 240.0 / 3600.0;
  gRipple = loopNoise(vec2(rp.x - slide, rp.y), 60.0) - 0.5;
  gRipple += 0.5 * (loopNoise(vec2(rp.x * 2.3 - slide * 2.0, rp.y * 1.7 + 3.0), 60.0) - 0.5);
  float wave = texture(uWaveform, vec2(clamp(p.x / gAspect, 0.0, 1.0), 0.5)).r;
  float stir = 0.002 + (0.012 + 0.02 * depth) * wave + 0.003 * uLevel;
  vec2 m = vec2(p.x + gRipple * stir * 1.5, 2.0 * gWater - p.y + gRipple * stir);
  vec3 c = skyColour(m);
  c = moonDisc(c, m);
  c = shore(c, m);
  c = c * mix(0.66, 0.4, depth) + vec3(0.008, 0.01, 0.028);
  // Moonlight on the ripple crests, gathered into a path under the moon.
  float crest = smoothstep(0.12, 0.42, gRipple);
  float path = (p.x - gMoonAt.x) / (0.025 + 0.09 * depth);
  c += vec3(0.6, 0.66, 1.0) * exp(-path * path) * crest * (0.06 + 0.6 * gBass) * uParam_moon;
  return c + vec3(0.1, 0.11, 0.22) * crest * 0.1 * (1.0 - depth);
}

// ---- Cherry blossom ---------------------------------------------------------

// The clumps on a bough: x in from the panel's side, y down from its top,
// radius, and how far back it hangs (0 in front, 1 behind).
const vec4 CLUMP[CLUMPS] = vec4[CLUMPS](
  vec4(-0.02, 0.03, 0.08, 0.6),
  vec4(0.08, 0.1, 0.065, 0.2),
  vec4(0.14, 0.03, 0.06, 0.8),
  vec4(0.2, 0.09, 0.06, 0.1),
  vec4(0.26, 0.18, 0.05, 0.3),
  vec4(0.31, 0.07, 0.055, 0.7),
  vec4(0.36, 0.13, 0.05, 0.0),
  vec4(0.43, 0.08, 0.045, 0.5),
  vec4(0.47, 0.17, 0.04, 0.2),
  vec4(0.54, 0.1, 0.04, 0.4),
  vec4(0.62, 0.13, 0.032, 0.1),
  vec4(0.02, 0.17, 0.05, 0.3),
  vec4(0.68, 0.16, 0.022, 0.5),
  vec4(0.4, 0.21, 0.03, 0.6)
);

// x: 1 at the heart of the nearest clump, 0 at its edge, below 0 outside.
// y: how far back the clumps here hang, blended so no seam shows where two
// clumps meet.
vec2 clumpField(vec2 q) {
  float best = -1.0;
  float weight = 0.0;
  float depth = 0.0;
  for (int i = 0; i < CLUMPS; i++) {
    vec4 clump = CLUMP[i];
    float f = 1.0 - length((q - clump.xy) / clump.z * vec2(0.85, 1.2));
    float w = exp(8.0 * f);
    best = max(best, f);
    weight += w;
    depth += w * clump.w;
  }
  return vec2(best, depth / max(weight, 0.0001));
}

float bough(vec2 q) {
  float d = segment(q, vec2(-0.08, -0.02), vec2(0.12, 0.07), 0.036, 0.025);
  d = min(d, segment(q, vec2(0.12, 0.07), vec2(0.3, 0.1), 0.025, 0.015));
  d = min(d, segment(q, vec2(0.3, 0.1), vec2(0.5, 0.09), 0.015, 0.008));
  d = min(d, segment(q, vec2(0.5, 0.09), vec2(0.68, 0.13), 0.008, 0.0033));
  d = min(d, segment(q, vec2(0.2, 0.085), vec2(0.26, 0.2), 0.0095, 0.0038));
  d = min(d, segment(q, vec2(0.4, 0.1), vec2(0.46, 0.2), 0.0075, 0.003));
  d = min(d, segment(q, vec2(0.06, 0.05), vec2(0.02, 0.19), 0.012, 0.0045));
  return min(d, segment(q, vec2(0.3, 0.1), vec2(0.38, 0.03), 0.0075, 0.003));
}

// Single flowers, one per cell of a small grid: five notched petals round a
// deeper pink heart, each turned toward or away from you its own way, each
// opening only where the clump is full enough for it. x is how much of the
// pixel is petal, y how near the heart, z the flower's brightness.
vec3 flowers(vec2 p, float cell, float mass) {
  vec2 g = p / cell;
  vec2 base = floor(g);
  float aa = gPx / cell * 1.4;
  vec3 best = vec3(0.0);
  float rank = -1.0;
  for (int k = 0; k < FLOWER_CELLS; k++) {
    vec2 at = base + vec2(float(k % 3) - 1.0, float(k / 3) - 1.0);
    vec2 d = g - (at + 0.5 + (vec2(hash(at + 1.7), hash(at + 4.3)) - 0.5) * 0.5);
    float radius = 0.58 + 0.3 * hash(at + 8.9);
    if (dot(d, d) > radius * radius * 2.2) {
      continue;
    }
    float threshold = mix(-0.1, 0.3, hash(at + 5.5));
    float show = smoothstep(threshold - 0.1, threshold + 0.1, mass);
    float seed = hash(at + 0.37);
    if (show <= 0.0 || seed < rank) {
      continue;
    }
    float tilt = hash(at + 6.1) * TAU;
    vec2 axis = vec2(cos(tilt), sin(tilt));
    vec2 e = d + axis * dot(d, axis) * (1.0 / (0.62 + 0.38 * hash(at + 2.9)) - 1.0);
    float r = length(e);
    float lobe = abs(cos(2.5 * (atan(e.y, e.x) + seed * TAU)));
    float edge = radius * (0.56 + 0.44 * pow(lobe, 0.55)) - radius * 0.14 * smoothstep(0.93, 1.0, lobe);
    float cover = smoothstep(edge + aa, edge - aa, r) * show;
    // The flower on top is the one with the highest seed, the same for every
    // pixel it covers.
    if (cover > 0.02) {
      rank = seed;
      best = vec3(cover, 1.0 - smoothstep(0.0, radius * 0.5, r), 0.8 + 0.35 * hash(at + 3.3));
    }
  }
  return best;
}

vec3 blossom(vec3 c, vec2 p) {
  // Nothing hangs below the boughs or between them on a wide panel.
  if (p.y < 0.6 || (p.x > 0.8 && gAspect - p.x > 0.74)) {
    return c;
  }
  float sway = uParam_breeze * 0.005 * sin(cycle(360.0) + p.x * 2.0);
  vec2 left = vec2(p.x, 1.0 - p.y + sway * p.x);
  vec2 right = vec2(gAspect - p.x, 1.0 - p.y - 0.03 + sway * (gAspect - p.x)) / 0.92;
  float wood = min(bough(left), bough(right) * 0.92);
  vec2 warp = (vec2(noise(p * 11.0), noise(p * 11.0 + 7.3)) - 0.5) * 0.03;
  vec2 fromLeft = clumpField(left + warp);
  vec2 fromRight = clumpField(right + warp);
  vec2 field = fromLeft.x > fromRight.x ? fromLeft : fromRight;
  if (field.x < -0.6 && wood > 0.012) {
    return c;
  }
  float mass = field.x + (noise(p * 24.0) - 0.5) * 0.5 + (noise(p * 64.0) - 0.5) * 0.22;
  float back = field.y;
  // Moonlight from above; the lanterns from below, each part of the canopy
  // with the part of the music its lanterns play; and all of it warmer with
  // the mids.
  float below = exp(-max(0.0, p.y - gString) / 0.3) * (0.4 + 0.8 * uParam_glow);
  float lantern = (0.1 + 0.35 * gLanternLight) * below;
  vec3 moonlight = vec3(0.72, 0.7, 0.88) * (0.3 + 0.45 * uParam_moon) * (0.75 + 0.25 * smoothstep(0.7, 1.0, p.y));
  vec3 warmth = vec3(1.0, 0.5, 0.32) * (lantern + 0.8 * gMids * (0.4 + 0.6 * uParam_glow));
  vec3 lightOn = (moonlight + warmth) * mix(1.0, 0.55, back);
  vec3 pink = mix(vec3(1.0, 0.88, 0.92), vec3(1.0, 0.55, 0.72), uParam_blossom);
  // The soft mass behind the flowers; clumps further back dimmer and bluer.
  vec3 fill = pink * lightOn * mix(0.42, 0.28, back) + vec3(0.02, 0.02, 0.05) * back;
  c = mix(c, fill, smoothstep(0.0, 0.3, mass) * 0.94);
  // The boughs, dark bark with moonlight along their upper edges.
  float bark = smoothstep(gPx * 1.2, -gPx * 1.2, wood);
  if (bark > 0.001) {
    float above = min(bough(left - vec2(0.0, 0.004)), bough(right - vec2(0.0, 0.004 / 0.92)) * 0.92);
    vec3 wooden = vec3(0.05, 0.036, 0.042) + vec3(0.06, 0.025, 0.014) * lantern;
    c = mix(c, wooden + moonlight * 0.35 * smoothstep(0.0, 0.004, above), bark);
  }
  if (mass > -0.25) {
    vec3 f = flowers(p, 0.0115, mass);
    vec3 col = pink * lightOn * f.z * 1.1;
    col = mix(col, col * vec3(1.0, 0.7, 0.8), f.y * 0.6);
    col += vec3(1.0, 0.85, 0.45) * lightOn * f.y * f.y * 0.35;
    c = mix(c, col, f.x);
  }
  return c;
}

// ---- Petals on the air ------------------------------------------------------

vec3 petals(vec3 c, vec2 p) {
  float lantern = gLanternLight * exp(-abs(p.y - gString) / 0.3) * (0.3 + 0.7 * uParam_glow);
  vec3 lit = vec3(0.55, 0.5, 0.7) * (0.45 + 0.55 * uParam_moon) + vec3(1.0, 0.5, 0.3) * lantern;
  vec3 pink = mix(vec3(1.0, 0.9, 0.93), vec3(1.0, 0.62, 0.76), uParam_blossom);
  for (int layer = 0; layer < PETAL_LAYERS; layer++) {
    float fl = float(layer);
    float cell = 0.09 + 0.06 * fl;
    // Each layer drifts a whole number of cells an hour: seamless at the wrap.
    vec2 g = p / cell + vec2(-(240.0 + 180.0 * fl), 420.0 + 240.0 * fl) * uTime / 3600.0;
    vec2 base = floor(g);
    float seed = hash(base + fl * 13.1);
    if (seed > uParam_petals * 0.35) {
      continue;
    }
    vec2 centre = base + 0.5 + (vec2(hash(base + 2.3), hash(base + 5.9)) - 0.5) * 0.24;
    centre.x += 0.07 * (0.4 + uParam_breeze) * sin(cycle(600.0 + 60.0 * floor(seed * 10.0)) + seed * TAU);
    vec2 d = (g - centre) * cell;
    float spin = cycle(720.0 + 360.0 * floor(hash(base + 7.7) * 4.0)) + seed * TAU;
    vec2 r = mat2(cos(spin), -sin(spin), sin(spin), cos(spin)) * d;
    // Turning as it falls, so it is sometimes seen nearly edge-on.
    float tumble = 0.5 + 0.5 * abs(sin(spin * 0.5 + seed * 3.0));
    float size = (0.0045 + 0.0035 * fl) * (0.8 + 0.4 * hash(base + 9.1));
    vec2 e = r / vec2(size, size * 0.62 * tumble);
    // A cherry petal: an oval with a small notch at its outer end.
    float notch = 0.3 * smoothstep(0.7, 1.0, e.x) * (1.0 - smoothstep(0.0, 0.28, abs(e.y)));
    float aa = gPx / (size * 0.62 * tumble) * (1.0 + fl * 0.8);
    float cover = smoothstep(aa, -aa, length(e) - 1.0 + notch);
    float glint = 1.0 + gTreble * 0.8 * max(0.0, sin(spin * 2.0 + seed * 5.0));
    c = mix(c, pink * lit * glint * (0.9 - 0.2 * e.x), cover * mix(0.9, 0.75, fl * 0.5));
  }
  return c;
}

vec4 sceneColour(vec2 uv) {
  listen();
  place();
  vec2 p = vec2(uv.x * gAspect, uv.y);
  // Read once here: the sky, the mist, the blossom and the petals all use it.
  gLanternLight = lanternLightAt(p.x);
  vec3 c;
  gRipple = 0.0;
  if (p.y >= gWater) {
    c = skyColour(p);
    c = stars(c, p);
    c = moonDisc(c, p);
    c = clouds(c, p);
    c = shootingStar(c, p);
    c = shore(c, p);
  } else {
    c = pond(p);
  }
  c = lanterns(c, p);
  c = blossom(c, p);
  c = petals(c, p);
  // A gentle vignette, a soft shoulder for the brightest light, and a little
  // grain so the dark sky never bands.
  vec2 v = (uv - 0.5) * vec2(0.9, 1.1);
  c *= 1.0 - 0.3 * dot(v, v);
  vec3 over = max(c - 0.78, 0.0);
  c = min(c, 0.78) + 0.22 * (1.0 - exp(-over / 0.22));
  c += (hash(uv * uResolution) - 0.5) / 255.0;
  return vec4(clamp(c, 0.0, 1.0), 1.0);
}
`;

export default STARTER_SOURCE;

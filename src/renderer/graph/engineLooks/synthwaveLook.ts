/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { windowFloor } from '../../utils/windowInk';
import type { ISceneReading } from '../sceneViews/sceneFrame';
import {
  RAILS,
  RAIL_FAR,
  RAIL_NEAR,
  RANGE_POINTS,
  RUNGS,
  gridFlash,
  horizonAlpha,
  placeStars,
  railSpread,
  rangeHeight,
  readSynthwave,
  ridgeGlowAlpha,
  starAlpha,
  sunCentre,
  sunCuts,
  sunGlowAlpha,
  sunGlowReach,
  synthwaveCopy,
  traceRange,
  type ISynthwaveState,
} from '../sceneViews/synthwave';
import type { IEngineLookInput } from './engineLookInput';
import type { IEngineLook } from './engineLookTypes';
import {
  pushRectSprite,
  setLookVector,
  sizeLookData,
  spritesSoFarUnder,
} from './lookInput';

/**
 * SYNTHWAVE on the GPU: the 2D look's rolling neon grid, the cut sun and its
 * glow, the mountain range with its neon ridge and held dots, and the
 * horizon line (`sceneViews/synthwave.ts`), painted per pixel from the same
 * layout; the stars placed by the 2D look's own function and drawn as
 * sprites under the picture. A copy that hangs upside down is painted the
 * right way up in a mirror about its band's middle, as the 2D look draws it.
 *
 *   uLook[6]  the grid's fan, its flash, the ridge's line, the ridge's glow
 *   uLook[7]  the sun's glow light, the horizon line's light, how far the
 *             floor has rolled into its next rung, the sun glow's reach
 *   uLook[8]  the rock's dark: the window's floor, and how solid
 *   uLook[9]  rails, rungs, the range's points each side, the window's width
 *   uLook[10 + 3c]      copy c: horizon, near edge, sky edge, the mirror's
 *                       line (top + bottom) or -1 the right way up
 *   uLook[10 + 3c + 1]  its middle, its sun's middle and radius, its cuts
 *   uLook[10 + 3c + 2]  the range's top, how tall, present
 *   texel (j, 2c)      the ridge's point j: x, y, and its held y (or none)
 *   texel (k, 2c + 1)  the sun's cut k: its top and height
 */

/** The rock's floor colour is the window's, darkened this much (2D look). */
const ROCK_DARKER = 0.35;
const NOT_HELD = -1e6;

const GLSL = `
vec3 ridgeInk(vec2 q, float horizon, float top, float whiten) {
  int mode = lookInkMode();
  if (mode == 0) {
    return lookLightInk(0.5, whiten);
  }
  if (mode == 1) {
    float w = max(1.0, uLook[1].y - uLook[1].x);
    return lookLightInk(abs((q.x - uLook[1].x) / w * 2.0 - 1.0), whiten);
  }
  return lookLightInk(lookAlong(q.y, horizon, top), whiten);
}

float segmentDistance(vec2 q, vec2 a, vec2 b) {
  vec2 ab = b - a;
  float t = clamp(dot(q - a, ab) / max(1e-4, dot(ab, ab)), 0.0, 1.0);
  return length(q - a - ab * t);
}

vec4 synthCopy(vec2 p, int c, vec4 picture) {
  vec4 place = uLook[10 + 3 * c];
  vec4 sun = uLook[11 + 3 * c];
  vec4 range = uLook[12 + 3 * c];
  if (range.z < 0.5) {
    return picture;
  }
  float horizon = place.x;
  float nearY = place.y;
  vec2 q = place.w >= 0.0 ? vec2(p.x, place.w - p.y) : p;
  float cx = sun.x;
  float opacity = lookOpacity();

  // The grid, rolling toward the viewer, fading into the haze.
  if (q.y >= horizon - 3.0 && q.y <= nearY + 3.0) {
    float depth = max(1.0, nearY - horizon);
    float f = clamp((q.y - horizon) / depth, 0.0, 1.0);
    float spread = uLook[6].x;
    float rails = uLook[9].x;
    float rungs = uLook[9].y;
    float fan = spread * (${RAIL_FAR} + (${RAIL_NEAR} - ${RAIL_FAR}) * f);
    float at = (q.x - cx) / max(1e-3, fan);
    float k = floor((at + 0.5) * rails + 0.5);
    float railD = 1e4;
    for (float n = -1.0; n <= 1.0; n += 1.0) {
      float kk = clamp(k + n, 0.0, rails);
      float atK = kk / rails - 0.5;
      float slope = atK * spread * (${RAIL_NEAR} - ${RAIL_FAR}) / depth;
      railD = min(railD, abs(q.x - (cx + atK * fan)) / sqrt(1.0 + slope * slope));
    }
    float roll = uLook[7].z;
    float s = sqrt(f) * rungs - roll;
    float rungD = 1e4;
    for (float n = -1.0; n <= 1.0; n += 1.0) {
      float r = clamp(floor(s + 0.5) + n, 0.0, rungs - 1.0);
      float along = (r + roll) / rungs;
      rungD = min(rungD, abs(q.y - (horizon + depth * along * along)));
    }
    float lineD = q.x >= 0.0 && q.x <= uLook[9].w ? min(railD, rungD) : railD;
    float flash = uLook[6].y;
    float g = f < 0.35
      ? mix(0.0, 0.35 + flash, f / 0.35)
      : mix(0.35 + flash, 0.8 + flash, (f - 0.35) / 0.65);
    g = clamp(g, 0.0, 1.0);
    vec3 gridInk = lookInk(0.15);
    picture = lookOver(picture, lookPaint(gridInk, 0.25 * g * lookStroke(lineD, 5.0)));
    picture = lookOver(picture, lookPaint(gridInk, g * lookStroke(lineD, 1.2)));
  }

  // The sun, cut into bands below its middle, and its glow.
  float sunY = sun.y;
  float radius = sun.z;
  float d = length(q - vec2(cx, sunY));
  bool shown = q.y >= sunY - radius && q.y <= sunY + radius * 0.02;
  int cuts = int(sun.w + 0.5);
  for (int k = 0; k < 32; k++) {
    if (k >= cuts) {
      break;
    }
    vec4 cut = texelFetch(uLookData, ivec2(k, 2 * c + 1), 0);
    shown = shown || (q.y >= cut.x && q.y <= cut.x + cut.y);
  }
  if (shown) {
    float t = lookAlong(q.y, sunY - radius, horizon);
    vec3 face = mix(lookLightInk(1.0, 0.35), lookInk(0.75), t);
    picture = lookOver(picture, lookPaint(face, lookFill(d - radius)));
  }
  float reach = radius * uLook[7].w;
  float glowT = clamp((d - radius * 0.8) / max(1e-3, reach - radius * 0.8), 0.0, 1.0);
  picture = lookOver(picture, lookPaint(lookInk(0.85), uLook[7].x * (1.0 - glowT) * lookFill(d - reach)));

  // The range: its ridge, point by point from the right.
  float halfWidth = max(1.0, (uLook[1].y - uLook[1].x) * 0.5);
  float points = uLook[9].z;
  float index = (1.0 - (q.x - cx) / halfWidth) * points;
  int j = int(clamp(floor(index), 0.0, 2.0 * points - 1.0));
  vec4 a = texelFetch(uLookData, ivec2(j, 2 * c), 0);
  vec4 b = texelFetch(uLookData, ivec2(j + 1, 2 * c), 0);
  float top = range.x;
  if (lookFilled() && q.x <= cx + halfWidth && q.x >= cx - halfWidth) {
    float span = b.x - a.x;
    float ridgeY = abs(span) < 1e-4 ? a.y : mix(a.y, b.y, (q.x - a.x) / span);
    float inside = clamp(min(q.y - ridgeY, horizon - q.y) / lookPixel() + 0.5, 0.0, 1.0);
    float t = lookAlong(q.y, top, horizon);
    vec4 rockTop = vec4(lookInk(0.35), 0.55 * opacity);
    vec4 rock = mix(rockTop, uLook[8], t);
    picture = lookOver(picture, lookPaint(rock.rgb, rock.a * inside));
  }
  float edgeD = 1e4;
  for (int n = -1; n <= 1; n++) {
    int s0 = clamp(j + n, 0, int(2.0 * points) - 1);
    vec4 e0 = texelFetch(uLookData, ivec2(s0, 2 * c), 0);
    vec4 e1 = texelFetch(uLookData, ivec2(s0 + 1, 2 * c), 0);
    edgeD = min(edgeD, segmentDistance(q, e0.xy, e1.xy));
  }
  float line = uLook[6].z;
  picture = lookOver(picture, lookPaint(ridgeInk(q, horizon, top, 0.0), uLook[6].w * lookStroke(edgeD, line + 3.5)));
  picture = lookOver(picture, lookPaint(ridgeInk(q, horizon, top, 0.25), 0.95 * lookStroke(edgeD, line)));
  for (int n = 0; n <= 1; n++) {
    vec4 held = texelFetch(uLookData, ivec2(j + n, 2 * c), 0);
    if (held.z > ${NOT_HELD / 2}.0) {
      float mark = lookFill(lookBox(q, vec2(held.x - 1.0, held.z - 1.0), vec2(held.x + 1.0, held.z + 1.0), 0.0));
      picture = lookOver(picture, lookPaint(ridgeInk(q, horizon, top, 0.5), 0.85 * mark));
    }
  }

  // The horizon line, across the window.
  if (q.x >= 0.0 && q.x <= uLook[9].w) {
    picture = lookOver(picture, lookPaint(lookInk(0.9), uLook[7].y * lookStroke(abs(q.y - horizon), 1.5)));
  }
  return picture;
}

vec4 sceneColour(vec2 uv) {
  vec2 p = lookPoint(uv);
  vec4 picture = vec4(0.0);
  for (int c = 0; c < 2; c++) {
    picture = synthCopy(p, c, picture);
  }
  return picture;
}
`;

const STAR: readonly [number, number, number] = [1, 1, 1];

const step = (
  reading: ISceneReading,
  state: ISynthwaveState,
  input: IEngineLookInput,
): boolean => {
  const { plot, music, look, bands, window: frame } = reading;
  const falling = readSynthwave(reading, state);
  const across = RANGE_POINTS * 2 + 1;
  const data = sizeLookData(input, across, 4);
  data.fill(0);
  const stars = starAlpha(music.treble);
  [0, 1].forEach((copy) => {
    const band = bands[copy];
    const base = 10 + copy * 3;
    if (!band) {
      setLookVector(input, base, 0, 0, 0, -1);
      setLookVector(input, base + 1, 0, 0, 0, 0);
      setLookVector(input, base + 2, 0, 0, 0, 0);
      return;
    }
    const { horizon, near, sky, cx, sun } = synthwaveCopy(
      band,
      bands.length,
      plot,
      frame.height,
      music.pulse,
    );
    const mirror = band.flipped ? band.top + band.bottom : -1;
    const tall = rangeHeight(band);
    const sunY = sunCentre(horizon, sun);
    // The sky's stars, scenery under the picture, placed in the mirror too.
    placeStars(music, frame.width, sky, horizon, (x, y, size) => {
      pushRectSprite(
        input,
        x,
        mirror >= 0 ? mirror - y : y,
        size,
        size,
        stars,
        STAR,
      );
    });
    let point = 0;
    const ridgeRow = copy * 2 * across * 4;
    traceRange(
      state,
      look.accents,
      plot,
      cx,
      horizon,
      -1,
      tall,
      (x, y, heldY) => {
        data[ridgeRow + point * 4] = x;
        data[ridgeRow + point * 4 + 1] = y;
        data[ridgeRow + point * 4 + 2] = heldY ?? NOT_HELD;
        point += 1;
      },
    );
    let cuts = 0;
    const cutRow = (copy * 2 + 1) * across * 4;
    sunCuts(sunY, sun, horizon, (y, height) => {
      if (cuts < across) {
        data[cutRow + cuts * 4] = y;
        data[cutRow + cuts * 4 + 1] = height;
        cuts += 1;
      }
    });
    setLookVector(input, base, horizon, near, sky, mirror);
    setLookVector(input, base + 1, cx, sunY, sun, cuts);
    setLookVector(input, base + 2, horizon - tall, tall, 1, 0);
  });
  spritesSoFarUnder(input);
  const [red, green, blue] = windowFloor();
  const keep = 1 - ROCK_DARKER;
  setLookVector(
    input,
    6,
    railSpread(frame.width),
    gridFlash(music.pulse),
    look.filled ? 1.5 : look.lineWidth,
    ridgeGlowAlpha(music.pulse, reading.glow),
  );
  setLookVector(
    input,
    7,
    sunGlowAlpha(music.pulse, reading.glow),
    horizonAlpha(music.pulse),
    state.roll % 1,
    sunGlowReach(music.pulse),
  );
  setLookVector(
    input,
    8,
    (red * keep) / 255,
    (green * keep) / 255,
    (blue * keep) / 255,
    0.92 * look.opacity,
  );
  setLookVector(input, 9, RAILS, RUNGS, RANGE_POINTS, frame.width);
  input.bloom = 0;
  return falling && look.accents;
};

const synthwaveLook: IEngineLook<ISynthwaveState> = {
  glsl: GLSL,
  stateOf: (scene) => scene.synthwave,
  step,
};

export default synthwaveLook;

/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { Projected } from 'common/graphStyles';
import { fireworkRgb, type TSegment } from '../../bridgeFireworks';
import { GLOW_LAYERS, SEA_SCALE } from '../../figureGlow';
import {
  CAR_BODY,
  CAR_COLOURS,
  CAR_HUB,
  CAR_TYRE,
  CAR_WHEELS,
  CAR_WHEEL_Y,
  CAR_WINDOW,
  FADE_BANDS,
  LEVEL_BINS,
  SEA_ROWS,
  TRUSS_INKS,
  seaRowY,
  type TrussBridgeLayout,
} from '../../trussBridge';
import {
  MAX_STROKE_POINTS,
  STROKE_FLOATS,
  type IEngineLookInput,
} from '../engineLookInput';
import { sizeLookData } from '../lookInput';
import { sceneToScreen, type IDesignedFrame } from './designedInput';
import {
  NIGHT_GLSL,
  glslInk as ink,
  nightStarGrid,
  writeNightStars,
} from './nightSky';

/**
 * The BRIDGE at night on the GPU (`trussBridge.ts`, `bridgeFireworks.ts`,
 * painted by the page in `LiveTraceCanvas`): the halo round the deck, the
 * stars, the truss under the deck and its footing, the sea — the truss's
 * glow on the beat, the swells and the haze, soft as the page paints them
 * at a third of its resolution — the horizon, the piers and towers, their
 * bracing, the hangers and the cables; where it is not filled the deck as
 * the figure; then the asphalt, its edge and centre line, the cars, the
 * lamps' light, the lamps, their light on the water and the fireworks.
 * Each copy in that order, as the page paints it.
 *
 * Numbers the shader reads once a pixel are in the parameter row:
 *   P0 the floor, half the asphalt, the road's points, the members
 *   P1 the first joint, the joints' pitch, the hangers, the dashes
 *   P2 the piers', towers' and the towers' lower quads, the cable's points
 *   P3 the bracing above and below the deck, the beacons, the streaks
 *   P4 the sea's left, its sample pitch and samples, the horizon
 *   P5 the haze's depth, left and width, the horizon line's left
 *   P6 the horizon line's right, the footing's ends, a lamp's radius
 *   P7 the beat, the bass, the first dash's left, the dashes' pitch
 *   P8 the stars' grid: its left and top, a cell's size
 *   P9 the grid's cells across and down, the cars, the sea's floor
 * The fireworks are strokes (`uLookStrokes`), each copy's in its half.
 */

const PARAM_ROW = 0;
const ROAD_ROW = 1;
const MEMBER_ROW = 2;
const BIN_ROW = 3;
const HANGER_ROW = 4;
const LAMP_ROW = 5;
const CONE_ROW = 6;
const REFLECT_ROW = 8;
const QUAD_ROW = 9;
const BRACE_ROW = 11;
const MISC_ROW = 12;
const CABLE_ROW = 13;
const DASH_ROW = 14;
const SEA_ROW = 15;
const CAR_ROW = SEA_ROW + SEA_ROWS;
const STAR_ROW = CAR_ROW + 1;
const CELL_ROW = STAR_ROW + 1;
const ROWS = CELL_ROW + 1;
/** Where the streaks start among the odds and ends. */
const STREAK_AT = 2;
/** Straight pieces a shock ring is drawn in. */
const RING_PIECES = 64;
const f = (value: number) => value.toFixed(6);
const WIDEST_GLOW = Math.max(...GLOW_LAYERS.map(({ widen }) => widen));
const { member, body, outline, cable, car: carInk } = TRUSS_INKS;
const DARK = ink(carInk.dark);
const CARS_GLSL = `const vec3 CAR_INKS[${CAR_COLOURS.length}] = vec3[${CAR_COLOURS.length}](${CAR_COLOURS.map(
  (colour) => ink(colour).rgb,
).join(', ')});`;
const box = ([x, y, w, h]: readonly [number, number, number, number]) =>
  `vec4(${f(x)}, ${f(y)}, ${f(w)}, ${f(h)})`;

const GLSL = `${NIGHT_GLSL}
uniform sampler2D uLookStrokes;
${CARS_GLSL}

vec4 trussParam(int k) {
  return texelFetch(uLookData, ivec2(k, ${PARAM_ROW}), 0);
}

// The last texel of a row whose x is at or left of x, the row sorted by x.
int trussFind(int row, int count, float x) {
  if (count < 1 || x < texelFetch(uLookData, ivec2(0, row), 0).x) {
    return 0;
  }
  int lo = 0;
  int hi = count;
  for (int k = 0; k < 16; k++) {
    if (hi - lo <= 1) {
      break;
    }
    int mid = (lo + hi) / 2;
    if (texelFetch(uLookData, ivec2(mid, row), 0).x <= x) {
      lo = mid;
    } else {
      hi = mid;
    }
  }
  return lo;
}

// A convex quad's signed distance, from its four corners in order: the
// farthest q stands outside any of its edges, negative within.
float trussQuad(vec2 q, vec2 a, vec2 b, vec2 c, vec2 d) {
  float turn = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  float side = turn < 0.0 ? -1.0 : 1.0;
  vec2 corners[4] = vec2[4](a, b, c, d);
  float inside = -1e5;
  for (int k = 0; k < 4; k++) {
    vec2 from = corners[k];
    vec2 edge = corners[(k + 1) % 4] - from;
    vec2 normal = normalize(vec2(edge.y, -edge.x)) * side;
    inside = max(inside, dot(q - from, normal));
  }
  return inside;
}

float trussQuadEdge(vec2 q, vec2 a, vec2 b, vec2 c, vec2 d) {
  return min(min(dsToSegment(q, a, b), dsToSegment(q, b, c)), min(dsToSegment(q, c, d), dsToSegment(q, d, a)));
}

// Soft, as what the page paints at a third of its resolution and
// stretches back over the frame.
float trussSoft(float distance) {
  return clamp(0.5 - distance / (lookPixel() / ${f(SEA_SCALE)}), 0.0, 1.0);
}

vec4 trussCopy(vec4 picture, vec2 p, vec2 uv, int copy) {
  vec2 q = dsScene(p, copy);
  vec4 p0 = trussParam(0);
  vec4 p1 = trussParam(1);
  vec4 p2 = trussParam(2);
  vec4 p3 = trussParam(3);
  vec4 p4 = trussParam(4);
  vec4 p5 = trussParam(5);
  vec4 p6 = trussParam(6);
  vec4 p7 = trussParam(7);
  float floorY = p0.x;
  float roadHalf = p0.y;
  int roadCount = int(p0.z + 0.5);
  float thump = p7.x;
  float bass = p7.y;
  float stroke = dsStrokeWidth();
  vec3 paint = dsPaint(q);
  bool glowing = uLook[6].z > 0.0;

  // The deck: how far from it, within reach of its widest stroke.
  float roadReach = max(roadHalf, glowing ? (stroke + ${f(WIDEST_GLOW)} * uLook[6].w) * 0.5 + 4.0 : 0.0) + stroke + 4.0;
  float deck = dsNearest(q, ${ROAD_ROW}, roadCount, roadReach).x;
  if (glowing) {
    vec3 glow = dsGlowPaint(q);
    ${GLOW_LAYERS.map(
      ({ widen, opacity }) =>
        `picture = lookOver(picture, lookPaint(glow, ${f(opacity)} * uLook[6].z * dsSoftStroke(deck, stroke + ${f(widen)} * uLook[6].w)));`,
    ).join('\n    ')}
  }

  // The stars, dim then twinkling.
  vec2 stars = nightStars(q, ${STAR_ROW}, ${CELL_ROW}, trussParam(8), ivec2(trussParam(9).xy + 0.5));
  picture = lookOver(picture, lookPaint(vec3(1.0), dsOpacity() * ${f(TRUSS_INKS.stars.dim)} * stars.y));
  picture = lookOver(picture, lookPaint(vec3(1.0), dsOpacity() * (${f(TRUSS_INKS.stars.bright(0))} + thump * ${f(TRUSS_INKS.stars.bright(1) - TRUSS_INKS.stars.bright(0))}) * stars.x));

  // The truss: each member in its four pieces, the pieces burning by the
  // band under the member, gathered band by band as the page strokes them.
  float memberWidth = max(1.0, stroke * 0.7);
  float glowWidth = memberWidth + ${f(member.glowWiden)} * thump;
  float pieces[${FADE_BANDS * LEVEL_BINS}];
  float glowPieces[${FADE_BANDS * LEVEL_BINS}];
  for (int k = 0; k < ${FADE_BANDS * LEVEL_BINS}; k++) {
    pieces[k] = 0.0;
    glowPieces[k] = 0.0;
  }
  int members = int(p0.w + 0.5);
  int joint = int(floor((q.x - p1.x) / max(1e-3, p1.y)));
  for (int k = 0; k < 6; k++) {
    int i = (joint - 1) * 2 + k;
    if (i < 0 || i >= members) {
      continue;
    }
    vec4 ends = texelFetch(uLookData, ivec2(i, ${MEMBER_ROW}), 0);
    int bin = int(texelFetch(uLookData, ivec2(i, ${BIN_ROW}), 0).x + 0.5);
    for (int band = 0; band < ${FADE_BANDS}; band++) {
      vec2 from = mix(ends.xy, ends.zw, float(band) / ${f(FADE_BANDS)});
      vec2 to = mix(ends.xy, ends.zw, float(band + 1) / ${f(FADE_BANDS)});
      float d = dsToSegment(q, from, to);
      int slot = band * ${LEVEL_BINS} + bin;
      pieces[slot] = max(pieces[slot], lookStroke(d, memberWidth));
      glowPieces[slot] = max(glowPieces[slot], dsSoftStroke(d, glowWidth));
    }
  }
  for (int band = 0; band < ${FADE_BANDS}; band++) {
    float fade = ${f(member.fade(0))} - float(band) * ${f(member.fade(0) - member.fade(1))};
    for (int bin = 0; bin < ${LEVEL_BINS}; bin++) {
      float burn = ${f(member.burn(0))} + float(bin) * ${f(member.burn(1) - member.burn(0))};
      picture = lookOver(picture, lookPaint(paint, dsOpacity() * min(1.0, fade * burn) * pieces[band * ${LEVEL_BINS} + bin]));
    }
  }
  float footing = dsToSegment(q, vec2(p6.y, floorY), vec2(p6.z, floorY));
  picture = lookOver(picture, lookPaint(paint, dsOpacity() * ${f(TRUSS_INKS.footing)} * lookStroke(footing, memberWidth)));

  // What the page lays down at a third of its resolution: the truss's glow
  // on the beat, the sea's swells, the haze on the waterline.
  if (thump > 0.0) {
    for (int band = 0; band < ${FADE_BANDS}; band++) {
      float fade = ${f(member.fade(0))} - float(band) * ${f(member.fade(0) - member.fade(1))};
      for (int bin = 0; bin < ${LEVEL_BINS}; bin++) {
        float burn = ${f(member.burn(0))} + float(bin) * ${f(member.burn(1) - member.burn(0))};
        picture = lookOver(picture, lookPaint(paint, dsOpacity() * fade * burn * thump * ${f(member.glowAlpha)} * glowPieces[band * ${LEVEL_BINS} + bin]));
      }
    }
  }
  float seaLeft = p4.x;
  float seaPitch = max(1e-3, p4.y);
  int seaSamples = int(p4.z + 0.5);
  float seaAt = (q.x - seaLeft) / seaPitch;
  int seaIndex = clamp(int(floor(seaAt)), 0, max(0, seaSamples - 2));
  float mixAt = clamp(seaAt - float(seaIndex), 0.0, 1.0);
  float across = trussSoft(seaLeft - q.x) * trussSoft(q.x - (seaLeft + seaPitch * float(seaSamples - 1)));
  float above = mix(texelFetch(uLookData, ivec2(seaIndex, ${SEA_ROW}), 0).x, texelFetch(uLookData, ivec2(seaIndex + 1, ${SEA_ROW}), 0).x, mixAt);
  for (int row = 0; row < ${SEA_ROWS}; row++) {
    float below = row + 1 < ${SEA_ROWS}
      ? mix(texelFetch(uLookData, ivec2(seaIndex, ${SEA_ROW} + row + 1), 0).x, texelFetch(uLookData, ivec2(seaIndex + 1, ${SEA_ROW} + row + 1), 0).x, mixAt)
      : trussParam(9).w;
    float strip = trussSoft(above - q.y) * trussSoft(q.y - below) * across;
    float near = float(row + 1) / ${f(SEA_ROWS)};
    float shade = row % 2 == 0 ? 1.0 : 0.7;
    picture = lookOver(picture, lookPaint(paint, dsOpacity() * (0.06 + near * 0.3) * shade * (0.8 + bass * 0.5) * strip));
    above = below;
  }
  float horizon = p4.w;
  float haze = p5.x;
  float hazeTop = horizon - haze;
  float hazeBottom = horizon + haze * ${f(TRUSS_INKS.haze.below)};
  if (q.y >= hazeTop && q.y <= hazeBottom && q.x >= p5.y && q.x <= p5.y + p5.z) {
    float t = (q.y - hazeTop) / max(1e-3, hazeBottom - hazeTop);
    ${(() => {
      const { stops } = TRUSS_INKS.haze;
      return `float mist = ${stops
        .slice(1)
        .map(
          (stop, index) =>
            `t <= ${f(stop.at)} ? mix(${f(stops[index].alpha)}, ${f(stop.alpha)}, (t - ${f(stops[index].at)}) / ${f(stop.at - stops[index].at)}) : `,
        )
        .join('')}0.0;`;
    })()}
    picture = lookOver(picture, lookPaint(vec3(1.0), dsOpacity() * (${f(TRUSS_INKS.haze.alpha(0))} + bass * ${f(TRUSS_INKS.haze.alpha(1) - TRUSS_INKS.haze.alpha(0))}) * mist));
  }

  // The horizon.
  float line = dsToSegment(q, vec2(p5.w, horizon), vec2(p6.x, horizon));
  picture = lookOver(picture, lookPaint(vec3(1.0), dsOpacity() * ${f(TRUSS_INKS.horizon.alpha)} * lookStroke(line, ${f(TRUSS_INKS.horizon.width)})));

  // The piers and the towers, above the deck and below it: filled, then
  // edged.
  int piers = int(p2.x + 0.5);
  int towers = int(p2.y + 0.5);
  int lower = int(p2.z + 0.5);
  vec3 fillPaint = dsFilled() ? paint : ${ink(body.openColour).rgb};
  float fillAlpha = dsFilled() ? ${f(body.filled)} : ${f(body.open)};
  vec3 bodies = vec3(0.0);
  vec3 edges = vec3(1e5);
  for (int k = 0; k < 16; k++) {
    if (k >= piers + towers + lower) {
      break;
    }
    vec4 ab = texelFetch(uLookData, ivec2(k, ${QUAD_ROW}), 0);
    vec4 cd = texelFetch(uLookData, ivec2(k, ${QUAD_ROW + 1}), 0);
    float solid = lookFill(trussQuad(q, ab.xy, ab.zw, cd.xy, cd.zw));
    float rim = trussQuadEdge(q, ab.xy, ab.zw, cd.xy, cd.zw);
    int group = k < piers ? 0 : (k < piers + towers ? 1 : 2);
    bodies[group] = max(bodies[group], solid);
    edges[group] = min(edges[group], rim);
  }
  for (int group = 0; group < 3; group++) {
    picture = lookOver(picture, lookPaint(fillPaint, dsOpacity() * fillAlpha * bodies[group]));
  }
  picture = lookOver(picture, lookPaint(paint, dsOpacity() * ${f(outline.piers)} * lookStroke(edges.x, ${f(outline.width)})));
  picture = lookOver(picture, lookPaint(paint, dsOpacity() * ${f(outline.towers)} * lookStroke(edges.y, ${f(outline.width)})));
  picture = lookOver(picture, lookPaint(paint, dsOpacity() * ${f(outline.towers)} * lookStroke(edges.z, ${f(outline.width)})));
  // The bracing, above the deck then below it.
  int braceAbove = int(p3.x + 0.5);
  int braceBelow = int(p3.y + 0.5);
  vec2 braces = vec2(1e5);
  for (int k = 0; k < 64; k++) {
    if (k >= braceAbove + braceBelow) {
      break;
    }
    vec4 brace = texelFetch(uLookData, ivec2(k, ${BRACE_ROW}), 0);
    float d = dsToSegment(q, brace.xy, brace.zw);
    if (k < braceAbove) {
      braces.x = min(braces.x, d);
    } else {
      braces.y = min(braces.y, d);
    }
  }
  picture = lookOver(picture, lookPaint(paint, dsOpacity() * ${f(TRUSS_INKS.bracing.alpha)} * lookStroke(braces.x, ${f(TRUSS_INKS.bracing.width)})));
  picture = lookOver(picture, lookPaint(paint, dsOpacity() * ${f(TRUSS_INKS.bracing.alpha)} * lookStroke(braces.y, ${f(TRUSS_INKS.bracing.width)})));

  // The hangers, the lamps and what they throw, and their light on the
  // water: one of each to a hanger, found by where q is across.
  int hangers = int(p1.z + 0.5);
  int hanger = trussFind(${HANGER_ROW}, hangers, q.x);
  float hangerLine = 1e5;
  float cones = 0.0;
  vec2 lamps = vec2(0.0);
  float waterLight = 1e5;
  for (int k = -2; k <= 3; k++) {
    int i = hanger + k;
    if (i < 0 || i >= hangers) {
      continue;
    }
    vec4 segment = texelFetch(uLookData, ivec2(i, ${HANGER_ROW}), 0);
    hangerLine = min(hangerLine, dsToSegment(q, segment.xy, segment.zw));
    vec4 lamp = texelFetch(uLookData, ivec2(i, ${LAMP_ROW}), 0);
    float lit = lookFill(length(q - lamp.xy) - lamp.z);
    if (lamp.w > 0.5) {
      lamps.y = max(lamps.y, lit);
    } else {
      lamps.x = max(lamps.x, lit);
    }
    vec4 ab = texelFetch(uLookData, ivec2(i, ${CONE_ROW}), 0);
    vec4 cd = texelFetch(uLookData, ivec2(i, ${CONE_ROW + 1}), 0);
    cones = max(cones, lookFill(trussQuad(q, ab.xy, ab.zw, cd.xy, cd.zw)));
    vec4 light = texelFetch(uLookData, ivec2(i, ${REFLECT_ROW}), 0);
    waterLight = min(waterLight, dsToSegment(q, light.xy, light.zw));
  }
  int beacons = int(p3.z + 0.5);
  for (int k = 0; k < ${STREAK_AT}; k++) {
    if (k >= beacons) {
      break;
    }
    vec4 lamp = texelFetch(uLookData, ivec2(k, ${MISC_ROW}), 0);
    float lit = lookFill(length(q - lamp.xy) - lamp.z);
    if (lamp.w > 0.5) {
      lamps.y = max(lamps.y, lit);
    } else {
      lamps.x = max(lamps.x, lit);
    }
  }
  int streaks = int(p3.w + 0.5);
  for (int k = 0; k < 8; k++) {
    if (k >= streaks) {
      break;
    }
    vec4 streak = texelFetch(uLookData, ivec2(${STREAK_AT} + k, ${MISC_ROW}), 0);
    waterLight = min(waterLight, dsToSegment(q, streak.xy, streak.zw));
  }
  picture = lookOver(picture, lookPaint(paint, dsOpacity() * ${f(TRUSS_INKS.hangers.alpha)} * lookStroke(hangerLine, ${f(TRUSS_INKS.hangers.width)})));

  // The cables: a tint of the look's colour under a white wire, both
  // pumping with the bass.
  float wire = dsNearest(q, ${CABLE_ROW}, int(p2.w + 0.5), 8.0).x;
  picture = lookOver(picture, lookPaint(paint, dsOpacity() * (${f(cable.tintAlpha(0))} + bass * ${f(cable.tintAlpha(1) - cable.tintAlpha(0))}) * lookStroke(wire, ${f(cable.tintWidth(0))} + bass * ${f(cable.tintWidth(1) - cable.tintWidth(0))})));
  float wireAlpha = ${f(cable.wireAlpha(0, 0))} + bass * ${f(cable.wireAlpha(1, 0) - cable.wireAlpha(0, 0))} + thump * ${f(cable.wireAlpha(0, 1) - cable.wireAlpha(0, 0))};
  float wireWidth = ${f(cable.wireWidth(0, 0))} + bass * ${f(cable.wireWidth(1, 0) - cable.wireWidth(0, 0))} + thump * ${f(cable.wireWidth(0, 1) - cable.wireWidth(0, 0))};
  picture = lookOver(picture, lookPaint(vec3(1.0), dsOpacity() * wireAlpha * lookStroke(wire, wireWidth)));

  // Not filled, the deck line is the figure.
  if (!dsFilled() && stroke > 0.0) {
    picture = lookOver(picture, lookPaint(paint, dsOpacity() * lookStroke(deck, stroke)));
  }

  // The road: the asphalt, its lower edge, the centre line.
  picture = lookOver(picture, lookPaint(${ink(TRUSS_INKS.asphalt.colour).rgb}, dsOpacity() * ${f(TRUSS_INKS.asphalt.alpha)} * lookStroke(deck, roadHalf * 2.0)));
  float edge = dsNearest(q - vec2(0.0, roadHalf), ${ROAD_ROW}, roadCount, 4.0).x;
  picture = lookOver(picture, lookPaint(vec3(1.0), dsOpacity() * ${f(TRUSS_INKS.edge.alpha)} * lookStroke(edge, ${f(TRUSS_INKS.edge.width)})));
  int dashes = int(p1.w + 0.5);
  int dash = int(floor((q.x - p7.z) / max(1e-3, p7.w)));
  float centre = 1e5;
  for (int k = -1; k <= 1; k++) {
    int i = dash + k;
    if (i < 0 || i >= dashes) {
      continue;
    }
    vec4 piece = texelFetch(uLookData, ivec2(i, ${DASH_ROW}), 0);
    centre = min(centre, dsToSegment(q, piece.xy, piece.zw));
  }
  picture = lookOver(picture, lookPaint(vec3(1.0), dsOpacity() * ${f(TRUSS_INKS.dash.alpha)} * lookStroke(centre, max(1.0, roadHalf * 0.3))));

  // The cars, each in its own colour: its glow, its body, its window and
  // tyres, the rims and the hubs.
  int cars = int(trussParam(9).z + 0.5);
  for (int c = 0; c < ${CAR_COLOURS.length}; c++) {
    if (c >= cars) {
      break;
    }
    vec4 pose = texelFetch(uLookData, ivec2(c * 2, ${CAR_ROW}), 0);
    vec4 more = texelFetch(uLookData, ivec2(c * 2 + 1, ${CAR_ROW}), 0);
    float size = more.x;
    float level = more.y;
    vec3 colour = CAR_INKS[c];
    vec2 d = q - pose.xy;
    // In the car's own units, before its size and tilt.
    vec2 local = vec2(d.x * pose.z + d.y * pose.w, -d.x * pose.w + d.y * pose.z) / max(1e-3, size);
    vec4 boxes[2] = vec4[2](${CAR_BODY.map(box).join(', ')});
    float inBody = 1e5;
    float bodyEdge = 1e5;
    for (int b = 0; b < 2; b++) {
      vec4 part = boxes[b];
      float sd = nightBox(local, part.xy + part.zw * 0.5, part.zw * 0.5) * size;
      inBody = min(inBody, sd);
      bodyEdge = min(bodyEdge, abs(sd));
    }
    vec4 window = ${box(CAR_WINDOW)};
    float windowSd = nightBox(local, window.xy + window.zw * 0.5, window.zw * 0.5) * size;
    float tyre = 1e5;
    float hub = 1e5;
    for (int w = 0; w < ${CAR_WHEELS.length}; w++) {
      vec2 middle = vec2(float(w) * ${f(CAR_WHEELS[1] - CAR_WHEELS[0])} + ${f(CAR_WHEELS[0])}, ${f(CAR_WHEEL_Y)});
      float fromMiddle = length(local - middle) * size;
      tyre = min(tyre, fromMiddle - ${f(CAR_TYRE)} * size);
      hub = min(hub, fromMiddle - ${f(CAR_HUB)} * size);
    }
    ${carInk.glow
      .map(
        (glow) =>
          `picture = lookOver(picture, lookPaint(colour, dsOpacity() * level * ${f(glow.alpha)} * lookStroke(bodyEdge, ${f(glow.width(0))} + level * ${f(glow.width(1) - glow.width(0))})));`,
      )
      .join('\n    ')}
    if (dsFilled()) {
      picture = lookOver(picture, lookPaint(colour, dsOpacity() * lookFill(inBody)));
      picture = lookOver(picture, lookPaint(${DARK.rgb}, dsOpacity() * lookFill(min(windowSd, tyre))));
    } else {
      picture = lookOver(picture, lookPaint(colour, dsOpacity() * lookStroke(bodyEdge, ${f(carInk.outline)})));
      picture = lookOver(picture, lookPaint(colour, dsOpacity() * ${f(carInk.darkOutline)} * lookStroke(min(abs(windowSd), abs(tyre)), ${f(carInk.outline)})));
    }
    picture = lookOver(picture, lookPaint(vec3(1.0), dsOpacity() * ${f(carInk.rim.alpha)} * lookStroke(abs(tyre), ${f(carInk.rim.width)})));
    picture = lookOver(picture, lookPaint(colour, dsOpacity() * ${f(carInk.hub)} * lookFill(hub)));
  }

  // The lamps' light on the road, the lamps, their light on the water.
  picture = lookOver(picture, lookPaint(vec3(1.0), dsOpacity() * (${f(TRUSS_INKS.cone(0))} + thump * ${f(TRUSS_INKS.cone(1) - TRUSS_INKS.cone(0))}) * cones));
  picture = lookOver(picture, lookPaint(paint, dsOpacity() * ${f(TRUSS_INKS.lampOff)} * lamps.x));
  picture = lookOver(picture, lookPaint(vec3(1.0), dsOpacity() * (${f(TRUSS_INKS.lampOn(0))} + thump * ${f(TRUSS_INKS.lampOn(1) - TRUSS_INKS.lampOn(0))}) * lamps.y));
  picture = lookOver(picture, lookPaint(vec3(1.0), dsOpacity() * (${f(TRUSS_INKS.reflection.alpha(0))} + thump * ${f(TRUSS_INKS.reflection.alpha(1) - TRUSS_INKS.reflection.alpha(0))}) * lookStroke(waterLight, ${f(TRUSS_INKS.reflection.width)})));

  // The fireworks, as their strokes were laid down for this copy.
  return lookOver(picture, texture(uLookStrokes, vec2(uv.x, (uv.y + float(copy)) * 0.5)));
}

vec4 sceneColour(vec2 uv) {
  vec2 p = lookPoint(uv);
  vec4 picture = vec4(0.0);
  for (int copy = 0; copy < 2; copy++) {
    if (dsCopy(copy).z > 0.5) {
      picture = trussCopy(picture, p, uv, copy);
    }
  }
  return picture;
}
`;

/** What the page hands the engine for the bridge, beside the frame. */
export interface ITrussScene {
  bridge: TrussBridgeLayout;
}

/**
 * The cable as one line left to right: the left side span and the main
 * span, then the right side span, which the page strokes from its anchor
 * inward, turned round to carry on from the tower.
 */
const cableLine = (cables: readonly Projected[][]): Projected[] => {
  const [main = [], right = []] = cables;
  return [...main, ...[...right].reverse().slice(1)];
};

/** The fireworks as strokes on the screen, every copy's. */
const writeFireworks = (
  input: IEngineLookInput,
  frame: IDesignedFrame,
  bridge: TrussBridgeLayout,
): void => {
  const floats = MAX_STROKE_POINTS * STROKE_FLOATS;
  const points =
    input.strokes && input.strokes.points.length === floats
      ? input.strokes.points
      : new Float32Array(floats);
  let count = 0;
  const put = (
    x: number,
    y: number,
    flags: number,
    width: number,
    [red, green, blue]: readonly number[],
    alpha: number,
  ) => {
    if (count >= MAX_STROKE_POINTS) {
      return;
    }
    points.set(
      [x, y, flags, width, red, green, blue, alpha],
      count * STROKE_FLOATS,
    );
    count += 1;
  };
  const white = [1, 1, 1];
  const { firework: fireworkInk } = TRUSS_INKS;
  frame.copies.slice(0, 2).forEach((copy, index) => {
    const copyFlag = index * 4;
    const segments = (
      list: readonly TSegment[],
      width: number,
      colour: readonly number[],
      alpha: number,
      round: boolean,
    ) => {
      const ends = round ? 2 : 0;
      list.forEach(([from, to]) => {
        const a = sceneToScreen(frame, copy, from[0], from[1]);
        const b = sceneToScreen(frame, copy, to[0], to[1]);
        put(a.x, a.y, 1 + copyFlag, width, colour, 0);
        put(b.x, b.y, ends + copyFlag, width, colour, alpha * frame.opacity);
      });
    };
    bridge.fireworks.forEach((firework, rocket) => {
      // The canvas's ends carry over from the rocket before: the first
      // rocket's reflection and ring are flat-ended, every later one's
      // round, as its last band left them.
      const carried = rocket > 0;
      const head = firework.strokes[firework.strokes.length - 1];
      if (firework.reflection && head) {
        segments(
          firework.reflection,
          fireworkInk.reflectionWidth,
          fireworkRgb(head.hue, fireworkInk.reflectionLightness),
          firework.reflectionAlpha,
          carried,
        );
      }
      if (firework.flash) {
        const { x, y, r } = firework.flash;
        segments(
          [
            [
              [x, y],
              [x, y],
            ],
          ],
          r * 2,
          white,
          fireworkInk.flash,
          true,
        );
      }
      if (firework.ring) {
        const { x, y, r } = firework.ring;
        const ring: TSegment[] = Array.from(
          { length: RING_PIECES },
          (_, piece): TSegment => {
            const from = (piece / RING_PIECES) * Math.PI * 2;
            const to = ((piece + 1) / RING_PIECES) * Math.PI * 2;
            return [
              [x + Math.cos(from) * r, y + Math.sin(from) * r],
              [x + Math.cos(to) * r, y + Math.sin(to) * r],
            ];
          },
        );
        segments(ring, firework.ringWidth, white, firework.ringAlpha, true);
      }
      firework.strokes.forEach((stroke) => {
        segments(
          stroke.segments,
          stroke.width,
          fireworkRgb(stroke.hue, stroke.lightness),
          stroke.alpha,
          Boolean(stroke.round),
        );
      });
      if (firework.twinkle) {
        segments(
          firework.twinkle,
          fireworkInk.twinkle.width,
          white,
          fireworkInk.twinkle.alpha,
          true,
        );
      }
    });
  });
  input.strokes = { points, count };
};

const step = (
  frame: IDesignedFrame,
  scene: ITrussScene,
  input: IEngineLookInput,
): void => {
  const { bridge } = scene;
  const grid = nightStarGrid(
    bridge.stars.map((star) => ({ ...star, round: true })),
  );
  const cable = cableLine(bridge.cables);
  const { sea } = bridge;
  const seaSamples = sea.steps + 1;
  const quads = [...bridge.piers, ...bridge.towers, ...bridge.towersBelow];
  const braces = [...bridge.bracing, ...bridge.bracingBelow];
  const across = Math.max(
    16,
    bridge.road.length,
    bridge.members.length,
    bridge.hangers.length,
    quads.length,
    braces.length,
    cable.length,
    bridge.dashes.length,
    seaSamples,
    bridge.cars.length * 2,
    grid.sorted.length,
    grid.spans.length,
  );
  const data = sizeLookData(input, across, ROWS);
  data.fill(0);
  const put = (row: number, index: number, values: number[]) => {
    data.set(values, (row * across + index) * 4);
  };
  const segment = (row: number, index: number, [a, b]: readonly Projected[]) =>
    put(row, index, [a[0], a[1], b[0], b[1]]);
  const quad = (row: number, index: number, corners: readonly Projected[]) => {
    segment(row, index, [corners[0], corners[1]]);
    segment(row + 1, index, [corners[2], corners[3]]);
  };

  bridge.road.forEach(([x, y], index) => put(ROAD_ROW, index, [x, y, 0, 0]));
  bridge.members.forEach(({ from, to, bin }, index) => {
    segment(MEMBER_ROW, index, [from, to]);
    put(BIN_ROW, index, [bin, 0, 0, 0]);
  });
  bridge.hangers.forEach((hanger, index) => {
    segment(HANGER_ROW, index, hanger);
    const lamp = bridge.lamps[index];
    put(LAMP_ROW, index, [lamp.x, lamp.y, lamp.r, lamp.on ? 1 : 0]);
    quad(CONE_ROW, index, bridge.lampCones[index]);
    segment(REFLECT_ROW, index, bridge.reflections[index]);
  });
  quads.forEach((corners, index) => quad(QUAD_ROW, index, corners));
  braces.forEach((brace, index) => segment(BRACE_ROW, index, brace));
  bridge.beacons.forEach(({ x, y, r, on }, index) => {
    put(MISC_ROW, index, [x, y, r, on ? 1 : 0]);
  });
  bridge.streaks.forEach((streak, index) => {
    segment(MISC_ROW, STREAK_AT + index, streak);
  });
  cable.forEach(([x, y], index) => put(CABLE_ROW, index, [x, y, 0, 0]));
  bridge.dashes.forEach((dash, index) => segment(DASH_ROW, index, dash));
  const seaPitch = sea.width / sea.steps;
  for (let row = 0; row < SEA_ROWS; row += 1) {
    for (let sample = 0; sample < seaSamples; sample += 1) {
      put(SEA_ROW + row, sample, [
        seaRowY(sea, row, sea.left + seaPitch * sample),
        0,
        0,
        0,
      ]);
    }
  }
  bridge.cars.forEach((car, index) => {
    put(CAR_ROW, index * 2, [car.x, car.y, car.cos, car.sin]);
    put(CAR_ROW, index * 2 + 1, [car.size, car.level, 0, 0]);
  });
  writeNightStars(grid, put, STAR_ROW, CELL_ROW);

  const { plot } = frame;
  const plotWidth = plot.right - plot.left;
  const joints = bridge.members
    .filter((_, index) => index % 2 === 0)
    .map(({ from }) => from[0]);
  const firstDash = bridge.dashes[0]?.[0][0] ?? 0;
  const dashPitch =
    bridge.dashes.length > 1 ? bridge.dashes[1][0][0] - firstDash : 1;
  const params = [
    [
      frame.sceneBase,
      bridge.roadHalf,
      bridge.road.length,
      bridge.members.length,
    ],
    [
      joints[0] ?? 0,
      joints.length > 1 ? joints[1] - joints[0] : 1,
      bridge.hangers.length,
      bridge.dashes.length,
    ],
    [
      bridge.piers.length,
      bridge.towers.length,
      bridge.towersBelow.length,
      cable.length,
    ],
    [
      bridge.bracing.length,
      bridge.bracingBelow.length,
      bridge.beacons.length,
      bridge.streaks.length,
    ],
    [sea.left, seaPitch, seaSamples, bridge.horizon],
    [
      bridge.horizonHaze,
      plot.left - plotWidth,
      plotWidth * 3,
      plot.left - plotWidth,
    ],
    [
      plot.right + plotWidth,
      bridge.footing[0],
      bridge.footing[1],
      bridge.lampR,
    ],
    [bridge.thump, bridge.bass, firstDash, dashPitch],
    [grid.left, grid.top, grid.cellWidth, grid.cellHeight],
    [grid.columns, grid.rows, bridge.cars.length, seaRowY(sea, SEA_ROWS, 0)],
  ];
  params.forEach((values, index) => put(PARAM_ROW, index, values));
  writeFireworks(input, frame, bridge);
};

const trussLook = { glsl: GLSL, step };

export default trussLook;

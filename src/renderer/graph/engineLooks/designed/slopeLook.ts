/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { Projected } from 'common/graphStyles';
import { slopeArrows } from 'common/graphShapes';
import { GLOW_LAYERS } from '../../figureGlow';
import {
  FIELD_COLUMNS,
  FIELD_ROWS,
  TICK_HEAD_BACK,
  TICK_HEAD_SPREAD,
  traceFieldPulse,
  type IPathSink,
  type SlopeFieldLayout,
} from '../../slopeField';
import type { SlopeFlowSets } from '../../slopeFlow';
import {
  LINE_FLOATS,
  MAX_LINE_POINTS,
  type IEngineLookInput,
} from '../engineLookInput';
import { setLookVector, sizeLookData } from '../lookInput';
import { sceneToScreen, type IDesignedFrame } from './designedInput';

/**
 * The SLOPE FIELD on the GPU (`slopeField.ts`, `slopeFlow.ts`, painted by
 * the page in `LiveTraceCanvas`): the arrows' fading trails, the field of
 * ticks over the window in its three bands, the beat's band leaving the
 * curve, the motes riding the flow, the halo and the arrows — each copy of
 * the drawing in that order, as the page paints it.
 *
 *   uLook[8]  the field's grid: its left and top, a column, a row
 *   uLook[9]  a tick's half-length, the bands' lift with the bass, how far
 *             the beat's band has travelled and how strong it is
 *   uLook[10] the three bands' widths, the beat's band's
 *   uLook[11] the three bands' alphas, the beat's band's points
 *   uLook[12] an arrow's length, its head's depth and spread
 *   uLook[13] the motes' heads' alpha, their trails'
 *   texel (i, s)          set s's arrow i: where it stands, which way it
 *                         points — s 0 the arrows, then their trails
 *   texel (s, SET_ROW)    set s's arrows, alpha, width against the trace's
 *   texel (c, TICK_ROW+r) the tick at grid point (c, r): its half-vector,
 *                         its band
 *   texel (i, PULSE_ROW)  the curve the beat's band is drawn along
 *   uLookLines            the motes: each copy's trails and heads
 */

const SETS = 4;
const SET_ROW = SETS;
const TICK_ROW = SET_ROW + 1;
const PULSE_ROW = TICK_ROW + FIELD_ROWS + 1;
/** Straight pieces each of the beat's band's quadratics is drawn with. */
const PULSE_PIECES = 4;
const f = (value: number) => value.toFixed(6);
const WIDEST_GLOW = Math.max(...GLOW_LAYERS.map(({ widen }) => widen));

const GLSL = `
const int SET_ROW = ${SET_ROW};
const int TICK_ROW = ${TICK_ROW};
const int PULSE_ROW = ${PULSE_ROW};

uniform sampler2D uLookLines;

// How far q is from one arrow: its shaft and the two barbs of its head.
float slopeArrow(vec2 q, vec4 arrow) {
  vec2 u = arrow.zw;
  vec2 tip = arrow.xy + u * uLook[12].x * 0.5;
  vec2 tail = arrow.xy - u * uLook[12].x * 0.5;
  vec2 back = tip - u * uLook[12].y;
  vec2 side = vec2(-u.y, u.x) * uLook[12].y * uLook[12].z;
  return min(dsToSegment(q, tail, tip), min(dsToSegment(q, back + side, tip), dsToSegment(q, back - side, tip)));
}

// How far q is from the nearest arrow of a set, looking within reach of it.
float slopeArrows(vec2 q, int set, float reach) {
  int count = int(texelFetch(uLookData, ivec2(set, SET_ROW), 0).x + 0.5);
  if (count < 1) {
    return 1e5;
  }
  int from = dsSegment(set, count, q.x);
  float best = 1e5;
  for (int k = 0; k < 64; k++) {
    int i = from - k;
    if (i < 0) {
      break;
    }
    vec4 arrow = texelFetch(uLookData, ivec2(i, set), 0);
    if (arrow.x < q.x - reach) {
      break;
    }
    best = min(best, slopeArrow(q, arrow));
  }
  for (int k = 1; k < 64; k++) {
    int i = from + k;
    if (i >= count) {
      break;
    }
    vec4 arrow = texelFetch(uLookData, ivec2(i, set), 0);
    if (arrow.x > q.x + reach) {
      break;
    }
    best = min(best, slopeArrow(q, arrow));
  }
  return best;
}

// A segment stroked width wide with flat ends: its signed distance.
float slopeButt(vec2 q, vec2 a, vec2 b, float width) {
  vec2 ab = b - a;
  float span = length(ab);
  if (span < 1e-4) {
    return 1e5;
  }
  vec2 u = ab / span;
  vec2 rel = q - a;
  float along = dot(rel, u);
  float across = abs(dot(rel, vec2(-u.y, u.x)));
  return max(across - width * 0.5, max(-along, along - span));
}

// The tick at grid point (c, r): how much of q it covers, and its band.
vec2 slopeTick(vec2 q, int c, int r) {
  if (c < 0 || c > ${FIELD_COLUMNS} || r < 0 || r > ${FIELD_ROWS}) {
    return vec2(0.0, 2.0);
  }
  vec4 tick = texelFetch(uLookData, ivec2(c, TICK_ROW + r), 0);
  int band = int(tick.z + 0.5);
  float width = band == 0 ? uLook[10].x : (band == 1 ? uLook[10].y : uLook[10].z);
  vec2 centre = uLook[8].xy + vec2(float(c), float(r)) * uLook[8].zw;
  vec2 tip = centre + tick.xy;
  float distance = slopeButt(q, centre - tick.xy, tip, width);
  // A head on the two bands near the curve: barbs with flat ends, joined
  // round at the tip.
  if (band < 2) {
    vec2 u = tick.xy / max(1e-4, uLook[9].x);
    float wing = uLook[9].x * ${f(TICK_HEAD_BACK)};
    vec2 back = tip - u * wing;
    vec2 side = vec2(-u.y, u.x) * wing * ${f(TICK_HEAD_SPREAD)};
    distance = min(distance, min(slopeButt(q, back + side, tip, width), slopeButt(q, back - side, tip, width)));
    distance = min(distance, length(q - tip) - width * 0.5);
  }
  return vec2(lookFill(distance), float(band));
}

vec4 slopeCopy(vec4 picture, vec2 p, vec2 uv, int copy) {
  vec2 q = dsScene(p, copy);
  float stroke = dsStrokeWidth();
  float arrowSpan = uLook[12].x;
  // The trails the arrows leave, oldest first.
  for (int s = 1; s < ${SETS}; s++) {
    vec4 set = texelFetch(uLookData, ivec2(s, SET_ROW), 0);
    float width = stroke * set.z;
    float d = slopeArrows(q, s, arrowSpan * 0.5 + width * 0.5 + 2.0);
    picture = lookOver(picture, lookPaint(dsPaint(q), dsOpacity() * set.y * lookStroke(d, width)));
  }
  // The field, from its faintest band to its brightest: the four grid
  // points around q, each tick in its own cell.
  vec2 cell = floor((q - uLook[8].xy) / uLook[8].zw);
  vec3 bands = vec3(0.0);
  for (int k = 0; k < 4; k++) {
    vec2 tick = slopeTick(q, int(cell.x) + k % 2, int(cell.y) + k / 2);
    int band = int(tick.y + 0.5);
    bands[band] = max(bands[band], tick.x);
  }
  float lift = uLook[9].y;
  picture = lookOver(picture, lookPaint(dsPaint(q), dsOpacity() * uLook[11].z * lift * bands.z));
  picture = lookOver(picture, lookPaint(dsPaint(q), dsOpacity() * uLook[11].y * lift * bands.y));
  picture = lookOver(picture, lookPaint(dsPaint(q), dsOpacity() * uLook[11].x * lift * bands.x));
  // The beat's band: the curve offset above and below by how far it has
  // travelled, one stroke for both.
  if (uLook[9].w > 0.0) {
    int count = int(uLook[11].w + 0.5);
    float width = uLook[10].w;
    float travelled = uLook[9].z;
    float reach = width + 2.0;
    float d = min(
      dsNearest(q + vec2(0.0, travelled), PULSE_ROW, count, reach).x,
      dsNearest(q - vec2(0.0, travelled), PULSE_ROW, count, reach).x
    );
    picture = lookOver(picture, lookPaint(dsPaint(q), dsOpacity() * uLook[9].w * lookStroke(d, width)));
  }
  // The motes: white heads, then trails in the look's colour.
  vec4 motes = texture(uLookLines, uv);
  float head = copy == 0 ? motes.g : motes.a;
  float trail = copy == 0 ? motes.r : motes.b;
  picture = lookOver(picture, lookPaint(vec3(1.0), dsOpacity() * uLook[13].x * head));
  picture = lookOver(picture, lookPaint(dsPaint(q), dsOpacity() * uLook[13].y * trail));
  // The halo round the arrows, and the arrows.
  float glowing = uLook[6].z > 0.0 ? (stroke + ${f(WIDEST_GLOW)} * uLook[6].w) * 0.5 + 4.0 : 0.0;
  float d = slopeArrows(q, 0, arrowSpan * 0.5 + max(stroke * 0.5 + 2.0, glowing));
  if (uLook[6].z > 0.0) {
    vec3 glow = dsGlowPaint(q);
    ${GLOW_LAYERS.map(
      ({ widen, opacity }) =>
        `picture = lookOver(picture, lookPaint(glow, ${f(opacity)} * uLook[6].z * dsSoftStroke(d, stroke + ${f(widen)} * uLook[6].w)));`,
    ).join('\n    ')}
  }
  if (stroke > 0.0) {
    picture = lookOver(picture, lookPaint(dsPaint(q), dsOpacity() * lookStroke(d, stroke)));
  }
  return picture;
}

vec4 sceneColour(vec2 uv) {
  vec2 p = lookPoint(uv);
  vec4 picture = vec4(0.0);
  for (int copy = 0; copy < 2; copy++) {
    if (dsCopy(copy).z > 0.5) {
      picture = slopeCopy(picture, p, uv, copy);
    }
  }
  return picture;
}
`;

/** What the page hands the engine for the slope, beside the frame. */
export interface ISlopeScene {
  field: SlopeFieldLayout;
  flow: SlopeFlowSets;
  /** The columns the arrows and the beat's band are laid along. */
  columns: readonly Projected[];
  gap: number;
}

/** The beat's band's curve, its quadratics cut into straight pieces. */
const pulseLine = (columns: readonly Projected[]): Projected[] => {
  const line: Projected[] = [];
  const sink: IPathSink = {
    moveTo: (x, y) => {
      line.push([x, y]);
    },
    lineTo: (x, y) => {
      line.push([x, y]);
    },
    quadraticCurveTo: (cx, cy, x, y) => {
      const [fromX, fromY] = line[line.length - 1] ?? [x, y];
      for (let piece = 1; piece <= PULSE_PIECES; piece += 1) {
        const t = piece / PULSE_PIECES;
        const a = (1 - t) * (1 - t);
        const b = 2 * (1 - t) * t;
        const c = t * t;
        line.push([a * fromX + b * cx + c * x, a * fromY + b * cy + c * y]);
      }
    },
  };
  if (columns.length > 1) {
    traceFieldPulse(sink, columns, 0);
  }
  return line;
};

/**
 * The motes as lines on the screen, every copy's: a trail kept at the
 * first width of a copy's pair and its head at the second — the first
 * copy's pair red and green, the second's blue and alpha.
 */
const writeMotes = (
  input: IEngineLookInput,
  frame: IDesignedFrame,
  field: SlopeFieldLayout,
): void => {
  const floats = MAX_LINE_POINTS * LINE_FLOATS;
  const points =
    input.lines && input.lines.points.length === floats
      ? input.lines.points
      : new Float32Array(floats);
  let count = 0;
  const put = (x: number, y: number, first: boolean, kept: number) => {
    if (count >= MAX_LINE_POINTS) {
      return;
    }
    const at = count * LINE_FLOATS;
    points[at] = x;
    points[at + 1] = y;
    points[at + 2] = first ? 1 : 0;
    points[at + 3] = kept;
    count += 1;
  };
  frame.copies.slice(0, 2).forEach((copy, index) => {
    const trailKept = index === 0 ? 1 : 4;
    const headKept = index === 0 ? 2 : 8;
    field.motes.forEach((trail) => {
      const onScreen = trail.map(([x, y]) => sceneToScreen(frame, copy, x, y));
      onScreen.forEach(({ x, y }, at) => put(x, y, at === 0, trailKept));
      const head = onScreen[onScreen.length - 1];
      const previous = onScreen[onScreen.length - 2] ?? head;
      put(previous.x, previous.y, true, headKept);
      put(head.x, head.y, false, headKept);
    });
  });
  const [head, trail] = field.flow;
  input.lines = {
    points,
    count,
    widths: [trail.width, head.width, trail.width, head.width],
  };
};

const step = (
  frame: IDesignedFrame,
  scene: ISlopeScene,
  input: IEngineLookInput,
): void => {
  const { field, flow, columns, gap } = scene;
  const sets = [
    { points: flow.figure, opacity: 1, width: 1 },
    ...flow.trails,
  ].map(({ points, opacity, width }) => ({
    arrows: points.length > 1 ? slopeArrows(points, gap) : undefined,
    opacity,
    width,
  }));
  const pulse = field.pulse.alpha > 0 ? pulseLine(columns) : [];
  const across = Math.max(
    FIELD_COLUMNS + 1,
    SETS,
    pulse.length,
    ...sets.map(({ arrows }) => arrows?.arrows.length ?? 0),
  );
  const data = sizeLookData(input, across, PULSE_ROW + 1);
  data.fill(0);
  sets.forEach(({ arrows, opacity, width }, set) => {
    arrows?.arrows.forEach(({ x, y, ux, uy }, index) => {
      data.set([x, y, ux, uy], (set * across + index) * 4);
    });
    data.set(
      [arrows?.arrows.length ?? 0, opacity, width, 0],
      (SET_ROW * across + set) * 4,
    );
  });
  field.ticks.forEach(({ dx, dy, band }, index) => {
    const column = Math.floor(index / (FIELD_ROWS + 1));
    const row = index % (FIELD_ROWS + 1);
    data.set([dx, dy, band, 0], ((TICK_ROW + row) * across + column) * 4);
  });
  pulse.forEach(([x, y], index) => {
    data.set([x, y, 0, 0], (PULSE_ROW * across + index) * 4);
  });
  const shape = sets[0].arrows ?? { length: 0, wing: 0, spread: 0 };
  setLookVector(
    input,
    8,
    field.left,
    field.top,
    field.columnStep,
    field.rowStep,
  );
  setLookVector(
    input,
    9,
    field.tick,
    0.85 + field.bass * 0.3,
    field.pulse.travelled,
    field.pulse.alpha,
  );
  const [near, middle, far] = field.bands;
  setLookVector(
    input,
    10,
    near.width,
    middle.width,
    far.width,
    Math.max(1, frame.strokeWidth * 0.8),
  );
  setLookVector(input, 11, near.alpha, middle.alpha, far.alpha, pulse.length);
  setLookVector(input, 12, shape.length, shape.wing, shape.spread, 0);
  const [head, trail] = field.flow;
  setLookVector(input, 13, head.alpha, trail.alpha, 0, 0);
  writeMotes(input, frame, field);
};

const slopeLook = { glsl: GLSL, step };

export default slopeLook;

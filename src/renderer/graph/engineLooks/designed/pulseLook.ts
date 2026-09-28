/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { GLOW_LAYERS } from '../../figureGlow';
import {
  PULSE_GRID_HEAVY,
  PULSE_TAIL_FRACTION,
  PULSE_TAIL_SLICES,
  echoDrift,
  pulseThump,
  type PulseMonitor,
  type pulseLayout,
} from '../../pulseMonitor';
import type { IEngineLookInput } from '../engineLookInput';
import { setLookVector, sizeLookData } from '../lookInput';
import type { IDesignedFrame } from './designedInput';

/**
 * The HEART MONITOR on the GPU (`pulseMonitor.ts`, painted by the page in
 * `LiveTraceCanvas`): the ruled paper and the write-head's afterglow on it,
 * the halo, the trace shut against the floor, the echoes of past beats
 * drifting away, the previous sweep dim, the tail brightening toward the
 * head, and the head itself — all from the layout the page cuts the trace
 * by (`pulseLayout`).
 *
 *   uLook[8]  vertices, the head's x, the tail's start, the gap's end
 *   uLook[9]  the thump, a square of paper, the paper's floor, its lift
 *   uLook[10] the paper's width and height, the afterglow's reach, echoes
 *   uLook[11] the head's y, the trace's ends, 1 where the paper shows
 *   uLook[12] a tail slice's width, the halo's two widths and alphas' ratio
 *   texel (i, 0)        the trace's vertex i
 *   texel (i, 1 + e)    echo e's vertex i
 *   texel (e, ECHO_ROW) echo e's drift, its light and its vertices
 */

const MAX_ECHOES = 6;
const ECHO_ROW = 1 + MAX_ECHOES;
const f = (value: number) => value.toFixed(6);

const GLSL = `
const int ECHO_ROW = ${ECHO_ROW};

vec4 pulsePaper(vec4 picture, vec2 p) {
  vec2 q = dsWave(p, 0);
  float cell = uLook[9].y;
  float floorY = uLook[9].z;
  float lift = uLook[9].w;
  float width = uLook[10].x;
  float height = uLook[10].y;
  float stretch = abs(dsCopy(0).y);
  float px = lookPixel();
  float down = clamp(0.5 + q.y * stretch / px, 0.0, 1.0) * clamp(0.5 + (height - q.y) * stretch / px, 0.0, 1.0);
  float across = clamp(0.5 + q.x / px, 0.0, 1.0) * clamp(0.5 + (width - q.x) / px, 0.0, 1.0);
  float column = floor(q.x / cell + 0.5);
  float vertical = column >= 0.0 && column * cell <= width + cell
    ? lookStroke(q.x - column * cell, 1.0) * down
    : 0.0;
  bool heavyColumn = mod(column, ${f(PULSE_GRID_HEAVY)}) < 0.5;
  float rung = floor(abs(q.y - floorY) / cell + 0.5);
  float row = floorY + sign(q.y - floorY) * rung * cell;
  float horizontal = row >= 0.0 && row <= height
    ? lookStroke((q.y - row) * stretch, stretch) * across
    : 0.0;
  bool heavyRow = mod(rung, ${f(PULSE_GRID_HEAVY)}) < 0.5;
  float fine = max(heavyColumn ? 0.0 : vertical, heavyRow ? 0.0 : horizontal);
  float heavy = max(heavyColumn ? vertical : 0.0, heavyRow ? horizontal : 0.0);
  vec3 ink = dsPaint(q);
  picture = lookOver(picture, lookPaint(ink, dsOpacity() * 0.12 * lift * fine));
  picture = lookOver(picture, lookPaint(ink, dsOpacity() * 0.3 * lift * heavy));
  // The write head lights the paper it is passing over.
  float reach = uLook[10].z;
  float from = uLook[8].y - reach;
  float glow = clamp((q.x - from) / max(1e-3, reach), 0.0, 1.0) * 0.1
    * step(from, q.x) * step(q.x, uLook[8].y) * down;
  return lookOver(picture, lookPaint(vec3(1.0), dsOpacity() * lift * glow));
}

vec4 pulseCopy(vec4 picture, vec2 p, int copy) {
  vec2 q = dsScene(p, copy);
  int count = int(uLook[8].x + 0.5);
  if (count < 2) {
    return picture;
  }
  float thump = uLook[9].x;
  float floorY = dsSceneBase();
  vec2 first = dsPoint(0, count, 0);
  vec2 last = dsPoint(0, count, count - 1);
  float haloWide = dsStrokeWidth() + ${f(GLOW_LAYERS[0].widen)} * uLook[6].w;
  float reach = max(haloWide, 6.0 + thump * 6.0) * 0.5 + lookPixel() * 3.0;
  vec2 near = dsNearest(q, 0, count, reach);
  // The trace shut against the floor: the figure, and what the halo follows.
  float outline = min(
    near.x,
    min(
      dsToSegment(q, last, vec2(last.x, floorY)),
      min(dsToSegment(q, vec2(last.x, floorY), vec2(first.x, floorY)), dsToSegment(q, vec2(first.x, floorY), first))
    )
  );
  if (uLook[6].z > 0.0) {
    vec3 glow = dsGlowPaint(q);
    ${GLOW_LAYERS.map(
      ({ widen, opacity }) =>
        `picture = lookOver(picture, lookPaint(glow, ${f(opacity)} * uLook[6].z * dsSoftStroke(outline, dsStrokeWidth() + ${f(widen)} * uLook[6].w)));`,
    ).join('\n    ')}
  }
  if (dsFilled()) {
    float lineY = dsLineAt(0, count, dsSegment(0, count, q.x), q.x);
    bool inside = q.x >= first.x && q.x <= last.x && q.y >= lineY && q.y <= floorY;
    float cover = clamp(0.5 + (inside ? outline : -outline) / lookPixel(), 0.0, 1.0);
    picture = lookOver(picture, lookPaint(dsPaint(q), dsOpacity() * dsFillOpacity() * cover));
  }
  // Echoes of past beats passing behind, each drifting up and away.
  int echoes = int(uLook[10].w + 0.5);
  for (int e = 0; e < ${MAX_ECHOES}; e++) {
    if (e >= echoes) {
      break;
    }
    vec4 drift = texelFetch(uLookData, ivec2(e, ECHO_ROW), 0);
    if (drift.z <= 0.0) {
      continue;
    }
    vec2 moved = q - drift.xy;
    float d = dsNearest(moved, 1 + e, int(drift.w + 0.5), 1.4).x;
    picture = lookOver(picture, lookPaint(dsPaint(moved), dsOpacity() * drift.z * 0.55 * lookStroke(d, 1.4)));
  }
  // The previous sweep, dim; then the tail brightening toward the head,
  // colour wide and faint under a white core; nothing in the wiped gap.
  float x = near.y;
  float head = uLook[8].y;
  float tail = uLook[8].z;
  float gap = uLook[8].w;
  if (x < tail || x > gap) {
    picture = lookOver(picture, lookPaint(dsPaint(q), dsOpacity() * 0.3 * lookStroke(near.x, 1.2)));
  } else if (x <= head && x >= uLook[11].y) {
    float slice = clamp(floor((x - tail) / max(1e-3, uLook[12].x)), 0.0, ${f(PULSE_TAIL_SLICES - 1)});
    float nearness = (slice + 1.0) / ${f(PULSE_TAIL_SLICES)};
    picture = lookOver(picture, lookPaint(dsPaint(q), dsOpacity() * nearness * (0.35 + thump * 0.3) * lookStroke(near.x, 3.0 + thump * 3.0)));
    picture = lookOver(picture, lookPaint(vec3(1.0), dsOpacity() * (0.3 + nearness * 0.7) * lookStroke(near.x, 1.2 + thump)));
  }
  // The write-head: a dot that flares on the thump.
  float toHead = length(q - vec2(head, uLook[11].x));
  picture = lookOver(picture, lookPaint(dsPaint(q), dsOpacity() * 0.5 * lookFill(toHead - (2.5 + thump * 4.0))));
  return lookOver(picture, lookPaint(vec3(1.0), dsOpacity() * lookFill(toHead - (1.6 + thump * 2.0))));
}

vec4 sceneColour(vec2 uv) {
  vec2 p = lookPoint(uv);
  vec4 picture = vec4(0.0);
  if (uLook[11].w > 0.5 && dsCopy(0).z > 0.5) {
    picture = pulsePaper(picture, p);
  }
  for (int copy = 0; copy < 2; copy++) {
    if (dsCopy(copy).z > 0.5) {
      picture = pulseCopy(picture, p, copy);
    }
  }
  return picture;
}
`;

/** What the page hands the engine for the monitor, beside the frame. */
export interface IPulseScene {
  monitor: PulseMonitor;
  layout: ReturnType<typeof pulseLayout>;
  clock: number;
  /** The paper, where the measurement grid is off and it shows. */
  paper?: { cell: number; floor: number; width: number; height: number };
}

const step = (
  frame: IDesignedFrame,
  scene: IPulseScene,
  input: IEngineLookInput,
): void => {
  const { monitor, layout, clock, paper } = scene;
  const echoes = monitor.echoes.slice(0, MAX_ECHOES);
  const across = Math.max(
    8,
    layout.vertices.length,
    ...echoes.map(({ vertices }) => vertices.length),
  );
  const data = sizeLookData(input, across, ECHO_ROW + 1);
  data.fill(0);
  layout.vertices.forEach(([x, y], index) => {
    data[index * 4] = x;
    data[index * 4 + 1] = y;
  });
  echoes.forEach((echo, e) => {
    const row = (1 + e) * across;
    echo.vertices.forEach(([x, y], index) => {
      data[(row + index) * 4] = x;
      data[(row + index) * 4 + 1] = y;
    });
    const drift = echoDrift(echo, clock, frame.depth);
    data.set(
      [drift.x, drift.y, drift.glow, echo.vertices.length],
      (ECHO_ROW * across + e) * 4,
    );
  });
  const thump = pulseThump(monitor, clock);
  const width = Math.max(1, layout.right - layout.left);
  setLookVector(
    input,
    8,
    layout.vertices.length,
    layout.headX,
    layout.tailStart,
    layout.gapEnd,
  );
  setLookVector(
    input,
    9,
    thump,
    paper?.cell ?? 1,
    paper?.floor ?? 0,
    0.55 + thump * 0.45,
  );
  setLookVector(
    input,
    10,
    paper?.width ?? 0,
    paper?.height ?? 0,
    (frame.plot.right - frame.plot.left) * 0.14,
    echoes.length,
  );
  setLookVector(
    input,
    11,
    layout.head[1],
    Math.max(layout.left, layout.tailStart),
    layout.right,
    paper ? 1 : 0,
  );
  setLookVector(
    input,
    12,
    (width * PULSE_TAIL_FRACTION) / PULSE_TAIL_SLICES,
    0,
    0,
    0,
  );
};

const pulseLook = { glsl: GLSL, step };

export default pulseLook;

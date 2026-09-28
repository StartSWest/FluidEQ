/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { GLOW_LAYERS } from '../../figureGlow';
import type { bubbleMoteLayout } from '../../bubbleMotes';
import {
  BUBBLE_BATCHES,
  GLINT_TURN,
  REFRACTION_FROM,
  REFRACTION_TO,
  type bubbleLayout,
} from '../../bubblePaths';
import type { IEngineLookInput } from '../engineLookInput';
import {
  pushRectSprite,
  pushSprite,
  setLookVector,
  sizeLookData,
  spritesSoFarUnder,
} from '../lookInput';
import { paintAt, sceneToScreen, type IDesignedFrame } from './designedInput';

/**
 * BUBBLES on the GPU (`bubblePaths.ts`, painted by the page in
 * `LiveTraceCanvas`): the specks rising behind, the halo round every bubble,
 * each bubble's rim, glassy body, glint and refracted band, the bursts'
 * spreading rims and their droplets, and the lightning between bubbles.
 *
 * A pixel asks only the bubbles of the bands near it: each band's three
 * rise at its own column, give or take a sway. The specks and the droplets
 * are sprites, the specks under the picture.
 *
 *   uLook[8]  bubbles, the first band's column, the bands' spacing, the
 *             widest reach of a bubble or a burst
 *   uLook[9]  lightning lines, the figure's own stroke (0 where filled)
 *   texel (3b + n, copy)  bubble b of that copy: n 0 its centre and radii
 *             (no radii, not drawn); n 1 its radius, its rim, its glint's
 *             centre; n 2 the glint's size, the refraction's radius, the
 *             burst's spread and age batch (-1, none)
 *   texel (i, LINES + l)  lightning line l's point i
 *   texel (l, LINE_ROW)   line l's copy, age batch, points, left
 *   texel (l, BOX_ROW)    its right, top, bottom
 */

const LINES = 2;
const MAX_LINES = 120;
const LINE_ROW = LINES + MAX_LINES;
const BOX_ROW = LINE_ROW + 1;
const f = (value: number) => value.toFixed(6);

const GLSL = `
const int LINES = ${LINES};
const int LINE_ROW = ${LINE_ROW};
const int BOX_ROW = ${BOX_ROW};

// How far q is from an ellipse's edge, near enough for a bubble that
// wobbles by a twentieth.
float bubbleEdge(vec2 q, vec2 centre, vec2 radii) {
  return (length((q - centre) / max(radii, vec2(1e-3))) - 1.0) * min(radii.x, radii.y);
}

vec4 bubblesCopy(vec4 picture, vec2 p, int copy) {
  vec2 q = dsScene(p, copy);
  int count = int(uLook[8].x + 0.5);
  float spacing = max(1e-3, uLook[8].z);
  float haloWide = dsStrokeWidth() + ${f(GLOW_LAYERS[0].widen)} * uLook[6].w;
  float reach = uLook[8].w + spacing * 0.35 + haloWide * 0.5 + 2.0;
  int from = max(0, int(floor((q.x - uLook[8].y - reach) / spacing)));
  int to = min(count / 3 - 1, int(ceil((q.x - uLook[8].y + reach) / spacing)));
  float halo0 = 0.0;
  float halo1 = 0.0;
  float ring = 0.0;
  float body = 0.0;
  float glint = 0.0;
  float refraction = 0.0;
  float outline = 0.0;
  vec4 pops = vec4(0.0);
  float stroke = uLook[9].y;
  for (int c = from; c <= to && c < from + 64; c++) {
    for (int layer = 0; layer < 3; layer++) {
      int b = c * 3 + layer;
      vec4 at = texelFetch(uLookData, ivec2(b * 3, copy), 0);
      vec4 extra = texelFetch(uLookData, ivec2(b * 3 + 2, copy), 0);
      if (extra.w >= 0.0) {
        float spread = abs(length(q - at.xy) - extra.z);
        float rim = lookStroke(spread, 1.4);
        if (extra.w < 0.5) { pops.x = max(pops.x, rim); }
        else if (extra.w < 1.5) { pops.y = max(pops.y, rim); }
        else if (extra.w < 2.5) { pops.z = max(pops.z, rim); }
        else { pops.w = max(pops.w, rim); }
      }
      if (at.z <= 0.0) {
        continue;
      }
      vec4 size = texelFetch(uLookData, ivec2(b * 3 + 1, copy), 0);
      float edge = bubbleEdge(q, at.xy, at.zw);
      ${GLOW_LAYERS.map(
        ({ widen }, layer) =>
          `halo${layer} = max(halo${layer}, dsSoftStroke(edge, dsStrokeWidth() + ${f(widen)} * uLook[6].w));`,
      ).join('\n      ')}
      float inside = lookFill(edge);
      body = max(body, inside);
      ring = max(ring, min(inside, clamp(0.5 + (length(q - at.xy) - (size.x - size.y)) / lookPixel(), 0.0, 1.0)));
      if (stroke > 0.0) {
        outline = max(outline, lookStroke(edge, stroke));
      }
      if (extra.x > 0.0) {
        // The glint, turned; the refraction band low on the right.
        vec2 g = q - size.zw;
        float c0 = cos(${f(GLINT_TURN)});
        float s0 = sin(${f(GLINT_TURN)});
        vec2 local = vec2(c0 * g.x + s0 * g.y, -s0 * g.x + c0 * g.y);
        vec2 radii = vec2(extra.x * 1.5, extra.x);
        glint = max(glint, lookFill((length(local / radii) - 1.0) * extra.x));
        vec2 v = q - at.xy;
        float angle = atan(v.y, v.x);
        float d = angle >= ${f(REFRACTION_FROM)} && angle <= ${f(REFRACTION_TO)}
          ? abs(length(v) - extra.y)
          : min(
              length(v - extra.y * vec2(cos(${f(REFRACTION_FROM)}), sin(${f(REFRACTION_FROM)}))),
              length(v - extra.y * vec2(cos(${f(REFRACTION_TO)}), sin(${f(REFRACTION_TO)})))
            );
        refraction = max(refraction, lookStroke(d, 1.6));
      }
    }
  }
  if (uLook[6].z > 0.0) {
    vec3 light = dsGlowPaint(q);
    ${GLOW_LAYERS.map(
      ({ opacity }, layer) =>
        `picture = lookOver(picture, lookPaint(light, ${f(opacity)} * uLook[6].z * halo${layer}));`,
    ).join('\n    ')}
  }
  vec3 ink = dsPaint(q);
  float presence = dsOpacity();
  if (dsFilled()) {
    picture = lookOver(picture, lookPaint(ink, presence * dsFillOpacity() * ring));
  }
  // The glassy body, faint, the glint hard and the refraction soft.
  picture = lookOver(picture, lookPaint(ink, presence * 0.09 * body));
  picture = lookOver(picture, lookPaint(vec3(1.0), presence * 0.85 * glint));
  picture = lookOver(picture, lookPaint(vec3(1.0), presence * 0.28 * refraction));
  // A burst: the rim expanding and fading, the freshest first.
  for (int k = 0; k < ${BUBBLE_BATCHES}; k++) {
    float rim = k == 0 ? pops.x : (k == 1 ? pops.y : (k == 2 ? pops.z : pops.w));
    picture = lookOver(picture, lookPaint(ink, presence * (1.0 - float(k) / ${f(BUBBLE_BATCHES)}) * 0.75 * rim));
  }
  // A strike is light, not a line: a wide soft glow, a tighter one, and a
  // thin white core; the freshest batch brightest.
  int lines = int(uLook[9].x + 0.5);
  vec4 bolts = vec4(1e5);
  for (int l = 0; l < ${MAX_LINES}; l++) {
    if (l >= lines) {
      break;
    }
    vec4 line = texelFetch(uLookData, ivec2(l, LINE_ROW), 0);
    vec4 box = texelFetch(uLookData, ivec2(l, BOX_ROW), 0);
    if (int(line.x + 0.5) != copy || q.x < line.w - 4.0 || q.x > box.x + 4.0 || q.y < box.y - 4.0 || q.y > box.z + 4.0) {
      continue;
    }
    int points = int(line.z + 0.5);
    float d = 1e5;
    vec2 a = texelFetch(uLookData, ivec2(0, LINES + l), 0).xy;
    for (int i = 1; i < 16; i++) {
      if (i >= points) {
        break;
      }
      vec2 b = texelFetch(uLookData, ivec2(i, LINES + l), 0).xy;
      d = min(d, dsToSegment(q, a, b));
      a = b;
    }
    if (line.y < 0.5) { bolts.x = min(bolts.x, d); }
    else if (line.y < 1.5) { bolts.y = min(bolts.y, d); }
    else if (line.y < 2.5) { bolts.z = min(bolts.z, d); }
    else { bolts.w = min(bolts.w, d); }
  }
  for (int k = 0; k < ${BUBBLE_BATCHES}; k++) {
    float d = k == 0 ? bolts.x : (k == 1 ? bolts.y : (k == 2 ? bolts.z : bolts.w));
    if (d > 8.0) {
      continue;
    }
    float strength = 1.0 - float(k) / ${f(BUBBLE_BATCHES)};
    picture = lookOver(picture, lookPaint(ink, presence * strength * 0.22 * lookStroke(d, 7.0)));
    picture = lookOver(picture, lookPaint(ink, presence * strength * 0.55 * lookStroke(d, 2.6)));
    picture = lookOver(picture, lookPaint(vec3(1.0), presence * strength * lookStroke(d, 1.0)));
  }
  // A stroked look's own line round every bubble, over the rest.
  return lookOver(picture, lookPaint(ink, presence * outline));
}

vec4 sceneColour(vec2 uv) {
  vec2 p = lookPoint(uv);
  vec4 picture = vec4(0.0);
  for (int copy = 0; copy < 2; copy++) {
    if (dsCopy(copy).z > 0.5) {
      picture = bubblesCopy(picture, p, copy);
    }
  }
  return picture;
}
`;

/** What the page hands the engine for the bubbles, beside the frame. */
export interface IBubblesScene {
  /** Each copy's bubbles, laid out at its own height. */
  layouts: ReturnType<typeof bubbleLayout>[];
  motes: ReturnType<typeof bubbleMoteLayout>;
  /** The first band's column. */
  left: number;
  /** The figure's own stroke width, or 0 where it has none. */
  figureStroke: number;
}

const step = (
  frame: IDesignedFrame,
  scene: IBubblesScene,
  input: IEngineLookInput,
): void => {
  const { layouts, motes, left, figureStroke } = scene;
  const count = Math.max(0, ...layouts.map(({ bubbles }) => bubbles.length));
  const lines = layouts
    .flatMap(({ bolts }, copy) =>
      bolts.flatMap(({ batch, lines: traced }) =>
        traced.map((points) => ({ copy, batch, points })),
      ),
    )
    .slice(0, MAX_LINES);
  const across = Math.max(count * 3, MAX_LINES, 16);
  const data = sizeLookData(input, across, BOX_ROW + 1);
  data.fill(0);
  layouts.forEach((layout, copy) => {
    const row = copy * across;
    const pops = new Map(layout.pops.map((pop) => [pop.index, pop]));
    for (let b = 0; b < count; b += 1) {
      const at = (row + b * 3) * 4;
      const bubble = layout.bubbles[b];
      const pop = pops.get(b);
      data.set(
        [
          bubble?.x ?? pop?.x ?? 0,
          bubble?.y ?? pop?.y ?? 0,
          bubble?.rx ?? 0,
          bubble?.ry ?? 0,
          bubble?.radius ?? 0,
          bubble?.rim ?? 0,
          bubble?.glint?.x ?? 0,
          bubble?.glint?.y ?? 0,
          bubble?.glint?.size ?? 0,
          bubble?.refraction ?? 0,
          pop?.spread ?? 0,
          pop ? pop.batch : -1,
        ],
        at,
      );
    }
  });
  lines.forEach(({ copy, batch, points }, l) => {
    let [minX, maxX, minY, maxY] = [Infinity, -Infinity, Infinity, -Infinity];
    points.forEach(({ x, y }, i) => {
      data[((LINES + l) * across + i) * 4] = x;
      data[((LINES + l) * across + i) * 4 + 1] = y;
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    });
    data.set([copy, batch, points.length, minX], (LINE_ROW * across + l) * 4);
    data.set([maxX, minY, maxY, 0], (BOX_ROW * across + l) * 4);
  });
  setLookVector(
    input,
    8,
    count,
    left,
    layouts[0]?.spacing ?? 1,
    Math.max(0, ...layouts.map(({ widest }) => widest)),
  );
  setLookVector(input, 9, lines.length, frame.filled ? 0 : figureStroke, 0, 0);
  // The specks behind everything, then the droplets over the bursts.
  frame.copies.forEach((copy) => {
    motes.spots.forEach(({ x, y, half, bright }) => {
      const at = sceneToScreen(frame, copy, x, y);
      pushRectSprite(
        input,
        at.x,
        at.y,
        half * 2,
        half * 2,
        frame.opacity * (bright ? motes.brightAlpha : motes.dimAlpha),
        paintAt(frame.paint, x, y),
      );
    });
  });
  spritesSoFarUnder(input);
  layouts.forEach((layout, index) => {
    const copy = frame.copies[index];
    if (!copy) {
      return;
    }
    layout.droplets.forEach(({ x, y, size }) => {
      const at = sceneToScreen(frame, copy, x, y);
      pushSprite(input, at.x, at.y, size, frame.opacity * 0.7, [1, 1, 1]);
    });
  });
};

const bubblesLook = { glsl: GLSL, step };

export default bubblesLook;

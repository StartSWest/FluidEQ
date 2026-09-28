/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { Projected } from 'common/graphStyles';
import {
  TERRACE_TIER_FRACTIONS,
  terraceEdges,
  terraceTierOpacity,
} from 'common/graphTerrace';
import { GLOW_LAYERS } from '../../figureGlow';
import {
  JUMPER_COLOURS,
  JUMPER_ORIGIN,
  JUMPER_SPRITE,
  jumperPixel,
} from '../../terraceJumper';
import {
  MIST_ABOVE,
  MIST_BANDS,
  MIST_BELOW,
  MIST_DEPTH,
  MIST_INK,
  MIST_PEAK,
  MIST_TOP,
} from '../../terraceNight';
import {
  VALLEY_INKS,
  terraceEdgeStroke,
  type TerraceValleyLayout,
} from '../../terraceValley';
import type { IEngineLookInput } from '../engineLookInput';
import { setLookVector, sizeLookData } from '../lookInput';
import type { IDesignedFrame } from './designedInput';
import {
  NIGHT_GLSL,
  glslInk as ink,
  nightStarGrid,
  writeNightStars,
} from './nightSky';

/**
 * The TERRACE at night on the GPU (`terraceValley.ts`, `graphTerrace.ts`,
 * painted by the page in `LiveTraceCanvas`): where it is filled, the night
 * over it — stars, the moon's halo, the moon and its craters, the clouds
 * and the mist — then the halo, the four shelves each filled and edged, the
 * walls under the rims and the rims; filled or not, the glints on the
 * flats, the fireflies, the birds and the explorer; and where it is not
 * filled, the shelves' edges as the figure. Each copy in that order, as the
 * page paints it.
 *
 *   uLook[8]  the floor, the shelves' left and right ends, the plot's depth
 *   uLook[9]  a wall's height, half a column, the rims' and glints' alpha
 *   uLook[10] the moon's middle and radius, its halo's alpha
 *   uLook[11] the bright and faint stars' alpha, the mist's, a glint's length
 *   uLook[12] the mist's left and right, the columns, the clouds' circles
 *   uLook[13] the stars' grid: its left and top, a cell's size
 *   uLook[14] the grid's cells across and down, fireflies, birds
 *   uLook[15] the explorer's feet, its pixel signed by which way it faces,
 *             its pixel (0 where there is none)
 *   texel (i, k)             shelf k's edge, corner i
 *   texel (i, COLUMN_ROW)    column i: where it stands, its glint's start
 *   texel (i, WALL_ROW)      column i's walls' tops
 *   texel (i, STAR_ROW)      the stars, cell by cell: where, how big, bright
 *   texel (c, CELL_ROW)      cell c's first star and how many
 *   texel (i, CIRCLE_ROW)    the clouds' circles, then the craters'
 *   texel (i, FLY_ROW)       the fireflies
 *   texel (i, BIRD_ROW)      the birds, three points each
 */

const SHELVES = TERRACE_TIER_FRACTIONS.length;
const COLUMN_ROW = SHELVES;
const WALL_ROW = COLUMN_ROW + 1;
const STAR_ROW = WALL_ROW + 1;
const CELL_ROW = STAR_ROW + 1;
const CIRCLE_ROW = CELL_ROW + 1;
const FLY_ROW = CIRCLE_ROW + 1;
const BIRD_ROW = FLY_ROW + 1;
/** A wall top, a glint, where there is none. */
const NONE = -1e9;
const CRATERS = 3;
const f = (value: number) => value.toFixed(6);
const WIDEST_GLOW = Math.max(...GLOW_LAYERS.map(({ widen }) => widen));

/** The explorer's sprite as colour numbers, and the colours. */
const jumperGlsl = () => {
  const letters = Object.keys(JUMPER_COLOURS);
  const width = JUMPER_SPRITE[0].length;
  const cells = JUMPER_SPRITE.flatMap((row) =>
    [...row].map((letter) => letters.indexOf(letter) + 1),
  );
  const inks = [
    'vec3(0.0)',
    ...letters.map((letter) => ink(JUMPER_COLOURS[letter]).rgb),
  ];
  return `const int JUMPER_WIDE = ${width};
const int JUMPER_HIGH = ${JUMPER_SPRITE.length};
const int JUMPER[${cells.length}] = int[${cells.length}](${cells.join(', ')});
const vec3 JUMPER_INK[${inks.length}] = vec3[${inks.length}](${inks.join(', ')});`;
};

const STAR = ink(VALLEY_INKS.star);
const MOON = ink(VALLEY_INKS.moon.colour);
const CRATER = ink(VALLEY_INKS.crater.colour);
const CLOUD = ink(VALLEY_INKS.cloud.colour);
const WALL = ink(VALLEY_INKS.wall.colour);
const RIM = ink(VALLEY_INKS.rim.colour);
const GLINT = ink(VALLEY_INKS.glint.colour);
const FIREFLY = ink(VALLEY_INKS.firefly.colour);
const [FLY_LIT, FLY_DIM] = VALLEY_INKS.firefly.alphas;
const BIRD = ink(VALLEY_INKS.bird.colour);
const [MIST_R, MIST_G, MIST_B] = MIST_INK.map((channel) => channel / 255);

const GLSL = `${NIGHT_GLSL}
const int COLUMN_ROW = ${COLUMN_ROW};
const int WALL_ROW = ${WALL_ROW};
const int STAR_ROW = ${STAR_ROW};
const int CELL_ROW = ${CELL_ROW};
const int CIRCLE_ROW = ${CIRCLE_ROW};
const int FLY_ROW = ${FLY_ROW};
const int BIRD_ROW = ${BIRD_ROW};
${jumperGlsl()}

// The night over the tiers: stars, the moon's halo, the moon and its
// craters, the clouds, the mist.
vec4 terraceNight(vec4 picture, vec2 q) {
  vec2 stars = nightStars(q, STAR_ROW, CELL_ROW, uLook[13], ivec2(uLook[14].xy + 0.5));
  picture = lookOver(picture, lookPaint(${STAR.rgb}, dsOpacity() * uLook[11].x * stars.x));
  picture = lookOver(picture, lookPaint(${STAR.rgb}, dsOpacity() * uLook[11].y * stars.y));
  vec2 moon = uLook[10].xy;
  float radius = uLook[10].z;
  vec4 halo = nightHalo(q, moon, radius);
  picture = lookOver(picture, lookPaint(halo.rgb, dsOpacity() * uLook[10].w * halo.a));
  picture = lookOver(picture, lookPaint(${MOON.rgb}, dsOpacity() * ${f(VALLEY_INKS.moon.alpha)} * lookFill(length(q - moon) - radius)));
  int clouds = int(uLook[12].w + 0.5);
  picture = lookOver(picture, lookPaint(${CRATER.rgb}, dsOpacity() * ${f(VALLEY_INKS.crater.alpha)} * nightCircles(q, CIRCLE_ROW, clouds, ${CRATERS})));
  picture = lookOver(picture, lookPaint(${CLOUD.rgb}, dsOpacity() * ${f(VALLEY_INKS.cloud.alpha)} * nightCircles(q, CIRCLE_ROW, 0, clouds)));
  // The mist's two bands, each rising from nothing to its middle and
  // falling back, across the plot.
  float depth = uLook[8].w;
  float top = uLook[8].x - depth * ${f(MIST_TOP)};
  if (q.y >= top && q.y <= top + depth * ${f(MIST_DEPTH)}) {
    float mist = 0.0;
    ${MIST_BANDS.map(
      ({ band, weight }) => `{
      float from = top + depth * ${f(MIST_TOP - band - MIST_ABOVE)};
      float t = (q.y - from) / max(1e-3, depth * ${f(MIST_ABOVE + MIST_BELOW)});
      if (t >= 0.0 && t <= 1.0) {
        mist = max(mist, ${f(MIST_PEAK * weight)} * (t < 0.5 ? t * 2.0 : (1.0 - t) * 2.0));
      }
    }`,
    ).join('\n    ')}
    float across = lookFill(uLook[12].x - q.x) * lookFill(q.x - uLook[12].y);
    picture = lookOver(picture, lookPaint(vec3(${f(MIST_R)}, ${f(MIST_G)}, ${f(MIST_B)}), dsOpacity() * uLook[11].z * mist * across));
  }
  return picture;
}

// A shelf's edge at q: how far q is from it, and 1 where q is on or under it.
vec2 terraceEdge(vec2 q, int shelf, int count, float reach) {
  float d = dsNearest(q, shelf, count, reach).x;
  float height = dsPoint(shelf, count, dsSegment(shelf, count, q.x)).y;
  return vec2(d, q.y >= height ? 1.0 : 0.0);
}

// How much of q a shelf's body covers: under its edge, down to the floor,
// between its ends.
float terraceBody(vec2 q, vec2 edge) {
  float stair = edge.y > 0.5 ? -edge.x : edge.x;
  float box = max(max(uLook[8].y - q.x, q.x - uLook[8].z), q.y - uLook[8].x);
  return lookFill(max(stair, box));
}

// The explorer's pixels over q, premultiplied: each pixel of the sprite
// covering as much of q's own pixel as it overlaps.
vec4 terraceJumper(vec2 q) {
  float pixel = uLook[15].w;
  if (pixel <= 0.0) {
    return vec4(0.0);
  }
  vec2 grid = vec2((q.x - uLook[15].x) / uLook[15].z, (q.y - uLook[15].y) / pixel)
    - vec2(${f(JUMPER_ORIGIN.x)}, ${f(JUMPER_ORIGIN.y)});
  float reach = 0.5 * lookPixel() / pixel;
  vec4 sum = vec4(0.0);
  for (int k = 0; k < 9; k++) {
    ivec2 cell = ivec2(floor(grid)) + ivec2(k % 3 - 1, k / 3 - 1);
    if (cell.x < 0 || cell.y < 0 || cell.x >= JUMPER_WIDE || cell.y >= JUMPER_HIGH) {
      continue;
    }
    int letter = JUMPER[cell.y * JUMPER_WIDE + cell.x];
    if (letter == 0) {
      continue;
    }
    vec2 overlap = max(min(grid + reach, vec2(cell) + 1.0) - max(grid - reach, vec2(cell)), 0.0);
    float area = overlap.x * overlap.y / (4.0 * reach * reach);
    sum += vec4(JUMPER_INK[letter] * area, area);
  }
  return sum;
}

vec4 terraceCopy(vec4 picture, vec2 p, int copy) {
  vec2 q = dsScene(p, copy);
  int columns = int(uLook[12].z + 0.5);
  int corners = columns * 2 + 1;
  float floorY = uLook[8].x;
  float left = uLook[8].y;
  float right = uLook[8].z;
  float stroke = dsStrokeWidth();
  bool glowing = uLook[6].z > 0.0;
  float reach = (glowing ? (stroke + ${f(WIDEST_GLOW)} * uLook[6].w) * 0.5 + 4.0 : 0.0) + max(stroke, 1.6) * 0.5 + 2.0;
  vec2 edges[${SHELVES}];
  for (int k = 0; k < ${SHELVES}; k++) {
    edges[k] = terraceEdge(q, k, corners, reach);
  }
  if (dsFilled()) {
    picture = terraceNight(picture, q);
  }
  // The halo round the figure: the top shelf's body where it is filled,
  // every shelf's edge where it is not.
  float outline = min(min(edges[0].x, edges[1].x), min(edges[2].x, edges[3].x));
  float figure = outline;
  if (dsFilled()) {
    float first = dsPoint(0, corners, 0).y;
    float last = dsPoint(0, corners, corners - 1).y;
    figure = min(edges[0].x, min(
      dsToSegment(q, vec2(right, last), vec2(right, floorY)),
      min(dsToSegment(q, vec2(right, floorY), vec2(left, floorY)), dsToSegment(q, vec2(left, floorY), vec2(left, first)))
    ));
  }
  if (glowing) {
    vec3 glow = dsGlowPaint(q);
    ${GLOW_LAYERS.map(
      ({ widen, opacity }) =>
        `picture = lookOver(picture, lookPaint(glow, ${f(opacity)} * uLook[6].z * dsSoftStroke(figure, stroke + ${f(widen)} * uLook[6].w)));`,
    ).join('\n    ')}
  }
  float pitch = uLook[9].y * 2.0;
  int near = int(floor((q.x - texelFetch(uLookData, ivec2(0, COLUMN_ROW), 0).x) / max(1e-3, pitch) + 0.5));
  if (dsFilled()) {
    // Each shelf: its band between its edge and the next one down, then
    // its edge.
    vec3 paint = dsPaint(q);
    for (int k = 0; k < ${SHELVES}; k++) {
      float band = terraceBody(q, edges[k]) - (k + 1 < ${SHELVES} ? terraceBody(q, edges[min(k + 1, ${SHELVES - 1})]) : 0.0);
      float solid = ${TERRACE_TIER_FRACTIONS.map((_, k) => `k == ${k} ? ${f(terraceTierOpacity(k))} : `).join('')}0.0;
      picture = lookOver(picture, lookPaint(paint, dsOpacity() * dsFillOpacity() * solid * max(0.0, band)));
      float edgeAlpha = k == 0 ? ${f(terraceEdgeStroke(0).alpha)} : ${f(terraceEdgeStroke(1).alpha)};
      float edgeWidth = k == 0 ? ${f(terraceEdgeStroke(0).width)} : ${f(terraceEdgeStroke(1).width)};
      picture = lookOver(picture, lookPaint(paint, dsOpacity() * edgeAlpha * lookStroke(edges[k].x, edgeWidth)));
    }
    // The walls in shadow under the shelves, and the rims over them.
    float walls = 0.0;
    float rims = 1e5;
    for (int c = near - 1; c <= near + 1; c++) {
      if (c < 0 || c >= columns) {
        continue;
      }
      float x = texelFetch(uLookData, ivec2(c, COLUMN_ROW), 0).x;
      vec4 tops = texelFetch(uLookData, ivec2(c, WALL_ROW), 0);
      float wall = 0.0;
      for (int k = 0; k < 4; k++) {
        float top = tops[k];
        if (top < ${f(NONE / 2)}) {
          continue;
        }
        wall = max(wall, lookFill(nightBox(q, vec2(x, top + uLook[9].x * 0.5), vec2(uLook[9].y, uLook[9].x * 0.5))));
        rims = min(rims, dsToSegment(q, vec2(x - uLook[9].y, top), vec2(x + uLook[9].y, top)));
      }
      walls += wall;
    }
    picture = lookOver(picture, lookPaint(${WALL.rgb}, dsOpacity() * ${f(VALLEY_INKS.wall.alpha)} * min(1.0, walls)));
    picture = lookOver(picture, lookPaint(${RIM.rgb}, dsOpacity() * uLook[9].z * lookStroke(rims, ${f(VALLEY_INKS.rim.width)})));
  }
  // The glints on the flats.
  float glints = 1e5;
  for (int c = near - 1; c <= near + 1; c++) {
    if (c < 0 || c >= columns) {
      continue;
    }
    vec4 column = texelFetch(uLookData, ivec2(c, COLUMN_ROW), 0);
    if (column.z > ${f(NONE / 2)}) {
      glints = min(glints, dsToSegment(q, column.zw, column.zw + vec2(uLook[11].w, 0.0)));
    }
  }
  picture = lookOver(picture, lookPaint(${GLINT.rgb}, dsOpacity() * uLook[9].w * lookStroke(glints, ${f(VALLEY_INKS.glint.width)})));
  // The fireflies, lit then dim.
  vec2 flies = vec2(0.0);
  int flyCount = int(uLook[14].z + 0.5);
  for (int k = 0; k < 64; k++) {
    if (k >= flyCount) {
      break;
    }
    vec4 fly = texelFetch(uLookData, ivec2(k, FLY_ROW), 0);
    float lit = lookFill(length(q - fly.xy) - fly.z);
    if (fly.w > 0.5) {
      flies.x = max(flies.x, lit);
    } else {
      flies.y = max(flies.y, lit);
    }
  }
  picture = lookOver(picture, lookPaint(${FIREFLY.rgb}, dsOpacity() * ${f(FLY_LIT)} * flies.x));
  picture = lookOver(picture, lookPaint(${FIREFLY.rgb}, dsOpacity() * ${f(FLY_DIM)} * flies.y));
  // The birds, a wing, the body and a wing each.
  int birds = int(uLook[14].w + 0.5);
  float wings = 1e5;
  for (int b = 0; b < 8; b++) {
    if (b >= birds) {
      break;
    }
    vec2 leftTip = texelFetch(uLookData, ivec2(b * 3, BIRD_ROW), 0).xy;
    vec2 body = texelFetch(uLookData, ivec2(b * 3 + 1, BIRD_ROW), 0).xy;
    vec2 rightTip = texelFetch(uLookData, ivec2(b * 3 + 2, BIRD_ROW), 0).xy;
    wings = min(wings, min(dsToSegment(q, leftTip, body), dsToSegment(q, body, rightTip)));
  }
  picture = lookOver(picture, lookPaint(${BIRD.rgb}, dsOpacity() * ${f(VALLEY_INKS.bird.alpha)} * lookStroke(wings, ${f(VALLEY_INKS.bird.width)})));
  picture = lookOver(picture, terraceJumper(q) * dsOpacity());
  // Not filled, the shelves' edges are the figure.
  if (!dsFilled() && stroke > 0.0) {
    picture = lookOver(picture, lookPaint(dsPaint(q), dsOpacity() * lookStroke(outline, stroke)));
  }
  return picture;
}

vec4 sceneColour(vec2 uv) {
  vec2 p = lookPoint(uv);
  vec4 picture = vec4(0.0);
  for (int copy = 0; copy < 2; copy++) {
    if (dsCopy(copy).z > 0.5) {
      picture = terraceCopy(picture, p, copy);
    }
  }
  return picture;
}
`;

/** What the page hands the engine for the terrace, beside the frame. */
export interface ITerraceScene {
  valley: TerraceValleyLayout;
  /** The columns the shelves stand on, in scene space. */
  columns: readonly Projected[];
  /** The explorer, where it is and which way it faces, if it is out. */
  jumper?: { x: number; y: number; direction: number };
  plotWidth: number;
  /** The plot's own depth, which sizes the explorer. */
  depth: number;
}

const step = (
  frame: IDesignedFrame,
  scene: ITerraceScene,
  input: IEngineLookInput,
): void => {
  const { valley, columns, jumper } = scene;
  const { left, right, edges } = terraceEdges(columns, frame.sceneBase);
  const grid = nightStarGrid(valley.stars);
  const circles = [...valley.clouds, ...valley.craters];
  const birds = valley.birds.flat();
  const across = Math.max(
    edges[0].length,
    grid.sorted.length,
    grid.spans.length,
    circles.length,
    valley.fireflies.length,
    birds.length,
    1,
  );
  const data = sizeLookData(input, across, BIRD_ROW + 1);
  data.fill(0);
  const put = (row: number, index: number, values: number[]) => {
    data.set(values, (row * across + index) * 4);
  };
  edges.forEach((corners, shelf) => {
    corners.forEach(([x, y], index) => put(shelf, index, [x, y, 0, 0]));
  });
  columns.forEach(([x, y], index) => {
    const glint = valley.glints[index];
    put(COLUMN_ROW, index, [x, y, glint?.x ?? NONE, glint?.y ?? NONE]);
    const tops = valley.walls[index];
    put(
      WALL_ROW,
      index,
      [0, 1, 2, 3].map((at) => tops[at] ?? NONE),
    );
  });
  writeNightStars(grid, put, STAR_ROW, CELL_ROW);
  circles.forEach(({ x, y, r }, index) => put(CIRCLE_ROW, index, [x, y, r, 0]));
  valley.fireflies.forEach(({ x, y, r, bright }, index) => {
    put(FLY_ROW, index, [x, y, r, bright ? 1 : 0]);
  });
  birds.forEach(([x, y], index) => put(BIRD_ROW, index, [x, y, 0, 0]));

  setLookVector(
    input,
    8,
    frame.sceneBase,
    left,
    right,
    frame.sceneBase - frame.sceneTop,
  );
  setLookVector(
    input,
    9,
    valley.wallHeight,
    valley.half,
    valley.rimAlpha,
    valley.glintAlpha,
  );
  setLookVector(
    input,
    10,
    valley.moon.x,
    valley.moon.y,
    valley.moon.r,
    valley.haloAlpha,
  );
  const [bright, faint] = valley.starAlphas;
  setLookVector(
    input,
    11,
    bright,
    faint,
    valley.mist,
    valley.glints.find(Boolean)?.length ?? 0,
  );
  setLookVector(
    input,
    12,
    frame.plot.left,
    frame.plot.right,
    columns.length,
    valley.clouds.length,
  );
  setLookVector(
    input,
    13,
    grid.left,
    grid.top,
    grid.cellWidth,
    grid.cellHeight,
  );
  setLookVector(
    input,
    14,
    grid.columns,
    grid.rows,
    valley.fireflies.length,
    valley.birds.length,
  );
  const pixel = jumper ? jumperPixel(scene.plotWidth, scene.depth) : 0;
  setLookVector(
    input,
    15,
    jumper?.x ?? 0,
    jumper?.y ?? 0,
    pixel * (jumper?.direction ?? 1),
    pixel,
  );
};

const terraceLook = { glsl: GLSL, step };

export default terraceLook;

/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { createSkylineTowers } from 'common/graphShapes';
import { parseCssColour } from '../../../utils/oklab';
import { CITY_INKS, type CitySkylineLayout } from '../../citySkyline';
import { GLOW_LAYERS } from '../../figureGlow';
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
 * The night CITY on the GPU (`citySkyline.ts`, the towers from
 * `createSkylineTowers`, painted by the page in `LiveTraceCanvas`): the
 * stars, the moon's halo, the moon and its craters, the halo round the
 * towers, the towers — each in its own colour where the palette gives one
 * a piece — the haze along the foot of the block, the windows where the
 * towers are filled, the beacons on the masts, and where they are not
 * filled, the towers' outlines. Each copy in that order, as the page
 * paints it.
 *
 *   uLook[8]  the floor, the towers, the pitch between them, the first one's
 *             middle
 *   uLook[9]  a tower's width for its windows, a pane, a floor's height, the
 *             windows' inset
 *   uLook[10] the moon's middle and radius, its halo's alpha
 *   uLook[11] the bright and faint stars' alpha, the lit windows', 1 where
 *             each tower has its own colour
 *   uLook[12] the haze's left and right, its height, its alpha
 *   uLook[13] the stars' grid: its left and top, a cell's size
 *   uLook[14] the grid's cells across and down, the beacons, the panes a
 *             floor has across
 *   texel (i, BLOCK_ROW + b)  tower i's block b: its corner and size
 *   texel (i, TOWER_ROW)      tower i's middle and floors
 *   texel (i, HEAT_ROW)       tower i's own colour
 *   texel (i, FLOOR_ROW + r)  tower i's floors 4r to 4r + 3: each a floor's
 *                             lit panes as bits
 *   texel (i, STAR_ROW)       the stars, cell by cell
 *   texel (c, CELL_ROW)       cell c's first star and how many
 *   texel (i, CIRCLE_ROW)     the craters
 *   texel (i, BEACON_ROW)     the beacons: where, how big
 */

const BLOCKS = 3;
const BLOCK_ROW = 0;
const TOWER_ROW = BLOCK_ROW + BLOCKS;
const HEAT_ROW = TOWER_ROW + 1;
const STAR_ROW = HEAT_ROW + 1;
const CELL_ROW = STAR_ROW + 1;
const CIRCLE_ROW = CELL_ROW + 1;
const BEACON_ROW = CIRCLE_ROW + 1;
const FLOOR_ROW = BEACON_ROW + 1;
const FLOORS_A_TEXEL = 4;
/** The most towers either side of a pixel its strokes are looked for in. */
const SIDE = 8;
const f = (value: number) => value.toFixed(6);
const WIDEST_GLOW = Math.max(...GLOW_LAYERS.map(({ widen }) => widen));

const STAR = ink(CITY_INKS.star);
const MOON = ink(CITY_INKS.moon.colour);
const CRATER = ink(CITY_INKS.crater.colour);
const DIM = ink(CITY_INKS.dim.colour);
const LIT = ink(CITY_INKS.lit);
const BEACON = ink(CITY_INKS.beacon.colour);
const [HAZE_R, HAZE_G, HAZE_B] = CITY_INKS.haze.rgb.map((value) => value / 255);

const GLSL = `${NIGHT_GLSL}
const int BLOCK_ROW = ${BLOCK_ROW};
const int TOWER_ROW = ${TOWER_ROW};
const int HEAT_ROW = ${HEAT_ROW};
const int STAR_ROW = ${STAR_ROW};
const int CELL_ROW = ${CELL_ROW};
const int CIRCLE_ROW = ${CIRCLE_ROW};
const int BEACON_ROW = ${BEACON_ROW};
const int FLOOR_ROW = ${FLOOR_ROW};

// How lit tower i's pane is on floor fl, column c: 1 lit, 0 dark, -1 none.
float skylinePane(int i, int fl, int c) {
  vec4 tower = texelFetch(uLookData, ivec2(i, TOWER_ROW), 0);
  if (fl < 0 || fl >= int(tower.y + 0.5) || c < 0 || c >= int(uLook[14].w + 0.5)) {
    return -1.0;
  }
  vec4 floors = texelFetch(uLookData, ivec2(i, FLOOR_ROW + fl / ${FLOORS_A_TEXEL}), 0);
  float mask = floors[fl % ${FLOORS_A_TEXEL}];
  return mod(floor(mask / exp2(float(c))), 2.0);
}

vec4 skylineCopy(vec4 picture, vec2 p, int copy) {
  vec2 q = dsScene(p, copy);
  float floorY = uLook[8].x;
  int towers = int(uLook[8].y + 0.5);
  float pitch = max(1e-3, uLook[8].z);
  float stroke = dsStrokeWidth();
  bool glowing = uLook[6].z > 0.0;

  // The sky: stars, the moon's halo, the moon, its craters.
  vec2 stars = nightStars(q, STAR_ROW, CELL_ROW, uLook[13], ivec2(uLook[14].xy + 0.5));
  picture = lookOver(picture, lookPaint(${STAR.rgb}, dsOpacity() * uLook[11].x * stars.x));
  picture = lookOver(picture, lookPaint(${STAR.rgb}, dsOpacity() * uLook[11].y * stars.y));
  vec4 halo = nightHalo(q, uLook[10].xy, uLook[10].z);
  picture = lookOver(picture, lookPaint(halo.rgb, dsOpacity() * uLook[10].w * halo.a));
  picture = lookOver(picture, lookPaint(${MOON.rgb}, dsOpacity() * ${f(CITY_INKS.moon.alpha)} * lookFill(length(q - uLook[10].xy) - uLook[10].z)));
  picture = lookOver(picture, lookPaint(${CRATER.rgb}, dsOpacity() * ${f(CITY_INKS.crater.alpha)} * nightCircles(q, CIRCLE_ROW, 0, 3)));

  // The towers near q: how much of q they cover together, how much each
  // covers on its own, and how far q is from the nearest outline.
  int near = int(floor((q.x - uLook[8].w) / pitch + 0.5));
  // As many towers either side as the widest stroke round them can reach.
  float around = (glowing ? (stroke + ${f(WIDEST_GLOW)} * uLook[6].w) * 0.5 + 4.0 : 0.0) + stroke * 0.5 + 2.0;
  int reach = min(${SIDE}, int(ceil(around / pitch)) + 1);
  float body = 0.0;
  float outline = 1e5;
  float each[${SIDE * 2 + 1}];
  for (int k = 0; k < ${SIDE * 2 + 1}; k++) {
    each[k] = 0.0;
    int i = near + k - ${SIDE};
    if (k - ${SIDE} < -reach || k - ${SIDE} > reach || i < 0 || i >= towers) {
      continue;
    }
    for (int b = 0; b < ${BLOCKS}; b++) {
      vec4 block = texelFetch(uLookData, ivec2(i, BLOCK_ROW + b), 0);
      if (block.w <= 0.0) {
        continue;
      }
      float sd = nightBox(q, block.xy + block.zw * 0.5, block.zw * 0.5);
      each[k] = max(each[k], lookFill(sd));
      outline = min(outline, abs(sd));
    }
    body = max(body, each[k]);
  }
  if (glowing) {
    vec3 glow = dsGlowPaint(q);
    ${GLOW_LAYERS.map(
      ({ widen, opacity }) =>
        `picture = lookOver(picture, lookPaint(glow, ${f(opacity)} * uLook[6].z * dsSoftStroke(outline, stroke + ${f(widen)} * uLook[6].w)));`,
    ).join('\n    ')}
  }
  if (dsFilled()) {
    if (uLook[11].w > 0.5) {
      // A colour per tower, each filled on its own, left to right.
      for (int k = 0; k < ${SIDE * 2 + 1}; k++) {
        int i = clamp(near + k - ${SIDE}, 0, max(0, towers - 1));
        vec3 own = texelFetch(uLookData, ivec2(i, HEAT_ROW), 0).rgb;
        picture = lookOver(picture, lookPaint(own, dsOpacity() * dsFillOpacity() * each[k]));
      }
    } else {
      picture = lookOver(picture, lookPaint(dsPaint(q), dsOpacity() * dsFillOpacity() * body));
    }
  }

  // The city's glow along the foot of the block, with the bass.
  float hazeTop = floorY - uLook[12].z;
  if (q.y >= hazeTop - 1.0 && q.y <= floorY + 1.0) {
    float rise = clamp((q.y - hazeTop) / max(1e-3, uLook[12].z), 0.0, 1.0);
    float inside = lookFill(uLook[12].x - q.x) * lookFill(q.x - uLook[12].y)
      * lookFill(hazeTop - q.y) * lookFill(q.y - floorY);
    picture = lookOver(picture, lookPaint(vec3(${f(HAZE_R)}, ${f(HAZE_G)}, ${f(HAZE_B)}), dsOpacity() * uLook[12].w * ${f(CITY_INKS.haze.alpha)} * rise * inside));
  }

  // The windows, dark then lit, on filled towers.
  if (dsFilled()) {
    float width = uLook[9].x;
    float pane = uLook[9].y;
    float storey = uLook[9].z;
    // Dark, lit.
    vec2 panes = vec2(0.0);
    for (int k = 0; k < 3; k++) {
      int i = near + k - 1;
      if (i < 0 || i >= towers) {
        continue;
      }
      float x = texelFetch(uLookData, ivec2(i, TOWER_ROW), 0).x;
      float from = x - width * 0.5 + uLook[9].w;
      int row = int(floor((floorY - q.y) / storey));
      int column = int(floor((q.x - from) / (pane * 2.0)));
      for (int n = 0; n < 4; n++) {
        int fl = row - 1 + n / 2;
        int c = column + n % 2;
        float state = skylinePane(i, fl, c);
        if (state < 0.0) {
          continue;
        }
        vec2 corner = vec2(from + float(c) * pane * 2.0, floorY - float(fl + 1) * storey);
        vec2 size = vec2(pane, pane * 1.35);
        float cover = lookFill(nightBox(q, corner + size * 0.5, size * 0.5));
        if (state > 0.5) {
          panes.y = max(panes.y, cover);
        } else {
          panes.x = max(panes.x, cover);
        }
      }
    }
    picture = lookOver(picture, lookPaint(${DIM.rgb}, dsOpacity() * ${f(CITY_INKS.dim.alpha)} * panes.x));
    picture = lookOver(picture, lookPaint(${LIT.rgb}, dsOpacity() * uLook[11].z * panes.y));
  }

  // The beacons on the masts.
  float beacons = 0.0;
  int count = int(uLook[14].z + 0.5);
  for (int k = 0; k < 64; k++) {
    if (k >= count) {
      break;
    }
    vec4 beacon = texelFetch(uLookData, ivec2(k, BEACON_ROW), 0);
    beacons = max(beacons, lookFill(length(q - beacon.xy) - beacon.z));
  }
  picture = lookOver(picture, lookPaint(${BEACON.rgb}, dsOpacity() * ${f(CITY_INKS.beacon.alpha)} * beacons));

  // Not filled, the towers' outlines are the figure.
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
      picture = skylineCopy(picture, p, copy);
    }
  }
  return picture;
}
`;

/** What the page hands the engine for the skyline, beside the frame. */
export interface ISkylineScene {
  city: CitySkylineLayout;
  towers: ReturnType<typeof createSkylineTowers>;
  /** Each tower's own colour, where the palette colours by the piece. */
  heat?: readonly string[];
}

const step = (
  frame: IDesignedFrame,
  scene: ISkylineScene,
  input: IEngineLookInput,
): void => {
  const { city, towers, heat } = scene;
  const grid = nightStarGrid(city.stars);
  const { windows } = city;
  const floorTexels = Math.max(
    1,
    ...windows.towers.map(({ floors }) =>
      Math.ceil(floors.length / FLOORS_A_TEXEL),
    ),
  );
  const across = Math.max(
    towers.towers.length,
    grid.sorted.length,
    grid.spans.length,
    city.beacons.length,
    city.craters.length,
    1,
  );
  const data = sizeLookData(input, across, FLOOR_ROW + floorTexels);
  data.fill(0);
  const put = (row: number, index: number, values: number[]) => {
    data.set(values, (row * across + index) * 4);
  };
  towers.towers.forEach(({ blocks }, index) => {
    blocks.slice(0, BLOCKS).forEach((block, at) => {
      put(BLOCK_ROW + at, index, [...block]);
    });
    const floors = windows.towers[index]?.floors ?? [];
    put(TOWER_ROW, index, [windows.towers[index]?.x ?? 0, floors.length, 0, 0]);
    const [red, green, blue] = parseCssColour(heat?.[index] ?? '')?.rgb ?? [
      0, 0, 0,
    ];
    put(HEAT_ROW, index, [red, green, blue, 0]);
    for (let texel = 0; texel * FLOORS_A_TEXEL < floors.length; texel += 1) {
      put(
        FLOOR_ROW + texel,
        index,
        [0, 1, 2, 3].map((at) => floors[texel * FLOORS_A_TEXEL + at] ?? 0),
      );
    }
  });
  writeNightStars(grid, put, STAR_ROW, CELL_ROW);
  city.craters.forEach(({ x, y, r }, index) => {
    put(CIRCLE_ROW, index, [x, y, r, 0]);
  });
  city.beacons.forEach(({ x, y, r }, index) => {
    put(BEACON_ROW, index, [x, y, r, 0]);
  });

  const first = towers.towers[0]?.x ?? 0;
  const last = towers.towers[towers.towers.length - 1]?.x ?? first;
  setLookVector(
    input,
    8,
    frame.sceneBase,
    towers.towers.length,
    (last - first) / Math.max(1, towers.towers.length - 1),
    first,
  );
  setLookVector(
    input,
    9,
    windows.width,
    windows.pane,
    windows.pitch,
    windows.insetX,
  );
  setLookVector(
    input,
    10,
    city.moon.x,
    city.moon.y,
    city.moon.r,
    city.haloAlpha,
  );
  const [bright, faint] = city.starAlphas;
  setLookVector(input, 11, bright, faint, city.litAlpha, heat ? 1 : 0);
  setLookVector(
    input,
    12,
    frame.plot.left,
    frame.plot.right,
    city.hazeHeight,
    city.hazeAlpha,
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
    city.beacons.length,
    windows.across,
  );
};

const skylineLook = { glsl: GLSL, step };

export default skylineLook;

/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { PixelRect } from 'common/graphInvaders';
import type { Projected } from 'common/graphStyles';
import { parseCssColour } from '../../../utils/oklab';
import type { CabinetFrameLayout } from '../../invaderCabinet';
import INVADER_INKS from '../../invaderInks';
import type { SpaceInvasion } from '../../spaceInvasion';
import type { SpaceInvasionLayout } from '../../spaceInvasionLayout';
import {
  MAX_STROKE_POINTS,
  STROKE_FLOATS,
  type IEngineLookInput,
} from '../engineLookInput';
import { sizeLookData } from '../lookInput';
import { sceneToScreen, type IDesignedFrame } from './designedInput';
import { NIGHT_GLSL, nightStarGrid } from './nightSky';

/**
 * The ARCADE on the GPU (`spaceInvasion.ts`, `invaderCabinet.ts`,
 * `invaderWreck.ts`, painted by the page in `LiveTraceCanvas`).
 *
 * Everything in it is pixel rectangles, made by the same functions that
 * make the page's paths, so the engine reads rectangles rather than
 * drawing any sprite a second time. They come in groups — an alien, a
 * shelter, a burst, thirty-two of the ground's steps — each with the box
 * round it, and the drawing is a list of steps in the page's order, each
 * filling or outlining some groups in one colour: the cabinet's screen
 * edges in the window's own pixels, then each copy's stars, saucer,
 * plasma, lasers and bolts, shelters, fighter, bubble, wreck, bursts and
 * formation. The aliens are one group a column, looked up by where a pixel
 * is across rather than asked one by one. A group's rectangles never
 * overlap, so how much of a pixel they fill together is their sum — which
 * is also what makes two pixels of a sprite meet without a seam.
 *
 *   texel (0, PARAM_ROW)   the first alien's middle, the aliens' pitch
 *   texel (1, PARAM_ROW)   the stars' grid: its left and top, a cell
 *   texel (2, PARAM_ROW)   the grid's cells, the steps, the window's steps
 *   texel (3, PARAM_ROW)   the star layers' strengths
 *   texel (3s, STEP_ROW)   step s: its first group, how many, what it does
 *                          and how, a stroke's width
 *   texel (3s+1, STEP_ROW) its colour and how solid
 *   texel (3s+2, STEP_ROW) the box round all it draws
 *   texel (2g, GROUP_ROW)  group g's box; (2g+1) its first rectangle, count
 *   texel (i, RECT_ROW+)   the rectangles, RECT_WIDE a row
 * The lasers and bolts are strokes (`uLookStrokes`), each copy's in its
 * half.
 */

const PARAM_ROW = 0;
const STEP_ROW = 1;
const GROUP_ROW = 2;
const STAR_ROW = 3;
const CELL_ROW = 4;
const RECT_ROW = 5;
const RECT_WIDE = 1024;
/** The most rectangles a group holds, so a long list is split up. */
const GROUP_SIZE = 32;
/** What a step does. */
const FILL = 0;
const STROKE = 1;
const STARS = 2;
const STROKES = 3;
/** How it does it, as flags over what it does. */
const LOOK_PAINT = 1;
const BY_COLUMN = 2;
const IN_WINDOW = 4;
const f = (value: number) => value.toFixed(6);

const GLSL = `${NIGHT_GLSL}
uniform sampler2D uLookStrokes;
const int RECT_WIDE = ${RECT_WIDE};

vec4 invRect(int i) {
  return texelFetch(uLookData, ivec2(i % RECT_WIDE, ${RECT_ROW} + i / RECT_WIDE), 0);
}

// A group at q: how much of q its rectangles fill together, and how far q
// is from the nearest of their outlines — within reach of its box.
vec2 invGroup(vec2 q, int g, float reach) {
  vec4 box = texelFetch(uLookData, ivec2(g * 2, ${GROUP_ROW}), 0);
  if (q.x < box.x - reach || q.x > box.z + reach || q.y < box.y - reach || q.y > box.w + reach) {
    return vec2(0.0, 1e5);
  }
  vec4 range = texelFetch(uLookData, ivec2(g * 2 + 1, ${GROUP_ROW}), 0);
  int first = int(range.x + 0.5);
  int count = int(range.y + 0.5);
  float cover = 0.0;
  float edge = 1e5;
  for (int k = 0; k < ${GROUP_SIZE}; k++) {
    if (k >= count) {
      break;
    }
    vec4 r = invRect(first + k);
    float sd = nightBox(q, r.xy + r.zw * 0.5, r.zw * 0.5);
    cover += lookFill(sd);
    edge = min(edge, abs(sd));
  }
  return vec2(min(1.0, cover), edge);
}

vec4 invStep(vec4 picture, vec2 q, vec2 uv, int copy, int s) {
  vec4 how = texelFetch(uLookData, ivec2(s * 3, ${STEP_ROW}), 0);
  int code = int(how.z + 0.5);
  int kind = code % 8;
  int flags = code / 8;
  float width = how.w;
  float reach = kind == ${STROKE} ? width * 0.5 + 1.5 : 1.0;
  if (kind <= ${STROKE}) {
    vec4 box = texelFetch(uLookData, ivec2(s * 3 + 2, ${STEP_ROW}), 0);
    if (q.x < box.x - reach || q.x > box.z + reach || q.y < box.y - reach || q.y > box.w + reach) {
      return picture;
    }
  }
  vec4 ink = texelFetch(uLookData, ivec2(s * 3 + 1, ${STEP_ROW}), 0);
  if (kind == ${STARS}) {
    vec4 grid = texelFetch(uLookData, ivec2(1, ${PARAM_ROW}), 0);
    vec4 counts = texelFetch(uLookData, ivec2(2, ${PARAM_ROW}), 0);
    vec4 strength = texelFetch(uLookData, ivec2(3, ${PARAM_ROW}), 0);
    vec3 near = nightStreaks(q, ${STAR_ROW}, ${CELL_ROW}, grid, ivec2(counts.xy + 0.5));
    for (int layer = 0; layer < 3; layer++) {
      float streakWidth = ${f(INVADER_INKS.stars.width(0))} + float(layer) * ${f(INVADER_INKS.stars.width(1) - INVADER_INKS.stars.width(0))};
      picture = lookOver(picture, lookPaint(ink.rgb, strength[layer] * lookStroke(near[layer], streakWidth)));
    }
    return picture;
  }
  if (kind == ${STROKES}) {
    return lookOver(picture, texture(uLookStrokes, vec2(uv.x, (uv.y + float(copy)) * 0.5)));
  }
  int first = int(how.x + 0.5);
  int count = int(how.y + 0.5);
  bool outlined = kind == ${STROKE};
  float cover = 0.0;
  float edge = 1e5;
  if ((flags & ${BY_COLUMN}) != 0) {
    vec4 aliens = texelFetch(uLookData, ivec2(0, ${PARAM_ROW}), 0);
    int column = int(floor((q.x - aliens.x) / max(1e-3, aliens.y) + 0.5));
    for (int k = -1; k <= 1; k++) {
      int c = column + k;
      if (c < 0 || c >= count) {
        continue;
      }
      vec2 group = invGroup(q, first + c, reach);
      cover = min(1.0, cover + group.x);
      edge = min(edge, group.y);
    }
  } else {
    for (int k = 0; k < 96; k++) {
      if (k >= count) {
        break;
      }
      vec2 group = invGroup(q, first + k, reach);
      cover = min(1.0, cover + group.x);
      edge = min(edge, group.y);
    }
  }
  float amount = outlined ? lookStroke(edge, width) : cover;
  vec3 colour = (flags & ${LOOK_PAINT}) != 0 ? dsPaint(q) : ink.rgb;
  return lookOver(picture, lookPaint(colour, ink.a * amount));
}

vec4 sceneColour(vec2 uv) {
  vec2 p = lookPoint(uv);
  vec4 picture = vec4(0.0);
  vec4 counts = texelFetch(uLookData, ivec2(2, ${PARAM_ROW}), 0);
  int steps = int(counts.z + 0.5);
  int framed = int(counts.w + 0.5);
  // The cabinet's screen edges, in the window's own pixels, once.
  for (int s = 0; s < 8; s++) {
    if (s >= framed) {
      break;
    }
    picture = invStep(picture, p, uv, 0, s);
  }
  for (int copy = 0; copy < 2; copy++) {
    if (dsCopy(copy).z < 0.5) {
      continue;
    }
    vec2 q = dsScene(p, copy);
    for (int s = 0; s < 48; s++) {
      if (framed + s >= steps) {
        break;
      }
      picture = invStep(picture, q, uv, copy, framed + s);
    }
  }
  return picture;
}
`;

/** What the page hands the engine for the arcade, beside the frame. */
export interface IInvadersScene {
  fight: SpaceInvasionLayout;
  shelters: readonly PixelRect[];
  cabinet: CabinetFrameLayout;
  /** For the screen's shake: the fight, and its clock. */
  state: SpaceInvasion;
  clock: number;
}

interface IStep {
  kind: number;
  flags: number;
  groups: readonly (readonly PixelRect[])[];
  colour: string;
  alpha: number;
  width: number;
}

const rgbOf = (colour: string): [number, number, number] => {
  const [red, green, blue] = parseCssColour(colour)?.rgb ?? [1, 1, 1];
  return [red, green, blue];
};

/** A long list of rectangles as groups a shader can skip by their boxes. */
const chunks = (rects: readonly PixelRect[]): PixelRect[][] => {
  const groups: PixelRect[][] = [];
  for (let at = 0; at < rects.length; at += GROUP_SIZE) {
    groups.push(rects.slice(at, at + GROUP_SIZE));
  }
  return groups;
};

/**
 * The page's painting, step by step: what each draws, in which colour,
 * how solid and whether filled or outlined — in the page's order, from
 * `INVADER_INKS`. The cabinet's own steps come first and are drawn in the
 * window's pixels.
 */
const stepsOf = (frame: IDesignedFrame, scene: IInvadersScene) => {
  const { fight, shelters, cabinet } = scene;
  const ink = INVADER_INKS;
  const { unit, thump } = fight;
  const { opacity, filled } = frame;
  const aliens = fight.aliens.map(({ rects }) => rects);
  const steps: IStep[] = [];
  const add = (
    kind: number,
    groups: readonly (readonly PixelRect[])[],
    colour: string,
    alpha: number,
    width = 0,
    flags = 0,
  ) => {
    if (kind >= STARS || groups.some((group) => group.length > 0)) {
      steps.push({ kind, flags, groups, colour, alpha, width });
    }
  };
  // Filled, or outlined a pixel wide where the look is not.
  const part = (
    rects: readonly PixelRect[],
    colour: string,
    alpha: number,
    flags = 0,
  ) =>
    add(
      filled ? FILL : STROKE,
      chunks(rects),
      colour,
      alpha * opacity,
      ink.outline,
      flags,
    );

  const edges: [readonly PixelRect[], { colour: string; alpha: number }][] = [
    [cabinet.ground, ink.frame.ground],
    [cabinet.spare, ink.frame.spare],
    [cabinet.readout, ink.frame.readout],
  ];
  edges.forEach(([rects, { colour, alpha }]) =>
    part(rects, colour, alpha, IN_WINDOW),
  );
  const framed = steps.length;

  add(STARS, [], ink.stars.colour, 1);
  add(
    STROKE,
    [fight.saucer],
    ink.saucer.colour,
    opacity * ink.saucer.glowAlpha(thump),
    unit * ink.saucer.glowWidth,
  );
  part(fight.saucer, ink.saucer.colour, ink.saucer.alpha);
  add(FILL, chunks(fight.saucerLights), ink.saucer.lights, opacity);
  add(
    STROKE,
    chunks(fight.plasmaFlame),
    ink.plasma.halo,
    opacity * ink.plasma.haloAlpha,
    unit * ink.plasma.haloWidth,
  );
  add(
    FILL,
    chunks(fight.plasmaFlame),
    ink.plasma.flame,
    opacity * ink.plasma.flameAlpha,
  );
  add(FILL, chunks(fight.plasmaCore), ink.plasma.core, opacity);
  add(STROKES, [], '#fff', 1);
  part(shelters, ink.shelter, 1);
  add(
    STROKE,
    chunks(fight.hull),
    ink.ship.glow,
    opacity * ink.ship.glowAlpha(thump),
    ink.ship.glowWidth,
  );
  const { ship } = ink;
  part(fight.flame, ship.flame.colour, ship.flame.alpha);
  part(fight.core, ship.core.colour, ship.core.alpha);
  part(fight.hull, ship.hull.colour, ship.hull.alpha);
  part(fight.stripes, ship.stripes.colour, ship.stripes.alpha);
  part(fight.canopy, ship.canopy.colour, ship.canopy.alpha);
  if (fight.shipFlash) {
    add(
      FILL,
      chunks([...fight.hull, ...fight.canopy, ...fight.stripes]),
      ship.flash.colour,
      opacity * ship.flash.alpha,
    );
  }
  add(
    FILL,
    chunks(fight.muzzle),
    ship.flash.colour,
    opacity * ship.flash.alpha,
  );
  add(
    STROKE,
    chunks(fight.shield),
    ink.shield.colour,
    opacity * ink.shield.glowAlpha,
    unit * ink.shield.glowWidth,
  );
  add(
    FILL,
    chunks(fight.shield),
    ink.shield.colour,
    opacity * ink.shield.alpha(thump),
  );
  const { wreckage } = fight;
  if (wreckage) {
    const { glow } = wreckage;
    add(
      FILL,
      chunks(wreckage.fire),
      ink.wreck.fire,
      opacity * ink.wreck.fireAlpha(glow),
    );
    add(
      FILL,
      chunks(wreckage.heart),
      ink.wreck.heart,
      opacity * ink.wreck.heartAlpha(glow),
    );
    const flashed = (colour: string) =>
      wreckage.flash ? ink.wreck.flash : colour;
    part(wreckage.hull, flashed(ship.hull.colour), glow);
    part(wreckage.stripes, flashed(ship.stripes.colour), glow);
    part(wreckage.canopy, flashed(ship.canopy.colour), glow);
  }
  fight.bursts.forEach((rects, band) => {
    add(
      FILL,
      chunks(rects),
      '#fff',
      opacity * fight.burstAlphas[band],
      0,
      LOOK_PAINT,
    );
  });
  add(
    STROKE,
    aliens,
    '#fff',
    opacity * ink.formation.glowAlpha(thump),
    ink.formation.glowWidth,
    LOOK_PAINT + BY_COLUMN,
  );
  // The figure: the formation filled, or outlined as the look strokes it.
  add(
    filled ? FILL : STROKE,
    aliens,
    '#fff',
    opacity * (filled ? frame.fillOpacity : 1),
    frame.strokeWidth,
    LOOK_PAINT + BY_COLUMN,
  );
  add(
    FILL,
    chunks(
      fight.aliens.filter(({ flash }) => flash).flatMap(({ rects }) => rects),
    ),
    ink.hit.colour,
    opacity * ink.hit.alpha,
  );
  add(
    FILL,
    chunks(fight.popups),
    ink.points.colour,
    opacity * ink.points.alpha,
  );
  add(
    FILL,
    chunks(fight.popupsFading),
    ink.points.colour,
    opacity * ink.points.fading,
  );
  return { steps, framed };
};

/** The lasers and bolts as strokes on the screen, every copy's. */
const writeStrokes = (
  input: IEngineLookInput,
  frame: IDesignedFrame,
  fight: SpaceInvasionLayout,
): void => {
  const floats = MAX_STROKE_POINTS * STROKE_FLOATS;
  const points =
    input.strokes && input.strokes.points.length === floats
      ? input.strokes.points
      : new Float32Array(floats);
  let count = 0;
  const put = (values: number[]) => {
    if (count < MAX_STROKE_POINTS) {
      points.set(values, count * STROKE_FLOATS);
      count += 1;
    }
  };
  const { bolts, shots } = INVADER_INKS;
  const passes: [readonly Projected[][], string, number, number][] = [
    [fight.bolts, bolts.colour, bolts.glowWidth, bolts.glowAlpha],
    [fight.bolts, bolts.colour, bolts.width, bolts.alpha],
    [fight.shots, shots.glow, shots.glowWidth, shots.glowAlpha],
    [fight.shots, shots.core, shots.width, shots.alpha],
  ];
  frame.copies.slice(0, 2).forEach((copy, index) => {
    passes.forEach(([lines, colour, width, alpha]) => {
      const [red, green, blue] = rgbOf(colour);
      lines.forEach((line) => {
        line.forEach(([x, y], at) => {
          const screen = sceneToScreen(frame, copy, x, y);
          // Round ends, as the page's stars left the canvas's.
          put([
            screen.x,
            screen.y,
            (at === 0 ? 1 : 2) + index * 4,
            width * fight.unit,
            red,
            green,
            blue,
            alpha * frame.opacity,
          ]);
        });
      });
    });
  });
  input.strokes = { points, count };
};

const step = (
  frame: IDesignedFrame,
  scene: IInvadersScene,
  input: IEngineLookInput,
): void => {
  const { fight } = scene;
  const { steps, framed } = stepsOf(frame, scene);
  const groups = steps.flatMap(({ groups: list }) => list);
  const rectCount = groups.reduce((sum, group) => sum + group.length, 0);
  const grid = nightStarGrid(
    fight.stars.map(({ x, y, length, layer }) => ({
      x,
      y,
      r: length,
      bright: layer > 0,
      layer,
    })),
  );
  const across = Math.max(
    RECT_WIDE,
    steps.length * 3,
    groups.length * 2,
    grid.sorted.length,
    grid.spans.length,
  );
  const data = sizeLookData(
    input,
    across,
    RECT_ROW + Math.max(1, Math.ceil(rectCount / RECT_WIDE)),
  );
  data.fill(0);
  const put = (row: number, index: number, values: number[]) => {
    data.set(values, (row * across + index) * 4);
  };
  let group = 0;
  let rect = 0;
  /** The box round some rectangles, or one nothing falls in. */
  const boxOf = (list: readonly PixelRect[]) => {
    const xs = list.flatMap(([x, , w]) => [x, x + w]);
    const ys = list.flatMap(([, y, , h]) => [y, y + h]);
    return list.length > 0
      ? [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)]
      : [1e9, 1e9, -1e9, -1e9];
  };
  steps.forEach((painted, index) => {
    put(STEP_ROW, index * 3, [
      group,
      painted.groups.length,
      painted.kind + painted.flags * 8,
      painted.width,
    ]);
    put(STEP_ROW, index * 3 + 1, [...rgbOf(painted.colour), painted.alpha]);
    put(STEP_ROW, index * 3 + 2, boxOf(painted.groups.flat()));
    painted.groups.forEach((list) => {
      put(GROUP_ROW, group * 2, boxOf(list));
      put(GROUP_ROW, group * 2 + 1, [rect, list.length, 0, 0]);
      list.forEach((box) => {
        data.set(
          box,
          ((RECT_ROW + Math.floor(rect / RECT_WIDE)) * across +
            (rect % RECT_WIDE)) *
            4,
        );
        rect += 1;
      });
      group += 1;
    });
  });
  grid.sorted.forEach(({ x, y, r, layer }, index) => {
    put(STAR_ROW, index, [x, y, r, layer]);
  });
  grid.spans.forEach(({ start, count }, index) => {
    put(CELL_ROW, index, [start, count, 0, 0]);
  });
  const middles = fight.aliens.map(({ middle }) => middle);
  put(PARAM_ROW, 0, [
    middles[0] ?? 0,
    middles.length > 1 ? middles[1] - middles[0] : 1,
    0,
    0,
  ]);
  put(PARAM_ROW, 1, [grid.left, grid.top, grid.cellWidth, grid.cellHeight]);
  put(PARAM_ROW, 2, [grid.columns, grid.rows, steps.length, framed]);
  const lift = INVADER_INKS.stars.lift(fight.warp) * frame.opacity;
  put(PARAM_ROW, 3, [...fight.starAlphas.map((alpha) => alpha * lift), 0]);
  writeStrokes(input, frame, fight);
};

const invadersLook = { glsl: GLSL, step };

export default invadersLook;

/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { parseCssColour } from '../../../utils/oklab';
import {
  DAY_HALO_STOPS,
  HALO_INNER,
  HALO_REACH,
  HALO_STOPS,
} from '../../nightSurfaces';

/**
 * The skyline's night sky on the GPU (`skylineLook.ts`): hundreds of square
 * stars found through a grid rather than asked about one by one, the moon's
 * halo as `nightSurfaces.ts` paints it on the page, and circles by the row —
 * the craters.
 */

const f = (value: number) => value.toFixed(6);

/** A CSS colour as a GLSL vec3 and its alpha, for a scene's fixed inks. */
export const glslInk = (colour: string) => {
  const parsed = parseCssColour(colour);
  const [red, green, blue] = parsed?.rgb ?? [1, 1, 1];
  return {
    rgb: `vec3(${f(red)}, ${f(green)}, ${f(blue)})`,
    alpha: parsed?.alpha ?? 1,
  };
};

/** The stars' grid: each star is looked for in its own cell and around. */
const GRID_COLUMNS = 24;
const GRID_ROWS = 8;

export interface INightStar {
  x: number;
  y: number;
  r: number;
  bright: boolean;
  /** A disc of radius `r`, where it is not a square `r` from its middle. */
  round?: boolean;
}

/**
 * The stars sorted into the grid's cells, and each cell's run of them: a
 * star is found from the cell it stands in, and a cell is wider than any
 * star, so the eight around a pixel's own hold every star that can touch it.
 */
export const nightStarGrid = <TStar extends INightStar>(
  stars: readonly TStar[],
) => {
  const xs = stars.map(({ x }) => x);
  const ys = stars.map(({ y }) => y);
  const left = Math.min(0, ...xs);
  const top = Math.min(0, ...ys);
  const cellWidth = Math.max(
    1,
    (Math.max(1, ...xs) - left) / GRID_COLUMNS + 1e-3,
  );
  const cellHeight = Math.max(1, (Math.max(1, ...ys) - top) / GRID_ROWS + 1e-3);
  const cellOf = ({ x, y }: TStar) =>
    Math.min(GRID_ROWS - 1, Math.floor((y - top) / cellHeight)) * GRID_COLUMNS +
    Math.min(GRID_COLUMNS - 1, Math.floor((x - left) / cellWidth));
  const sorted = stars
    .map((star) => ({ star, cell: cellOf(star) }))
    .sort((a, b) => a.cell - b.cell)
    .map(({ star }) => star);
  const spans = Array.from({ length: GRID_COLUMNS * GRID_ROWS }, () => ({
    start: 0,
    count: 0,
  }));
  sorted.forEach((star, index) => {
    const span = spans[cellOf(star)];
    if (span.count === 0) {
      span.start = index;
    }
    span.count += 1;
  });
  return {
    left,
    top,
    cellWidth,
    cellHeight,
    columns: GRID_COLUMNS,
    rows: GRID_ROWS,
    sorted,
    spans,
  };
};

export type NightStarGrid = ReturnType<typeof nightStarGrid>;

/**
 * A halo, stop to stop, blended straight as a canvas blends it: the moon's
 * by night, the sun's on a light window (`DAY_HALO_STOPS`), as `haloStops`
 * chooses for the page.
 */
const haloInk = (
  name: string,
  from: readonly { at: number; colour: string }[],
) => {
  const stops = from.map(({ at, colour }) => {
    const { rgb, alpha } = glslInk(colour);
    return { at, value: `vec4(${rgb}, ${f(alpha)})` };
  });
  const pieces = stops.slice(1).map(
    (stop, index) => `if (t <= ${f(stop.at)}) {
    return mix(${stops[index].value}, ${stop.value}, (t - ${f(stops[index].at)}) / ${f(Math.max(1e-6, stop.at - stops[index].at))});
  }`,
  );
  return `vec4 ${name}(float t) {
  ${pieces.join('\n  ')}
  return ${stops[stops.length - 1].value};
}`;
};

/**
 * One of two fixed inks by the window's side (`lookOnLight`): a night
 * scene's own colour on a dark window, its day colour on a light one.
 */
export const dayOrNight = (day: string, night: string): string =>
  `(lookOnLight() ? ${glslInk(day).rgb} : ${glslInk(night).rgb})`;

export const NIGHT_GLSL = `
// A box's signed distance: its middle, and half its size.
float nightBox(vec2 q, vec2 middle, vec2 halfSize) {
  vec2 off = abs(q - middle) - halfSize;
  return length(max(off, 0.0)) + min(max(off.x, off.y), 0.0);
}

// How much of q the union of a row's circles covers, from the first given.
float nightCircles(vec2 q, int row, int from, int count) {
  float cover = 0.0;
  for (int k = 0; k < 16; k++) {
    if (k >= count) {
      break;
    }
    vec4 circle = texelFetch(uLookData, ivec2(from + k, row), 0);
    cover = max(cover, lookFill(length(q - circle.xy) - circle.z));
  }
  return cover;
}

// The stars around q, in their two bands, the bright and the faint: the
// stars kept cell by cell in starRow, each cell's first and how many in
// cellRow, the grid's left, top and cell size, and its cells across and down.
vec2 nightStars(vec2 q, int starRow, int cellRow, vec4 grid, ivec2 cells) {
  ivec2 home = ivec2(floor((q - grid.xy) / grid.zw));
  vec2 cover = vec2(0.0);
  for (int k = 0; k < 9; k++) {
    ivec2 cell = home + ivec2(k % 3 - 1, k / 3 - 1);
    if (cell.x < 0 || cell.y < 0 || cell.x >= cells.x || cell.y >= cells.y) {
      continue;
    }
    vec4 span = texelFetch(uLookData, ivec2(cell.y * cells.x + cell.x, cellRow), 0);
    int start = int(span.x + 0.5);
    int count = int(span.y + 0.5);
    for (int s = 0; s < 32; s++) {
      if (s >= count) {
        break;
      }
      vec4 star = texelFetch(uLookData, ivec2(start + s, starRow), 0);
      // Bright plus two where it is a disc rather than a square.
      float inked = lookFill(star.w > 1.5
        ? length(q - star.xy) - star.z
        : nightBox(q, star.xy, vec2(star.z)));
      if (mod(star.w, 2.0) > 0.5) {
        cover.x = max(cover.x, inked);
      } else {
        cover.y = max(cover.y, inked);
      }
    }
  }
  return cover;
}

${haloInk('nightHaloMoon', HALO_STOPS)}
${haloInk('nightHaloSun', DAY_HALO_STOPS)}
vec4 nightHaloInk(float t) {
  return lookOnLight() ? nightHaloSun(t) : nightHaloMoon(t);
}

// The moon's halo at q, straight: its colour and how solid, before the
// strength it is laid down at.
vec4 nightHalo(vec2 q, vec2 moon, float radius) {
  float fromMoon = length(q - moon);
  if (fromMoon >= radius * ${f(HALO_REACH)}) {
    return vec4(0.0);
  }
  return nightHaloInk(clamp((fromMoon - radius * ${f(HALO_INNER)}) / max(1e-3, radius * ${f(HALO_REACH - HALO_INNER)}), 0.0, 1.0));
}
`;

/** Writes the stars and the grid's cells into two rows of a look's data. */
export const writeNightStars = (
  grid: NightStarGrid,
  put: (row: number, index: number, values: number[]) => void,
  starRow: number,
  cellRow: number,
): void => {
  grid.sorted.forEach(({ x, y, r, bright, round }, index) => {
    put(starRow, index, [x, y, r, (bright ? 1 : 0) + (round ? 2 : 0)]);
  });
  grid.spans.forEach(({ start, count }, index) => {
    put(cellRow, index, [start, count, 0, 0]);
  });
};

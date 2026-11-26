/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * THE HEADER'S NAME, DRAWN WITH A BROAD PEN (Ivan, 2026-11-26: "a nice
 * FluidEQ, cursive and artistic", then "more fat and more professional, just a
 * bit of hand write look", and of four pens, "A · Broad pen").
 *
 * The letters are a pen's centre lines, hand-drawn here, so no font is shipped
 * or licensed: a sans skeleton whose small letters join with round turns. The
 * pen is a flat nib held at 35°, so a stroke is thick where it runs across the
 * nib and thin where it runs along it, with square-cut ends. The outline is
 * the nib swept along every line — for each step, the hull of the nib at both
 * ends — computed once at load into one SVG path.
 *
 * Units: baseline 121, x-height 72, cap height 26, as drawn; the slant is
 * applied when the outline is built.
 */

export interface IWordStroke {
  d: string;
  /** The stroke that leaves the Q and runs on as the live sound. */
  isTail?: boolean;
}

const LUID =
  'M 96 26 L 96 104 C 96 114, 102 121, 111 121 C 118 121, 123 116, 125 108 ' +
  'L 129 72 L 129 104 C 129 114, 136 121, 145 121 C 154 121, 161 114, 161 104 L 161 72 L 161 106 C 161 115, 166 121, 174 121 C 180 121, 184 117, 186 110 ' +
  'L 190 72 L 190 106 C 190 115, 195 121, 203 121 C 209 121, 213 118, 215 112 ' +
  // The d: the join runs into the bowl's left side and the bowl closes on itself.
  'C 216 108, 217 104, 217 98 C 217 82, 228 72, 242 72 C 256 72, 266 82, 266 97 C 266 112, 256 121, 242 121 C 228 121, 217 112, 217 98';

export const WORDMARK_STROKES: readonly IWordStroke[] = [
  // F: a stem, a top bar that leaves it in a round corner, a crossbar. It
  // stands on its own: joined to the l, its crossbar read as the bowl of a P.
  { d: 'M 30 121 L 30 40 C 30 31, 36 26, 45 26 L 80 26' },
  { d: 'M 30 72 L 66 72' },
  { d: LUID },
  {
    d: 'M 266 26 L 266 106 C 266 115, 271 121, 279 121 C 285 121, 289 118, 291 113',
  },
  // E: two open bowls meeting in a cusp at the waist.
  {
    d: 'M 362 38 C 357 30, 348 26, 337 26 C 322 26, 312 35, 312 48 C 312 61, 323 70, 340 70 C 320 70, 307 81, 307 97 C 307 112, 320 121, 337 121 C 350 121, 359 115, 364 106',
  },
  // Q: an oval, and a tail that crosses it and runs out along the baseline.
  {
    d: 'M 418 26 C 396 26, 382 46, 382 73.5 C 382 101, 396 121, 418 121 C 440 121, 454 101, 454 73.5 C 454 46, 440 26, 418 26 Z',
  },
  {
    d: 'M 408 94 C 420 104, 432 119, 450 121 C 463 122.5, 474 121, 488 121',
    isTail: true,
  },
];

/** The i's dot, as drawn. */
const I_DOT = { x: 190, y: 50, r: 5.2 };

export const WORDMARK_PEN = {
  /** Degrees the letters lean, applied about the baseline. */
  slant: 8,
  baseline: 121,
  /** The nib's width across, in lettering units. */
  nib: 15,
  /** The nib's own thickness: what a stroke running along it is left with. */
  edge: 3.6,
  /** The nib's angle from the horizontal, degrees. */
  angle: 35,
  /** How far apart the pen is set down along a line, in lettering units. */
  step: 2,
} as const;

type TPoint = readonly [number, number];

/**
 * Points along one stroke's path, `step` apart or closer. Only the commands
 * the skeleton uses are read: absolute M, L, C and Z.
 */
export const sampleStroke = (d: string, step: number): TPoint[] => {
  const tokens = d.match(/[MLCZ]|-?\d*\.?\d+/g) ?? [];
  const points: TPoint[] = [];
  let index = 0;
  let current: TPoint = [0, 0];
  let start: TPoint = [0, 0];
  let command = '';
  const read = () => {
    const value = Number(tokens[index]);
    index += 1;
    return value;
  };
  const line = (to: TPoint) => {
    const count = Math.max(
      1,
      Math.ceil(Math.hypot(to[0] - current[0], to[1] - current[1]) / step),
    );
    for (let i = 1; i <= count; i += 1) {
      const t = i / count;
      points.push([
        current[0] + (to[0] - current[0]) * t,
        current[1] + (to[1] - current[1]) * t,
      ]);
    }
    current = to;
  };
  while (index < tokens.length) {
    if (/[MLCZ]/.test(tokens[index])) {
      command = tokens[index];
      index += 1;
    }
    if (command === 'M') {
      current = [read(), read()];
      start = current;
      points.push(current);
      command = 'L';
    } else if (command === 'L') {
      line([read(), read()]);
    } else if (command === 'C') {
      const c1: TPoint = [read(), read()];
      const c2: TPoint = [read(), read()];
      const to: TPoint = [read(), read()];
      const from = current;
      const length =
        Math.hypot(c1[0] - from[0], c1[1] - from[1]) +
        Math.hypot(c2[0] - c1[0], c2[1] - c1[1]) +
        Math.hypot(to[0] - c2[0], to[1] - c2[1]);
      const count = Math.max(2, Math.ceil(length / step));
      for (let i = 1; i <= count; i += 1) {
        const t = i / count;
        const u = 1 - t;
        points.push([
          u * u * u * from[0] +
            3 * u * u * t * c1[0] +
            3 * u * t * t * c2[0] +
            t * t * t * to[0],
          u * u * u * from[1] +
            3 * u * u * t * c1[1] +
            3 * u * t * t * c2[1] +
            t * t * t * to[1],
        ]);
      }
      current = to;
    } else if (command === 'Z') {
      line(start);
      command = '';
    } else {
      // Anything else is not the skeleton's: stop rather than loop on it.
      break;
    }
  }
  return points;
};

/** Counter-clockwise hull of a handful of points (monotone chain). */
const hullOf = (points: TPoint[]): TPoint[] => {
  const sorted = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o: TPoint, a: TPoint, b: TPoint) =>
    (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower: TPoint[] = [];
  sorted.forEach((point) => {
    while (
      lower.length >= 2 &&
      cross(lower[lower.length - 2], lower[lower.length - 1], point) <= 0
    ) {
      lower.pop();
    }
    lower.push(point);
  });
  const upper: TPoint[] = [];
  [...sorted].reverse().forEach((point) => {
    while (
      upper.length >= 2 &&
      cross(upper[upper.length - 2], upper[upper.length - 1], point) <= 0
    ) {
      upper.pop();
    }
    upper.push(point);
  });
  return [...lower.slice(0, -1), ...upper.slice(0, -1)];
};

export interface IWordmarkShape {
  /** The whole word as one filled path, every piece wound the same way. */
  path: string;
  /** The box the outline fills, lettering units. */
  box: { x: number; y: number; width: number; height: number };
  /** Where the Q's tail ends, and so where the live sound takes over. */
  tailEnd: { x: number; y: number };
  /** The pen's width on a level stroke: the tail's width as it leaves the Q. */
  tailWidth: number;
  /** The Q's top right, where the version stands. */
  qShoulder: { x: number; y: number };
}

const round = (value: number) => Math.round(value * 10) / 10;

/** The word swept by the pen, once. */
export const buildWordmark = (pen = WORDMARK_PEN): IWordmarkShape => {
  const lean = Math.tan((pen.slant * Math.PI) / 180);
  const skew = ([x, y]: TPoint): TPoint => [x - (y - pen.baseline) * lean, y];
  const angle = (pen.angle * Math.PI) / 180;
  // Half the nib across, and half its thickness along the perpendicular.
  const across: TPoint = [
    (Math.cos(angle) * pen.nib) / 2,
    (-Math.sin(angle) * pen.nib) / 2,
  ];
  const thick: TPoint = [
    (Math.sin(angle) * pen.edge) / 2,
    (Math.cos(angle) * pen.edge) / 2,
  ];
  const corners = ([x, y]: TPoint): TPoint[] => [
    [x + across[0] + thick[0], y + across[1] + thick[1]],
    [x + across[0] - thick[0], y + across[1] - thick[1]],
    [x - across[0] + thick[0], y - across[1] + thick[1]],
    [x - across[0] - thick[0], y - across[1] - thick[1]],
  ];
  const pieces: string[] = [];
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let tailEnd = { x: 0, y: 0 };
  let qShoulder = { x: -Infinity, y: Infinity };
  WORDMARK_STROKES.forEach((stroke, strokeIndex) => {
    const points = sampleStroke(stroke.d, pen.step).map(skew);
    for (let i = 1; i < points.length; i += 1) {
      const hull = hullOf([...corners(points[i - 1]), ...corners(points[i])]);
      const xs = hull.map(([x]) => x);
      const ys = hull.map(([, y]) => y);
      minX = Math.min(minX, ...xs);
      minY = Math.min(minY, ...ys);
      maxX = Math.max(maxX, ...xs);
      maxY = Math.max(maxY, ...ys);
      pieces.push(
        `M${hull.map(([x, y]) => `${round(x)} ${round(y)}`).join('L')}Z`,
      );
    }
    if (stroke.isTail) {
      const [x, y] = points[points.length - 1];
      tailEnd = { x, y };
    }
    // The Q is the stroke before its tail.
    if (WORDMARK_STROKES[strokeIndex + 1]?.isTail) {
      points.forEach(([x, y]) => {
        qShoulder = {
          x: Math.max(qShoulder.x, x),
          y: Math.min(qShoulder.y, y),
        };
      });
    }
  });
  const [dotX, dotY] = skew([I_DOT.x, I_DOT.y]);
  const { r } = I_DOT;
  pieces.push(
    `M${round(dotX - r)} ${round(dotY)}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0Z`,
  );
  return {
    path: pieces.join(''),
    box: { x: minX, y: minY, width: maxX - minX, height: maxY - minY },
    tailEnd,
    tailWidth: Math.abs(across[1]) * 2 + pen.edge * Math.cos(angle),
    qShoulder,
  };
};

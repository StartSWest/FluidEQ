/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The title bar's meter never draws past the top or the bottom of its stage
 * (Ivan, 2026-11-25: "fix top wave going cut on the top ... make sure the
 * waves never touch the top and pass"). The stage clips at its box, so a line
 * drawn past it is cut off flat — which is what loud music did to the wave,
 * because the curve through two neighbouring points at the top bowed above
 * them.
 *
 * Every style is driven here with music louder than anything the gate hands
 * over — values past full scale, plateaus at the top with deep dips beside
 * them, the shape that made the curve bow — and every point of every curve,
 * sampled along each Bézier, with the half of its stroke that lies outside
 * it, has to stay inside the box. The recorder keeps its own test of the same
 * thing (`waveformRecorder.test.ts`, "holds a sample past full scale").
 */

import { WAVEFORM_STYLES } from 'common/waveformStyles';
import paintFlatMeter from 'renderer/waveformFlatPaint';
import {
  BODY_TINT,
  EDGE_CLEARANCE,
  type IFlatMeterBox,
  type IFlatMeterInput,
  traceCurve,
} from 'renderer/waveformFlatKit';
import {
  advanceFlatMeter,
  createFlatMeterState,
} from 'renderer/waveformFlatState';

/** A point of a drawn shape, and how far its paint spreads past it. */
interface IMark {
  y: number;
  spread: number;
}

/** Samples along each Bézier, enough to find a bow a fraction of a pixel. */
const BEZIER_STEPS = 48;

/** The y of a cubic Bézier at `t`. */
const bezierY = (y0: number, y1: number, y2: number, y3: number, t: number) =>
  (1 - t) ** 3 * y0 +
  3 * (1 - t) ** 2 * t * y1 +
  3 * (1 - t) * t ** 2 * y2 +
  t ** 3 * y3;

/** The y of a quadratic Bézier at `t`. */
const quadraticY = (y0: number, y1: number, y2: number, t: number) =>
  (1 - t) ** 2 * y0 + 2 * (1 - t) * t * y1 + t ** 2 * y2;

/**
 * A path that keeps the vertical extent of everything put on it: the points
 * themselves, every curve sampled along its length, rectangles by their two
 * edges, circles by their top and bottom.
 */
class ExtentPath {
  ys: number[] = [];

  private lastY = 0;

  moveTo(_x: number, y: number) {
    this.ys.push(y);
    this.lastY = y;
  }

  lineTo(_x: number, y: number) {
    this.ys.push(y);
    this.lastY = y;
  }

  bezierCurveTo(
    _c1x: number,
    c1y: number,
    _c2x: number,
    c2y: number,
    _x: number,
    y: number,
  ) {
    for (let step = 1; step <= BEZIER_STEPS; step += 1) {
      this.ys.push(bezierY(this.lastY, c1y, c2y, y, step / BEZIER_STEPS));
    }
    this.lastY = y;
  }

  quadraticCurveTo(_cx: number, cy: number, _x: number, y: number) {
    for (let step = 1; step <= BEZIER_STEPS; step += 1) {
      this.ys.push(quadraticY(this.lastY, cy, y, step / BEZIER_STEPS));
    }
    this.lastY = y;
  }

  rect(_x: number, y: number, _w: number, h: number) {
    this.ys.push(y, y + h);
  }

  roundRect(x: number, y: number, w: number, h: number) {
    this.rect(x, y, w, h);
  }

  arc(_cx: number, cy: number, radius: number) {
    this.ys.push(cy - radius, cy + radius);
  }

  closePath() {
    return this;
  }
}

/**
 * A context that turns every fill and stroke into marks: a fill's paint ends
 * at its edge, a stroke's half its width past it (and a mitred corner, which
 * the skyline's square steps have, half its width times √2).
 */
const markingContext = () => {
  const marks: IMark[] = [];
  let path = new ExtentPath();
  const context = {
    globalAlpha: 1,
    fillStyle: '' as unknown,
    strokeStyle: '' as unknown,
    lineWidth: 1,
    lineJoin: 'round',
    lineCap: 'round',
    beginPath: () => {
      path = new ExtentPath();
    },
    moveTo: (x: number, y: number) => path.moveTo(x, y),
    lineTo: (x: number, y: number) => path.lineTo(x, y),
    bezierCurveTo: (
      a: number,
      b: number,
      c: number,
      d: number,
      e: number,
      f: number,
    ) => path.bezierCurveTo(a, b, c, d, e, f),
    rect: (x: number, y: number, w: number, h: number) => path.rect(x, y, w, h),
    roundRect: (x: number, y: number, w: number, h: number) =>
      path.roundRect(x, y, w, h),
    arc: (cx: number, cy: number, radius: number) => path.arc(cx, cy, radius),
    closePath: () => undefined,
    fill: (shape?: ExtentPath) => {
      (shape ?? path).ys.forEach((y) => marks.push({ y, spread: 0 }));
    },
    fillRect: (_x: number, y: number, _w: number, h: number) => {
      marks.push({ y, spread: 0 }, { y: y + h, spread: 0 });
    },
    stroke: () => {
      const half = context.lineWidth / 2;
      const spread = context.lineJoin === 'miter' ? half * Math.SQRT2 : half;
      path.ys.forEach((y) => marks.push({ y, spread }));
    },
  };
  return { context, marks };
};

/**
 * Louder than the gate ever hands over: plateaus at full scale and past it,
 * with deep dips between them — the shape the curve bowed over.
 */
const tooLoud = (length: number, top: number) =>
  Array.from({ length }, (_, index) => {
    const phase = index % 8;
    if (phase < 2) {
      return 0.05;
    }
    return phase % 3 === 0 ? top : top * 0.98;
  });

const FLAT_STYLES = WAVEFORM_STYLES.filter(
  (style): style is IFlatMeterInput['style'] => style !== 'recorder',
);

/**
 * The styles whose meter itself rides up to the top keep `EDGE_CLEARANCE`
 * from it as well as staying inside. Not the ones whose background grid runs
 * to the top by design (Ivan, 2026-11-16: "the ones with bg needs to cover
 * full height"), nor Level, which runs across.
 */
const GRID_STYLES = new Set<IFlatMeterInput['style']>([
  'dots',
  'blocks',
  'segments',
  'heat',
  'waterfall',
  'level',
]);
const METER_STYLES = FLAT_STYLES.filter((style) => !GRID_STYLES.has(style));

/**
 * The stages the meter has: the 54px bar, the short window's 40px, a taller
 * one off the device pixel grid, and one far shorter than any it has.
 */
const BOXES: IFlatMeterBox[] = [
  { x: 10, y: 10, width: 400, height: 36 },
  { x: 10, y: 10, width: 180, height: 22 },
  { x: 10, y: 10.4, width: 260, height: 47 },
  { x: 10, y: 10, width: 400, height: 12 },
];

const paint = (
  style: IFlatMeterInput['style'],
  box: IFlatMeterBox,
  ratio: number,
  loudness: number,
) => {
  const bands = tooLoud(64, loudness);
  const state = createFlatMeterState();
  // A history and held peaks as loud as the bands, for Echo, Waterfall,
  // Peaks and Level.
  for (let frame = 0; frame < 12; frame += 1) {
    advanceFlatMeter(state, bands, [loudness, loudness], 70, { value: 0 });
  }
  const { context, marks } = markingContext();
  paintFlatMeter(context as unknown as CanvasRenderingContext2D, {
    style,
    box,
    ratio,
    wave: tooLoud(96, loudness),
    bands,
    state,
    ink: 'INK',
    light: 'LIGHT',
    unlit: 'UNLIT',
    body: BODY_TINT,
    meterTop: box.y,
  });
  return marks;
};

/** How far the paint comes to the box's top and its bottom: the least room. */
const roomOf = (marks: readonly IMark[], box: IFlatMeterBox) => ({
  top: Math.min(...marks.map(({ y, spread }) => y - spread - box.y)),
  bottom: Math.min(
    ...marks.map(({ y, spread }) => box.y + box.height - (y + spread)),
  ),
});

describe('the title bar meter on music louder than the pane', () => {
  beforeEach(() => {
    Object.assign(globalThis, { Path2D: ExtentPath });
  });
  afterEach(() => {
    Reflect.deleteProperty(globalThis, 'Path2D');
  });

  describe.each(BOXES)('in a $width x $height stage', (box) => {
    it.each(
      FLAT_STYLES.flatMap((style) =>
        [1, 1.25, 2].map((ratio) => [style, ratio] as const),
      ),
    )('%s at %sx never passes the top or the bottom', (style, ratio) => {
      [1, 1.6].forEach((loudness) => {
        const marks = paint(style, box, ratio, loudness);
        expect(marks.length).toBeGreaterThan(0);
        const room = roomOf(marks, box);
        // Half a device pixel is the most an edge snapped to whole device
        // pixels (the LED grids, a bar's height) may lean past a box whose
        // own edge falls between two; a bow of the curve was 1 to 5px.
        const snapping = 0.5 / ratio + 1e-9;
        expect(room.top).toBeGreaterThanOrEqual(-snapping);
        expect(room.bottom).toBeGreaterThanOrEqual(-snapping);
      });
    });

    it.each(METER_STYLES)(
      '%s keeps clear of the top, never touching it',
      (style) => {
        const ratio = 2;
        const room = roomOf(paint(style, box, ratio, 1.6), box);
        expect(room.top).toBeGreaterThanOrEqual(
          EDGE_CLEARANCE - 0.5 / ratio - 1e-9,
        );
      },
    );
  });
});

describe('the curve through the wave', () => {
  /** The y extent of a curve, every Bézier sampled along its length. */
  const extentOf = (draw: (context: CanvasRenderingContext2D) => void) => {
    const path = new ExtentPath();
    draw(path as unknown as CanvasRenderingContext2D);
    return { top: Math.min(...path.ys), bottom: Math.max(...path.ys) };
  };

  /** The curve as it was drawn before: plain Catmull-Rom. */
  const catmullRom = (
    context: CanvasRenderingContext2D,
    points: readonly [number, number][],
  ) => {
    context.moveTo(points[0][0], points[0][1]);
    for (let index = 0; index < points.length - 1; index += 1) {
      const [x0, y0] = points[Math.max(0, index - 1)];
      const [x1, y1] = points[index];
      const [x2, y2] = points[index + 1];
      const [x3, y3] = points[Math.min(points.length - 1, index + 2)];
      context.bezierCurveTo(
        x1 + (x2 - x0) / 6,
        y1 + (y2 - y0) / 6,
        x2 - (x3 - x1) / 6,
        y2 - (y3 - y1) / 6,
        x2,
        y2,
      );
    }
  };

  /** The band a wave 28px tall is mapped into. */
  const BAND = { top: 2, bottom: 30 };

  /** Two neighbours at the top with deep dips either side, 4px apart. */
  const plateau: [number, number][] = [
    [0, 30],
    [4, 2],
    [8, 2],
    [12, 30],
    [16, 2],
    [20, 2],
    [24, 30],
  ];

  it('never leaves its band, however loud', () => {
    const { top, bottom } = extentOf((context) =>
      traceCurve(context, plateau, BAND),
    );
    expect(top).toBeGreaterThanOrEqual(2 - 1e-9);
    expect(bottom).toBeLessThanOrEqual(30 + 1e-9);
  });

  it('where the old curve bowed an eighth of the reach past the top (the control)', () => {
    const { top } = extentOf((context) => catmullRom(context, plateau));
    // 28px of reach: 3.5px over the plateau, past a stage's top.
    expect(top).toBeLessThan(2 - 3);
  });

  it('is the old curve exactly wherever that one stayed inside', () => {
    // Three quarters of the band, the way ordinary music draws: no control
    // point of the old curve leans out of the band.
    const quiet: [number, number][] = Array.from({ length: 24 }, (_, index) => [
      index * 4,
      16 - 10.5 * Math.sin(index / 3),
    ]);
    const calls = (draw: (context: CanvasRenderingContext2D) => void) => {
      const recorded: number[][] = [];
      draw({
        moveTo: (...args: number[]) => recorded.push(args),
        lineTo: (...args: number[]) => recorded.push(args),
        bezierCurveTo: (...args: number[]) => recorded.push(args),
      } as unknown as CanvasRenderingContext2D);
      return recorded;
    };
    const now = calls((context) => traceCurve(context, quiet, BAND));
    const before = calls((context) => catmullRom(context, quiet));
    expect(now).toHaveLength(before.length);
    now.forEach((call, index) =>
      call.forEach((value, at) =>
        expect(value).toBeCloseTo(before[index][at], 9),
      ),
    );
  });
});

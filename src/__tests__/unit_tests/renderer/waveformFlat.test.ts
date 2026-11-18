/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The title bar meter's flat styles (Ivan, 2026-11-16: "do all of them, flat
 * and the 10 new ones"; "all meters need to fill the full width of the
 * container"; "just the bg not the meter").
 */

import { WAVEFORM_STYLES } from 'common/waveformStyles';
import paintFlatMeter from 'renderer/waveformFlatPaint';
import {
  BODY_TINT,
  type IFlatMeterInput,
  slots,
} from 'renderer/waveformFlatKit';
import {
  FLAT_HISTORY_LENGTH,
  advanceFlatMeter,
  createFlatMeterState,
  levelOf,
} from 'renderer/waveformFlatState';

describe('a row of pieces', () => {
  const box = { x: 10, y: 0, width: 397, height: 40 };

  it('spans the box edge to edge at a width that does not divide', () => {
    const ratio = 2;
    const row = slots(box, ratio, 48, 2);
    const first = row[0];
    const last = row[row.length - 1];
    expect(first.x).toBeCloseTo(box.x, 5);
    // To the last device pixel: centring left up to 47 of them at the ends.
    expect(Math.abs(last.x + last.width - (box.x + box.width))).toBeLessThan(
      1 / ratio + 1e-9,
    );
  });

  it('keeps every gap the same and every piece within a device pixel of the next', () => {
    const ratio = 1.25;
    const row = slots(box, ratio, 40, 3);
    const gaps = row
      .slice(1)
      .map((piece, index) =>
        Math.round((piece.x - row[index].x - row[index].width) * ratio),
      );
    expect(new Set(gaps).size).toBe(1);
    const widths = row.map((piece) => Math.round(piece.width * ratio));
    expect(Math.max(...widths) - Math.min(...widths)).toBeLessThanOrEqual(1);
  });
});

describe('what the styles remember', () => {
  it('holds a band’s peak and lets it fall slowly, while the band itself drops', () => {
    const state = createFlatMeterState();
    const since = { value: 0 };
    advanceFlatMeter(state, [1, 0.2], [0, 0], 16, since);
    expect(state.peaks[0]).toBe(1);
    // Half a second later the band is silent; the held mark is still high.
    const moving = advanceFlatMeter(state, [0, 0.2], [0, 0], 500, since);
    expect(moving).toBe(true);
    expect(state.peaks[0]).toBeCloseTo(1 - 0.55 * 0.5, 5);
    expect(state.peaks[1]).toBe(0.2);
  });

  it('keeps a moment of the past every 70 ms, never more than ten', () => {
    const state = createFlatMeterState();
    const since = { value: 0 };
    advanceFlatMeter(state, [0.5], [0, 0], 16, since);
    expect(state.history).toHaveLength(1);
    // Three frames of 16 ms is under 70: no new moment.
    for (let frame = 0; frame < 3; frame += 1) {
      advanceFlatMeter(state, [0.5], [0, 0], 16, since);
    }
    expect(state.history).toHaveLength(1);
    for (let frame = 0; frame < 40; frame += 1) {
      advanceFlatMeter(state, [frame / 40], [0, 0], 70, since);
    }
    expect(state.history).toHaveLength(FLAT_HISTORY_LENGTH);
    expect(state.history[0][0]).toBeCloseTo(39 / 40, 5);
  });

  it('puts each channel on the -48..0 dB scale', () => {
    expect(levelOf(1)).toBe(1);
    expect(levelOf(10 ** (-24 / 20))).toBeCloseTo(0.5, 5);
    expect(levelOf(10 ** (-60 / 20))).toBe(0);
    expect(levelOf(0)).toBe(0);
  });

  it('settles: nothing moves once the bands and the channels are still', () => {
    const state = createFlatMeterState();
    const since = { value: 0 };
    let moving = true;
    for (let frame = 0; frame < 200 && moving; frame += 1) {
      moving = advanceFlatMeter(state, [0.4, 0.4], [0.5, 0.5], 16, since);
    }
    expect(moving).toBe(false);
  });
});

/** A context that records what each fill was made of, and in which colour. */
const recordingContext = () => {
  const fills: { style: unknown; rects: [number, number, number, number][] }[] =
    [];
  const pending: [number, number, number, number][] = [];
  const context: Record<string, unknown> = {
    globalAlpha: 1,
    fillStyle: '',
    strokeStyle: '',
    calls: 0,
  };
  const count = () => {
    context.calls = (context.calls as number) + 1;
  };
  Object.assign(context, {
    createLinearGradient: () => ({ addColorStop: () => undefined }),
    beginPath: () => {
      pending.length = 0;
    },
    roundRect: (x: number, y: number, w: number, h: number) => {
      count();
      pending.push([x, y, w, h]);
    },
    fill: (path?: { rects: [number, number, number, number][] }) => {
      count();
      fills.push({
        style: context.fillStyle,
        rects: path ? [...path.rects] : [...pending],
      });
    },
    fillRect: (x: number, y: number, w: number, h: number) => {
      count();
      fills.push({ style: context.fillStyle, rects: [[x, y, w, h]] });
    },
    stroke: count,
    moveTo: count,
    lineTo: count,
    bezierCurveTo: count,
    arc: count,
    closePath: () => undefined,
    rect: count,
    save: () => undefined,
    restore: () => undefined,
  });
  return { context, fills };
};

class RecordingPath2D {
  rects: [number, number, number, number][] = [];

  roundRect(x: number, y: number, w: number, h: number) {
    this.rects.push([x, y, w, h]);
  }

  rect(x: number, y: number, w: number, h: number) {
    this.rects.push([x, y, w, h]);
  }

  moveTo() {
    return this;
  }

  /** A dot, kept as the square it sits in. */
  arc(cx: number, cy: number, radius: number) {
    this.rects.push([cx - radius, cy - radius, radius * 2, radius * 2]);
  }
}

describe('every style', () => {
  beforeEach(() => {
    Object.assign(globalThis, { Path2D: RecordingPath2D });
  });
  afterEach(() => {
    Reflect.deleteProperty(globalThis, 'Path2D');
  });

  const input = (
    style: IFlatMeterInput['style'],
    meterTop = 0,
  ): IFlatMeterInput => {
    const state = createFlatMeterState();
    const bands = Array.from({ length: 64 }, (_, index) => (index % 7) / 6);
    advanceFlatMeter(state, bands, [0.6, 0.4], 16, { value: 0 });
    return {
      style,
      box: { x: 0, y: 0, width: 400, height: 40 },
      ratio: 2,
      wave: Array.from({ length: 96 }, (_, index) => Math.sin(index / 5)),
      bands,
      state,
      ink: 'INK',
      light: 'LIGHT',
      unlit: 'UNLIT',
      body: BODY_TINT,
      meterTop,
    };
  };

  // The recorder keeps its own pixels (`waveformRecorder.ts`); every other
  // style is painted whole by `paintFlatMeter`.
  const FLAT_STYLES = WAVEFORM_STYLES.filter(
    (style): style is IFlatMeterInput['style'] => style !== 'recorder',
  );

  it.each(FLAT_STYLES)('%s paints, and leaves the alpha at 1', (style) => {
    const { context, fills } = recordingContext();
    paintFlatMeter(
      context as unknown as CanvasRenderingContext2D,
      input(style),
    );
    expect(context.calls as number).toBeGreaterThan(0);
    expect(context.globalAlpha).toBe(1);
    // Whatever it fills is inside the box.
    fills.forEach(({ rects }) =>
      rects.forEach(([x, , w]) => {
        expect(x).toBeGreaterThanOrEqual(-1e-9);
        expect(x + w).toBeLessThanOrEqual(400 + 1e-9);
      }),
    );
  });

  it('has the recorder first, then the ten new styles after the eleven', () => {
    expect(WAVEFORM_STYLES).toHaveLength(22);
    expect(WAVEFORM_STYLES[0]).toBe('recorder');
    expect(WAVEFORM_STYLES.slice(12)).toEqual([
      'peaks',
      'segments',
      'steps',
      'beads',
      'echo',
      'heat',
      'waterfall',
      'level',
      'reflection',
      'contour',
    ]);
  });
});

describe('a background grid over the label row', () => {
  beforeEach(() => {
    Object.assign(globalThis, { Path2D: RecordingPath2D });
  });
  afterEach(() => {
    Reflect.deleteProperty(globalThis, 'Path2D');
  });

  const loud = (style: IFlatMeterInput['style'], meterTop: number) => {
    const state = createFlatMeterState();
    const bands = new Array<number>(64).fill(1);
    advanceFlatMeter(state, bands, [1, 1], 16, { value: 0 });
    const { context, fills } = recordingContext();
    paintFlatMeter(context as unknown as CanvasRenderingContext2D, {
      style,
      box: { x: 0, y: 0, width: 400, height: 40 },
      ratio: 2,
      wave: [],
      bands,
      state,
      ink: 'INK',
      light: 'LIGHT',
      unlit: 'UNLIT',
      body: BODY_TINT,
      meterTop,
    });
    const tops = (lit: boolean) =>
      fills
        .filter(({ style: colour }) => (colour === 'UNLIT') !== lit)
        .flatMap(({ rects }) => rects.map(([, y]) => y));
    return {
      litTop: Math.min(...tops(true)),
      gridTop: Math.min(...tops(false)),
    };
  };

  it.each(['segments', 'dots', 'heat', 'waterfall'] as const)(
    '%s lights nothing above the meter, while its grid runs to the top',
    (style) => {
      const { litTop, gridTop } = loud(style, 12);
      expect(litTop).toBeGreaterThanOrEqual(12 - 1e-9);
      expect(gridTop).toBeLessThan(12);
    },
  );

  it('lights up to the top when the meter starts at the top (the control)', () => {
    const { litTop } = loud('segments', 0);
    expect(litTop).toBeLessThan(12);
  });
});

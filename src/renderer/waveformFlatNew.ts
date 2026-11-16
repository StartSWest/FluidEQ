/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The ten meter styles added on 2026-11-16 (Ivan: "do all of them, flat and
 * the 10 new ones"), flat from the start.
 */
import {
  type TPainter,
  HOT,
  WARM,
  across,
  countFor,
  resample,
  silhouette,
  slots,
  snap,
  soften,
  stroke,
  tint,
  traceCurve,
} from './waveformFlatKit';

const NEW_PAINTERS: Record<
  | 'peaks'
  | 'segments'
  | 'steps'
  | 'beads'
  | 'echo'
  | 'heat'
  | 'waterfall'
  | 'level'
  | 'reflection'
  | 'contour',
  TPainter
> = {
  peaks(context, input) {
    const { box, ratio } = input;
    const row = slots(box, ratio, countFor(box, 9.5, 20, 56), 3);
    const values = resample(input.bands, row.length);
    const held = resample(input.state.peaks, row.length);
    const floor = box.y + box.height;
    const tick = snap(2, ratio);
    context.globalAlpha = 0.6;
    context.fillStyle = input.ink;
    context.beginPath();
    row.forEach(({ x, width }, index) => {
      const height = Math.max(
        2 / ratio,
        snap(values[index] * (box.height - tick - 2), ratio),
      );
      context.roundRect(x, floor - height, width, height, [1, 1, 0, 0]);
    });
    context.fill();
    context.globalAlpha = 1;
    context.fillStyle = input.light;
    row.forEach(({ x, width }, index) => {
      context.fillRect(
        x,
        snap(floor - tick - held[index] * (box.height - tick - 2), ratio),
        width,
        tick,
      );
    });
  },

  segments(context, input) {
    const { box, ratio } = input;
    const row = slots(box, ratio, countFor(box, 13, 16, 44), 3);
    const values = resample(input.bands, row.length);
    const cells = 8;
    const gap = snap(2, ratio);
    const floor = box.y + box.height;
    // Eight cells in the meter; the grid carries on, unlit, to the box's top.
    const cell = Math.max(
      1 / ratio,
      snap((floor - input.meterTop - gap * (cells - 1)) / cells, ratio),
    );
    const rows = Math.max(cells, Math.floor((box.height + gap) / (cell + gap)));
    const groups = {
      unlit: new Path2D(),
      body: new Path2D(),
      warm: new Path2D(),
      hot: new Path2D(),
    };
    row.forEach(({ x, width }, index) => {
      const lit = Math.round(values[index] * cells);
      for (let level = 0; level < rows; level += 1) {
        let group: keyof typeof groups = 'unlit';
        if (level < lit) {
          if (level === cells - 1) {
            group = 'hot';
          } else if (level === cells - 2) {
            group = 'warm';
          } else {
            group = 'body';
          }
        }
        groups[group].roundRect(
          x,
          snap(floor - (level + 1) * cell - level * gap, ratio),
          width,
          cell,
          1,
        );
      }
    });
    context.fillStyle = input.unlit;
    context.fill(groups.unlit);
    context.fillStyle = input.ink;
    context.fill(groups.body);
    context.fillStyle = WARM;
    context.fill(groups.warm);
    context.fillStyle = HOT;
    context.fill(groups.hot);
  },

  steps(context, input) {
    const { box, ratio } = input;
    const count = countFor(box, 15, 16, 36);
    const values = resample(input.bands, count);
    const step = box.width / count;
    const floor = box.y + box.height;
    const levelY = (value: number) =>
      snap(floor - 1 - value * (box.height - 3), ratio) + 0.5 / ratio;
    const skyline = () => {
      values.forEach((value, index) => {
        const y = levelY(value);
        if (index === 0) {
          context.moveTo(box.x, y);
        }
        context.lineTo(box.x + index * step, y);
        context.lineTo(box.x + (index + 1) * step, y);
      });
    };
    context.beginPath();
    skyline();
    context.lineTo(box.x + box.width, floor);
    context.lineTo(box.x, floor);
    context.closePath();
    tint(context, input);
    context.beginPath();
    skyline();
    context.globalAlpha = 1;
    context.strokeStyle = input.ink;
    context.lineWidth = 1.25;
    context.lineJoin = 'miter';
    context.lineCap = 'butt';
    context.stroke();
  },

  beads(context, input) {
    const { box, ratio } = input;
    const count = countFor(box, 13, 16, 40);
    const values = resample(input.bands, count);
    const step = box.width / count;
    const centre = snap(box.y + box.height / 2, ratio);
    context.fillStyle = input.unlit;
    context.fillRect(box.x, centre, box.width, 1 / ratio);
    context.fillStyle = input.ink;
    context.beginPath();
    values.forEach((value, index) => {
      const radius = 1.5 + value * Math.min(step * 0.46, box.height / 2 - 1);
      const cx = box.x + step * (index + 0.5);
      context.moveTo(cx + radius, centre);
      context.arc(cx, centre, radius, 0, Math.PI * 2);
    });
    context.fill();
  },

  echo(context, input) {
    const fades: [number, number][] = [
      [8, 0.1],
      [6, 0.18],
      [4, 0.3],
      [2, 0.45],
    ];
    fades.forEach(([age, alpha]) => {
      const frame = input.state.history[age];
      if (!frame) {
        return;
      }
      context.beginPath();
      traceCurve(context, silhouette(input, soften(frame, 1)));
      stroke(context, input, 1, alpha);
    });
    context.beginPath();
    traceCurve(context, silhouette(input, soften(input.bands, 1)));
    stroke(context, input, 1.5);
  },

  heat(context, input) {
    const { box, ratio } = input;
    const row = slots(box, ratio, countFor(box, 8.5, 24, 64), 2);
    const values = resample(input.bands, row.length);
    const inset = snap(Math.min(4, box.height * 0.1), ratio);
    const floor = box.y + box.height - inset;
    // The cells' background runs to the box's top; the light stays in the
    // meter.
    context.fillStyle = input.unlit;
    context.beginPath();
    row.forEach(({ x, width }) => {
      context.roundRect(x, box.y + inset, width, floor - box.y - inset, 2);
    });
    context.fill();
    const top = Math.max(box.y + inset, input.meterTop);
    context.fillStyle = input.ink;
    row.forEach(({ x, width }, index) => {
      context.globalAlpha = 0.08 + 0.92 * values[index] ** 1.6;
      context.beginPath();
      context.roundRect(x, top, width, floor - top, 2);
      context.fill();
    });
    context.globalAlpha = 1;
  },

  waterfall(context, input) {
    const { box, ratio } = input;
    const row = slots(box, ratio, countFor(box, 8.5, 24, 64), 2);
    const rows = 8;
    const gap = snap(2, ratio);
    const floor = box.y + box.height;
    // Eight rows of the past in the meter, newest at its top; the grid
    // carries on, unlit, above it to the box's top.
    const height = Math.max(
      1 / ratio,
      snap((floor - input.meterTop - gap * (rows - 1)) / rows, ratio),
    );
    const meterTop = floor - rows * height - (rows - 1) * gap;
    context.fillStyle = input.unlit;
    for (
      let y = meterTop - height - gap;
      y >= box.y - height / 2;
      y -= height + gap
    ) {
      row.forEach(({ x, width }) => {
        context.fillRect(x, snap(y, ratio), width, height);
      });
    }
    context.fillStyle = input.ink;
    for (let age = 0; age < rows; age += 1) {
      const frame = input.state.history[age];
      if (!frame) {
        break;
      }
      const values = resample(frame, row.length);
      const y = snap(meterTop + age * (height + gap), ratio);
      row.forEach(({ x, width }, index) => {
        context.globalAlpha =
          (0.06 + 0.94 * values[index] ** 1.8) * (1 - age * 0.09);
        context.fillRect(x, y, width, height);
      });
    }
    context.globalAlpha = 1;
  },

  level(context, input) {
    const { box, ratio, state } = input;
    const bar = Math.max(4, snap(Math.min(8, box.height * 0.2), ratio));
    const gap = snap(Math.max(3, box.height * 0.1), ratio);
    const top = snap(box.y + (box.height - bar * 2 - gap) / 2, ratio);
    // The scale's marks, under the bars: -40, -20, -10, -6, -3 and 0 dB on
    // the -48..0 scale the levels are drawn on.
    context.fillStyle = input.unlit;
    [-40, -20, -10, -6, -3, 0].forEach((db) => {
      const x = snap(box.x + (1 + db / 48) * box.width, ratio);
      context.fillRect(
        Math.min(x, box.x + box.width - 1 / ratio),
        box.y + 2,
        1 / ratio,
        box.height - 4,
      );
    });
    for (let side = 0; side < 2; side += 1) {
      const y = top + side * (bar + gap);
      context.fillStyle = input.unlit;
      context.beginPath();
      context.roundRect(box.x, y, box.width, bar, bar / 2);
      context.fill();
      context.fillStyle = input.ink;
      context.beginPath();
      context.roundRect(
        box.x,
        y,
        Math.max(bar, state.levels[side] * box.width),
        bar,
        bar / 2,
      );
      context.fill();
      context.fillStyle = input.light;
      const peakX = snap(box.x + state.levelPeaks[side] * box.width, ratio);
      context.fillRect(
        Math.max(box.x, Math.min(peakX - 1, box.x + box.width - 2)),
        y - 1,
        2,
        bar + 2,
      );
    }
  },

  reflection(context, input) {
    const { box, ratio } = input;
    const row = slots(box, ratio, countFor(box, 8.5, 24, 64), 2);
    const values = resample(input.bands, row.length);
    const horizon = snap(box.y + box.height * 0.66, ratio);
    const room = horizon - box.y - 1;
    context.fillStyle = input.ink;
    context.beginPath();
    row.forEach(({ x, width }, index) => {
      const height = Math.max(2 / ratio, snap(values[index] * room, ratio));
      context.roundRect(x, horizon - height, width, height, [
        Math.min(1.5, width / 2),
        Math.min(1.5, width / 2),
        0,
        0,
      ]);
    });
    context.fill();
    // The mirror, a third of the height, fading to nothing: one row of
    // device pixels at a time, so the fade is the bar's own colour.
    const below = box.y + box.height - horizon - 1 / ratio;
    const rowsDown = Math.max(1, Math.round(below * ratio));
    for (let line = 0; line < rowsDown; line += 1) {
      const depth = line / ratio;
      context.globalAlpha = 0.26 * (1 - line / rowsDown);
      row.forEach(({ x, width }, index) => {
        const height = values[index] * room * 0.5;
        if (depth < height) {
          context.fillRect(x, horizon + 1 / ratio + depth, width, 1 / ratio);
        }
      });
    }
    context.globalAlpha = 1;
  },

  contour(context, input) {
    const { box } = input;
    const centre = box.y + box.height / 2;
    const reach = (box.height / 2) * 0.92;
    const values = soften(input.bands, 2);
    const rings: [number, number, number][] = [
      [1, 1.4, 1],
      [0.64, 1.1, 0.6],
      [0.3, 1, 0.35],
    ];
    rings.forEach(([scale, width, alpha]) => {
      context.beginPath();
      traceCurve(
        context,
        across(box, values, (value) => centre - value * scale * reach),
      );
      stroke(context, input, width, alpha);
      context.beginPath();
      traceCurve(
        context,
        across(box, values, (value) => centre + value * scale * reach),
      );
      stroke(context, input, width, alpha);
    });
  },
};

export default NEW_PAINTERS;

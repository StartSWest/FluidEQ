/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The eleven meter styles the title bar always had, redrawn flat (Ivan,
 * 2026-11-16). Each states its change from the old drawing where it is not
 * obvious from the code.
 */
import {
  type TPainter,
  BODY_TINT,
  across,
  countFor,
  mirroredEdges,
  resample,
  silhouette,
  slots,
  snap,
  soften,
  stroke,
  tint,
  traceCurve,
} from './waveformFlatKit';

/** The pale bead on each Lattice rule, and how far its row stands in. */
const LATTICE_BEAD = 1.6;

const CLASSIC_PAINTERS: Record<
  | 'line'
  | 'filled'
  | 'ribbon'
  | 'bars'
  | 'mirror-bars'
  | 'dots'
  | 'spikes'
  | 'blocks'
  | 'outline'
  | 'lattice'
  | 'fluid',
  TPainter
> = {
  line(context, input) {
    const { upper, lower } = mirroredEdges(input);
    context.beginPath();
    traceCurve(context, upper);
    stroke(context, input, 1.5);
    context.beginPath();
    traceCurve(context, lower);
    stroke(context, input, 1.5);
  },

  filled(context, input) {
    const { upper, lower } = mirroredEdges(input);
    context.beginPath();
    traceCurve(context, upper);
    traceCurve(context, [...lower].reverse(), true);
    context.closePath();
    tint(context, input, 0.18);
    stroke(context, input, 1.25);
  },

  // One solid body, no seam down the middle (Ivan, 2026-11-17: "REMOVE center
  // line on ribbon").
  ribbon(context, input) {
    const { upper, lower } = mirroredEdges(input, 0.9);
    context.beginPath();
    traceCurve(context, upper);
    traceCurve(context, [...lower].reverse(), true);
    context.closePath();
    tint(context, input, 0.8);
  },

  bars(context, input) {
    const { box, ratio } = input;
    const row = slots(box, ratio, countFor(box, 8.5, 24, 64), 2);
    const values = resample(input.bands, row.length);
    const floor = box.y + box.height;
    context.fillStyle = input.ink;
    context.beginPath();
    row.forEach(({ x, width }, index) => {
      const height = Math.max(
        2 / ratio,
        snap(values[index] * box.height, ratio),
      );
      context.roundRect(x, floor - height, width, height, [
        Math.min(1.5, width / 2),
        Math.min(1.5, width / 2),
        0,
        0,
      ]);
    });
    context.fill();
  },

  'mirror-bars': function mirrorBars(context, input) {
    const { box, ratio } = input;
    const row = slots(box, ratio, countFor(box, 8.5, 24, 64), 2);
    const values = resample(input.bands, row.length);
    const centre = box.y + box.height / 2;
    context.fillStyle = input.ink;
    context.beginPath();
    row.forEach(({ x, width }, index) => {
      const height = Math.max(width, snap(values[index] * box.height, ratio));
      context.roundRect(
        x,
        snap(centre - height / 2, ratio),
        width,
        height,
        width / 2,
      );
    });
    context.fill();
  },

  dots(context, input) {
    const { box, ratio } = input;
    const row = slots(box, ratio, countFor(box, 9.5, 20, 56), 3);
    const values = resample(input.bands, row.length);
    const radius = Math.max(1, Math.min(row[0].width / 2, 2.4));
    const pitch = radius * 2 + 2;
    const floor = box.y + box.height;
    // The grid runs from the floor to the box's top, its rows spread evenly
    // between the two: stacked at a fixed pitch, the part of a pitch the
    // height did not divide into was left empty at the top (Ivan,
    // 2026-11-16: "for the bg ones you are still missing bit of the top").
    // Only the rows wholly inside the meter light.
    const reach = Math.max(0, box.height - radius * 2);
    const rows = Math.max(3, Math.floor(reach / pitch) + 1);
    const spacing = reach / (rows - 1);
    const meterRows = Math.max(
      3,
      Math.min(
        rows,
        Math.floor((floor - input.meterTop - radius * 2) / spacing + 1e-9) + 1,
      ),
    );
    // The unlit dots stay as a faint grid, so the shape reads at rest.
    const lit = new Path2D();
    const dark = new Path2D();
    row.forEach(({ x, width }, index) => {
      const on = Math.round(values[index] * meterRows);
      for (let level = 0; level < rows; level += 1) {
        const target = level < Math.max(1, on) ? lit : dark;
        const cx = x + width / 2;
        const cy = floor - radius - level * spacing;
        target.moveTo(cx + radius, cy);
        target.arc(cx, cy, radius, 0, Math.PI * 2);
      }
    });
    context.fillStyle = input.unlit;
    context.fill(dark);
    context.fillStyle = input.ink;
    context.fill(lit);
  },

  spikes(context, input) {
    const { box, ratio } = input;
    const row = slots(box, ratio, countFor(box, 8, 26, 64), 2);
    const values = resample(input.bands, row.length);
    const floor = box.y + box.height;
    context.fillStyle = input.ink;
    context.beginPath();
    row.forEach(({ x, width }, index) => {
      const height = Math.max(2, values[index] * (box.height - 1));
      const middle = x + width / 2;
      const half = Math.max(1, width * 0.42);
      context.moveTo(middle - half, floor);
      context.lineTo(middle, floor - height);
      context.lineTo(middle + half, floor);
      context.closePath();
    });
    context.fill();
  },

  blocks(context, input) {
    const { box, ratio } = input;
    const row = slots(box, ratio, countFor(box, 10, 20, 56), 3);
    const values = resample(input.bands, row.length);
    const gap = snap(2, ratio);
    const rungs = 7;
    const rung = snap((box.height - gap * (rungs - 1)) / rungs, ratio);
    const floor = box.y + box.height;
    const bodies = new Path2D();
    const tops = new Path2D();
    row.forEach(({ x, width }, index) => {
      const lit = Math.max(1, Math.round(values[index] * rungs));
      for (let level = 0; level < lit; level += 1) {
        const top = snap(floor - (level + 1) * rung - level * gap, ratio);
        // The top lit rung carries the light, as a held value does.
        (level === lit - 1 && lit > 1 ? tops : bodies).rect(
          x,
          top,
          width,
          rung,
        );
      }
    });
    context.fillStyle = input.ink;
    context.fill(bodies);
    context.globalAlpha = 0.9;
    context.fillStyle = input.light;
    context.fill(tops);
    context.globalAlpha = 1;
  },

  outline(context, input) {
    const { box } = input;
    const points = silhouette(input, soften(input.bands, 1));
    const floor = box.y + box.height;
    context.beginPath();
    traceCurve(context, points);
    context.lineTo(box.x + box.width, floor);
    context.lineTo(box.x, floor);
    context.closePath();
    tint(context, input, 0.14);
    context.beginPath();
    traceCurve(context, points);
    stroke(context, input, 1.5);
  },

  lattice(context, input) {
    const { box, ratio } = input;
    // The row stands a bead's radius in from each edge, so the beads at the
    // two ends are drawn whole rather than cut by the meter's edge.
    const row = slots(
      { ...box, x: box.x + LATTICE_BEAD, width: box.width - LATTICE_BEAD * 2 },
      ratio,
      countFor(box, 8, 24, 64),
      5,
    );
    const values = resample(input.bands, row.length);
    const floor = box.y + box.height;
    const hair = Math.max(1, Math.round(ratio)) / ratio;
    const rules = new Path2D();
    const beads = new Path2D();
    row.forEach(({ x, width }, index) => {
      const middle = snap(x + width / 2, ratio);
      const top = snap(
        floor - Math.max(3, values[index] * (box.height - 3)),
        ratio,
      );
      rules.rect(middle, top, hair, floor - top);
      beads.moveTo(middle + hair / 2 + LATTICE_BEAD, top);
      beads.arc(middle + hair / 2, top, LATTICE_BEAD, 0, Math.PI * 2);
    });
    context.fillStyle = input.ink;
    context.fill(rules);
    context.fillStyle = input.light;
    context.fill(beads);
  },

  fluid(context, input) {
    const { box, ratio } = input;
    const row = slots(box, ratio, countFor(box, 7.5, 28, 72), 2);
    const values = resample(input.bands, row.length);
    const floor = box.y + box.height;
    // The spectrum behind the wave as one flat step of the trace's colour.
    context.globalAlpha = BODY_TINT;
    context.fillStyle = input.ink;
    row.forEach(({ x, width }, index) => {
      const height = Math.max(
        2 / ratio,
        snap(values[index] * (box.height - 4), ratio),
      );
      context.fillRect(x, floor - height, width, height);
    });
    context.globalAlpha = 1;
    // The wave arches, tallest in the middle and tapered at the ends.
    const centre = box.y + box.height / 2;
    const last = Math.max(1, input.wave.length - 1);
    const points = across(
      box,
      input.wave,
      (value, index) =>
        centre -
        value *
          (box.height / 2 - 2) *
          Math.sin((Math.PI * index) / last) ** 0.7,
    );
    context.beginPath();
    traceCurve(context, points);
    stroke(context, input, 1.75);
  },
};

export default CLASSIC_PAINTERS;

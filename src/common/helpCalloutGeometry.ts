/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import type { THelpBox } from './helpGuide';

/**
 * The geometry under Help's numbered call-outs (`helpCallouts.ts`): points
 * and rectangles, the order a capture is read in, circles spread along a
 * side without overlapping, and whether a straight line passes through a
 * rectangle. Pure and in CSS pixels, with no idea what a help figure is.
 */

export interface IHelpPoint {
  readonly x: number;
  readonly y: number;
}

export interface IHelpRect {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

/** A number's circle. */
export const HELP_CALLOUT_BADGE = 22;
/** The least room between two circles on the same side. */
const GAP = 6;
/** Centre to centre, for circles standing side by side. */
export const HELP_CALLOUT_PITCH = HELP_CALLOUT_BADGE + GAP;
const PITCH = HELP_CALLOUT_PITCH;

export const clamp = (value: number, low: number, high: number) =>
  Math.min(Math.max(value, low), high);

export const centreOf = ([x, y, width, height]: THelpBox): IHelpPoint => ({
  x: x + width / 2,
  y: y + height / 2,
});

/**
 * The order the controls are numbered in: rows from the top, and left to
 * right along a row — how the capture is read.
 *
 * A control joins the row above when its centre falls inside the vertical
 * extent of that row's first control, so a knob a few pixels lower than the
 * one beside it is still the next number, not a new line.
 */
export const readingOrder = (boxes: readonly THelpBox[]): number[] => {
  const byHeight = boxes
    .map((box, index) => ({ index, box, centre: centreOf(box) }))
    .sort((left, right) => left.centre.y - right.centre.y);
  const rows: (typeof byHeight)[] = [];
  byHeight.forEach((entry) => {
    const row = rows[rows.length - 1];
    const leader = row?.[0];
    if (
      leader &&
      entry.centre.y >= leader.box[1] &&
      entry.centre.y <= leader.box[1] + leader.box[3]
    ) {
      row.push(entry);
    } else {
      rows.push([entry]);
    }
  });
  return rows.flatMap((row) =>
    row
      .sort((left, right) => left.centre.x - right.centre.x)
      .map((entry) => entry.index),
  );
};

/**
 * Circles spread along one side so none overlaps another, each as near the
 * point it wants as the others allow.
 *
 * Clusters, not a push in one direction: a run of neighbours that would
 * overlap is centred on the mean of what its members want, so the crowding is
 * shared out both ways instead of piling everything towards one end. A run
 * too long for the side is centred on the side and spills evenly — which
 * does not happen: a header or footer is never given more than it holds
 * (`assignSides`), and a side column is given the height it needs (`layOut`).
 */
export const spreadAlong = (
  wishes: readonly number[],
  low: number,
  high: number,
): number[] => {
  interface ICluster {
    members: number[];
    start: number;
  }
  const startFor = (members: readonly number[]) => {
    const mean =
      members.reduce((sum, member) => sum + wishes[member], 0) / members.length;
    const span = (members.length - 1) * PITCH;
    if (span > high - low) {
      return (low + high - span) / 2;
    }
    return clamp(mean - span / 2, low, high - span);
  };
  const clusters: ICluster[] = [];
  wishes
    .map((_, index) => index)
    .sort((left, right) => wishes[left] - wishes[right])
    .forEach((index) => {
      let cluster: ICluster = { members: [index], start: 0 };
      cluster.start = startFor(cluster.members);
      for (;;) {
        const previous = clusters[clusters.length - 1];
        if (!previous) {
          break;
        }
        const previousEnd =
          previous.start + (previous.members.length - 1) * PITCH;
        if (cluster.start - previousEnd >= PITCH) {
          break;
        }
        clusters.pop();
        const members = [...previous.members, ...cluster.members];
        cluster = { members, start: startFor(members) };
      }
      clusters.push(cluster);
    });
  const placed = new Array<number>(wishes.length);
  clusters.forEach((cluster) =>
    cluster.members.forEach((member, step) => {
      placed[member] = cluster.start + step * PITCH;
    }),
  );
  return placed;
};

/**
 * Whether a straight line passes through a rectangle's inside: Liang–Barsky
 * clipping, with the rectangle shrunk by a pixel so a line that only grazes a
 * neighbour's edge is not called a crossing.
 */
export const passesThrough = (
  from: IHelpPoint,
  to: IHelpPoint,
  rect: IHelpRect,
) => {
  const left = rect.left + 1;
  const right = rect.left + rect.width - 1;
  const top = rect.top + 1;
  const bottom = rect.top + rect.height - 1;
  if (left >= right || top >= bottom) {
    return false;
  }
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  let enter = 0;
  let leave = 1;
  const edges: readonly (readonly [number, number])[] = [
    [-dx, from.x - left],
    [dx, right - from.x],
    [-dy, from.y - top],
    [dy, bottom - from.y],
  ];
  return edges.every(([p, q]) => {
    if (p === 0) {
      return q >= 0;
    }
    const t = q / p;
    if (p < 0) {
      enter = Math.max(enter, t);
    } else {
      leave = Math.min(leave, t);
    }
    return enter <= leave;
  });
};

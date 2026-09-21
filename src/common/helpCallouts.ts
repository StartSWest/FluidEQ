/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import {
  HELP_CAPTURE_SCALE,
  type IHelpFigure,
  type THelpBox,
} from './helpGuide';

/**
 * Numbered call-outs round a help capture, the way a printed manual does it: a
 * circle in the margin for every control, a line from the circle to the
 * control, and the numbered list under the picture.
 *
 * They replaced a crop of the capture drawn beside each line of the list. Most
 * controls have no picture worth cropping — a label, a knob, a whole panel —
 * and the crops came out as fragments of words ("EC", "De"), flat teal blocks
 * cut from a selected button, or empty squares once a capture was retaken at
 * another size. A number cannot go stale like that, and every control gets
 * one, not only the ones that happen to have an icon.
 *
 * Everything here is in CSS pixels at the size the capture is drawn, so the
 * circles stay one readable size whatever the capture's own size; the reader
 * lays it out again when its column changes width, and the exported guide
 * lays it out once for its column. The NUMBERS never depend on the width —
 * they follow the capture in reading order — so a reader who resizes the
 * window, and a reader of the printed guide, see the same number on the same
 * control.
 */

export type THelpSide = 'top' | 'right' | 'bottom' | 'left';

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

export interface IHelpCallout {
  /** In the circle and beside the control's line in the list; from 1. */
  readonly number: number;
  /** Which of the figure's controls this points at. */
  readonly index: number;
  readonly side: THelpSide;
  /** The circle's centre. */
  readonly badge: IHelpPoint;
  /** Where the line leaves the circle's edge. */
  readonly start: IHelpPoint;
  /** Where the line ends: just inside the control, at its nearest point. */
  readonly anchor: IHelpPoint;
  /** The control on the frame, for the ring drawn while it is pointed at. */
  readonly box: IHelpRect;
}

export interface IHelpCalloutPlan {
  /** The whole annotated picture: the capture and its margins. */
  readonly width: number;
  readonly height: number;
  /** Where the capture sits in it. */
  readonly image: IHelpRect;
  /** In number order, which is the order of the list under the picture. */
  readonly callouts: readonly IHelpCallout[];
}

export interface IHelpCalloutRoom {
  /** The column's width. */
  readonly width: number;
  /** The tallest the capture itself may be drawn. */
  readonly maxImageHeight: number;
}

/** A number's circle. */
export const HELP_CALLOUT_BADGE = 22;
/** The least room between two circles on the same side. */
const GAP = 6;
/** Centre to centre, for circles standing side by side. */
const PITCH = HELP_CALLOUT_BADGE + GAP;
/** The clear run of line between a circle and the capture's edge. */
const LEAD = 16;
/** A margin with circles in it. */
const GUTTER = HELP_CALLOUT_BADGE + LEAD;
/**
 * How far inside a control its line stops, so the dot visibly lands ON the
 * control rather than on its outline.
 */
const INSET = 4;

/** Ties go to the first: left before right, then the header, the footer. */
const SIDES: readonly THelpSide[] = ['left', 'right', 'top', 'bottom'];

const clamp = (value: number, low: number, high: number) =>
  Math.min(Math.max(value, low), high);

const centreOf = ([x, y, width, height]: THelpBox): IHelpPoint => ({
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

/** How many circles a side holds at the pitch, from end to end of its run. */
const capacityOf = (run: number) =>
  Math.max(1, Math.floor(Math.max(0, run - HELP_CALLOUT_BADGE) / PITCH) + 1);

/**
 * What a line to this side would cost: the run from the control's own edge to
 * the capture's edge, and far more for every other control it would cross.
 *
 * Measured from the control's EDGE, not its centre. From the centre, a row of a
 * menu — as wide as the menu — was nearer the top than either side, so the
 * first rows' circles went above the menu and their lines ran straight down
 * through every row above theirs; measured from the edge, a full-width row is
 * no distance at all from either side. The crossing charge is a guard behind
 * that: a line through a control it is not about points at the wrong thing,
 * and no saving in length is worth it.
 */
const CROSSING = 10_000;

interface ISpan {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
}

const reachOf = (
  box: ISpan,
  side: THelpSide,
  width: number,
  height: number,
) => {
  if (side === 'left') {
    return box.left;
  }
  if (side === 'right') {
    return width - box.right;
  }
  if (side === 'top') {
    return box.top;
  }
  return height - box.bottom;
};

const crossingsOf = (boxes: readonly ISpan[], at: number, side: THelpSide) => {
  const own = boxes[at];
  const x = (own.left + own.right) / 2;
  const y = (own.top + own.bottom) / 2;
  return boxes.filter((other, index) => {
    if (index === at) {
      return false;
    }
    // A control inside a larger one leaves through that one's border whichever
    // way it goes, so the panel it sits in is not a crossing.
    if (
      x > other.left &&
      x < other.right &&
      y > other.top &&
      y < other.bottom
    ) {
      return false;
    }
    if (side === 'left' || side === 'right') {
      const level = other.top < y && y < other.bottom;
      return (
        level &&
        (side === 'left' ? other.left < own.left : other.right > own.right)
      );
    }
    const plumb = other.left < x && x < other.right;
    return (
      plumb &&
      (side === 'top' ? other.top < own.top : other.bottom > own.bottom)
    );
  }).length;
};

/**
 * Which margin each control's circle goes in: the one its line reaches most
 * cheaply (`reachOf`, `crossingsOf`), unless that margin is a full header or
 * footer, in which case the next cheapest.
 *
 * The sides are never full. A side column that needs more height than the
 * capture gets it — the frame grows above and below (`layOut`) — because the
 * alternative is worse: at the width of a narrow window the rack's eleven rows
 * overflowed the left margin, and the overflow went to the RIGHT margin, with
 * lines drawn across the entire capture to reach the left edge.
 *
 * The header and footer run only the capture's own width, so the side columns
 * own the corners and a corner never holds two circles. Controls hard against
 * an edge choose first — a row of the rack's list has a better claim to the
 * left margin than a panel in the middle does.
 */
const assignSides = (
  boxes: readonly ISpan[],
  width: number,
  height: number,
  banned: readonly ReadonlySet<THelpSide>[],
): THelpSide[] => {
  const capacity: Record<THelpSide, number> = {
    left: Number.POSITIVE_INFINITY,
    right: Number.POSITIVE_INFINITY,
    top: capacityOf(width),
    bottom: capacityOf(width),
  };
  const cost = (at: number, side: THelpSide) =>
    banned[at].has(side)
      ? Number.POSITIVE_INFINITY
      : reachOf(boxes[at], side, width, height) +
        CROSSING * crossingsOf(boxes, at, side);
  const cheapest = (at: number) =>
    Math.min(...SIDES.map((side) => cost(at, side)));
  const used: Record<THelpSide, number> = {
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  };
  const sides = new Array<THelpSide>(boxes.length);
  boxes
    .map((_, index) => index)
    .sort((left, right) => cheapest(left) - cheapest(right))
    .forEach((index) => {
      const ranked = [...SIDES].sort(
        (left, right) => cost(index, left) - cost(index, right),
      );
      const side = ranked.find((each) => used[each] < capacity[each]);
      sides[index] = side ?? ranked[0];
      used[sides[index]] += 1;
    });
  return sides;
};

const captureSize = (
  figure: IHelpFigure,
  room: IHelpCalloutRoom,
  margins: number,
) => {
  const scale = Math.min(
    1 / HELP_CAPTURE_SCALE,
    Math.max(1, room.width - margins) / figure.width,
    Math.max(1, room.maxImageHeight) / figure.height,
  );
  return {
    scale,
    width: figure.width * scale,
    height: figure.height * scale,
  };
};

/**
 * Whether a straight line passes through a rectangle's inside: Liang–Barsky
 * clipping, with the rectangle shrunk by a pixel so a line that only grazes a
 * neighbour's edge is not called a crossing.
 */
const passesThrough = (from: IHelpPoint, to: IHelpPoint, rect: IHelpRect) => {
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

/**
 * The call-out whose line crosses the most other controls, if any does.
 *
 * A panel a control sits inside does not count — its line has to leave
 * through that border whichever way it goes.
 */
const worstCrossing = (plan: IHelpCalloutPlan): IHelpCallout | undefined => {
  let worst: IHelpCallout | undefined;
  let most = 0;
  plan.callouts.forEach((callout) => {
    const centre = {
      x: callout.box.left + callout.box.width / 2,
      y: callout.box.top + callout.box.height / 2,
    };
    const crossed = plan.callouts.filter((other) => {
      if (other.index === callout.index) {
        return false;
      }
      const { box } = other;
      const holds =
        centre.x > box.left &&
        centre.x < box.left + box.width &&
        centre.y > box.top &&
        centre.y < box.top + box.height;
      return !holds && passesThrough(callout.start, callout.anchor, box);
    }).length;
    if (crossed > most) {
      most = crossed;
      worst = callout;
    }
  });
  return worst;
};

/**
 * The capture, its margins, and a numbered circle and line for every control.
 *
 * Laid out, then checked: a side's circles are spread so none overlaps
 * another, and on a crowded side that can push a circle far enough along it
 * that its line has to cross a neighbouring control to reach its own — the
 * header of the gallery at a narrow width sent Categories' line through the
 * search box. The worst such line's circle is then barred from that side and
 * everything is laid out again, one circle at a time, until no line crosses
 * anything or the offender has no side left to try.
 */
export const planHelpCallouts = (
  figure: IHelpFigure,
  room: IHelpCalloutRoom,
): IHelpCalloutPlan => {
  const controls = figure.controls ?? [];
  if (controls.length === 0) {
    const size = captureSize(figure, room, 0);
    return {
      width: size.width,
      height: size.height,
      image: { left: 0, top: 0, width: size.width, height: size.height },
      callouts: [],
    };
  }
  const banned = controls.map(() => new Set<THelpSide>());
  let plan = layOut(figure, room, banned);
  for (let round = 0; round < controls.length * SIDES.length; round += 1) {
    const offender = worstCrossing(plan);
    if (!offender || banned[offender.index].size >= SIDES.length - 1) {
      break;
    }
    banned[offender.index].add(offender.side);
    plan = layOut(figure, room, banned);
  }
  return plan;
};

/**
 * One layout with the sides a circle may not use.
 *
 * Twice over: once with a margin kept on both sides to decide which margin
 * each circle goes in, then again with only the margins that are used, so a
 * capture with nothing on its right is drawn wider rather than beside an empty
 * gutter. A wider capture only makes every side longer, so the first pass's
 * choices still fit.
 */
function layOut(
  figure: IHelpFigure,
  room: IHelpCalloutRoom,
  banned: readonly ReadonlySet<THelpSide>[],
): IHelpCalloutPlan {
  const controls = figure.controls ?? [];
  const draft = captureSize(figure, room, 2 * GUTTER);
  const sides = assignSides(
    controls.map(({ box: [x, y, width, height] }) => ({
      left: x * draft.scale,
      top: y * draft.scale,
      right: (x + width) * draft.scale,
      bottom: (y + height) * draft.scale,
    })),
    draft.width,
    draft.height,
    banned,
  );
  const uses = (side: THelpSide) => sides.includes(side);
  const count = (side: THelpSide) =>
    sides.filter((each) => each === side).length;
  const margin = {
    left: uses('left') ? GUTTER : 0,
    right: uses('right') ? GUTTER : 0,
    top: uses('top') ? GUTTER : 0,
    bottom: uses('bottom') ? GUTTER : 0,
  };

  const size = captureSize(figure, room, margin.left + margin.right);
  // A side column holds every circle given to it: when it needs more height
  // than the capture and its header and footer offer, the frame grows by the
  // difference, half above and half below.
  const column = Math.max(count('left'), count('right'));
  const columnSpan = column > 0 ? (column - 1) * PITCH + HELP_CALLOUT_BADGE : 0;
  const offered = margin.top + size.height + margin.bottom;
  if (columnSpan > offered) {
    margin.top += (columnSpan - offered) / 2;
    margin.bottom += (columnSpan - offered) / 2;
  }
  const image: IHelpRect = {
    left: margin.left,
    top: margin.top,
    width: size.width,
    height: size.height,
  };
  const frameWidth = margin.left + size.width + margin.right;
  const frameHeight = margin.top + size.height + margin.bottom;
  const boxes = controls.map(({ box: [x, y, width, height] }) => ({
    left: image.left + x * size.scale,
    top: image.top + y * size.scale,
    width: width * size.scale,
    height: height * size.scale,
  }));
  const centres = boxes.map((box) => ({
    x: box.left + box.width / 2,
    y: box.top + box.height / 2,
  }));

  // Where each circle stands along its side.
  const along = new Array<number>(controls.length);
  SIDES.forEach((side) => {
    const members = controls
      .map((_, index) => index)
      .filter((index) => sides[index] === side);
    if (members.length === 0) {
      return;
    }
    const horizontal = side === 'top' || side === 'bottom';
    const half = HELP_CALLOUT_BADGE / 2;
    // A header or footer runs the capture's width; a side column runs the
    // whole frame's height, corners included.
    const placed = spreadAlong(
      members.map((index) =>
        horizontal ? centres[index].x : centres[index].y,
      ),
      horizontal ? image.left + half : half,
      horizontal ? image.left + image.width - half : frameHeight - half,
    );
    members.forEach((index, step) => {
      along[index] = placed[step];
    });
  });

  // A header or footer circle stands just off the capture, whatever height
  // the side columns gave the frame, so its line stays short.
  const badgeOf = (index: number): IHelpPoint => {
    const half = HELP_CALLOUT_BADGE / 2;
    switch (sides[index]) {
      case 'top':
        return { x: along[index], y: image.top - LEAD - half };
      case 'bottom':
        return {
          x: along[index],
          y: image.top + image.height + LEAD + half,
        };
      case 'left':
        return { x: half, y: along[index] };
      default:
        return { x: frameWidth - half, y: along[index] };
    }
  };

  const numbers = new Array<number>(controls.length);
  readingOrder(controls.map((control) => control.box)).forEach(
    (index, position) => {
      numbers[index] = position + 1;
    },
  );

  return {
    width: frameWidth,
    height: frameHeight,
    image,
    callouts: controls
      .map((_, index): IHelpCallout => {
        const box = boxes[index];
        const badge = badgeOf(index);
        // The line enters through the edge that faces its circle and stops
        // a pixel inside it. Coming in from a side column at a slant, a line
        // that went four pixels in could clip the corner of the row above or
        // below — on the rack's list at a narrow width those rows touch.
        const across = sides[index] === 'left' || sides[index] === 'right';
        const insetX = across ? 1 : Math.min(INSET, box.width / 2);
        const insetY = across ? Math.min(INSET, box.height / 2) : 1;
        const anchor = {
          x: clamp(badge.x, box.left + insetX, box.left + box.width - insetX),
          y: clamp(badge.y, box.top + insetY, box.top + box.height - insetY),
        };
        const dx = anchor.x - badge.x;
        const dy = anchor.y - badge.y;
        const length = Math.hypot(dx, dy) || 1;
        const reach = HELP_CALLOUT_BADGE / 2;
        return {
          number: numbers[index],
          index,
          side: sides[index],
          badge,
          start: {
            x: badge.x + (dx / length) * reach,
            y: badge.y + (dy / length) * reach,
          },
          anchor,
          box,
        };
      })
      .sort((left, right) => left.number - right.number),
  };
}

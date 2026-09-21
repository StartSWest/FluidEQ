/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  HELP_CALLOUT_BADGE,
  planHelpCallouts,
  readingOrder,
  spreadAlong,
  type IHelpCalloutPlan,
  type IHelpRect,
} from '../../../common/helpCallouts';
import {
  HELP_CAPTURE_SCALE,
  HELP_CHAPTERS,
  type IHelpFigure,
} from '../../../common/helpGuide';

/**
 * The numbered call-outs round every help capture: a circle in the margin for
 * each control and a line to it, laid out for the column's width.
 *
 * Every rule here is one a reader would see broken. Two circles on top of
 * each other hide a number; a line that stops short of its control points at
 * the wrong thing; a number that moves when the window is resized no longer
 * matches the printed guide. The layout is checked on every real figure the
 * guide ships, at a wide column and a narrow one, rather than on a sample.
 */

const figures = HELP_CHAPTERS.flatMap((chapter) =>
  chapter.figures.filter((figure) => (figure.controls?.length ?? 0) > 0),
);

// The widths a reader actually meets: a full window, a narrow one, the Help's
// column at its tightest — the window's 720-pixel minimum is wider than this,
// because below 780 the contents move above the article and give it the whole
// width — and the phone layout of the printed guide.
const ROOMS = {
  wide: { width: 1100, maxImageHeight: 640 },
  narrow: { width: 560, maxImageHeight: 560 },
  tightest: { width: 440, maxImageHeight: 500 },
  phone: { width: 340, maxImageHeight: 520 },
} as const;

const inside = (point: { x: number; y: number }, rect: IHelpRect) =>
  point.x >= rect.left - 0.01 &&
  point.x <= rect.left + rect.width + 0.01 &&
  point.y >= rect.top - 0.01 &&
  point.y <= rect.top + rect.height + 0.01;

const centreOf = (rect: IHelpRect) => ({
  x: rect.left + rect.width / 2,
  y: rect.top + rect.height / 2,
});

const contains = (rect: IHelpRect, point: { x: number; y: number }) =>
  point.x > rect.left &&
  point.x < rect.left + rect.width &&
  point.y > rect.top &&
  point.y < rect.top + rect.height;

/**
 * Whether a straight line passes through a rectangle's inside — Liang–Barsky
 * clipping, with the rectangle shrunk by a pixel so a line that only grazes a
 * neighbour's edge is not called a crossing.
 */
const crosses = (
  from: { x: number; y: number },
  to: { x: number; y: number },
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
  const edges: [number, number][] = [
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

/** Call-outs whose line runs further than half the capture inside it. */
const overreaching = (plan: IHelpCalloutPlan) =>
  plan.callouts.filter(({ side, anchor }) => {
    const { image } = plan;
    if (side === 'left') {
      return anchor.x - image.left > image.width / 2 + 1;
    }
    if (side === 'right') {
      return image.left + image.width - anchor.x > image.width / 2 + 1;
    }
    if (side === 'top') {
      return anchor.y - image.top > image.height / 2 + 1;
    }
    return image.top + image.height - anchor.y > image.height / 2 + 1;
  });

const planned = Object.entries(ROOMS).flatMap(([roomName, room]) =>
  figures.map((figure) => ({
    label: `${figure.image} (${roomName})`,
    figure,
    room,
    plan: planHelpCallouts(figure, room),
  })),
);

describe('help call-outs on every shipped figure', () => {
  it('has the figures to check', () => {
    expect(figures.length).toBeGreaterThan(10);
  });

  it('numbers every control exactly once, from 1', () => {
    const wrong = planned
      .filter(({ figure, plan }) => {
        const numbers = plan.callouts.map((callout) => callout.number);
        const indices = new Set(plan.callouts.map((callout) => callout.index));
        const count = figure.controls?.length ?? 0;
        return (
          indices.size !== count ||
          numbers.join(',') !==
            Array.from({ length: count }, (_, at) => at + 1).join(',')
        );
      })
      .map(({ label }) => label);
    expect(wrong).toEqual([]);
  });

  it('never lets two circles overlap', () => {
    const touching = planned.flatMap(({ label, plan }) =>
      plan.callouts.flatMap((one, at) =>
        plan.callouts
          .slice(at + 1)
          .filter(
            (other) =>
              Math.hypot(
                one.badge.x - other.badge.x,
                one.badge.y - other.badge.y,
              ) <
              HELP_CALLOUT_BADGE - 0.01,
          )
          .map((other) => `${label}: ${one.number} and ${other.number}`),
      ),
    );
    expect(touching).toEqual([]);
  });

  it('keeps every circle in the margin, off the capture', () => {
    const covering = planned.flatMap(({ label, plan }) =>
      plan.callouts
        .filter((callout) => {
          const { image } = plan;
          const r = HELP_CALLOUT_BADGE / 2;
          return (
            callout.badge.x + r > image.left &&
            callout.badge.x - r < image.left + image.width &&
            callout.badge.y + r > image.top &&
            callout.badge.y - r < image.top + image.height
          );
        })
        .map((callout) => `${label}: ${callout.number}`),
    );
    expect(covering).toEqual([]);
  });

  it('ends every line on the control it is numbered for', () => {
    const missing = planned.flatMap(({ label, plan }) =>
      plan.callouts
        .filter((callout) => !inside(callout.anchor, callout.box))
        .map((callout) => `${label}: ${callout.number}`),
    );
    expect(missing).toEqual([]);
  });

  // The failure this layout was rewritten for: the first and last rows of a
  // menu got their circles above and below it, and their lines ran straight
  // through every other row on the way. A line through a control it is not
  // about points at the wrong thing.
  it('never runs a line through a control it is not numbering', () => {
    const through = planned.flatMap(({ label, plan }) =>
      plan.callouts.flatMap((callout) =>
        plan.callouts
          .filter(
            (other) =>
              other.index !== callout.index &&
              !contains(other.box, centreOf(callout.box)) &&
              crosses(callout.start, callout.anchor, other.box),
          )
          .map(
            (other) =>
              `${label}: ${callout.number} runs through ${other.number}`,
          ),
      ),
    );
    expect(through).toEqual([]);
  });

  // What a narrow window did: the rack's eleven rows overflowed the left
  // margin and the overflow was numbered from the RIGHT, each line drawn
  // across the whole capture to the row at its left edge. A control is always
  // within half the capture of one side or the other, so a line that runs
  // further than that inside the capture came from the wrong side.
  it('never draws a line across more than half the capture', () => {
    const across = planned.flatMap(({ label, plan }) =>
      overreaching(plan).map(
        ({ number, side }) => `${label}: ${number} from the ${side}`,
      ),
    );
    expect(across).toEqual([]);
  });

  // The rule above is a null test — it passes by finding nothing — so it is
  // shown finding something: the exact failure, a circle on the right margin
  // numbering a control at the capture's left edge.
  it('recognises a line that crosses more than half the capture', () => {
    const image = { left: 38, top: 0, width: 400, height: 100 };
    const box = { left: 38, top: 40, width: 60, height: 20 };
    const plan: IHelpCalloutPlan = {
      width: 476,
      height: 100,
      image,
      callouts: [
        {
          number: 1,
          index: 0,
          side: 'right',
          badge: { x: 465, y: 50 },
          start: { x: 454, y: 50 },
          anchor: { x: 97, y: 50 },
          box,
        },
      ],
    };
    expect(overreaching(plan).map(({ number }) => number)).toEqual([1]);
  });

  it('fits the column and never draws a capture larger than it was taken', () => {
    const wrong = planned
      .filter(
        ({ plan, room, figure }) =>
          plan.width > room.width + 0.01 ||
          plan.image.width > figure.width / HELP_CAPTURE_SCALE + 0.01,
      )
      .map(({ label }) => label);
    expect(wrong).toEqual([]);
  });

  // The printed guide is laid out once, for its own column; the app lays it
  // out for whatever width the window has. The same control must carry the
  // same number in both, or "number 4" means two different things.
  it('gives a control the same number at every width', () => {
    const moved = figures.filter((figure) => {
      const numbered = (plan: IHelpCalloutPlan) =>
        plan.callouts
          .map((callout) => `${callout.index}:${callout.number}`)
          .sort()
          .join(',');
      return (
        numbered(planHelpCallouts(figure, ROOMS.wide)) !==
        numbered(planHelpCallouts(figure, ROOMS.narrow))
      );
    });
    expect(moved.map((figure) => figure.image)).toEqual([]);
  });
});

describe('help call-out layout', () => {
  // A positive control for everything above: a figure small enough to reason
  // about, whose answers are known. Without it, a planner that put nothing
  // anywhere would pass the "no overlaps" and "nothing on the capture" rules.
  const figure: IHelpFigure = {
    image: 'synthetic.png',
    width: 600,
    height: 400,
    controls: [
      // Hard against the right edge, halfway down.
      { box: [560, 190, 30, 20], name: 'eq.gain', text: 'help.eq.gain' },
      // Hard against the left edge, same row.
      {
        box: [10, 185, 30, 30],
        name: 'eq.frequency',
        text: 'help.eq.frequency',
      },
      // At the very top, in the middle.
      { box: [280, 4, 40, 20], name: 'eq.smart', text: 'help.eq.smart' },
    ],
  };
  const plan = planHelpCallouts(figure, { width: 900, maxImageHeight: 800 });
  const byIndex = (index: number) =>
    plan.callouts.find((callout) => callout.index === index);

  it('puts each circle in the margin nearest its control', () => {
    expect(byIndex(0)?.side).toBe('right');
    expect(byIndex(1)?.side).toBe('left');
    expect(byIndex(2)?.side).toBe('top');
  });

  it('numbers the capture top to bottom, then left to right', () => {
    expect(byIndex(2)?.number).toBe(1);
    expect(byIndex(1)?.number).toBe(2);
    expect(byIndex(0)?.number).toBe(3);
  });

  it('draws the capture at its own size divided by the capture scale', () => {
    expect(plan.image.width).toBeCloseTo(600 / HELP_CAPTURE_SCALE);
    expect(plan.image.height).toBeCloseTo(400 / HELP_CAPTURE_SCALE);
  });

  // The menu case itself, small enough to see: four rows as wide as the menu.
  // Every circle belongs beside its row, not above or below the menu.
  it('numbers a menu down its side, not across its top and bottom', () => {
    const menu = planHelpCallouts(
      {
        image: 'menu.png',
        width: 200,
        height: 185,
        controls: [
          {
            box: [6, 30, 188, 34],
            name: 'eq.menu.reset',
            text: 'help.eq.reset',
          },
          {
            box: [6, 65, 188, 34],
            name: 'eq.menu.disable',
            text: 'help.eq.disable',
          },
          {
            box: [6, 110, 188, 34],
            name: 'eq.menu.addLeft',
            text: 'help.eq.addLeft',
          },
          {
            box: [6, 145, 188, 34],
            name: 'eq.menu.addRight',
            text: 'help.eq.addRight',
          },
        ],
      },
      { width: 900, maxImageHeight: 800 },
    );
    expect(
      menu.callouts.every(({ side }) => side === 'left' || side === 'right'),
    ).toBe(true);
  });

  // The crossing test above is only as good as its geometry; this is it
  // catching a crossing it must catch, and passing one it must pass.
  it('knows a line through a box from one that misses it', () => {
    const box = { left: 40, top: 40, width: 20, height: 20 };
    expect(crosses({ x: 0, y: 50 }, { x: 100, y: 50 }, box)).toBe(true);
    expect(crosses({ x: 0, y: 0 }, { x: 100, y: 0 }, box)).toBe(false);
    expect(crosses({ x: 0, y: 50 }, { x: 30, y: 50 }, box)).toBe(false);
  });

  it('gives an unannotated capture no margins at all', () => {
    const bare = planHelpCallouts(
      { image: 'bare.png', width: 600, height: 400 },
      { width: 900, maxImageHeight: 800 },
    );
    expect(bare.callouts).toEqual([]);
    expect(bare.image.left).toBe(0);
    expect(bare.image.top).toBe(0);
    expect(bare.width).toBeCloseTo(bare.image.width);
  });
});

describe('spreading circles along a side', () => {
  const pitch = HELP_CALLOUT_BADGE + 6;

  it('leaves circles that already clear each other where they are', () => {
    expect(spreadAlong([10, 100, 200], 0, 400)).toEqual([10, 100, 200]);
  });

  it('spaces a crowd at the pitch, centred on what its members want', () => {
    const placed = spreadAlong([100, 100, 100], 0, 400);
    expect(placed[1] - placed[0]).toBeCloseTo(pitch);
    expect(placed[2] - placed[1]).toBeCloseTo(pitch);
    expect((placed[0] + placed[2]) / 2).toBeCloseTo(100);
  });

  it('keeps a crowd inside the side rather than off its end', () => {
    const placed = spreadAlong([2, 2, 2], 11, 400);
    expect(Math.min(...placed)).toBeGreaterThanOrEqual(11);
  });

  it('returns each circle in the order it was asked for, not sorted', () => {
    const placed = spreadAlong([300, 10], 0, 400);
    expect(placed).toEqual([300, 10]);
  });
});

describe('reading order', () => {
  it('reads a row left to right even when its controls are not level', () => {
    // The right one sits three pixels higher, as knobs in a row often do.
    expect(
      readingOrder([
        [200, 103, 40, 40],
        [100, 100, 40, 40],
      ]),
    ).toEqual([1, 0]);
  });

  it('starts a new row below the first one', () => {
    expect(
      readingOrder([
        [0, 200, 40, 40],
        [300, 0, 40, 40],
      ]),
    ).toEqual([1, 0]);
  });
});

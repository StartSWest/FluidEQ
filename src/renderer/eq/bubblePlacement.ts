/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Where the Smart EQ bubble stands: somewhere free, pointing at its button.
 *
 * It hung off the button at one fixed spot, and the header around it is laid
 * out by the width of the window. Grown to the right it covered the Game mode
 * switch, which the title row centres; grown to the left it ran off the window
 * and over the page's title once the toolbar wrapped and put the button near
 * the left edge — both reported, one after the other. No one side is free at
 * every width, so the side is chosen from what is actually on screen: above
 * the button if there is a free stretch there, below it if not, slid along
 * its row as far as the tail can still point at the button, and nearest the
 * spot it would take if nothing were in the way.
 */

export interface IRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface IBubblePlacement {
  /** The bubble's top-left, in the same coordinates as everything given. */
  left: number;
  top: number;
  /** Under the button rather than over it, so the tail points up. */
  isBelow: boolean;
  /** Where the tail's point stands, from the bubble's own left edge. */
  tailX: number;
}

export interface IBubbleRequest {
  /** The button the bubble speaks for. */
  anchor: IRect;
  /** The point on the button the tail aims at. */
  aimX: number;
  width: number;
  height: number;
  /** What the bubble must stay inside. */
  bounds: IRect;
  /** What it must not cover. */
  avoid: readonly IRect[];
  /** Between the bubble and the button, above or below. */
  gap: number;
  /** How near either end of the bubble the tail may stand. */
  tailInset: number;
}

const overlap = (a: IRect, b: IRect): number =>
  Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) *
  Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));

/**
 * The best spot, and where its tail stands.
 *
 * For each row — above, then below — every left edge the tail allows is a
 * candidate: the one the bubble would take unobstructed (ending where it
 * aims, growing away from the button), each edge of what is in the way, and
 * the two ends of the stretch. The first row with a free candidate wins, and
 * in it the free one nearest the unobstructed spot. With nothing free
 * anywhere, the spot covering the least.
 */
const placeBubble = ({
  anchor,
  aimX,
  width,
  height,
  bounds,
  avoid,
  gap,
  tailInset,
}: IBubbleRequest): IBubblePlacement => {
  // The stretch of left edges from which the tail still reaches `aimX`, and
  // the bubble stays inside the bounds.
  const lowest = Math.max(bounds.left, aimX - width + tailInset);
  const highest = Math.min(bounds.right - width, aimX - tailInset);
  const clamp = (x: number) =>
    Math.min(Math.max(x, Math.min(lowest, highest)), Math.max(lowest, highest));
  const preferred = clamp(aimX + tailInset - width);

  const rows = [
    { isBelow: false, top: anchor.top - gap - height },
    { isBelow: true, top: anchor.bottom + gap },
  ];
  let fallback: { cost: number; placement: IBubblePlacement } | undefined;
  for (let at = 0; at < rows.length; at += 1) {
    const { isBelow, top } = rows[at];
    const candidates = [
      preferred,
      lowest,
      highest,
      ...avoid.flatMap((rect) => [rect.right + gap, rect.left - gap - width]),
    ]
      .map(clamp)
      .sort(
        (one, other) => Math.abs(one - preferred) - Math.abs(other - preferred),
      );
    for (let index = 0; index < candidates.length; index += 1) {
      const left = candidates[index];
      const box = { left, top, right: left + width, bottom: top + height };
      const outside =
        Math.max(0, bounds.top - box.top) +
        Math.max(0, box.bottom - bounds.bottom);
      const cost =
        avoid.reduce((sum, rect) => sum + overlap(box, rect), 0) +
        outside * width;
      const placement = {
        left,
        top,
        isBelow,
        tailX: Math.min(Math.max(aimX - left, tailInset), width - tailInset),
      };
      if (cost === 0) {
        return placement;
      }
      if (!fallback || cost < fallback.cost) {
        fallback = { cost, placement };
      }
    }
  }
  return (
    fallback?.placement ?? {
      left: preferred,
      top: rows[0].top,
      isBelow: false,
      tailX: tailInset,
    }
  );
};

export default placeBubble;

/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Where the Smart EQ bubble stands, in the two layouts it was reported in —
 * the rectangles are the EQ page's header as measured in the running window.
 *
 * Grown right from the Target button it covered the Game mode switch, which
 * the title row centres. Flipped to grow left, it ran 90 px off the window and
 * over the page's title as soon as the window was narrow enough to put the
 * button near the left edge. Each layout here is one of those.
 */
import placeBubble, {
  IBubbleRequest,
  IRect,
} from 'renderer/eq/bubblePlacement';

const rect = (left: number, top: number, right: number, bottom: number) => ({
  left,
  top,
  right,
  bottom,
});

const intersects = (a: IRect, b: IRect) =>
  a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;

const request = (
  anchor: IRect,
  bounds: IRect,
  avoid: IRect[],
): IBubbleRequest => ({
  anchor,
  aimX: anchor.right - 24 - 16,
  // "Filtered passage - waiting for the full range", as it measured.
  width: 263,
  height: 34,
  bounds,
  avoid,
  gap: 9,
  tailInset: 16,
});

describe('where the Smart EQ bubble stands', () => {
  it('stays above, ending at the label, where the title row is free there', () => {
    // 2804 px wide: the toolbar is one row, centred; Game mode sits right of
    // the button's column on the title row, the title far to the left.
    const gameMode = rect(1170, 174, 1461, 202);
    const avoid = [
      rect(201, 176, 380, 201), // the title's own text
      gameMode,
      rect(876, 217, 982, 249), // the preset picker
      rect(1102, 217, 1294, 249), // save for this song
      rect(1236, 260, 1400, 288), // Also applied
    ];
    const spot = placeBubble(
      request(rect(992, 217, 1092, 249), rect(201, 151, 2430, 288), avoid),
    );
    expect(spot).toEqual({ left: 805, top: 174, isBelow: false, tailX: 247 });
    const box = rect(spot.left, spot.top, spot.left + 263, spot.top + 34);
    expect(avoid.some((one) => intersects(box, one))).toBe(false);
  });

  it('goes under the button where nothing above is free, and never off the window', () => {
    // 788 px wide: the button near the left edge, the title over it and
    // Game mode just right of it — the width that sent it off the window.
    const avoid = [
      rect(25, 176, 155, 201), // the title's own text
      rect(25, 159, 85, 171), // the eyebrow
      rect(245, 174, 536, 202), // Game mode and the delay
      rect(36, 217, 87, 249), // the preset picker
      rect(207, 217, 399, 249), // save for this song
      rect(409, 217, 497, 249), // Clear EQ
      rect(507, 214, 640, 252), // EQ mode
      rect(650, 217, 745, 249), // Add band
      rect(338, 260, 443, 292), // the layout picker, wrapped to a second row
      rect(302, 310, 384, 322), // Also applied
      rect(392, 300, 479, 332),
    ];
    const bounds = rect(25, 151, 756, 332);
    const spot = placeBubble(request(rect(97, 217, 197, 249), bounds, avoid));
    expect(spot.isBelow).toBe(true);
    expect(spot.top).toBe(258);
    const box = rect(spot.left, spot.top, spot.left + 263, spot.top + 34);
    expect(avoid.some((one) => intersects(box, one))).toBe(false);
    expect(spot.left).toBeGreaterThanOrEqual(bounds.left);
    // Its tail still points at the button's label.
    expect(spot.left + spot.tailX).toBe(157);
  });

  it('slides along its row to a free stretch rather than leaving the row', () => {
    // Something sits exactly where it would stand unobstructed, and there is
    // room just past it that the tail can still reach.
    // Unobstructed it would stand at 476-676; the obstacle is at 450-520.
    const spot = placeBubble({
      ...request(rect(600, 217, 700, 249), rect(0, 100, 1400, 400), [
        rect(450, 150, 520, 210),
      ]),
      width: 200,
    });
    expect(spot.isBelow).toBe(false);
    expect(spot.left).toBe(529);
    expect(spot.left + spot.tailX).toBe(660);
  });

  it('covers the least it can when nothing anywhere is free', () => {
    const everything = rect(0, 0, 2000, 1000);
    const bounds = rect(0, 100, 900, 400);
    const blocked = placeBubble(
      request(rect(400, 217, 500, 249), bounds, [
        everything,
        rect(300, 150, 600, 210),
      ]),
    );
    // Still a real spot, reaching the button, inside the header.
    expect(blocked.left).toBeGreaterThanOrEqual(bounds.left);
    expect(blocked.left + 263).toBeLessThanOrEqual(bounds.right);
    expect(blocked.left + blocked.tailX).toBe(460);
  });
});

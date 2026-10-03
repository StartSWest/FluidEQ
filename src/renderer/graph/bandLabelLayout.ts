export interface ILabelBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface IBandLabelAnchor extends ILabelBox {
  id: string;
  /** Hovered/focused and selected bands get space first in a crowded plot. */
  priority: number;
}

export interface ILabelBounds {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export const labelBoxesOverlap = (one: ILabelBox, other: ILabelBox, gap = 0) =>
  one.x < other.x + other.width + gap &&
  one.x + one.width + gap > other.x &&
  one.y < other.y + other.height + gap &&
  one.y + one.height + gap > other.y;

/**
 * Pack labels above/below their handles, then into nearby lanes if needed.
 * Never cover another label or a handle. Tiny plots cannot hold arbitrarily
 * many labels: keep the active band's readout and omit only those that cannot
 * fit. Hovering/focusing a band gives it priority on the next layout.
 */
const packBandLabels = (
  anchors: readonly IBandLabelAnchor[],
  bounds: ILabelBounds,
  obstacles = anchors,
): Array<ILabelBox & { id: string }> => {
  const placed: Array<ILabelBox & { id: string }> = [];
  const dots = obstacles.map(({ x, y }) => ({
    x: x - 8,
    y: y - 8,
    width: 16,
    height: 16,
  }));
  const ordered = [...anchors].sort(
    (a, b) => b.priority - a.priority || a.x - b.x || a.id.localeCompare(b.id),
  );
  ordered.forEach(({ id, x, y, width, height }) => {
    if (
      width > bounds.right - bounds.left ||
      height > bounds.bottom - bounds.top
    ) {
      return;
    }
    const candidates: Array<ILabelBox & { cost: number }> = [];
    const rows = Math.ceil((bounds.bottom - bounds.top) / (height + 5));
    const columns = Math.ceil((bounds.right - bounds.left) / (width + 5));
    for (let row = 0; row < rows; row += 1) {
      const above = y - 14 - height - row * (height + 5);
      const below = y + 14 + row * (height + 5);
      for (let column = 0; column <= columns; column += 1) {
        const shifts =
          column === 0 ? [0] : [-column * (width + 5), column * (width + 5)];
        shifts.forEach((shift) => {
          const left = Math.max(
            bounds.left,
            Math.min(bounds.right - width, x - width / 2 + shift),
          );
          [above, below].forEach((top, side) => {
            if (top < bounds.top || top + height > bounds.bottom) {
              return;
            }
            candidates.push({
              x: left,
              y: top,
              width,
              height,
              cost:
                Math.abs(left + width / 2 - x) +
                row * (height + 5) * 1.2 +
                side,
            });
          });
        });
      }
    }
    candidates.sort((a, b) => a.cost - b.cost);
    const spot = candidates.find(
      (box) =>
        !placed.some((other) => labelBoxesOverlap(box, other, 5)) &&
        !dots.some((dot) => labelBoxesOverlap(box, dot, 3)),
    );
    if (spot) {
      placed.push({ id, x: spot.x, y: spot.y, width, height });
    }
  });
  return placed;
};

export const layoutBandLabels = (
  anchors: readonly IBandLabelAnchor[],
  bounds: ILabelBounds,
): Array<ILabelBox & { id: string }> => {
  const packed = packBandLabels(anchors, bounds);
  if (packed.length === anchors.length) {
    return packed;
  }
  // Spread a crowded plot's readouts across the spectrum instead of filling
  // all available space with the first few bass bands. Active bands still win.
  const active = anchors.filter((anchor) => anchor.priority > 0);
  const rest = anchors
    .filter((anchor) => anchor.priority === 0)
    .sort((a, b) => a.x - b.x);
  for (let count = packed.length - active.length; count > 0; count -= 1) {
    const sample = Array.from(
      { length: count },
      (_, index) =>
        rest[
          count === 1
            ? Math.floor(rest.length / 2)
            : Math.round((index * (rest.length - 1)) / (count - 1))
        ],
    );
    const attempt = packBandLabels([...active, ...sample], bounds, anchors);
    if (attempt.length === active.length + count) {
      return attempt;
    }
  }
  return packed;
};

export interface ILabelBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface IBandLabelAnchor extends ILabelBox {
  id: string;
  /**
   * The band being worked on. Among the labels whose dots moved it is placed
   * first, so a neighbour's label gives way to it rather than it to them.
   * Never decides anything for a label whose dot stood still, and never which
   * labels a crowded plot shows — selecting or hovering must not move a label
   * (Ivan, 2026-10-03: "they change when I hover it sucks big").
   */
  isActive?: boolean;
}

export interface ILabelBounds {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/**
 * Where a label stands: straight above its dot or straight below it, in the
 * lane counted outwards from the dot. Never beside it — a label shifted
 * sideways to find room read as belonging to the next band (Ivan,
 * 2026-10-03: "never do the side move always top or bottom"). Only the
 * plot's own edges hold a label off its dot's centre.
 */
export interface ILabelPlace {
  isAbove: boolean;
  lane: number;
}

export interface ILaidLabel extends ILabelBox {
  id: string;
  place: ILabelPlace;
}

/**
 * What a layout leaves for the next one. `home` is where the label stood when
 * it was laid out fresh, and where it goes back to whenever that place is free
 * again (Ivan, 2026-10-03: "they need to return to original places if they
 * can"); `last` is where it stood a layout ago, which it keeps while it cannot
 * go home; `x` and `y` are where its dot was, which says whose dot moved.
 */
export interface ILabelMemoryEntry {
  home: ILabelPlace;
  last: ILabelPlace;
  x: number;
  y: number;
}

export type TLabelMemory = ReadonlyMap<string, ILabelMemoryEntry>;

export interface ILabelLayoutOptions {
  /** The last layout's memory. Without it every label is laid out fresh. */
  previous?: TLabelMemory;
  /** Anything else on the plot a label must not cover: a genre's pins. */
  obstacles?: readonly ILabelBox[];
}

/**
 * What one genre pin covers (`GenrePins.tsx`), its numbered badge included:
 * the halo round the dot (radius 10) and the badge 15 above it (radius 7).
 * A band's label kept off the dot alone sat on the badge (Ivan, 2026-10-03:
 * "make sure the label doesn't conflict with the preset genre dots").
 */
export const genrePinBox = (x: number, y: number): ILabelBox => ({
  x: x - 10,
  y: y - 22,
  width: 20,
  height: 32,
});

export const labelBoxesOverlap = (one: ILabelBox, other: ILabelBox, gap = 0) =>
  one.x < other.x + other.width + gap &&
  one.x + one.width + gap > other.x &&
  one.y < other.y + other.height + gap &&
  one.y + one.height + gap > other.y;

/** From the dot's centre to the nearest lane's edge, room for the leader. */
const LEADER = 14;
const LANE_GAP = 5;
/** A dot moved when it is this far from where the last layout saw it. */
const MOVED = 0.5;

const samePlace = (one: ILabelPlace, other: ILabelPlace) =>
  one.isAbove === other.isAbove && one.lane === other.lane;

const dotBox = ({ x, y }: ILabelBox): ILabelBox => ({
  x: x - 8,
  y: y - 8,
  width: 16,
  height: 16,
});

/**
 * The places a label tries, best first. Fresh, it alternates sides lane by
 * lane outwards. With a home, every lane on the home's side comes before any
 * on the other: a label that crossed from above its dot to below it whenever
 * the two scored alike crossed back and forth on every step of a drag (Ivan,
 * 2026-10-03, on the 31-band layout: "it move to top and bottom of the dot
 * each time I move the dot"). It changes sides only when its own side has no
 * room left at all.
 */
const placesFor = (lanes: number, home?: ILabelPlace): ILabelPlace[] => {
  const range = Array.from({ length: lanes }, (_, lane) => lane);
  if (!home) {
    return range.flatMap((lane) => [
      { isAbove: true, lane },
      { isAbove: false, lane },
    ]);
  }
  return [home.isAbove, !home.isAbove].flatMap((isAbove) =>
    range.map((lane) => ({ isAbove, lane })),
  );
};

/**
 * Pack labels straight above or below their handles, outwards lane by lane.
 * Never cover another label, a handle or an obstacle.
 *
 * With a memory: the labels whose dots moved go first and keep to their own
 * homes, then every still label whose home is free goes back to it, then the
 * ones still pushed off it keep where they were if they can, and new labels
 * take what is left. So a drag carries its own label with its dot, a label in
 * its way steps aside only while it is in the way, and nothing else moves.
 */
const packBandLabels = (
  anchors: readonly IBandLabelAnchor[],
  bounds: ILabelBounds,
  dots: readonly IBandLabelAnchor[],
  { previous, obstacles = [] }: ILabelLayoutOptions,
): ILaidLabel[] => {
  const laid: ILaidLabel[] = [];
  const blocked = [...dots.map(dotBox), ...obstacles];
  const fits = ({ width, height }: ILabelBox) =>
    width <= bounds.right - bounds.left && height <= bounds.bottom - bounds.top;
  /**
   * `isDragged`: the label of the band being dragged keeps its place over
   * the other bands' dots and the pins, which draw over it and under it for
   * the moment it passes them — kept off them, it climbed a lane at every dot
   * it passed and dropped back between them. And at the plot's edge it slides
   * along it, its leader shortening, rather than jumping a lane inwards; it
   * changes sides only once the edge leaves no room beside its own dot.
   */
  const put = (
    anchor: IBandLabelAnchor,
    place: ILabelPlace,
    isDragged = false,
  ) => {
    const { x, y, width, height } = anchor;
    const nearest = place.isAbove ? y - LEADER - height : y + LEADER;
    const outwards = place.lane * (height + LANE_GAP);
    const wanted = place.isAbove ? nearest - outwards : nearest + outwards;
    const top = isDragged
      ? Math.max(bounds.top, Math.min(bounds.bottom - height, wanted))
      : wanted;
    if (
      top < bounds.top ||
      top + height > bounds.bottom ||
      (place.isAbove ? top > nearest : top < nearest)
    ) {
      return false;
    }
    const box = {
      x: Math.max(bounds.left, Math.min(bounds.right - width, x - width / 2)),
      y: top,
      width,
      height,
    };
    if (
      laid.some((other) => labelBoxesOverlap(box, other, LANE_GAP)) ||
      (!isDragged && blocked.some((dot) => labelBoxesOverlap(box, dot, 3)))
    ) {
      return false;
    }
    laid.push({ ...box, id: anchor.id, place });
    return true;
  };
  const settle = (anchor: IBandLabelAnchor, home?: ILabelPlace) =>
    placesFor(
      Math.ceil((bounds.bottom - bounds.top) / (anchor.height + LANE_GAP)),
      home,
    ).some((place) => put(anchor, place));

  const byPlace = (one: IBandLabelAnchor, other: IBandLabelAnchor) =>
    one.x - other.x || one.id.localeCompare(other.id);
  const shown = anchors.filter(fits);
  const known = shown.flatMap((anchor) => {
    const memory = previous?.get(anchor.id);
    return memory ? [{ anchor, memory }] : [];
  });
  const isMoved = ({ anchor, memory }: (typeof known)[number]) =>
    Math.abs(anchor.x - memory.x) > MOVED ||
    Math.abs(anchor.y - memory.y) > MOVED;

  known
    .filter(isMoved)
    .sort(
      (one, other) =>
        Number(other.anchor.isActive === true) -
          Number(one.anchor.isActive === true) ||
        byPlace(one.anchor, other.anchor),
    )
    .forEach(({ anchor, memory }) => {
      if (anchor.isActive === true && put(anchor, memory.home, true)) {
        return;
      }
      if (!put(anchor, memory.home) && !put(anchor, memory.last)) {
        settle(anchor, memory.home);
      }
    });
  // Labels already at home first: they stood together a layout ago, so only
  // a moved label can be in their way. Then the ones pushed off theirs.
  const still = known
    .filter((entry) => !isMoved(entry))
    .sort(
      (one, other) =>
        Number(!samePlace(one.memory.home, one.memory.last)) -
          Number(!samePlace(other.memory.home, other.memory.last)) ||
        byPlace(one.anchor, other.anchor),
    );
  const pushedOff = still.filter(
    ({ anchor, memory }) => !put(anchor, memory.home),
  );
  pushedOff.forEach(
    ({ anchor, memory }) =>
      put(anchor, memory.last) || settle(anchor, memory.home),
  );
  shown
    .filter((anchor) => !previous?.has(anchor.id))
    .sort(byPlace)
    .forEach((anchor) => settle(anchor));

  // Handed back in the bands' own order: which one was placed first is the
  // packing's business, and the drawing order must not change with it.
  const order = new Map(anchors.map((anchor, index) => [anchor.id, index]));
  return laid.sort(
    (one, other) => (order.get(one.id) ?? 0) - (order.get(other.id) ?? 0),
  );
};

export const layoutBandLabels = (
  anchors: readonly IBandLabelAnchor[],
  bounds: ILabelBounds,
  options: ILabelLayoutOptions = {},
): ILaidLabel[] => {
  const packed = packBandLabels(anchors, bounds, anchors, options);
  if (packed.length === anchors.length) {
    return packed;
  }
  // Spread a crowded plot's readouts across the spectrum instead of filling
  // all available space with the first few bass bands. Which bands keep one
  // is decided by place alone, never by which is selected or hovered.
  const byPlace = [...anchors].sort((a, b) => a.x - b.x);
  for (let count = packed.length; count > 0; count -= 1) {
    const sample = Array.from(
      { length: count },
      (_, index) =>
        byPlace[
          count === 1
            ? Math.floor(byPlace.length / 2)
            : Math.round((index * (byPlace.length - 1)) / (count - 1))
        ],
    );
    const attempt = packBandLabels(sample, bounds, anchors, options);
    if (attempt.length === count) {
      return attempt;
    }
  }
  return packed;
};

/**
 * What a layout leaves for the next one to keep to. A label keeps the home it
 * had; one laid out fresh is home where it landed. A label the plot had no
 * room for this time keeps what it knew, so it goes back home once there is.
 */
export const rememberLabels = (
  laid: readonly ILaidLabel[],
  anchors: readonly IBandLabelAnchor[],
  previous?: TLabelMemory,
): TLabelMemory => {
  const placed = new Map(laid.map((label) => [label.id, label.place]));
  return new Map(
    anchors.flatMap((anchor) => {
      const before = previous?.get(anchor.id);
      const place = placed.get(anchor.id);
      if (!place) {
        return before ? [[anchor.id, before] as const] : [];
      }
      return [
        [
          anchor.id,
          {
            home: before?.home ?? place,
            last: place,
            x: anchor.x,
            y: anchor.y,
          },
        ] as const,
      ];
    }),
  );
};

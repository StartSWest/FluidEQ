import {
  genrePinBox,
  labelBoxesOverlap,
  layoutBandLabels,
  rememberLabels,
  IBandLabelAnchor,
  ILaidLabel,
  TLabelMemory,
} from 'renderer/graph/bandLabelLayout';

const bounds = { left: 0, top: 0, right: 1000, bottom: 320 };
const point = (
  id: string,
  x: number,
  y = 160,
  isActive = false,
): IBandLabelAnchor => ({
  id,
  x,
  y,
  width: 88,
  height: 34,
  isActive,
});
const row = (count: number, y = 160) =>
  Array.from({ length: count }, (_, index) =>
    point(`${index}`, 20 + (index * 960) / (count - 1), y),
  );

it('keeps both ends of the spectrum represented when a narrow plot cannot fit all bands', () => {
  const points = Array.from({ length: 31 }, (_, index) =>
    point(`${index}`, 10 + (index * 280) / 30, 110),
  );
  const labels = layoutBandLabels(points, {
    left: 0,
    top: 0,
    right: 300,
    bottom: 220,
  });
  expect(labels.length).toBeLessThan(31);
  expect(labels.map((label) => label.id)).toEqual(
    expect.arrayContaining(['0', '30']),
  );
});

it.each([6, 10, 15, 20, 31])(
  'fits every label in a flat %i-band layout without collisions',
  (count) => {
    const points = row(count);
    const labels = layoutBandLabels(points, bounds);
    expect(labels).toHaveLength(count);
    labels.forEach((label, index) => {
      expect(label.x).toBeGreaterThanOrEqual(bounds.left);
      expect(label.y).toBeGreaterThanOrEqual(bounds.top);
      expect(label.x + label.width).toBeLessThanOrEqual(bounds.right);
      expect(label.y + label.height).toBeLessThanOrEqual(bounds.bottom);
      labels
        .slice(index + 1)
        .forEach((other) =>
          expect(labelBoxesOverlap(label, other)).toBe(false),
        );
      points.forEach((dot) =>
        expect(
          labelBoxesOverlap(label, {
            x: dot.x - 8,
            y: dot.y - 8,
            width: 16,
            height: 16,
          }),
        ).toBe(false),
      );
    });
    expect(labels.some((label) => label.y < 160)).toBe(true);
    expect(count < 15 || labels.some((label) => label.y > 160)).toBe(true);
  },
);

it('keeps labels inside all four edges and handles coincident frequencies', () => {
  const labels = layoutBandLabels(
    [
      point('top', 5, 2),
      point('bottom', 990, 318),
      point('one', 400),
      point('two', 400),
      point('three', 400),
    ],
    bounds,
  );
  expect(labels).toHaveLength(5);
  labels.forEach((label, index) => {
    expect(label.x).toBeGreaterThanOrEqual(0);
    expect(label.y).toBeGreaterThanOrEqual(0);
    expect(label.x + label.width).toBeLessThanOrEqual(1000);
    expect(label.y + label.height).toBeLessThanOrEqual(320);
    labels
      .slice(index + 1)
      .forEach((other) => expect(labelBoxesOverlap(label, other)).toBe(false));
  });
});

/**
 * Ivan, 2026-10-03: "never do the side move always top or bottom". Every
 * label stands on its dot's centre line, held off it only by the plot's
 * edges, and on the side its place says.
 */
it('puts every label straight above or below its dot, never beside it', () => {
  const curve = Array.from({ length: 31 }, (_, index) =>
    point(`${index}`, 20 + (index * 960) / 30, 160 + 90 * Math.sin(index / 3)),
  );
  [row(31), curve, row(15, 30)].forEach((anchors) => {
    const labels = layoutBandLabels(anchors, bounds);
    expect(labels.length).toBeGreaterThan(10);
    labels.forEach((label) => {
      const anchor = anchors.find((each) => each.id === label.id);
      if (!anchor) {
        throw new Error(`no band ${label.id}`);
      }
      expect(label.x).toBe(
        Math.max(
          bounds.left,
          Math.min(bounds.right - label.width, anchor.x - label.width / 2),
        ),
      );
      expect(
        label.place.isAbove
          ? label.y + label.height < anchor.y
          : label.y > anchor.y,
      ).toBe(true);
    });
  });
});

type TRemember = 'home' | 'where it was' | 'nothing';

/**
 * One band moved a step at a time, each layout handed the last one's memory
 * as the window does — or, for the controls, a memory that knows only where
 * each label last stood (the layout before this one), or none at all.
 */
const walk = (
  start: readonly IBandLabelAnchor[],
  id: string,
  steps: ReadonlyArray<Partial<IBandLabelAnchor>>,
  remember: TRemember = 'home',
  isActive = true,
) => {
  let memory: TLabelMemory | undefined;
  return steps.map((step) => {
    const anchors = start.map((anchor) =>
      anchor.id === id ? { ...anchor, ...step, isActive } : anchor,
    );
    const labels = layoutBandLabels(anchors, bounds, { previous: memory });
    memory =
      remember === 'nothing'
        ? undefined
        : rememberLabels(
            labels,
            anchors,
            remember === 'home' ? memory : undefined,
          );
    return { anchors, labels, memory };
  });
};

const changes = (
  frames: ReturnType<typeof walk>,
  id: string,
  of: (label: ILaidLabel) => unknown,
) => {
  const seen = frames.map(({ labels }) => {
    const label = labels.find((each) => each.id === id);
    return label ? JSON.stringify(of(label)) : undefined;
  });
  expect(seen.every((each) => each !== undefined)).toBe(true);
  return seen.filter((each, index) => index > 0 && each !== seen[index - 1])
    .length;
};
const side = (label: ILaidLabel) => label.place.isAbove;
const place = (label: ILaidLabel) => label.place;

/**
 * Ivan, 2026-10-03, on the 31-band layout: "it move to top and bottom of the
 * dot each time I move the dot". The middle band dragged up and then down
 * through the whole row of dots.
 */
const gainDrag = [
  ...Array.from({ length: 30 }, (_, step) => ({ y: 160 - step * 3 })),
  ...Array.from({ length: 60 }, (_, step) => ({ y: 70 + step * 3 })),
];

it('keeps a dragged band’s label in its place, through the row of dots it crosses', () => {
  expect(changes(walk(row(31), '15', gainDrag), '15', place)).toBe(0);
});

it('flipped it back and forth before it remembered (positive control)', () => {
  expect(
    changes(walk(row(31), '15', gainDrag, 'nothing'), '15', side),
  ).toBeGreaterThan(1);
});

it('climbed a lane at every dot it passed while it kept off them (positive control)', () => {
  expect(
    changes(walk(row(31), '15', gainDrag, 'home', false), '15', place),
  ).toBeGreaterThan(1);
});

it('slides a dragged label along the plot’s edge, and changes sides only when the edge leaves no room', () => {
  const start = row(31);
  const home = layoutBandLabels(start, bounds).find(
    (label) => label.id === '15',
  )?.place;
  if (!home) {
    throw new Error('band 15 has no label');
  }
  const out = Array.from({ length: 51 }, (_, step) => ({
    y: 160 + (home.isAbove ? -3 : 3) * step,
  }));
  const frames = walk(start, '15', [...out, ...[...out].reverse()]);
  const own = frames.map(({ anchors, labels }) => {
    const label = labels.find((each) => each.id === '15');
    if (!label) {
      throw new Error('the dragged band lost its label');
    }
    return { dot: anchors[15].y, label };
  });
  const roomOnItsSide = (dot: number) =>
    home.isAbove ? dot - 14 - 34 >= bounds.top : dot + 14 + 34 <= bounds.bottom;
  // The drag reaches both: room beside the dot, and none.
  expect(own.some(({ dot }) => roomOnItsSide(dot))).toBe(true);
  expect(own.some(({ dot }) => !roomOnItsSide(dot))).toBe(true);
  own.forEach(({ dot, label }) => {
    expect(label.y).toBeGreaterThanOrEqual(bounds.top);
    expect(label.y + label.height).toBeLessThanOrEqual(bounds.bottom);
    expect(label.place.isAbove === home.isAbove).toBe(roomOnItsSide(dot));
  });
  // On one side from one step to the next it slides with its 3px-a-step dot,
  // or is held still by the edge; it never jumps a lane.
  const slides = own.flatMap(({ label }, index) => {
    const before = own[index - 1];
    return before && before.label.place.isAbove === label.place.isAbove
      ? [Math.abs(label.y - before.label.y)]
      : [];
  });
  expect(slides.length).toBeGreaterThan(90);
  expect(Math.max(...slides)).toBeLessThanOrEqual(3);
});

/**
 * Ivan, 2026-10-03: "they need to return to original places if they can".
 * Band 7's frequency dragged across band 9's label and back: band 9 steps
 * aside while band 7's label is in its way, and every label is where it
 * started once band 7 is.
 */
const frequencyDrag = (remember: TRemember) => {
  const start = row(15);
  const from = start[7].x;
  const out = Array.from({ length: 31 }, (_, step) => ({ x: from + step * 4 }));
  return {
    start,
    frames: walk(start, '7', [...out, ...[...out].reverse()], remember),
  };
};
const placeOf = (labels: readonly ILaidLabel[], id: string) =>
  labels.find((label) => label.id === id)?.place;

it('puts a label pushed aside by a drag back where it was', () => {
  const { start, frames } = frequencyDrag('home');
  const before = layoutBandLabels(start, bounds);
  const home = placeOf(before, '9');
  // The drag did push band 9 off its place on the way out, outwards on its
  // own side of its dot and never across it...
  expect(
    frames.some(
      ({ labels }) =>
        JSON.stringify(placeOf(labels, '9')) !== JSON.stringify(home),
    ),
  ).toBe(true);
  frames.forEach(({ labels }) =>
    expect(placeOf(labels, '9')?.isAbove).toBe(home?.isAbove),
  );
  // ...and every label is back on its own once band 7 is.
  expect(frames[frames.length - 1].labels).toEqual(before);
});

it('left it pushed aside when it remembered only where it was (positive control)', () => {
  const { start, frames } = frequencyDrag('where it was');
  expect(frames[frames.length - 1].labels).not.toEqual(
    layoutBandLabels(start, bounds),
  );
});

it('keeps the dragged label’s place over a neighbour whose dot moves with it', () => {
  // A drag reshapes the summed curve, so a neighbour's dot moves on every
  // step too. Band 8 dragged down the spectrum into band 6's label while band
  // 6's dot drifts: band 8's label stays put and band 6's steps aside.
  const start = row(15);
  let memory: TLabelMemory | undefined;
  const places = Array.from({ length: 30 }, (_, step) => {
    const anchors = start.map((anchor) => {
      if (anchor.id === '8') {
        return { ...anchor, x: anchor.x - step * 4, isActive: true };
      }
      return anchor.id === '6' ? { ...anchor, y: anchor.y - step } : anchor;
    });
    const labels = layoutBandLabels(anchors, bounds, { previous: memory });
    memory = rememberLabels(labels, anchors, memory);
    return {
      dragged: JSON.stringify(placeOf(labels, '8')),
      neighbour: JSON.stringify(placeOf(labels, '6')),
    };
  });
  expect(new Set(places.map(({ dragged }) => dragged)).size).toBe(1);
  // The two did meet: band 6's label had to move.
  expect(
    new Set(places.map(({ neighbour }) => neighbour)).size,
  ).toBeGreaterThan(1);
});

it('lets no label but the dragged one move while nothing is in its way', () => {
  const start = row(15);
  const first = layoutBandLabels(start, bounds);
  const moved = start.map((anchor) =>
    anchor.id === '7' ? { ...anchor, y: 150, isActive: true } : anchor,
  );
  const second = layoutBandLabels(moved, bounds, {
    previous: rememberLabels(first, start),
  });
  first
    .filter((label) => label.id !== '7')
    .forEach((label) =>
      expect(second.find((other) => other.id === label.id)).toEqual(label),
    );
});

it('never moves a label for being selected', () => {
  // Band 9 pushed aside by band 7's label, then selected with nothing moved:
  // it stays aside rather than taking its place back from band 7.
  const { frames } = frequencyDrag('home');
  const { anchors, labels, memory } = frames[30];
  expect(placeOf(labels, '9')?.lane).toBeGreaterThan(0);
  const selected = anchors.map((anchor) => ({
    ...anchor,
    isActive: anchor.id === '9',
  }));
  expect(layoutBandLabels(selected, bounds, { previous: memory })).toEqual(
    labels,
  );
});

it('keeps every label off a genre’s pins and their numbered badges', () => {
  const flat = row(15);
  const plain = layoutBandLabels(flat, bounds);
  // A pin in the middle of three of the labels as they land untold, its dot
  // where the label's centre is: a Preset line crossing them there.
  const pins = [plain[2], plain[7], plain[12]].map((label) =>
    genrePinBox(label.x + label.width / 2, label.y + label.height / 2),
  );
  // Positive control: without being told, labels land on those pins.
  expect(
    plain.some((label) => pins.some((pin) => labelBoxesOverlap(label, pin))),
  ).toBe(true);
  const labels = layoutBandLabels(flat, bounds, { obstacles: pins });
  expect(labels).toHaveLength(15);
  labels.forEach((label) =>
    pins.forEach((pin) => expect(labelBoxesOverlap(label, pin)).toBe(false)),
  );
});

it('never lets selecting a band change which bands a crowded plot labels', () => {
  const points = Array.from({ length: 31 }, (_, index) =>
    point(`${index}`, 10 + (index * 280) / 30, 110),
  );
  const small = { left: 0, top: 0, right: 300, bottom: 220 };
  const plain = layoutBandLabels(points, small).map((label) => label.id);
  const selected = layoutBandLabels(
    points.map((anchor) =>
      anchor.id === '14' ? { ...anchor, isActive: true } : anchor,
    ),
    small,
  ).map((label) => label.id);
  expect(new Set(selected)).toEqual(new Set(plain));
});

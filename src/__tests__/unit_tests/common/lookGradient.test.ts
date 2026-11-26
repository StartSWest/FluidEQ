/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */
import {
  normalizeCustomLook,
  parseLookFile,
  resolveCustomLook,
  serializeLookFile,
  withLookStops,
} from 'common/customLooks';
import {
  type ILookStop,
  LOOK_GRADIENT_STEPS,
  MAX_LOOK_STOPS,
  addLookStop,
  legacyColoursFromStops,
  lookColourAt,
  lookRampFromStops,
  lookStopsFromColours,
  moveLookStop,
  normalizeLookStops,
  removeLookStop,
} from 'common/lookGradient';

/**
 * How every drawing of a look reads its colours: evenly spaced stops, a
 * straight line between neighbours, whole channels (`rampAt` in
 * `lookColours.ts`, `lookInk` in the shaders). Written out again here so the
 * test holds the contract, not a copy of the code under test.
 */
const drawnAt = (ramp: readonly string[], t: number): number[] => {
  const read = (hex: string) =>
    [1, 3, 5].map((at) => parseInt(hex.slice(at, at + 2), 16));
  const at = Math.max(0, Math.min(1, t)) * (ramp.length - 1);
  const from = read(ramp[Math.floor(at)]);
  const to = read(ramp[Math.min(ramp.length - 1, Math.floor(at) + 1)]);
  const blend = at - Math.floor(at);
  return from.map((channel, index) =>
    Math.round(channel + (to[index] - channel) * blend),
  );
};

const exactAt = (stops: readonly ILookStop[], t: number): number[] => {
  const hex = lookColourAt(stops, t);
  return [1, 3, 5].map((at) => parseInt(hex.slice(at, at + 2), 16));
};

/** The largest channel difference between two ramps over the whole bar. */
const worstGap = (
  a: (t: number) => number[],
  b: (t: number) => number[],
): number => {
  const gaps = Array.from({ length: 601 }, (_unused, index) => {
    const t = index / 600;
    const right = b(t);
    return Math.max(
      ...a(t).map((channel, at) => Math.abs(channel - right[at])),
    );
  });
  return Math.max(...gaps);
};

const SEVEN = [
  '#ff3030',
  '#ff9a1f',
  '#ffd21f',
  '#2fd66b',
  '#00ccf5',
  '#6b4cff',
  '#c86bff',
];

const savedSeven = {
  id: 'custom:seven',
  name: 'Seven',
  style: 'bars',
  palette: 'rainbow',
  tuning: {},
  colours: SEVEN,
};

describe('a look saved with seven colours', () => {
  it('reads back drawing exactly those seven colours', () => {
    const look = normalizeCustomLook(savedSeven);
    expect(look?.stops).toBeUndefined();
    expect(look && resolveCustomLook(look).colours).toEqual(SEVEN);
  });

  it('opens as seven evenly spaced points and, edited through them, draws the same seven colours', () => {
    const look = normalizeCustomLook(savedSeven);
    if (!look) {
      throw new Error('the saved look did not read');
    }
    const stops = lookStopsFromColours(look.colours);
    expect(stops.map((stop) => stop.at)).toEqual(
      [0, 1, 2, 3, 4, 5, 6].map((index) => index / 6),
    );
    const edited = withLookStops(look, stops);
    expect(resolveCustomLook(edited).colours).toEqual(SEVEN);
    expect(edited.colours).toEqual(SEVEN);
  });

  it('draws differently once a point is moved, so the check above can fail', () => {
    const look = normalizeCustomLook(savedSeven);
    if (!look) {
      throw new Error('the saved look did not read');
    }
    const moved = moveLookStop(lookStopsFromColours(look.colours), 3, 0.3);
    expect(resolveCustomLook(withLookStops(look, moved)).colours).not.toEqual(
      SEVEN,
    );
  });
});

describe('the ramp the drawing reads', () => {
  const uneven: ILookStop[] = [
    { colour: '#000000', at: 0 },
    { colour: '#ff0000', at: 7 / LOOK_GRADIENT_STEPS },
    { colour: '#00ff00', at: 13 / LOOK_GRADIENT_STEPS },
    { colour: '#ffffff', at: 1 },
  ];

  it('retraces points wherever they stand on the grid', () => {
    const ramp = lookRampFromStops(uneven);
    expect(
      worstGap(
        (t) => drawnAt(ramp, t),
        (t) => exactAt(uneven, t),
      ),
    ).toBeLessThanOrEqual(1);
  });

  it('is not the points evenly spaced (the control the exact ramp must beat)', () => {
    const naive = uneven.map((stop) => stop.colour);
    expect(
      worstGap(
        (t) => drawnAt(naive, t),
        (t) => exactAt(uneven, t),
      ),
    ).toBeGreaterThan(40);
  });

  it('holds the first and last colour outside the points', () => {
    const inset: ILookStop[] = [
      { colour: '#102030', at: 0.25 },
      { colour: '#a0b0c0', at: 0.75 },
    ];
    const ramp = lookRampFromStops(inset);
    expect(ramp[0]).toBe('#102030');
    expect(ramp[ramp.length - 1]).toBe('#a0b0c0');
  });

  it('lands every older look exactly: one to seven evenly spaced colours', () => {
    [1, 2, 3, 4, 5, 6, 7].forEach((count) => {
      const colours = SEVEN.slice(0, count);
      const stops = lookStopsFromColours(colours);
      const ramp = lookRampFromStops(stops);
      // One colour is two points of it: the same flat figure.
      expect(ramp).toEqual(count === 1 ? [colours[0], colours[0]] : colours);
    });
  });
});

describe('a look file with points', () => {
  const look = withLookStops(
    {
      id: 'custom:points',
      name: 'Points',
      style: 'bars',
      palette: 'level',
      tuning: normalizeCustomLook(savedSeven)?.tuning ?? ({} as never),
      colours: [],
    },
    [
      { colour: '#112233', at: 0 },
      { colour: '#ffcc00', at: 0.1 },
      { colour: '#ff00aa', at: 0.55 },
      { colour: '#ffffff', at: 1 },
    ],
  );

  it('comes back with the same points', () => {
    const [read] = parseLookFile(serializeLookFile([look]));
    expect(read.stops).toEqual(look.stops);
    expect(resolveCustomLook(read).colours).toEqual(
      resolveCustomLook(look).colours,
    );
  });

  it('carries seven colours for a version that reads nothing else', () => {
    const file = JSON.parse(serializeLookFile([look]));
    expect(file.schema).toBe(1);
    expect(file.looks[0].colours).toHaveLength(7);
    expect(file.looks[0].colours).toEqual(
      legacyColoursFromStops(look.stops ?? []),
    );
    // What such a version draws from them is the same gradient, sampled.
    expect(file.looks[0].colours[0]).toBe('#112233');
    expect(file.looks[0].colours[6]).toBe('#ffffff');
  });

  it('read without its points draws from those colours, as an older version does', () => {
    const file = JSON.parse(serializeLookFile([look]));
    delete file.looks[0].stops;
    const [read] = parseLookFile(JSON.stringify(file));
    expect(read.stops).toBeUndefined();
    expect(resolveCustomLook(read).colours).toEqual(file.looks[0].colours);
  });
});

describe('editing the points', () => {
  const two: ILookStop[] = [
    { colour: '#000000', at: 0 },
    { colour: '#ffffff', at: 1 },
  ];

  it('adds a point in the colour already there, so nothing drawn changes', () => {
    const added = addLookStop(two, 0.5);
    expect(added?.index).toBe(1);
    expect(added?.stops[1]).toEqual({ colour: '#808080', at: 0.5 });
    const before = lookRampFromStops(two);
    const after = lookRampFromStops(added?.stops ?? []);
    expect(
      worstGap(
        (t) => drawnAt(before, t),
        (t) => drawnAt(after, t),
      ),
    ).toBeLessThanOrEqual(1);
  });

  it('adds none where a point already stands, or past eight', () => {
    expect(addLookStop(two, 0.004)).toBeUndefined();
    let full: ILookStop[] = two;
    for (let index = 1; full.length < MAX_LOOK_STOPS; index += 1) {
      full = addLookStop(full, index / 10)?.stops ?? full;
    }
    expect(full).toHaveLength(MAX_LOOK_STOPS);
    expect(addLookStop(full, 0.95)).toBeUndefined();
  });

  it('moves a point, never past its neighbours', () => {
    const three = addLookStop(two, 0.5)?.stops ?? [];
    expect(moveLookStop(three, 1, 0.8)[1].at).toBeCloseTo(0.8);
    expect(moveLookStop(three, 1, 1.4)[1].at).toBeCloseTo(
      (LOOK_GRADIENT_STEPS - 1) / LOOK_GRADIENT_STEPS,
    );
    expect(moveLookStop(three, 1, -1)[1].at).toBeCloseTo(
      1 / LOOK_GRADIENT_STEPS,
    );
    // An end point moves freely to its end.
    expect(moveLookStop(three, 0, 0.2)[0].at).toBeCloseTo(0.2);
  });

  it('removes a point, but never the last two', () => {
    const three = addLookStop(two, 0.5)?.stops ?? [];
    expect(removeLookStop(three, 1)).toEqual(two);
    expect(removeLookStop(two, 0)).toEqual(two);
  });
});

describe('stored points', () => {
  it('are put on the grid, ordered and kept to one per step', () => {
    expect(
      normalizeLookStops(
        [
          { colour: '#FFF', at: 0.9 },
          { colour: '#000000', at: 0.001 },
          { colour: '#ff0000', at: 0.004 },
          { colour: 'red', at: 0.5 },
          { colour: '#00ff00', at: Number.NaN },
        ],
        'rainbow',
      ),
    ).toEqual([
      { colour: '#000000', at: 0 },
      { colour: '#ffffff', at: 0.9 },
    ]);
  });

  it('mean nothing on a flat look, or when fewer than two survive', () => {
    const fine = [
      { colour: '#000000', at: 0 },
      { colour: '#ffffff', at: 1 },
    ];
    expect(normalizeLookStops(fine, 'rainbow')).toHaveLength(2);
    expect(normalizeLookStops(fine, 'signal')).toEqual([]);
    expect(normalizeLookStops([fine[0]], 'rainbow')).toEqual([]);
    expect(normalizeLookStops('junk', 'rainbow')).toEqual([]);
  });
});

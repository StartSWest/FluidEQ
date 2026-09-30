import { type Projected } from 'common/graphStyles';
import { vehicleSize } from 'common/graphRoad';
import createTrussRoad from 'common/graphTruss';
import noise from 'common/seededNoise';
import { createFireworkPaths, fireworkLayout } from './bridgeFireworks';
import type { IBridgeCar, TrussBridge } from './trussBridge';
import {
  CAR_COLOURS,
  CROSSING_SECONDS,
  DECK_REACH,
  FADE_BANDS,
  LEVEL_BINS,
  SEA_HORIZON,
  SEA_REACH,
  SEA_ROWS,
  SEA_STEPS,
  STARS,
  lampBlink,
} from './trussBridge';

// Where the bridge, its lamps, its cars and the sea under it stand on a
// frame, and the paths they are drawn with, read from the bridge
// trussBridge.ts advances.

const polygon = (path: Path2D, vertices: readonly Projected[]) => {
  path.moveTo(vertices[0][0], vertices[0][1]);
  for (let index = 1; index < vertices.length; index += 1) {
    path.lineTo(vertices[index][0], vertices[index][1]);
  }
  path.closePath();
};

/** Segments, each its own subpath, as one path. */
const segmentsPath = (segments: readonly (readonly Projected[])[]) => {
  const path = new Path2D();
  segments.forEach(([[fromX, fromY], ...rest]) => {
    path.moveTo(fromX, fromY);
    rest.forEach(([x, y]) => path.lineTo(x, y));
  });
  return path;
};

/** Discs as one path, so where they overlap they are one shape. */
const discsPath = (discs: readonly { x: number; y: number; r: number }[]) => {
  const path = new Path2D();
  discs.forEach(({ x, y, r }) => {
    path.moveTo(x + r, y);
    path.arc(x, y, r, 0, Math.PI * 2);
  });
  return path;
};

/** One of the truss's members: from where it starts, to where it ends. */
export interface ITrussMember {
  from: Projected;
  to: Projected;
  /** How loud the band under its first end is: 0 quiet .. LEVEL_BINS - 1. */
  bin: number;
}

/** A lamp where a hanger meets the cable. */
export interface IBridgeLamp {
  x: number;
  y: number;
  r: number;
  on: boolean;
}

/** One car: where it stands, which way the deck tilts it, its size. */
export interface IBridgeCarPose {
  x: number;
  y: number;
  cos: number;
  sin: number;
  size: number;
  /** 0..1: how much this car's band is playing right now. */
  level: number;
  colour: string;
}

/**
 * The car's parts, in its own units before its size and tilt: the body's
 * two boxes, the window, and the wheels' middles — the tyre's radius, the
 * hub's.
 */
export const CAR_BODY = [
  [-9, -8, 18, 5],
  [-5, -12, 10, 5],
] as const;

export const CAR_WINDOW = [-3, -11, 6, 3] as const;

export const CAR_WHEELS = [-5, 5] as const;

export const CAR_WHEEL_Y = -2.7;

export const CAR_TYRE = 2.7;

export const CAR_HUB = 1;

/** The sea's rows at a moment: what `seaRowY` needs to find a swell. */
export interface IBridgeSea {
  horizon: number;
  nearest: number;
  size: number;
  swell: number;
  seconds: number;
  left: number;
  width: number;
  /** How many straight pieces a row is drawn in across its width. */
  steps: number;
}

/**
 * Where swell `row` of the sea stands at `x`: packed toward the horizon
 * the way distance packs them, travelling across, longer and taller the
 * nearer it is. The row below the last is flat, so the nearest strip
 * reaches the bottom of the overflow with no swell to leave a gap.
 */
export const seaRowY = (sea: IBridgeSea, row: number, x: number) => {
  if (row >= SEA_ROWS) {
    return sea.nearest + sea.size * 4;
  }
  const t = (row + 1) / SEA_ROWS;
  const rest = sea.horizon + (sea.nearest - sea.horizon) * t ** 1.8;
  const amp = sea.size * (0.35 + 3 * t) * sea.swell;
  const k = 0.011 / (0.12 + t);
  return (
    rest -
    amp *
      (0.55 * Math.sin(x * k + sea.seconds * 1.4 + row * 0.9) +
        0.45 * Math.sin(x * k * 2.3 - sea.seconds * 2.1 + row * 1.7))
  );
};

/**
 * The bridge as it stands this frame, in numbers: the deck, the truss's
 * members, the stars, the sea, the towers and piers, the bracing, the
 * cables and hangers, the lamps and what they throw, the reflections, the
 * cars and the fireworks. What the page's canvas and the engine's bridge
 * (`engineLooks/designed/trussLook.ts`) both draw from.
 */
export const trussBridgeLayout = (
  state: TrussBridge,
  columns: readonly Projected[],
  baseline: number,
  top: number,
  seconds: number,
  sizeHeight: number,
  frame: { top: number; bottom: number },
) => {
  const left = columns[0]?.[0] ?? 0;
  const right = columns[columns.length - 1]?.[0] ?? 1;
  const width = Math.max(1, right - left);
  const height = Math.max(1, baseline - top);
  const size = vehicleSize(sizeHeight);
  const thump = lampBlink(state, seconds);
  // The eased deck on the road's own x positions, dropped a few pixels on
  // its springs while a beat rings.
  const bounce = thump * size * 2.5;
  const span: Projected[] = createTrussRoad(columns).map(([x], index) => [
    x,
    (state.deck[index] ?? baseline) + bounce,
  ]);
  // The scene is allowed to overflow the plot, and the panel round it has
  // margins: the deck and the truss carry on level past both ends at the
  // road's own pitch, so the joints keep their spacing. The cables and the
  // anchors stay on the span.
  const reach = width * DECK_REACH;
  const pitch = span.length >= 2 ? Math.max(1, span[1][0] - span[0][0]) : 1;
  const approach = Math.ceil(reach / pitch);
  const road: Projected[] = [
    ...Array.from({ length: approach }, (_, i): Projected => [
      left - (approach - i) * pitch,
      span[0]?.[1] ?? baseline,
    ]),
    ...span,
    ...Array.from({ length: approach }, (_, i): Projected => [
      right + (i + 1) * pitch,
      span[span.length - 1]?.[1] ?? baseline,
    ]),
  ];
  const deckAt = (x: number) => {
    let at = 1;
    while (at < road.length - 1 && road[at][0] < x) {
      at += 1;
    }
    const [ax, ay] = road[at - 1];
    const [bx, by] = road[at];
    const mix = (x - ax) / Math.max(0.001, bx - ax);
    return ay + (by - ay) * mix;
  };

  // The stiffening truss under the deck: posts and alternating diagonals
  // from the joints to the floor, each burning with the level of the band
  // under its first end.
  const joints = road.filter((_p, index) => index % 8 === 0);
  const levelBin = (x: number) => {
    const step =
      (columns[columns.length - 1][0] - left) / Math.max(1, columns.length - 1);
    const index = Math.max(
      0,
      Math.min(columns.length - 1, Math.round((x - left) / step)),
    );
    const level = Math.max(
      0,
      Math.min(1, (baseline - columns[index][1]) / height),
    );
    return Math.min(LEVEL_BINS - 1, Math.floor(level * LEVEL_BINS));
  };
  // The road surface: half the asphalt's thickness, sized with the cars.
  const roadHalf = Math.max(2.5, size * 2.6);
  const members: ITrussMember[] = [];
  const member = (from: Projected, to: Projected) => {
    members.push({ from, to, bin: levelBin(from[0]) });
  };
  for (let index = 0; index < joints.length; index += 1) {
    const [x, y] = joints[index];
    member([x, y + roadHalf], [x, baseline]);
    if (index < joints.length - 1) {
      const [nx, ny] = joints[index + 1];
      if (index % 2 === 0) {
        member([x, y + roadHalf], [nx, baseline]);
      } else {
        member([x, baseline], [nx, ny + roadHalf]);
      }
    }
  }
  // The intermittent centre line: a dash every 2.3 dash-lengths along the
  // road, each a chord between the road's heights at its two ends.
  const dashes: Projected[][] = [];
  if (road.length >= 2) {
    const dash = Math.max(6, size * 9);
    for (
      let x = left - reach + dash;
      x < right + reach - dash;
      x += dash * 2.3
    ) {
      dashes.push([
        [x, deckAt(x)],
        [x + dash, deckAt(x + dash)],
      ]);
    }
  }

  // The sky: stars from the top of the WINDOW down to the horizon — a
  // fixed sky, whatever the deck does under it, because a star field that
  // squeezed with the deck read as the sky beating — each twinkling at
  // its own rate; the lit ones flare with the beat.
  const stars: { x: number; y: number; r: number; bright: boolean }[] = [];
  const skyTop = Math.min(frame.top, top);
  const skyDepth = Math.max(1, top + height * SEA_HORIZON - skyTop);
  for (let star = 0; star < STARS; star += 1) {
    stars.push({
      x: left - width + noise(star * 3 + 1) * width * 3,
      y: skyTop + noise(star * 3 + 2) * skyDepth,
      r: (0.6 + noise(star * 3 + 3) * 1.1) * Math.min(1.6, size),
      bright: Math.sin(seconds * (1.2 + noise(star) * 3) + star) > 0.5,
    });
  }

  // The sea behind and under the bridge, in perspective: SEA_ROWS swells
  // from a horizon fixed in the sky's frame down past the floor. Each swell
  // is a strip of water between one crest line and the next, so the sea is
  // a body of colour, deeper the nearer the strip — no lines on it — and
  // the whole sea rises with the bass.
  const horizon = top + height * SEA_HORIZON;
  const seaReach = width * SEA_REACH;
  const sea: IBridgeSea = {
    horizon,
    nearest: Math.max(frame.bottom, baseline) + size * 6,
    size,
    swell: 1 + state.bass * 1.6,
    seconds,
    left: left - seaReach,
    width: width + seaReach * 2,
    steps: SEA_STEPS * 3,
  };

  // The suspension: two towers on piers, the cables, the hangers.
  const towers: Projected[][] = [];
  const towersBelow: Projected[][] = [];
  const bracing: Projected[][] = [];
  const bracingBelow: Projected[][] = [];
  const piers: Projected[][] = [];
  // The towers' streaks on the water, and the lamps', one to a hanger.
  const streaks: Projected[][] = [];
  const reflections: Projected[][] = [];
  const cables: Projected[][] = [];
  const hangers: Projected[][] = [];
  // The beacons on the tower caps, and the lamps, one to a hanger.
  const beacons: IBridgeLamp[] = [];
  const lamps: IBridgeLamp[] = [];
  const lampCones: Projected[][] = [];
  const lampR = Math.max(1.2, size * 1.1);
  if (road.length >= 2) {
    const towerX = [left + width * 0.25, left + width * 0.75];
    // Equal towers on one line, whatever the deck does under them: that is
    // what makes the cables drape instead of running straight.
    // Low enough that the fullscreen header never clips the caps.
    const towerTop = top + height * 0.14;
    const leg = Math.max(2.5, size * 2.6);
    const spread = Math.max(6, size * 7);
    const pierHalf = spread * 1.6;
    const pierTop = baseline - Math.max(6, height * 0.05);
    towerX.forEach((x) => {
      // Two legs, a cap, and X-bracing every 18% of the height. Each leg
      // is cut at the deck, so the deck can be painted over the part
      // below it.
      const deckHere = deckAt(x) + roadHalf;
      const tall = pierTop - towerTop;
      const cut = (tall - (pierTop - deckHere)) / tall;
      [-1, 1].forEach((side) => {
        const legX = (f: number) => x + side * spread * (0.85 + 0.15 * f);
        towers.push([
          [legX(cut) - leg, deckHere],
          [legX(cut) + leg, deckHere],
          [legX(0) + leg, towerTop],
          [legX(0) - leg, towerTop],
        ]);
        towersBelow.push([
          [legX(1) - leg, pierTop],
          [legX(1) + leg, pierTop],
          [legX(cut) + leg, deckHere],
          [legX(cut) - leg, deckHere],
        ]);
      });
      towers.push([
        [x - spread * 0.85 - leg, towerTop],
        [x + spread * 0.85 + leg, towerTop],
        [x + spread * 0.85 + leg, towerTop + leg * 2.2],
        [x - spread * 0.85 - leg, towerTop + leg * 2.2],
      ]);
      const beaconR = lampR * 1.3;
      beacons.push({
        x,
        y: towerTop - beaconR - 1,
        r: beaconR,
        on: state.blinkParity === 0,
      });
      for (let f = 0.1; f < 0.95; f += 0.18) {
        const y0 = towerTop + tall * f;
        const y1 = towerTop + tall * Math.min(0.98, f + 0.18);
        const w0 = spread * (0.85 + 0.15 * f);
        const w1 = spread * (0.85 + 0.15 * Math.min(0.98, f + 0.18));
        const target = y0 < deckHere ? bracing : bracingBelow;
        target.push([
          [x - w0, y0],
          [x + w1, y1],
        ]);
        target.push([
          [x + w0, y0],
          [x - w1, y1],
        ]);
        target.push([
          [x - w0, y0],
          [x + w0, y0],
        ]);
      }
      // The tower's reflection in the water: a streak under each leg,
      // wobbling with the clock, longer on a beat.
      [-1, 1].forEach((side) => {
        const rx = x + side * spread + Math.sin(seconds * 2.3 + side) * 1.5;
        streaks.push([
          [rx, baseline + 2],
          [rx, baseline + size * (10 + thump * 8)],
        ]);
      });
      // The pier: a foundation block wider than the tower, in the water.
      piers.push([
        [x - pierHalf, baseline],
        [x + pierHalf, baseline],
        [x + pierHalf * 0.8, pierTop],
        [x - pierHalf * 0.8, pierTop],
      ]);
    });
    // Anchor blocks at the ends of the deck.
    [left, right].forEach((x, index) => {
      const dir = index === 0 ? 1 : -1;
      piers.push([
        [x, baseline],
        [x + dir * pierHalf, baseline],
        [x + dir * pierHalf * 0.7, deckAt(x)],
        [x, deckAt(x)],
      ]);
    });
    // The main span: a parabola whose low point clears the deck's highest
    // point between the towers by 8% of the plot.
    const spanLow = Math.min(
      ...road
        .filter(([x]) => x >= towerX[0] && x <= towerX[1])
        .map(([, y]) => y),
    );
    // The cables pump with the bass: on a kick they tighten and lift, and
    // slacken back down as it goes; the painter thickens and brightens
    // them with the same reading.
    const sag =
      Math.max(
        height * 0.08,
        Math.min(spanLow - height * 0.08 - towerTop, height * 0.34),
      ) *
      (1 - state.bass * 0.3);
    const cableAt = (x: number) => {
      const u = (x - towerX[0]) / (towerX[1] - towerX[0]);
      return towerTop + 4 * sag * u * (1 - u);
    };
    // Side spans from the anchor blocks up to the tower tops, drooping a
    // little too, then the main span.
    const sideAt = (anchorX: number, towerAt: number, x: number) => {
      const u = (x - anchorX) / (towerAt - anchorX);
      return (
        deckAt(anchorX) +
        (towerTop - deckAt(anchorX)) * u +
        sag * 0.35 * u * (1 - u)
      );
    };
    const side = (from: number, to: number): Projected[] =>
      Array.from({ length: 13 }, (_, step): Projected => {
        const x = from + (to - from) * (step / 12);
        return [x, sideAt(from, to, x)];
      });
    const main = side(left, towerX[0]);
    for (let x = towerX[0]; x <= towerX[1]; x += Math.max(4, width / 96)) {
      main.push([x, cableAt(x)]);
    }
    main.push([towerX[1], towerTop]);
    cables.push(main, side(right, towerX[1]));
    // Hangers from the cable to the deck at every joint: the main span's
    // from the drape, the side spans' from their own cable.
    let hanger = 0;
    joints.forEach(([x]) => {
      const inMain = x > towerX[0] + spread && x < towerX[1] - spread;
      const inLeft = x > left + pierHalf && x < towerX[0] - spread;
      const inRight = x > towerX[1] + spread && x < right - pierHalf;
      if (inMain || inLeft || inRight) {
        let y = cableAt(x);
        if (inLeft) {
          y = sideAt(left, towerX[0], x);
        } else if (inRight) {
          y = sideAt(right, towerX[1], x);
        }
        hangers.push([
          [x, y],
          [x, deckAt(x) - roadHalf],
        ]);
        // The lamp's light on the water below it.
        const wobble = Math.sin(seconds * 3.1 + x * 0.05) * 1.2;
        reflections.push([
          [x + wobble, baseline + 2],
          [x - wobble, baseline + size * (4 + thump * 4)],
        ]);
        // A lamp where the hanger meets the cable, and its cone of light
        // down onto the deck: a narrow wedge from the lamp to a pool the
        // width of a car on the road.
        lamps.push({ x, y, r: lampR, on: hanger % 2 === state.blinkParity });
        const roadY = deckAt(x) - roadHalf;
        const pool = size * 5;
        lampCones.push([
          [x - lampR, y],
          [x + lampR, y],
          [x + pool, roadY],
          [x - pool, roadY],
        ]);
        hanger += 1;
      }
    });
  }

  // Four cars crossing one way at a stroll, a quarter of the deck apart,
  // each rotated to the deck's slope under it.
  const phase = (seconds / CROSSING_SECONDS) % 1;
  const levelAt = (x: number) => {
    const step =
      (columns[columns.length - 1][0] - left) / Math.max(1, columns.length - 1);
    const at = Math.max(
      0,
      Math.min(columns.length - 1, Math.round((x - left) / step)),
    );
    return Math.max(0, Math.min(1, (baseline - columns[at][1]) / height));
  };
  const cars: IBridgeCarPose[] = CAR_COLOURS.map((colour, index) => {
    const x = left + ((phase + index / CAR_COLOURS.length) % 1) * width;
    const level = Math.min(
      1,
      Math.max(state.bass, thump) * 0.8 + levelAt(x) * 0.2,
    );
    let at = 1;
    while (at < road.length - 1 && road[at][0] < x) {
      at += 1;
    }
    const [ax, ay] = road[at - 1];
    const [bx, by] = road[at];
    const mix = (x - ax) / Math.max(0.001, bx - ax);
    const angle = Math.atan2(by - ay, bx - ax);
    const cos = Math.cos(angle);
    // On the top edge of the asphalt, measured along the road's normal.
    return {
      x,
      y: ay + (by - ay) * mix - roadHalf * cos,
      cos,
      sin: Math.sin(angle),
      // It swells up to a fifth with the rhythm.
      size: size * (1 + level * 0.2),
      level,
      colour,
    };
  });

  return {
    road,
    deckTop: Math.min(...road.map(([, y]) => y)),
    roadHalf,
    footing: [left - reach, right + reach] as const,
    members,
    dashes,
    stars,
    sea,
    horizon,
    /** How deep the haze over the waterline is, in pixels. */
    horizonHaze: size * (10 + state.bass * 14),
    towers,
    towersBelow,
    bracing,
    bracingBelow,
    piers,
    streaks,
    reflections,
    cables,
    hangers,
    beacons,
    lamps,
    lampR,
    lampCones,
    cars,
    // Fireworks: their own module — see bridgeFireworks. The horizon goes
    // in so a burst over the water is mirrored in it.
    fireworks: fireworkLayout(
      state.rockets,
      seconds,
      sizeHeight,
      horizon,
      state.glow,
    ),
    thump,
    bass: state.bass,
  };
};

export type TrussBridgeLayout = ReturnType<typeof trussBridgeLayout>;

export const createTrussBridgePaths = (
  state: TrussBridge,
  columns: readonly Projected[],
  baseline: number,
  top: number,
  seconds: number,
  /**
   * The plot's true depth, for sizing what must not stretch. The columns,
   * the baseline and the top may be in a scaled space — see the canvas —
   * and a car or a shell sized from that would squash with the wave.
   */
  sizeHeight = baseline - top,
  /**
   * The whole window, in the same space as everything else.
   *
   * The bridge answers the height slider; the sky and the sea do not.
   * Laid out inside the plot's box they shrank with the deck, so a short
   * wave left a band of stars over a strip of sea in the middle of a
   * black screen. Both are scenery and both reach the window's edges.
   */
  frame = { top, bottom: baseline },
) => {
  const layout = trussBridgeLayout(
    state,
    columns,
    baseline,
    top,
    seconds,
    sizeHeight,
    frame,
  );
  const { road, roadHalf } = layout;

  // The deck: the figure.
  const deck = new Path2D();
  if (road.length >= 2) {
    deck.moveTo(road[0][0], road[0][1]);
    road.slice(1).forEach(([x, y]) => deck.lineTo(x, y));
  }

  // members[fade][bin]: each member cut by depth into FADE_BANDS pieces for
  // the fade, grouped by the level of the band under its first end.
  const members = Array.from({ length: FADE_BANDS }, () =>
    Array.from({ length: LEVEL_BINS }, () => new Path2D()),
  );
  layout.members.forEach(({ from: a, to: b, bin }) => {
    for (let band = 0; band < FADE_BANDS; band += 1) {
      const from = band / FADE_BANDS;
      const to = (band + 1) / FADE_BANDS;
      members[band][bin].moveTo(
        a[0] + (b[0] - a[0]) * from,
        a[1] + (b[1] - a[1]) * from,
      );
      members[band][bin].lineTo(
        a[0] + (b[0] - a[0]) * to,
        a[1] + (b[1] - a[1]) * to,
      );
    }
  });
  // The asphalt's lower edge only: the upper one is the deck line the look
  // already strokes, and drawing it twice read as a double rail.
  const edges = new Path2D();
  if (road.length >= 2) {
    edges.moveTo(road[0][0], road[0][1] + roadHalf);
    road.slice(1).forEach(([x, y]) => edges.lineTo(x, y + roadHalf));
  }
  const footing = new Path2D();
  footing.moveTo(layout.footing[0], baseline);
  footing.lineTo(layout.footing[1], baseline);

  const stars = discsPath(layout.stars.filter(({ bright }) => !bright));
  const brightStars = discsPath(layout.stars.filter(({ bright }) => bright));

  const sea: Path2D[] = [];
  const { steps } = layout.sea;
  for (let row = 0; row < SEA_ROWS; row += 1) {
    const body = new Path2D();
    const xAt = (step: number) =>
      layout.sea.left + (layout.sea.width * step) / steps;
    body.moveTo(xAt(0), seaRowY(layout.sea, row, xAt(0)));
    for (let step = 1; step <= steps; step += 1) {
      body.lineTo(xAt(step), seaRowY(layout.sea, row, xAt(step)));
    }
    for (let step = steps; step >= 0; step -= 1) {
      body.lineTo(xAt(step), seaRowY(layout.sea, row + 1, xAt(step)));
    }
    body.closePath();
    sea.push(body);
  }

  const polygons = (quads: readonly Projected[][]) => {
    const path = new Path2D();
    quads.forEach((quad) => polygon(path, quad));
    return path;
  };
  const cables = segmentsPath(layout.cables);

  const cars: IBridgeCar[] = layout.cars.map((car) => {
    const put = (dx: number, dy: number): Projected => [
      car.x + car.size * (dx * car.cos - dy * car.sin),
      car.y + car.size * (dx * car.sin + dy * car.cos),
    ];
    const rect = (
      path: Path2D,
      [px, py, w, h]: readonly [number, number, number, number],
    ) => {
      polygon(path, [
        put(px, py),
        put(px + w, py),
        put(px + w, py + h),
        put(px, py + h),
      ]);
    };
    const body = new Path2D();
    CAR_BODY.forEach((box) => rect(body, box));
    const dark = new Path2D();
    const wheels = new Path2D();
    const hubs = new Path2D();
    rect(dark, CAR_WINDOW);
    CAR_WHEELS.forEach((wheel) => {
      const [wx, wy] = put(wheel, CAR_WHEEL_Y);
      dark.moveTo(wx + CAR_TYRE * car.size, wy);
      dark.arc(wx, wy, CAR_TYRE * car.size, 0, Math.PI * 2);
      wheels.moveTo(wx + CAR_TYRE * car.size, wy);
      wheels.arc(wx, wy, CAR_TYRE * car.size, 0, Math.PI * 2);
      hubs.moveTo(wx + CAR_HUB * car.size, wy);
      hubs.arc(wx, wy, CAR_HUB * car.size, 0, Math.PI * 2);
    });
    return { body, dark, wheels, hubs, level: car.level, colour: car.colour };
  });

  return {
    shape: deck,
    deckTop: layout.deckTop,
    stars,
    brightStars,
    roadHalf,
    edges,
    dashes: segmentsPath(layout.dashes),
    members,
    footing,
    lampsOn: discsPath(
      [...layout.beacons, ...layout.lamps].filter(({ on }) => on),
    ),
    lampsOff: discsPath(
      [...layout.beacons, ...layout.lamps].filter(({ on }) => !on),
    ),
    lampCones: polygons(layout.lampCones),
    sea,
    horizon: layout.horizon,
    horizonHaze: layout.horizonHaze,
    towers: polygons(layout.towers),
    towersBelow: polygons(layout.towersBelow),
    bracing: segmentsPath(layout.bracing),
    bracingBelow: segmentsPath(layout.bracingBelow),
    piers: polygons(layout.piers),
    reflections: segmentsPath([...layout.streaks, ...layout.reflections]),
    cables,
    hangers: segmentsPath(layout.hangers),
    cars,
    fireworks: createFireworkPaths(layout.fireworks),
    thump: layout.thump,
    bass: layout.bass,
    layout,
  };
};

export type TrussBridgePaths = ReturnType<typeof createTrussBridgePaths>;

import type { Projected } from 'common/graphStyles';
import { getEaseFactor } from 'common/smoothing';
import createTrussRoad from 'common/graphTruss';
import { vehicleSize } from 'common/graphRoad';
import {
  createFireworkPaths,
  fireworkLayout,
  IRocket,
  ROCKET_CLIMB,
  shellFor,
  shellLife,
} from './bridgeFireworks';

export type { IFirework, IRocket } from './bridgeFireworks';
export { ROCKET_CLIMB, SHELL_KINDS } from './bridgeFireworks';

/**
 * The bridge at night: a suspension bridge.
 *
 * The deck is the figure — the spectrum smoothed into a road profile,
 * held to the middle 60% of the plot and eased with a 120ms half-life on
 * top of the look's ballistics: enough that it visibly rides the music,
 * not so much that a bridge becomes a rope, which in fullscreen it was.
 * A beat drops the whole deck a few pixels on its springs and bobs the
 * cars, flares the cables and blinks the beacons on the tower tops. Two towers
 * of equal height stand on piers a quarter in from each end, braced with
 * X-frames; main cables run from anchor blocks at the ends up over the
 * towers and drape between them in a parabola whose low point clears the
 * deck; hangers drop from the cable to the deck at every joint. Under the
 * deck a stiffening truss is drawn in four bands of brightness, the
 * members fading toward their footings — and each member stands on a
 * band of the spectrum and burns with that band's level, so the bass end
 * of the truss lights up on a kick and the treble end on a hi-hat, and
 * the whole structure glows wider on the beat.
 *
 * Under the truss is the sea: swells in perspective receding to a horizon
 * behind the bridge, each a strip of water in the look's colour, deeper
 * the nearer, the swell rising with the bass. The
 * truss is open in both variants; filled, the towers and piers go solid
 * in the look's colour, and nothing is painted under the deck, which as a
 * body hid the water and read as a slab.
 *
 * The deck is a road: an asphalt band with light edges, and the cars sit
 * on its top edge. Lamps hang where each hanger meets the cable, the way a
 * suspension bridge is lit; each beat blinks half of them, alternating,
 * with the beacons on the tower caps. Four cars cross one way at a stroll — twenty-four seconds a
 * crossing — each in its own colour off the app's spectrum, scaled from the
 * plot's height so fullscreen keeps their proportion. Each car answers the
 * rhythm — every car swells a little and its whole outline glows on the
 * beat and with the bass, together, with only a touch of the band under it
 * — so the traffic pulses with the song rather than four cars twitching to
 * four different bins. The rockets answer
 * the TREBLE: a jump in the top 40% of the bands — a cymbal, a hi-hat, a
 * snare's crack — launches one from the deck, and it bursts in the sky in
 * one of six kinds of shell — peony, chrysanthemum, willow, ring, palm,
 * crackle — in its own rainbow hue; a hard hit launches two, and the
 * harder the hit the bigger the shell. The lamps and the deck answer the
 * whole mix, so the bass drives the bridge and the highs light the sky. The sparks also breathe with the level, so a burst
 * over a loud passage burns brighter than one over a quiet bar.
 *
 * Decided once per frame, before the curves, so a mirrored wave shows the
 * same lamps and fireworks without deciding them twice.
 */

/** A member fades over four bands from the deck to its footing. */
export const FADE_BANDS = 4;
/** And burns at one of three strengths: quiet, middling, loud. */
export const LEVEL_BINS = 3;
/**
 * How many shells may be in the sky at once.
 *
 * Eight was more than the treble ever fills and every one of them is a
 * few hundred segments of stroking on a full-screen canvas. Five reads as
 * a busy sky and costs a third less.
 */
const ROCKET_LIMIT = 5;
/**
 * Stars over the bridge: seeded, twinkling, flaring on the beat, over the
 * plot and a plot's width past each end, so the sky reaches whatever panel
 * margins there are.
 *
 * The sky is the window now, not the top of the plot, so the same count
 * spread over three or four times the area and read as an empty night.
 * They are small arcs in two fills and cost nothing measurable.
 */
const STARS = 340;
/**
 * The sea: rows of swell, and samples per row.
 *
 * Every row is a translucent fill the width of the scene, and blending
 * those is the whole of what this look costs to raster: fourteen rows at
 * a hundred and twenty samples each held the bridge at three times the
 * frame budget on a 1440p screen while the profile showed the script
 * idle. Nine rows read as the same water and cost a third of it.
 */
export const SEA_ROWS = 9;
const SEA_STEPS = 22;
/**
 * How far the deck and its truss carry on past the plot, as a fraction of
 * its width.
 *
 * A full plot width each way tripled the length of every member, and
 * stroking that truss was five milliseconds a frame on a full screen — for
 * structure that lives outside the panel and nobody sees. A third still
 * clears any margin the panel has at any window size.
 */
export const DECK_REACH = 0.35;
/**
 * How far past the plot the water goes: as far as the deck, so the bridge
 * never runs out over nothing.
 *
 * Only the stars go further. The sea has no reason to, because it is a
 * flat body and nobody can tell where it stops beyond the panel's own
 * margin — and every pixel of it is blended.
 */
const SEA_REACH = DECK_REACH;
/** Where the horizon sits, as a fraction of the plot's depth from the top. */
const SEA_HORIZON = 0.6;
/** One crossing of the deck takes this long, in seconds of bridge clock. */
export const CROSSING_SECONDS = 24;
/** The cars, one colour each: four steps around the app's spectrum. */
export const CAR_COLOURS = ['#77efdb', '#f7cf76', '#ed93c7', '#9bbcff'];
/** How long the deck takes to close half the distance to the music. */
export const DECK_HALF_LIFE_MS = 120;

/**
 * How each part of the bridge is painted — its colour, how solid, how wide
 * — by the page's canvas and the engine's bridge alike. What answers the
 * music is a function of the beat (`thump`) and the bass.
 */
export const TRUSS_INKS = {
  /** Dim stars, then the twinkling ones, which flare with the beat. */
  stars: { dim: 0.3, bright: (thump: number) => 0.7 + thump * 0.3 },
  /**
   * The truss under the deck: four bands from the deck down, each fainter
   * than the one above, so the members sink into the dark; within each,
   * the members whose band is loud burn brighter, and on a beat the whole
   * truss glows wider for a moment.
   */
  member: {
    width: (stroke: number) => Math.max(1, stroke * 0.7),
    fade: (depth: number) => 0.9 - (depth / FADE_BANDS) * 0.75,
    burn: (bin: number) => 0.45 + (bin / (LEVEL_BINS - 1)) * 0.75,
    glowWiden: 5,
    glowAlpha: 0.35,
  },
  footing: 0.25,
  /**
   * The sea: each swell a strip of the look's colour, faint at the horizon
   * and deeper as it nears, every other one a shade darker so the swells
   * read against each other without a line on the water, brighter with the
   * bass that lifts it.
   */
  sea: (row: number, bass: number) =>
    (0.06 + ((row + 1) / SEA_ROWS) * 0.3) *
    (row % 2 === 0 ? 1 : 0.7) *
    (0.8 + bass * 0.5),
  /**
   * A band of haze sitting on the waterline, thicker with the bass: from
   * its top down past the horizon, white rising to its strongest near the
   * waterline and gone again under it.
   */
  haze: {
    stops: [
      { at: 0, alpha: 0 },
      { at: 0.72, alpha: 0.1 },
      { at: 1, alpha: 0 },
    ],
    below: 0.4,
    alpha: (bass: number) => 0.5 + bass * 0.5,
  },
  horizon: { width: 1, alpha: 0.22 },
  /**
   * Piers and towers standing in the water: dark silhouettes edged in the
   * look's colour, or solid in the colour when filled.
   */
  body: { filled: 0.95, open: 0.7, openColour: '#000' },
  outline: { width: 1.2, piers: 0.7, towers: 0.9 },
  bracing: { width: 0.9, alpha: 0.55 },
  hangers: { width: 0.8, alpha: 0.4 },
  /**
   * The cables pump with the bass: a fine wire that thickens a little and
   * brightens with the kick, with a narrow tint of the look's colour under
   * it — a wide glow here eclipsed the rest of the scene.
   */
  cable: {
    tintWidth: (bass: number) => 2 + bass * 2.5,
    tintAlpha: (bass: number) => 0.12 + bass * 0.25,
    wireWidth: (bass: number, thump: number) => 1 + bass * 1.2 + thump * 0.5,
    wireAlpha: (bass: number, thump: number) =>
      0.45 + bass * 0.45 + thump * 0.1,
  },
  /** The asphalt over the deck line, with light edges and a centre line. */
  asphalt: { colour: '#000', alpha: 0.65 },
  edge: { width: 1, alpha: 0.2 },
  dash: {
    width: (roadHalf: number) => Math.max(1, roadHalf * 0.3),
    alpha: 0.7,
  },
  car: {
    /**
     * The car's own shape glows: a wide soft stroke of its body in its
     * colour, then a tighter one, both with the band under it.
     */
    glow: [
      { width: (level: number) => 6 + level * 10, alpha: 0.22 },
      { width: (level: number) => 2 + level * 4, alpha: 0.4 },
    ],
    dark: '#10242c',
    /**
     * Stroked, the car is a wireframe like the bridge it drives on: its
     * outline and its windows in its colour, nothing solid.
     */
    outline: 1.2,
    darkOutline: 0.7,
    /** The wheels: a light rim round the tyre and a hub in the middle. */
    rim: { width: 1, alpha: 0.4 },
    hub: 0.9,
  },
  /**
   * The light the lamps throw onto the road, under the lamps themselves: a
   * lit bridge, rather than beads on a wire. The lit half flares on the
   * beat and settles back over 250ms.
   */
  cone: (thump: number) => 0.05 + thump * 0.05,
  lampOff: 0.35,
  lampOn: (thump: number) => 0.45 + thump * 0.55,
  /** The lights on the water under the bridge, shimmering. */
  reflection: { width: 1, alpha: (thump: number) => 0.12 + thump * 0.12 },
  firework: {
    reflectionWidth: 1.6,
    reflectionLightness: 66,
    flash: 0.7,
    twinkle: { width: 2.2, alpha: 0.9 },
  },
};

export interface IBridgeCar {
  body: Path2D;
  /** Windows and wheels, painted dark over the body. */
  dark: Path2D;
  /** The tyres alone, for a light rim round each. */
  wheels: Path2D;
  /** A hub in each wheel, in the car's colour. */
  hubs: Path2D;
  /** 0..1: how much this car's band is playing right now. */
  level: number;
  colour: string;
}

export const createTrussBridge = () => ({
  beatLevel: 0,
  /** The treble tracker, for the rockets. */
  trebleLevel: 0,
  /** The bass, eased fast, for the cables: 0 at rest, 1 at full. */
  bass: 0,
  trackedAt: -1,
  blinkAt: -1,
  /** Which half of the lamps the last beat lit: 0 or 1. */
  blinkParity: 0,
  glow: 0,
  rockets: [] as IRocket[],
  /** How many rockets have ever launched, to seed each one differently. */
  launched: 0,
  /** The deck's eased heights, one per column, in plot pixels. */
  deck: [] as number[],
});
export type TrussBridge = ReturnType<typeof createTrussBridge>;

/** A cheap deterministic hash in [0, 1). */
const noise = (seed: number) => {
  const v = Math.sin(seed * 12.9898) * 43758.5453;
  return v - Math.floor(v);
};

/**
 * Where the deck wants to be: the road profile, flattened to mid-plot.
 *
 * Smoothed wide first — six columns each side, weighted to the centre — so
 * the deck is a long sweep rather than a wobble of every FFT bin. The
 * timing is not touched here: it still answers the music as fast as the
 * look's ballistics allow; only the SHAPE is calm.
 */
export const deckTarget = (
  columns: readonly Projected[],
  top: number,
  bottom: number,
): Projected[] => {
  const height = Math.max(1, bottom - top);
  const swept: Projected[] = columns.map(([x], index) => {
    let sum = 0;
    let weight = 0;
    for (let offset = -6; offset <= 6; offset += 1) {
      const at = Math.max(0, Math.min(columns.length - 1, index + offset));
      const mix = 7 - Math.abs(offset);
      sum += columns[at][1] * mix;
      weight += mix;
    }
    return [x, sum / weight];
  });
  return createTrussRoad(swept).map(([x, y]) => [
    x,
    top + height * 0.3 + (y - top) * 0.6,
  ]);
};

export const advanceTrussBridge = (
  state: TrussBridge,
  /** The eased trace, for the deck's shape. */
  columns: readonly Projected[],
  /** The live frame, for everything that has to land ON the beat. */
  live: readonly Projected[],
  top: number,
  bottom: number,
  seconds: number,
  playing: boolean,
) => {
  const target = deckTarget(columns, top, bottom);
  if (state.deck.length !== target.length) {
    state.deck = target.map(([, y]) => y);
  }
  if (!playing || columns.length < 2) {
    return;
  }
  const elapsedMs =
    state.trackedAt < 0 ? 0 : Math.max(0, seconds - state.trackedAt) * 1000;
  state.trackedAt = seconds;
  const settle = getEaseFactor(elapsedMs, DECK_HALF_LIFE_MS);
  target.forEach(([, y], index) => {
    state.deck[index] += (y - state.deck[index]) * settle;
  });
  state.rockets = state.rockets.filter(
    (rocket) => seconds - rocket.at <= ROCKET_CLIMB + shellLife(rocket.kind),
  );
  // The beat, the bass and the treble are read from the LIVE frame, not
  // the eased trace: the trace's attack and release are a look's choice,
  // and a hit read through them arrived late and soft.
  const depth = Math.max(1, bottom - top);
  const mean =
    live.reduce(
      (sum, [, y]) => sum + Math.max(0, Math.min(1, (bottom - y) / depth)),
      0,
    ) / Math.max(1, live.length);
  // The bass: the bottom 30% of the bands, eased over 25ms — quick enough
  // to follow a kick, just enough to keep it from flickering.
  const bassTo = Math.max(1, Math.floor(live.length * 0.3));
  const bass =
    live
      .slice(0, bassTo)
      .reduce(
        (sum, [, y]) => sum + Math.max(0, Math.min(1, (bottom - y) / depth)),
        0,
      ) / bassTo;
  state.bass += (bass - state.bass) * getEaseFactor(elapsedMs, 25);
  // The treble: the top 40% of the bands, the cymbals' and hi-hats' end.
  const trebleFrom = Math.floor(live.length * 0.6);
  const treble =
    live
      .slice(trebleFrom)
      .reduce(
        (sum, [, y]) => sum + Math.max(0, Math.min(1, (bottom - y) / depth)),
        0,
      ) / Math.max(1, live.length - trebleFrom);
  const jump = mean - state.beatLevel;
  if (jump >= 0.05) {
    state.blinkAt = seconds;
    state.blinkParity = 1 - state.blinkParity;
  }
  // Relative to the treble's own recent level, not an absolute jump: the
  // highs sit far below the bass on this plot, so a hi-hat is a small
  // move in absolute terms and a large one against what came before it.
  const crack = treble - state.trebleLevel;
  const relative = crack / Math.max(0.03, state.trebleLevel);
  if (crack >= 0.02 && relative >= 0.35) {
    const left = columns[0][0];
    const width = columns[columns.length - 1][0] - left;
    const deckTop = Math.min(...state.deck);
    const sky = Math.max(1, deckTop - top);
    const strength = Math.min(1, relative / 1.5);
    // One rocket a crack; a hard one sends two, staggered by 120ms and of
    // different kinds and hues, so the big hits read as a volley.
    const salvo = strength > 0.6 ? 2 : 1;
    for (let shot = 0; shot < salvo; shot += 1) {
      const seed = state.launched;
      state.launched += 1;
      state.rockets.unshift({
        kind: shellFor(seed),
        x: left + width * (0.1 + noise(seed * 3 + 1) * 0.8),
        burstY: top + sky * (0.1 + noise(seed * 3 + 2) * 0.45),
        launchY: deckTop,
        at: seconds + shot * 0.12,
        hue: (seed * 137.5) % 360,
        strength,
      });
    }
    if (state.rockets.length > ROCKET_LIMIT) {
      state.rockets.length = ROCKET_LIMIT;
    }
  }
  const release = 1 - getEaseFactor(elapsedMs, 110);
  state.beatLevel = Math.max(mean, state.beatLevel * release);
  state.trebleLevel = Math.max(treble, state.trebleLevel * release);
  state.glow += (mean - state.glow) * getEaseFactor(elapsedMs, 90);
};

/** 1 at the blink, 0 once it is over, 250ms later. */
export const lampBlink = (state: TrussBridge, seconds: number) => {
  const age = (seconds - state.blinkAt) / 0.25;
  return state.blinkAt < 0 || age < 0 || age > 1 ? 0 : 1 - age;
};

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

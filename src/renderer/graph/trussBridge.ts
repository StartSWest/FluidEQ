import type { Projected } from 'common/graphStyles';
import { getEaseFactor } from 'common/smoothing';
import createTrussRoad from 'common/graphTruss';
import { vehicleSize } from 'common/graphRoad';
import {
  createFireworkPaths,
  IFirework,
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

  // The deck: the figure.
  const deck = new Path2D();
  if (road.length >= 2) {
    deck.moveTo(road[0][0], road[0][1]);
    road.slice(1).forEach(([x, y]) => deck.lineTo(x, y));
  }

  // The stiffening truss under the deck: posts and alternating diagonals
  // from the joints to the floor, each cut into FADE_BANDS pieces.
  const joints = road.filter((_p, index) => index % 8 === 0);
  // members[fade][bin]: cut by depth for the fade, grouped by the level of
  // the band under the member's joint for the beat.
  const members = Array.from({ length: FADE_BANDS }, () =>
    Array.from({ length: LEVEL_BINS }, () => new Path2D()),
  );
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
  const member = (a: Projected, b: Projected) => {
    const bin = levelBin(a[0]);
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
  };
  const lampsOn = new Path2D();
  const lampsOff = new Path2D();
  // What each lamp throws onto the road under it. Painted as one faint
  // fill, so a lit bridge reads as lit rather than as beads on a wire.
  const lampCones = new Path2D();
  const lampR = Math.max(1.2, size * 1.1);
  // The road surface: half the asphalt's thickness, sized with the cars.
  const roadHalf = Math.max(2.5, size * 2.6);
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
  // The asphalt's edges, and the intermittent centre line between them,
  // for the painter to line: a dash every 2.3 dash-lengths along the road.
  const edges = new Path2D();
  const dashes = new Path2D();
  if (road.length >= 2) {
    // The lower edge only: the upper one is the deck line the look
    // already strokes, and drawing it twice read as a double rail.
    edges.moveTo(road[0][0], road[0][1] + roadHalf);
    road.slice(1).forEach(([x, y]) => edges.lineTo(x, y + roadHalf));
    const dash = Math.max(6, size * 9);
    for (
      let x = left - reach + dash;
      x < right + reach - dash;
      x += dash * 2.3
    ) {
      dashes.moveTo(x, deckAt(x));
      dashes.lineTo(x + dash, deckAt(x + dash));
    }
  }
  const footing = new Path2D();
  footing.moveTo(left - reach, baseline);
  footing.lineTo(right + reach, baseline);

  // The sky: stars from the top of the WINDOW down to the horizon — a
  // fixed sky, whatever the deck does under it, because a star field that
  // squeezed with the deck read as the sky beating — each twinkling at
  // its own rate; the lit ones flare with the beat.
  const stars = new Path2D();
  const brightStars = new Path2D();
  const skyTop = Math.min(frame.top, top);
  const skyDepth = Math.max(1, top + height * SEA_HORIZON - skyTop);
  for (let star = 0; star < STARS; star += 1) {
    const x = left - width + noise(star * 3 + 1) * width * 3;
    const y = skyTop + noise(star * 3 + 2) * skyDepth;
    const r = (0.6 + noise(star * 3 + 3) * 1.1) * Math.min(1.6, size);
    const twinkle = Math.sin(seconds * (1.2 + noise(star) * 3) + star) > 0.5;
    const target = twinkle ? brightStars : stars;
    target.moveTo(x + r, y);
    target.arc(x, y, r, 0, Math.PI * 2);
  }

  // The sea behind and under the bridge, in perspective: SEA_ROWS swells
  // from a horizon fixed in the sky's frame down past the floor, packed
  // toward the horizon the way distance packs them. Each swell is a strip
  // of water between one crest line and the next, a closed polygon, so
  // the sea is a body of colour, deeper the nearer the strip — no lines
  // on it. Each row travels across, longer and taller the nearer it is,
  // and the whole sea rises with the bass.
  const sea: Path2D[] = [];
  const horizon = top + height * SEA_HORIZON;
  {
    const nearest = Math.max(frame.bottom, baseline) + size * 6;
    const swell = 1 + state.bass * 1.6;
    const rowY = (row: number, x: number) => {
      const t = (row + 1) / SEA_ROWS;
      const rest = horizon + (nearest - horizon) * t ** 1.8;
      const amp = size * (0.35 + 3 * t) * swell;
      const k = 0.011 / (0.12 + t);
      return (
        rest -
        amp *
          (0.55 * Math.sin(x * k + seconds * 1.4 + row * 0.9) +
            0.45 * Math.sin(x * k * 2.3 - seconds * 2.1 + row * 1.7))
      );
    };
    // The row below the last one is flat, so the nearest strip reaches
    // the bottom of the overflow with no swell to leave a gap.
    const rowYOrFloor = (row: number, x: number) =>
      row < SEA_ROWS ? rowY(row, x) : nearest + size * 4;
    const seaReach = width * SEA_REACH;
    const seaLeft = left - seaReach;
    const seaWidth = width + seaReach * 2;
    const steps = SEA_STEPS * 3;
    for (let row = 0; row < SEA_ROWS; row += 1) {
      const body = new Path2D();
      body.moveTo(seaLeft, rowY(row, seaLeft));
      for (let step = 1; step <= steps; step += 1) {
        const x = seaLeft + (seaWidth * step) / steps;
        body.lineTo(x, rowY(row, x));
      }
      for (let step = steps; step >= 0; step -= 1) {
        const x = seaLeft + (seaWidth * step) / steps;
        body.lineTo(x, rowYOrFloor(row + 1, x));
      }
      body.closePath();
      sea.push(body);
    }
  }

  // The suspension: two towers on piers, the cables, the hangers.
  const towers = new Path2D();
  const towersBelow = new Path2D();
  const bracing = new Path2D();
  const bracingBelow = new Path2D();
  const piers = new Path2D();
  const reflections = new Path2D();
  const cables = new Path2D();
  const hangers = new Path2D();
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
        polygon(towers, [
          [legX(cut) - leg, deckHere],
          [legX(cut) + leg, deckHere],
          [legX(0) + leg, towerTop],
          [legX(0) - leg, towerTop],
        ]);
        polygon(towersBelow, [
          [legX(1) - leg, pierTop],
          [legX(1) + leg, pierTop],
          [legX(cut) + leg, deckHere],
          [legX(cut) - leg, deckHere],
        ]);
      });
      polygon(towers, [
        [x - spread * 0.85 - leg, towerTop],
        [x + spread * 0.85 + leg, towerTop],
        [x + spread * 0.85 + leg, towerTop + leg * 2.2],
        [x - spread * 0.85 - leg, towerTop + leg * 2.2],
      ]);
      const beaconR = lampR * 1.3;
      const beacon = state.blinkParity === 0 ? lampsOn : lampsOff;
      beacon.moveTo(x + beaconR, towerTop - beaconR - 1);
      beacon.arc(x, towerTop - beaconR - 1, beaconR, 0, Math.PI * 2);
      for (let f = 0.1; f < 0.95; f += 0.18) {
        const y0 = towerTop + tall * f;
        const y1 = towerTop + tall * Math.min(0.98, f + 0.18);
        const w0 = spread * (0.85 + 0.15 * f);
        const w1 = spread * (0.85 + 0.15 * Math.min(0.98, f + 0.18));
        const target = y0 < deckHere ? bracing : bracingBelow;
        target.moveTo(x - w0, y0);
        target.lineTo(x + w1, y1);
        target.moveTo(x + w0, y0);
        target.lineTo(x - w1, y1);
        target.moveTo(x - w0, y0);
        target.lineTo(x + w0, y0);
      }
      // The tower's reflection in the water: a streak under each leg,
      // wobbling with the clock, longer on a beat.
      [-1, 1].forEach((side) => {
        const rx = x + side * spread + Math.sin(seconds * 2.3 + side) * 1.5;
        reflections.moveTo(rx, baseline + 2);
        reflections.lineTo(rx, baseline + size * (10 + thump * 8));
      });
      // The pier: a foundation block wider than the tower, in the water.
      polygon(piers, [
        [x - pierHalf, baseline],
        [x + pierHalf, baseline],
        [x + pierHalf * 0.8, pierTop],
        [x - pierHalf * 0.8, pierTop],
      ]);
    });
    // Anchor blocks at the ends of the deck.
    [left, right].forEach((x, index) => {
      const dir = index === 0 ? 1 : -1;
      polygon(piers, [
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
    const side = (from: number, to: number) => {
      for (let step = 0; step <= 12; step += 1) {
        const x = from + (to - from) * (step / 12);
        const y = sideAt(from, to, x);
        if (step === 0) {
          cables.moveTo(x, y);
        } else {
          cables.lineTo(x, y);
        }
      }
    };
    side(left, towerX[0]);
    for (let x = towerX[0]; x <= towerX[1]; x += Math.max(4, width / 96)) {
      cables.lineTo(x, cableAt(x));
    }
    cables.lineTo(towerX[1], towerTop);
    side(right, towerX[1]);
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
        hangers.moveTo(x, y);
        hangers.lineTo(x, deckAt(x) - roadHalf);
        // The lamp's light on the water below it.
        const wobble = Math.sin(seconds * 3.1 + x * 0.05) * 1.2;
        reflections.moveTo(x + wobble, baseline + 2);
        reflections.lineTo(x - wobble, baseline + size * (4 + thump * 4));
        // A lamp where the hanger meets the cable, and its cone of light
        // down onto the deck: a narrow wedge from the lamp to a pool the
        // width of a car on the road.
        const target = hanger % 2 === state.blinkParity ? lampsOn : lampsOff;
        target.moveTo(x + lampR, y);
        target.arc(x, y, lampR, 0, Math.PI * 2);
        const roadY = deckAt(x) - roadHalf;
        const pool = size * 5;
        lampCones.moveTo(x - lampR, y);
        lampCones.lineTo(x + lampR, y);
        lampCones.lineTo(x + pool, roadY);
        lampCones.lineTo(x - pool, roadY);
        lampCones.closePath();
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
  const cars: IBridgeCar[] = CAR_COLOURS.map((colour, index) => {
    const x = left + ((phase + index / CAR_COLOURS.length) % 1) * width;
    const level = Math.min(
      1,
      Math.max(state.bass, thump) * 0.8 + levelAt(x) * 0.2,
    );
    // It swells up to a fifth with the rhythm.
    const carSize = size * (1 + level * 0.2);
    let at = 1;
    while (at < road.length - 1 && road[at][0] < x) {
      at += 1;
    }
    const [ax, ay] = road[at - 1];
    const [bx, by] = road[at];
    const mix = (x - ax) / Math.max(0.001, bx - ax);
    const angle = Math.atan2(by - ay, bx - ax);
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    // On the top edge of the asphalt, measured along the road's normal.
    const y = ay + (by - ay) * mix - roadHalf * cos;
    const put = (dx: number, dy: number): Projected => [
      x + carSize * (dx * cos - dy * sin),
      y + carSize * (dx * sin + dy * cos),
    ];
    const rect = (
      path: Path2D,
      px: number,
      py: number,
      w: number,
      h: number,
    ) => {
      polygon(path, [
        put(px, py),
        put(px + w, py),
        put(px + w, py + h),
        put(px, py + h),
      ]);
    };
    const body = new Path2D();
    rect(body, -9, -8, 18, 5);
    rect(body, -5, -12, 10, 5);
    const dark = new Path2D();
    const wheels = new Path2D();
    const hubs = new Path2D();
    rect(dark, -3, -11, 6, 3);
    [-5, 5].forEach((wheel) => {
      const [wx, wy] = put(wheel, -2.7);
      dark.moveTo(wx + 2.7 * carSize, wy);
      dark.arc(wx, wy, 2.7 * carSize, 0, Math.PI * 2);
      wheels.moveTo(wx + 2.7 * carSize, wy);
      wheels.arc(wx, wy, 2.7 * carSize, 0, Math.PI * 2);
      hubs.moveTo(wx + carSize, wy);
      hubs.arc(wx, wy, carSize, 0, Math.PI * 2);
    });
    return { body, dark, wheels, hubs, level, colour };
  });

  // Fireworks: their own module — see bridgeFireworks. The horizon goes
  // in so a burst over the water is mirrored in it.
  const fireworks: IFirework[] = createFireworkPaths(
    state.rockets,
    seconds,
    sizeHeight,
    horizon,
    state.glow,
  );

  return {
    shape: deck,
    deckTop: Math.min(...road.map(([, y]) => y)),
    stars,
    brightStars,
    roadHalf,
    edges,
    dashes,
    members,
    footing,
    lampsOn,
    lampsOff,
    lampCones,
    sea,
    horizon,
    /** How deep the haze over the waterline is, in pixels. */
    horizonHaze: size * (10 + state.bass * 14),
    towers,
    towersBelow,
    bracing,
    bracingBelow,
    piers,
    reflections,
    cables,
    hangers,
    cars,
    fireworks,
    thump,
    bass: state.bass,
  };
};

export type TrussBridgePaths = ReturnType<typeof createTrussBridgePaths>;

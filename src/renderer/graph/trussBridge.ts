import type { Projected } from 'common/graphStyles';
import { getEaseFactor } from 'common/smoothing';
import createTrussRoad from 'common/graphTruss';

import { IRocket, ROCKET_CLIMB, shellFor, shellLife } from './bridgeFireworks';

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
export const STARS = 340;
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
export const SEA_STEPS = 22;
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
export const SEA_REACH = DECK_REACH;
/** Where the horizon sits, as a fraction of the plot's depth from the top. */
export const SEA_HORIZON = 0.6;
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
export const noise = (seed: number) => {
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

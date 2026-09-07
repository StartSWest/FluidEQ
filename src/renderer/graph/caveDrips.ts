import type { Projected } from 'common/graphStyles';
import { getEaseFactor } from 'common/smoothing';
import { vehicleSize } from 'common/graphRoad';
import { stalactiteProfiles, IStalactite } from 'common/graphStalactites';

/**
 * The cave behind the Stalactites form.
 *
 * The spectrum hangs from a rock ceiling as calcite pendants; under them is
 * a pool that fills the bottom of the plot, and the whole thing lives on
 * water. A bead of water forms at every tip and swells — faster on a loud
 * band — until it is heavy enough to fall, and a hit on that band shakes
 * it loose early, so the drips keep the rhythm: a kick lets the bass end
 * go, a hi-hat the treble end, and a big beat drops every bead that has
 * grown. A drip falls under gravity, stretches with its speed, lands on
 * the pool at a depth of its own (the pool is seen from slightly above, so
 * a landing further in sits higher on the screen), throws a small splash,
 * and spreads two rings that widen and fade. The pool reflects the rock
 * above it, wobbling, and glows with the bass.
 *
 * Everything moves on the music-pace clock, so paused music is a still
 * cave with a bead hanging on every tip.
 */

interface IDrip {
  x: number;
  y: number;
  /** Downward speed, px per second of clock. */
  vy: number;
  radius: number;
  /** The pool y this drip lands on. */
  landing: number;
}

interface IRipple {
  x: number;
  y: number;
  bornAt: number;
  strength: number;
}

export interface CaveDrips {
  drips: IDrip[];
  ripples: IRipple[];
  /** Per column: how far the bead at the tip has grown, 0..1. */
  hangs: number[];
  /** Per column: the live level last frame, for the crack that lets a bead go. */
  levels: number[];
  mean: number;
  bass: number;
  thump: number;
  clock: number;
  profiles: IStalactite[];
  poolTop: number;
}

export const createCaveDrips = (): CaveDrips => ({
  drips: [],
  ripples: [],
  hangs: [],
  levels: [],
  mean: 0,
  bass: 0,
  thump: 0,
  clock: 0,
  profiles: [],
  poolTop: 0,
});

/**
 * The cave's own colours, for Auto: limestone from the wet roots down to
 * the pale calcite tips — the level ramp runs bottom to top, so the tips'
 * colour comes first — and the water and the ceiling rock beside them.
 */
export const CAVE_ROCK_COLOURS = ['#efe3c6', '#c8a674', '#6e4f33'];
export const CAVE_WATER = '#1f8aa0';
export const CAVE_CEILING = '#5b432c';

/** The pool takes the bottom of the plot, this fraction of its depth. */
export const POOL_DEPTH = 0.13;
/** A ripple's life in clock seconds; the splash is its first quarter second. */
const RIPPLE_LIFE = 1.8;
const SPLASH_LIFE = 0.25;
const DRIP_LIMIT = 40;
const RIPPLE_LIMIT = 32;
/** A bead lets go on its own at 1; a hit on the band lets it go from here. */
const HANG_TO_SHAKE = 0.35;
const HANG_TO_BIG_BEAT = 0.5;

const noise = (seed: number) => {
  const v = Math.sin(seed * 12.9898) * 43758.5453;
  return v - Math.floor(v);
};

const levelOf = (y: number, top: number, bottom: number) =>
  Math.max(0, Math.min(1, (bottom - y) / Math.max(1, bottom - top)));

/**
 * Advance the cave by the clock: beads grow and fall, drips fly, ripples
 * age. `columns` is the eased trace (the rock), `live` the raw frame (the
 * beat), both in scene space.
 */
export const advanceCaveDrips = (
  state: CaveDrips,
  columns: readonly Projected[],
  live: readonly Projected[],
  top: number,
  bottom: number,
  seconds: number,
  playing: boolean,
  gap: number,
  sizeHeight: number,
) => {
  const size = vehicleSize(sizeHeight);
  const depth = Math.max(1, bottom - top);
  const dt = Math.max(0, Math.min(0.1, seconds - state.clock));
  const elapsedMs = dt * 1000;

  // The pool and the rock. Tips stop a bead's height above the water.
  state.poolTop = bottom - depth * POOL_DEPTH;
  const dripR = 1.6 * size;
  state.profiles = stalactiteProfiles(
    columns,
    state.poolTop - dripR * 2.5,
    top,
    gap,
  );

  // Paused, the cave stands still: the rock and the pool follow the trace,
  // nothing else moves and the clock is not read, so a bead, a drip and a
  // ripple are exactly where they were when the music comes back.
  if (!playing) {
    return;
  }
  state.clock = seconds;

  // The beat and the bass, read from the live frame.
  const levels = live.map(([, y]) => levelOf(y, top, bottom));
  const mean =
    levels.reduce((sum, v) => sum + v, 0) / Math.max(1, levels.length);
  const crack = mean - state.mean;
  state.mean = mean;
  const bassTo = Math.max(1, Math.floor(levels.length * 0.3));
  const bass = levels.slice(0, bassTo).reduce((s, v) => s + v, 0) / bassTo;
  state.bass += (bass - state.bass) * getEaseFactor(elapsedMs, 25);
  const bigBeat = playing && crack >= 0.05 && mean >= 0.2;
  if (bigBeat) {
    state.thump = 1;
  } else {
    state.thump *= 1 - getEaseFactor(elapsedMs, 140);
  }

  // Beads: every tip grows one, faster where the band is loud; a hit on
  // the band shakes it loose, a big beat shakes every grown one loose.
  if (state.hangs.length !== columns.length) {
    state.hangs = columns.map((_, index) => noise(index + 0.5) * 0.6);
    state.levels = levels.slice();
  }
  const byColumn = new Map(state.profiles.map((p) => [p.column, p]));
  columns.forEach((_, index) => {
    const level = levels[index] ?? 0;
    const rise = level - (state.levels[index] ?? 0);
    state.levels[index] = level;
    const profile = byColumn.get(index);
    if (!profile || !playing) {
      return;
    }
    state.hangs[index] += dt * (0.12 + level * 1.4);
    const hang = state.hangs[index];
    const shaken = rise >= 0.12 && hang >= HANG_TO_SHAKE;
    const dropped = bigBeat && hang >= HANG_TO_BIG_BEAT;
    if (hang >= 1 || shaken || dropped) {
      state.hangs[index] = 0;
      if (state.drips.length < DRIP_LIMIT) {
        const [tx, ty] = profile.tip;
        state.drips.push({
          x: tx,
          y: ty + dripR,
          vy: 0,
          radius: dripR * (0.7 + Math.min(1, hang) * 0.5),
          // Seen from slightly above: the landing's depth into the pool.
          landing:
            state.poolTop +
            depth * POOL_DEPTH * (0.15 + noise(index + 7) * 0.7),
        });
      }
    }
  });

  // Drips fall; a landing becomes a ripple.
  const gravity = depth * 2.6;
  state.drips = state.drips.filter((drip) => {
    drip.vy += gravity * dt;
    drip.y += drip.vy * dt;
    if (drip.y < drip.landing) {
      return true;
    }
    if (state.ripples.length >= RIPPLE_LIMIT) {
      state.ripples.shift();
    }
    state.ripples.push({
      x: drip.x,
      y: drip.landing,
      bornAt: seconds,
      strength: Math.min(1, drip.radius / (dripR * 1.2)),
    });
    return false;
  });
  state.ripples = state.ripples.filter(
    (ripple) => seconds - ripple.bornAt < RIPPLE_LIFE,
  );
};

const polygon = (path: Path2D, vertices: readonly Projected[]) => {
  path.moveTo(vertices[0][0], vertices[0][1]);
  for (let index = 1; index < vertices.length; index += 1) {
    path.lineTo(vertices[index][0], vertices[index][1]);
  }
  path.closePath();
};

export interface RippleBand {
  path: Path2D;
  alpha: number;
}

/** Three alpha bands for the rings, so they are three strokes, not thirty. */
const RIPPLE_BANDS = [0.9, 0.55, 0.22];

export const createCaveDripsPaths = (
  state: CaveDrips,
  columns: readonly Projected[],
  top: number,
  bottom: number,
  seconds: number,
  sizeHeight: number,
) => {
  const left = columns[0]?.[0] ?? 0;
  const right = columns[columns.length - 1]?.[0] ?? 1;
  const width = Math.max(1, right - left);
  const depth = Math.max(1, bottom - top);
  const size = vehicleSize(sizeHeight);
  const { poolTop } = state;

  // The rock: every stalactite's outline is the figure; the shade and the
  // wet highlight are painted over it.
  const shape = new Path2D();
  const shade = new Path2D();
  const light = new Path2D();
  const reflections = new Path2D();
  // The growth bands: calcite builds in rings, so a few faint lines run
  // across each stalactite where the flank swells.
  const bands = new Path2D();
  const wobble = (x: number) =>
    Math.sin(seconds * 2.2 + x * 0.045) * size * 0.7;
  state.profiles.forEach((profile) => {
    polygon(shape, profile.outline);
    polygon(shade, profile.shade);
    if (profile.light.length >= 3) {
      polygon(light, profile.light);
    }
    const last = profile.outline.length - 1;
    [2, 4, 6, 8].forEach((level) => {
      const [lx, ly] = profile.outline[level];
      const [rx] = profile.outline[last - level];
      bands.moveTo(lx, ly);
      bands.lineTo(rx, ly + (rx - lx) * 0.12);
    });
    // Its reflection in the pool: mirrored about the surface, squashed,
    // and wobbling with the water.
    polygon(
      reflections,
      profile.outline.map(([x, y]) => [
        x + wobble(y),
        poolTop + (poolTop - y) * 0.25,
      ]),
    );
  });

  // The cave closes on every side. The plot sits inside a panel with
  // margins for its axes, and a scene is allowed to overflow, so the rock
  // and the water run a whole plot's width past both ends: whatever the
  // panel's margins are, they are cave.
  const reach = width;

  // The ceiling: a band of rock along the top with a ragged lower edge,
  // the stalactites growing out from under it, and a few dark cracks
  // across it. No walls: the sides stay open to the dark.
  const ceiling = new Path2D();
  const cracks = new Path2D();
  {
    const band = depth * 0.09;
    const step = width / 48;
    ceiling.moveTo(left - reach, top - reach);
    ceiling.lineTo(right + reach, top - reach);
    ceiling.lineTo(right + reach, top + band);
    for (let i = 48; i >= 0; i -= 1) {
      const x = left + step * i;
      const bump =
        band * (0.55 + 0.3 * noise(i * 3.1) + 0.15 * Math.sin(i * 1.7));
      ceiling.lineTo(x, top + bump);
    }
    ceiling.lineTo(left - reach, top + band);
    ceiling.closePath();
    for (let i = 0; i < 7; i += 1) {
      const x = left + width * noise(i * 5.3 + 1);
      const run = width * (0.02 + noise(i * 2.7) * 0.05);
      cracks.moveTo(x, top);
      cracks.lineTo(x + run * 0.4, top + band * 0.4);
      cracks.lineTo(x + run, top + band * 0.75);
    }
  }

  // The pool: its body from the surface to past the floor, and its
  // surface line, both out past the ends.
  const pool = new Path2D();
  pool.rect(left - reach, poolTop, width + reach * 2, bottom - poolTop + reach);
  const surface = new Path2D();
  surface.moveTo(left - reach, poolTop);
  surface.lineTo(right + reach, poolTop);

  // The beads at the tips, swelling as they grow.
  const beads = new Path2D();
  const dripR = 1.6 * size;
  state.profiles.forEach((profile) => {
    const hang = Math.min(1, state.hangs[profile.column] ?? 0);
    const r = dripR * (0.25 + hang * 0.75);
    const [x, y] = profile.tip;
    beads.moveTo(x + r, y + r * 0.6);
    beads.arc(x, y + r * 0.6, r, 0, Math.PI * 2);
  });

  // The drips in flight, stretched by their speed, each with a shine.
  const drips = new Path2D();
  const shine = new Path2D();
  state.drips.forEach((drip) => {
    const stretch = 1 + Math.min(1.6, drip.vy / (depth * 1.1));
    // A moveTo first: an ellipse continues the path from wherever it was.
    drips.moveTo(drip.x + drip.radius, drip.y);
    drips.ellipse(
      drip.x,
      drip.y,
      drip.radius,
      drip.radius * stretch,
      0,
      0,
      Math.PI * 2,
    );
    drips.closePath();
    const s = drip.radius * 0.3;
    shine.moveTo(drip.x - drip.radius * 0.35 + s, drip.y - drip.radius * 0.3);
    shine.arc(
      drip.x - drip.radius * 0.35,
      drip.y - drip.radius * 0.3,
      s,
      0,
      Math.PI * 2,
    );
  });

  // The rings, two per landing, widening and fading, in three bands; and
  // the splash: a crown of short lines in the first quarter second.
  const ripples: RippleBand[] = RIPPLE_BANDS.map((alpha) => ({
    path: new Path2D(),
    alpha,
  }));
  const splash = new Path2D();
  state.ripples.forEach((ripple) => {
    const age = seconds - ripple.bornAt;
    const life = Math.max(0, 1 - age / RIPPLE_LIFE);
    const band = ripples[Math.min(2, Math.floor((1 - life) * 3))];
    [0, 0.22].forEach((delay) => {
      const a = age - delay;
      if (a <= 0) {
        return;
      }
      const rx = size * (2 + a * 22) * (0.6 + ripple.strength * 0.4);
      band.path.moveTo(ripple.x + rx, ripple.y);
      band.path.ellipse(ripple.x, ripple.y, rx, rx * 0.22, 0, 0, Math.PI * 2);
      band.path.closePath();
    });
    if (age < SPLASH_LIFE) {
      const rise = size * 4 * Math.sin((age / SPLASH_LIFE) * Math.PI);
      [-1, -0.4, 0.4, 1].forEach((side) => {
        splash.moveTo(ripple.x, ripple.y);
        splash.lineTo(
          ripple.x + side * size * 1.5,
          ripple.y - rise * (1 - Math.abs(side) * 0.3),
        );
      });
    }
  });

  return {
    shape,
    shade,
    light,
    bands,
    reflections,
    ceiling,
    cracks,
    pool,
    surface,
    beads,
    drips,
    shine,
    ripples,
    splash,
    poolTop,
    bass: state.bass,
    thump: state.thump,
  };
};

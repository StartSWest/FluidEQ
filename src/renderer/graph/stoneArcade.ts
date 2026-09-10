import type { Projected } from 'common/graphStyles';
import { getEaseFactor } from 'common/smoothing';

/**
 * The aqueduct behind the Arches form.
 *
 * The spectrum is an arcade of stone: every band is an arch, as tall as
 * its band is loud, on piers that stand in a river. Each arch is a ring
 * of voussoirs round its opening with a keystone at the crown, the piers
 * are coursed masonry with a capital under the springing, and a parapet
 * runs along the crowns. The arcade carries on level past both ends of
 * the plot, because the panel has margins and a scene may overflow.
 *
 * Through every opening the evening shows: a sky in the look's colour
 * (the openings are the figure, so the palette paints what is seen
 * through the arches) with a lantern hung in each arch that flares when
 * its own band hits — the bass end on kicks, the treble end on hi-hats —
 * and embers that drift up out of the openings on treble cracks. Below,
 * the river reflects the arcade upside down, wobbling, and its surface
 * glows with the bass. Stars over the parapet twinkle on the clock; on a
 * big hit a flight of birds crosses the sky.
 *
 * All of it runs on the music-pace clock and reads the beat from the
 * live frame.
 */

interface IEmber {
  x: number;
  y: number;
  vx: number;
  vy: number;
  bornAt: number;
}

export interface StoneArcade {
  /** Per column: the eased arch height, in scene pixels from the floor. */
  rise: number[];
  /** Per column: the live level last frame, for the lantern flares. */
  levels: number[];
  /** Per column: when the lantern last flared. */
  flareAt: number[];
  embers: IEmber[];
  birdsAt: number;
  mean: number;
  trebleLevel: number;
  bass: number;
  thump: number;
  clock: number;
}

/**
 * The arcade's own colours, for Auto: the evening sky seen through the
 * arches as a level ramp (horizon first), sandstone for the wall, its
 * shadow, the mortar, and the river.
 */
export const ARCADE_SKY_COLOURS = ['#ff9a4a', '#ff5e7e', '#4b3a8f'];
export const ARCADE_STONE = '#c9a97a';
/** The wall as painted: sandstone already in evening shade. */
export const ARCADE_SHADE = '#a8865c';
export const ARCADE_MORTAR = '#3d2a17';
export const ARCADE_WATER = '#1f5f7a';

export const ARCH_HALF_LIFE_MS = 70;
export const EMBER_LIFE = 2.2;
export const BIRDS_CROSSING = 7;
const EMBER_LIMIT = 40;
export const RIVER_DEPTH = 0.14;

const noise = (seed: number) => {
  const v = Math.sin(seed * 12.9898) * 43758.5453;
  return v - Math.floor(v);
};

export const createStoneArcade = (): StoneArcade => ({
  rise: [],
  levels: [],
  flareAt: [],
  embers: [],
  birdsAt: -1,
  mean: 0,
  trebleLevel: 0,
  bass: 0,
  thump: 0,
  clock: 0,
});

const levelOf = (y: number, top: number, bottom: number) =>
  Math.max(0, Math.min(1, (bottom - y) / Math.max(1, bottom - top)));

/** The river's surface for a plot: the floor is under water. */
export const riverTop = (top: number, bottom: number) =>
  bottom - (bottom - top) * RIVER_DEPTH;

export const advanceStoneArcade = (
  state: StoneArcade,
  columns: readonly Projected[],
  live: readonly Projected[],
  top: number,
  bottom: number,
  seconds: number,
  playing: boolean,
) => {
  if (columns.length < 2) {
    return;
  }
  const depth = Math.max(1, bottom - top);
  const water = riverTop(top, bottom);
  // The arch heights follow the eased trace, from the water up, on a
  // short half-life of their own so the stone does not jitter.
  const target = columns.map(
    ([, y]) => Math.max(0, water - Math.max(top, y)) * 0.92,
  );
  if (state.rise.length !== columns.length) {
    state.rise = target.slice();
    state.levels = columns.map(() => 0);
    state.flareAt = columns.map(() => -1);
  }
  const dt = Math.max(0, Math.min(0.1, seconds - state.clock));
  const elapsedMs = dt * 1000;
  if (!playing) {
    return;
  }
  state.clock = seconds;
  const settle = getEaseFactor(elapsedMs, ARCH_HALF_LIFE_MS);
  target.forEach((value, index) => {
    state.rise[index] += (value - state.rise[index]) * settle;
  });

  // The beat, the bass and the treble from the live frame, and per band
  // the rise that flares its lantern.
  const levels = live.map(([, y]) => levelOf(y, top, bottom));
  const mean =
    levels.reduce((sum, v) => sum + v, 0) / Math.max(1, levels.length);
  const crack = mean - state.mean;
  state.mean = mean;
  const bassTo = Math.max(1, Math.floor(levels.length * 0.3));
  const bass = levels.slice(0, bassTo).reduce((s, v) => s + v, 0) / bassTo;
  state.bass += (bass - state.bass) * getEaseFactor(elapsedMs, 25);
  const trebleFrom = Math.floor(levels.length * 0.6);
  const treble =
    levels.slice(trebleFrom).reduce((s, v) => s + v, 0) /
    Math.max(1, levels.length - trebleFrom);
  if (crack >= 0.05 && mean >= 0.15) {
    state.thump = 1;
  } else {
    state.thump *= 1 - getEaseFactor(elapsedMs, 140);
  }
  levels.forEach((level, index) => {
    if (level - (state.levels[index] ?? 0) >= 0.12) {
      state.flareAt[index] = seconds;
    }
  });
  state.levels = levels;

  // Embers out of the openings on a treble crack, measured against the
  // treble's own recent level.
  const trebleCrack = treble - state.trebleLevel;
  const relative = trebleCrack / Math.max(0.03, state.trebleLevel);
  if (trebleCrack >= 0.02 && relative >= 0.35) {
    const burst = Math.min(6, EMBER_LIMIT - state.embers.length);
    for (let i = 0; i < burst; i += 1) {
      const seed = Math.floor(seconds * 13) * 7 + i;
      const column = Math.floor(noise(seed) * columns.length);
      const [x] = columns[column];
      state.embers.push({
        x,
        y: water - state.rise[column] * 0.5,
        vx: (noise(seed + 1) - 0.5) * depth * 0.08,
        vy: -depth * (0.12 + noise(seed + 2) * 0.12),
        bornAt: seconds,
      });
    }
  }
  state.embers = state.embers.filter((ember) => {
    ember.x += ember.vx * dt + Math.sin(seconds * 3 + ember.bornAt) * dt * 6;
    ember.y += ember.vy * dt;
    return seconds - ember.bornAt < EMBER_LIFE;
  });
  const release = 1 - getEaseFactor(elapsedMs, 110);
  state.trebleLevel = Math.max(treble, state.trebleLevel * release);

  // A big hit sends the birds across.
  if (crack >= 0.1 && mean >= 0.5 && seconds - state.birdsAt > BIRDS_CROSSING) {
    state.birdsAt = seconds;
  }
};

export interface IBand {
  path: Path2D;
  alpha: number;
}

const arch = (
  path: Path2D,
  x: number,
  half: number,
  base: number,
  rise: number,
) => {
  // A round-headed opening: straight jambs up to the springing, then a
  // semicircle-ish head drawn as two quadratics through the crown.
  const spring = base - Math.max(0, rise - half);
  const crown = base - rise;
  path.moveTo(x - half, base);
  path.lineTo(x - half, spring);
  path.quadraticCurveTo(x - half, crown, x, crown);
  path.quadraticCurveTo(x + half, crown, x + half, spring);
  path.lineTo(x + half, base);
  path.closePath();
};

export const createStoneArcadePaths = (
  state: StoneArcade,
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
  const step = width / Math.max(1, columns.length - 1);
  const size = Math.max(0.7, Math.min(3.2, sizeHeight / 230));
  const water = riverTop(top, bottom);
  // Past the ends only as far as a panel margin can be: a plot's width of
  // extra arches each side tripled the masonry and cost 8ms a frame.
  const reach = width * 0.12;

  // The arcade continues level past both ends at the end arches' heights,
  // at the same pitch.
  const approach = Math.ceil(reach / step);
  const arches: { x: number; rise: number; column: number }[] = [];
  for (let i = approach; i >= 1; i -= 1) {
    arches.push({ x: left - i * step, rise: state.rise[0] ?? 0, column: 0 });
  }
  columns.forEach(([x], index) => {
    arches.push({ x, rise: state.rise[index] ?? 0, column: index });
  });
  for (let i = 1; i <= approach; i += 1) {
    arches.push({
      x: right + i * step,
      rise: state.rise[columns.length - 1] ?? 0,
      column: columns.length - 1,
    });
  }

  const half = step * 0.36;
  const pierHalf = step * 0.5 - half;
  const minRise = half + size * 3;

  // The openings: the figure, painted in the palette as what shows
  // through the arches. The wall: everything else between the parapet and
  // the water, with the openings cut out (even-odd).
  const shape = new Path2D();
  const wall = new Path2D();
  const parapetY = (a: { rise: number }) => water - a.rise - size * 5;
  wall.moveTo(arches[0].x - step, water + size * 2);
  arches.forEach((a) => {
    wall.lineTo(a.x - step / 2, parapetY(a));
    wall.lineTo(a.x + step / 2, parapetY(a));
  });
  wall.lineTo(arches[arches.length - 1].x + step, water + size * 2);
  wall.closePath();
  arches.forEach((a) => {
    const rise = Math.max(minRise, a.rise);
    arch(shape, a.x, half, water, rise);
    arch(wall, a.x, half, water, rise);
  });

  // The masonry: voussoir joints round every arch head, the keystones,
  // the capitals at the springing, and the piers' courses.
  const joints = new Path2D();
  const keystones = new Path2D();
  const courses = new Path2D();
  const parapet = new Path2D();
  arches.forEach((a, i) => {
    const rise = Math.max(minRise, a.rise);
    const spring = water - Math.max(0, rise - half);
    const crown = water - rise;
    // Joints: lines from the opening's edge outward along the head.
    const ring = size * 4;
    for (let k = 1; k < 6; k += 1) {
      const t = k / 6;
      const angle = Math.PI * (1 - t);
      const cx = a.x + Math.cos(angle) * half;
      const cy = spring - Math.sin(angle) * (spring - crown);
      const ox = a.x + Math.cos(angle) * (half + ring);
      const oy = spring - Math.sin(angle) * (spring - crown + ring);
      joints.moveTo(cx, cy);
      joints.lineTo(ox, oy);
    }
    // The keystone: a wedge at the crown.
    keystones.moveTo(a.x - size * 1.6, crown - ring);
    keystones.lineTo(a.x + size * 1.6, crown - ring);
    keystones.lineTo(a.x + size * 1.1, crown + size * 0.5);
    keystones.lineTo(a.x - size * 1.1, crown + size * 0.5);
    keystones.closePath();
    // Capitals and courses on the pier to the right of this arch.
    const px = a.x + step / 2;
    courses.moveTo(px - pierHalf - size, spring);
    courses.lineTo(px + pierHalf + size, spring);
    courses.moveTo(px - pierHalf - size, spring + size * 3);
    courses.lineTo(px + pierHalf + size, spring + size * 3);
    for (let y = spring + size * 8; y < water; y += size * 9) {
      const shift = ((i + Math.round(y / (size * 9))) % 2) * pierHalf * 0.5;
      courses.moveTo(px - pierHalf, y);
      courses.lineTo(px + pierHalf, y);
      courses.moveTo(px - pierHalf + shift, y);
      courses.lineTo(px - pierHalf + shift, Math.min(water, y + size * 9));
    }
    // The parapet: a band along the crowns.
    const py = parapetY(a);
    parapet.moveTo(a.x - step / 2, py);
    parapet.lineTo(a.x + step / 2, py);
    parapet.moveTo(a.x - step / 2, py + size * 2.5);
    parapet.lineTo(a.x + step / 2, py + size * 2.5);
  });

  // The lanterns: one hung in each arch on the plot, flaring for a
  // quarter second after its band hits.
  const lanterns = new Path2D();
  const flares = new Path2D();
  const lanternR = Math.max(1.5, size * 1.8);
  columns.forEach(([x], index) => {
    const rise = Math.max(minRise, state.rise[index] ?? 0);
    const crown = water - rise;
    const ly = crown + size * 7;
    lanterns.moveTo(x, crown);
    lanterns.lineTo(x, ly - lanternR);
    lanterns.moveTo(x + lanternR, ly);
    lanterns.arc(x, ly, lanternR, 0, Math.PI * 2);
    const age = seconds - (state.flareAt[index] ?? -1);
    if (age < 0.25) {
      const r = lanternR * (1.5 + (1 - age / 0.25) * 3);
      flares.moveTo(x + r, ly);
      flares.arc(x, ly, r, 0, Math.PI * 2);
    }
  });

  // The embers, three brightness bands by age.
  const embers: IBand[] = [0.95, 0.6, 0.25].map((alpha) => ({
    path: new Path2D(),
    alpha,
  }));
  state.embers.forEach((ember) => {
    const age = (seconds - ember.bornAt) / EMBER_LIFE;
    const band = embers[Math.min(2, Math.floor(age * 3))];
    const r = size * (1.2 - age * 0.6);
    band.path.moveTo(ember.x + r, ember.y);
    band.path.arc(ember.x, ember.y, r, 0, Math.PI * 2);
  });

  // The river: its body from the surface down past the floor, and the
  // arcade's reflection in it, squashed and wobbling.
  const river = new Path2D();
  river.rect(left - width, water, width * 3, bottom - water + depth);
  const reflection = new Path2D();
  arches.forEach((a) => {
    const rise = Math.max(minRise, a.rise) * 0.3;
    const wobble = Math.sin(seconds * 2 + a.x * 0.03) * size;
    // Upside down: the opening's mirror hangs from the surface.
    const spring = water + Math.max(0, rise - half * 0.3);
    const crown = water + rise;
    reflection.moveTo(a.x - half + wobble, water);
    reflection.lineTo(a.x - half + wobble, spring);
    reflection.quadraticCurveTo(
      a.x - half + wobble,
      crown,
      a.x + wobble,
      crown,
    );
    reflection.quadraticCurveTo(
      a.x + half + wobble,
      crown,
      a.x + half + wobble,
      spring,
    );
    reflection.lineTo(a.x + half + wobble, water);
    reflection.closePath();
  });
  const ripples = new Path2D();
  for (let i = 0; i < 14; i += 1) {
    const rx = left - reach + noise(i * 3 + 1) * (width + reach * 2);
    const ry = water + size * 3 + noise(i * 3 + 2) * (bottom - water);
    const len = size * (6 + noise(i * 3 + 3) * 14);
    const drift = Math.sin(seconds * 1.3 + i) * size * 2;
    ripples.moveTo(rx + drift, ry);
    ripples.lineTo(rx + drift + len, ry);
  }

  // The stars over the parapet, and the birds when they are crossing.
  const stars = new Path2D();
  const brightStars = new Path2D();
  for (let i = 0; i < 90; i += 1) {
    const sx = left - reach + noise(i * 5 + 1) * (width + reach * 2);
    const sy = top - depth * 0.3 + noise(i * 5 + 2) * depth * 0.6;
    const r = (0.5 + noise(i * 5 + 3)) * Math.min(1.4, size);
    const twinkle = Math.sin(seconds * (1 + noise(i) * 2) + i) > 0.6;
    const target = twinkle ? brightStars : stars;
    target.moveTo(sx + r, sy);
    target.arc(sx, sy, r, 0, Math.PI * 2);
  }
  const birds = new Path2D();
  const flight = seconds - state.birdsAt;
  if (state.birdsAt >= 0 && flight < BIRDS_CROSSING) {
    const bx = left - reach + (flight / BIRDS_CROSSING) * (width + reach * 2);
    const by = top + depth * 0.18;
    for (let i = 0; i < 7; i += 1) {
      const ox = bx - Math.abs(i - 3) * size * 9;
      const oy =
        by + Math.abs(i - 3) * size * 4 + Math.sin(seconds * 5 + i) * size;
      const flap = Math.sin(seconds * 9 + i) * size * 2;
      birds.moveTo(ox - size * 4, oy - flap);
      birds.lineTo(ox, oy + size);
      birds.lineTo(ox + size * 4, oy - flap);
    }
  }

  return {
    shape,
    wall,
    joints,
    keystones,
    courses,
    parapet,
    lanterns,
    flares,
    embers,
    river,
    reflection,
    ripples,
    stars,
    brightStars,
    birds,
    water,
    bass: state.bass,
    thump: state.thump,
  };
};

export type StoneArcadePaths = ReturnType<typeof createStoneArcadePaths>;

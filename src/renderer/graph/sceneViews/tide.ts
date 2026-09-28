/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { IAnalysisBand, IAnalysisPlot } from '../analysis/analysisFrame';
import {
  clampUnit,
  hash01,
  inkAt,
  inkPosition,
  levelAtX,
  lightInkAt,
  rampAlong,
  type ISceneDrawn,
  type ISceneFrame,
  type ISceneLook,
  type ISceneMusic,
  type ISceneReading,
} from './sceneFrame';

/**
 * TIDE: a sea of four swells, one behind the other.
 *
 * The far swell is the treble — small, quick, pale — and each one nearer is
 * lower in the music, down to the front swell, which is the bass: tall, slow,
 * the colour of the top of the ramp. Each is the spectrum under it, smoothed
 * into a sea, riding on two long waves of its own that roll at the music's
 * pace, so the water keeps moving while the song does and stands still when
 * it stops. The nearest two carry foam along their crests, bright where the
 * crest is sharp, and on the treble spray lifts off the tallest crest and
 * falls back. On a beat a roller sets off along the front swell.
 *
 * Over it all hangs a moon, whose halo opens on the bass. Its light lies on
 * the water as a soft column, and each swell carries a path of glints under
 * it — narrow on the far water, wide on the near — that sparkle at the
 * music's pace and thicken with the treble. When the sea has the window to
 * itself, the sky above it carries stars.
 *
 * The style editor: Colour by lays each swell at its depth on the ramp, runs
 * the water across it bass to treble, paints it one colour, or colours each
 * swell by how loud its part of the music is; Outline leaves the sea as its
 * crests alone at the line width; Opacity is how solid the water is; Lit
 * peaks is the spray; Glow brightens the foam and the moon's halo. The sea
 * is not made of pieces, so Pieces and Gap have nothing here to move.
 *
 * Four filled paths, two strokes, four fills of glints, the moon and its
 * column: the whole sea is a score of calls. The layout — the sky, the
 * swells, the glints, the spray — is in the functions exported here, which
 * the look's GPU painting (`engineLooks/tideLook.ts`) is drawn from too.
 */

/** Points along each swell. */
export const SAMPLES = 96;
/**
 * The four swells, far to near: where each rests as a share of the band's
 * depth from the top, how tall it can grow, which region of the music drives
 * it, how long its own two waves are as a share of the width and how fast
 * they roll, and where it sits on the colour ramp.
 */
const SWELLS: readonly {
  rest: number;
  height: number;
  drive: 'treble' | 'mid' | 'low' | 'bass';
  lengths: readonly [number, number];
  speeds: readonly [number, number];
  tint: number;
  alpha: number;
}[] = [
  {
    rest: 0.46,
    height: 0.08,
    drive: 'treble',
    lengths: [0.13, 0.07],
    speeds: [0.9, -1.3],
    tint: 0.14,
    alpha: 0.62,
  },
  {
    rest: 0.56,
    height: 0.12,
    drive: 'mid',
    lengths: [0.21, 0.11],
    speeds: [0.7, -0.9],
    tint: 0.3,
    alpha: 0.72,
  },
  {
    rest: 0.67,
    height: 0.18,
    drive: 'low',
    lengths: [0.34, 0.16],
    speeds: [0.5, -0.65],
    tint: 0.48,
    alpha: 0.82,
  },
  {
    rest: 0.8,
    height: 0.3,
    drive: 'bass',
    lengths: [0.52, 0.23],
    speeds: [0.35, -0.45],
    tint: 0.74,
    alpha: 0.94,
  },
];

/** How many swells, the front one last. */
export const SWELL_COUNT = SWELLS.length;

/** The moon: how far across the plot, and its radius against the depth. */
const MOON_ACROSS = 0.72;
const MOON_SIZE = 0.055;
/** Glints of moonlight on each swell, far to near. */
const GLINTS: readonly number[] = [12, 20, 30, 44];
/** The most glints a swell can carry: all of them, with the treble up. */
export const MOST_GLINTS = Math.ceil(Math.max(...GLINTS) * 1.7);
/** Stars over a sea that has the window to itself. */
const STARS = 70;
/**
 * The darker seas on the moon's face: across and down from its middle and
 * their size, as shares of its radius, and how dark.
 */
export const MOON_SEAS: readonly (readonly [number, number, number, number])[] =
  [
    [0.22, -0.14, 0.36, 0.2],
    [-0.26, 0.16, 0.3, 0.16],
    [0.1, 0.36, 0.22, 0.12],
    [-0.08, -0.34, 0.18, 0.1],
  ];

/** A roller set off by a beat: where along the width, and how strong. */
interface IRoller {
  at: number;
  strength: number;
}

interface ISpray {
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  copy: number;
}

export interface ITideState {
  rollers: IRoller[];
  spray: ISpray[];
  seed: number;
  /** Each swell's shape, smoothed across the width, reused every frame. */
  shape: Float64Array;
}

export const createTideState = (): ITideState => ({
  rollers: [],
  spray: [],
  seed: 0,
  shape: new Float64Array(SAMPLES + 1),
});

/** How strongly a swell's own region of the music is playing. */
const driveOf = (music: ISceneMusic, drive: string): number => {
  if (drive === 'treble') {
    return music.treble;
  }
  if (drive === 'mid') {
    return music.mid;
  }
  if (drive === 'low') {
    return (music.mid + music.bass) / 2;
  }
  return music.bass;
};

/**
 * A wave's height at `phase`, 0..1: peaked at the crest and flat in the
 * trough, the shape of a real swell.
 */
const sharpCrest = (phase: number): number =>
  (0.5 + 0.5 * Math.sin(phase)) ** 1.7;

/** A smooth path through points, by the midpoints between them. */
const smoothThrough = (
  path: Path2D,
  xs: readonly number[],
  ys: readonly number[],
) => {
  path.moveTo(xs[0], ys[0]);
  for (let index = 1; index < xs.length - 1; index += 1) {
    const midX = (xs[index] + xs[index + 1]) / 2;
    const midY = (ys[index] + ys[index + 1]) / 2;
    path.quadraticCurveTo(xs[index], ys[index], midX, midY);
  }
  path.lineTo(xs[xs.length - 1], ys[ys.length - 1]);
};

/** Stars between two heights, reaching the window's edges. */
export const placeTideStars = (
  music: Pick<ISceneMusic, 'clock'>,
  windowWidth: number,
  from: number,
  to: number,
  star: (x: number, y: number, size: number) => void,
): void => {
  for (let index = 0; index < STARS; index += 1) {
    const x = hash01(index * 5.3 + 2) * windowWidth;
    const y = from + hash01(index * 8.7 + 5) * (to - from);
    const twinkle =
      0.5 + 0.5 * Math.sin(music.clock * (1.2 + hash01(index) * 2.5) + index);
    star(x, y, 0.5 + hash01(index * 2.1) * 1.1 * (0.6 + 0.4 * twinkle));
  }
};

/** The stars' light, brighter with the treble. */
export const tideStarAlpha = (treble: number): number => 0.18 + treble * 0.35;

/**
 * One copy's sky and sea: which way its water stands, its foot and head, the
 * rest of the far swell, and the moon hung halfway between the band's head
 * and that swell — with the halo the bass opens round it.
 */
export const tideSky = (
  band: IAnalysisBand,
  plot: IAnalysisPlot,
  music: Pick<ISceneMusic, 'bass'>,
) => {
  const width = plot.right - plot.left;
  const depth = band.bottom - band.top;
  const foot = band.flipped ? band.top : band.bottom;
  const head = band.flipped ? band.bottom : band.top;
  const farRest = head + (foot - head) * SWELLS[0].rest;
  const radius = Math.max(5, depth * MOON_SIZE);
  return {
    depth,
    up: band.flipped ? 1 : -1,
    foot,
    head,
    farRest,
    moonX: plot.left + width * MOON_ACROSS,
    moonY: head + (farRest - head) * 0.42,
    moonRadius: radius,
    halo: radius * (3.2 + music.bass * 1.4),
  };
};

/** The moon's halo, brighter on the kick and with the Glow. */
export const moonHaloAlpha = (pulse: number, glow: number): number =>
  0.2 + pulse * 0.16 + glow * 0.2;

/** The moon's column on the water: how wide against the plot, how bright. */
export const moonColumnWidth = (plotWidth: number): number => plotWidth * 0.06;
export const moonColumnAlpha = (music: Pick<ISceneMusic, 'bass' | 'pulse'>) =>
  0.12 + music.bass * 0.06 + music.pulse * 0.06;

/**
 * The spectrum under the sea, read across the width; each swell smooths it
 * across a tenth of the width so it reads as water rather than a spectrum.
 */
export const shapeTide = (
  reading: Pick<ISceneReading, 'plot' | 'xs' | 'levels'>,
  state: ITideState,
): void => {
  const { plot, xs, levels } = reading;
  const width = plot.right - plot.left;
  for (let step = 0; step <= SAMPLES; step += 1) {
    state.shape[step] = levelAtX(
      xs,
      levels,
      plot.left + (step / SAMPLES) * width,
    );
  }
};

/** One swell as traced: its paint's place on the ramp, and its crest. */
export interface ISwellTrace {
  tint: number;
  /** Where its crests ride: the top of its water's light. */
  surface: number;
  crestX: number;
  crestY: number;
  alpha: number;
}

/**
 * Swell `layer` of a copy traced across the plot into `xs` and `ys`: the
 * spectrum under it, two long waves of its own, and on the front swell the
 * rollers.
 */
export const traceSwell = (
  reading: Pick<ISceneReading, 'plot' | 'music' | 'look'>,
  band: IAnalysisBand,
  state: ITideState,
  layer: number,
  xs: number[],
  ys: number[],
): ISwellTrace => {
  const { plot, music, look } = reading;
  const swell = SWELLS[layer];
  const width = plot.right - plot.left;
  const { depth, up, foot, head } = tideSky(band, plot, music);
  const reach = Math.max(1, Math.round(SAMPLES * 0.05));
  const drive = driveOf(music, swell.drive);
  const rest = head + (foot - head) * swell.rest;
  const tall = depth * swell.height * (0.45 + drive * 1.25);
  const time = music.clock;
  let crestX = plot.left;
  let crestY = rest;
  xs.length = 0;
  ys.length = 0;
  for (let step = 0; step <= SAMPLES; step += 1) {
    let total = 0;
    let count = 0;
    for (
      let near = Math.max(0, step - reach);
      near <= Math.min(SAMPLES, step + reach);
      near += 1
    ) {
      total += state.shape[near];
      count += 1;
    }
    const spectrum = count > 0 ? total / count : 0;
    const along = step / SAMPLES;
    // Two long waves of the swell's own, each sharpened at the crest and
    // flattened in the trough the way water is, rather than a sine's even
    // hills and valleys.
    const long = sharpCrest(
      (along / swell.lengths[0]) * Math.PI * 2 - time * swell.speeds[0] * 3,
    );
    const short = sharpCrest(
      (along / swell.lengths[1]) * Math.PI * 2 -
        time * swell.speeds[1] * 3 +
        layer,
    );
    const swellShape = 0.2 + 0.55 * long + 0.25 * short;
    let lift = tall * (0.55 * spectrum + 0.45 * swellShape);
    // The rollers ride the front swell only.
    if (layer === SWELLS.length - 1) {
      state.rollers.forEach((roller) => {
        const distance = (along - roller.at) / 0.06;
        lift += depth * 0.12 * roller.strength * Math.exp(-distance * distance);
      });
    }
    const x = plot.left + along * width;
    const y = rest + up * lift;
    xs.push(x);
    ys.push(y);
    if ((up < 0 && y < crestY) || (up > 0 && y > crestY)) {
      crestX = x;
      crestY = y;
    }
  }
  // Where on the ramp this swell's water sits (Colour by): its depth in the
  // sea for level, its loudness for heat, the middle for one colour; for
  // frequency the water runs across instead.
  return {
    tint: inkPosition(look.ink, swell.tint, drive),
    surface: rest + up * tall * 0.6,
    crestX,
    crestY,
    alpha: swell.alpha,
  };
};

/**
 * Spray off the tallest crest of the front swell, on the treble, when Lit
 * peaks asks for it.
 */
export const throwSpray = (
  state: ITideState,
  reading: Pick<ISceneReading, 'plot' | 'music' | 'look'>,
  layer: number,
  crestX: number,
  crestY: number,
  up: number,
  copy: number,
): void => {
  const { music, look, plot } = reading;
  if (
    !look.accents ||
    layer !== SWELLS.length - 1 ||
    music.treble <= 0.25 ||
    state.spray.length >= 140
  ) {
    return;
  }
  const width = plot.right - plot.left;
  const drops = Math.round(music.treble * 3);
  for (let drop = 0; drop < drops; drop += 1) {
    state.seed += 1;
    state.spray.push({
      x: crestX + (hash01(state.seed) - 0.5) * width * 0.08,
      y: crestY,
      vx: (hash01(state.seed * 2.3) - 0.5) * 50,
      vy: up * (40 + 70 * hash01(state.seed * 4.1)),
      age: 0,
      copy,
    });
  }
};

/**
 * The moon's path on one swell: short strokes of light under the moon, just
 * below the swell's surface, spread wider the nearer the water. They move on
 * the music's clock, so they sparkle while it plays and hold when it stops.
 * `glint` is handed each one's middle, length and thickness.
 */
export const placeGlints = (
  reading: Pick<ISceneReading, 'plot' | 'music'>,
  layer: number,
  copy: number,
  moonX: number,
  surface: readonly number[],
  depth: number,
  up: number,
  glint: (x: number, y: number, length: number, thick: number) => void,
): void => {
  const { plot, music } = reading;
  const width = plot.right - plot.left;
  const count = Math.round(
    GLINTS[layer] * (0.5 + music.treble * 0.9 + music.energy * 0.3),
  );
  const spread = width * (0.025 + layer * 0.022);
  const moment = Math.floor(music.clock * 6);
  for (let index = 0; index < count; index += 1) {
    const seed = layer * 97 + index * 13.1 + copy * 211 + moment * 0.37;
    // Two draws summed: most of the glints near the middle of the path.
    const x =
      moonX + (hash01(seed) + hash01(seed * 1.9 + 3) - 1) * spread * 1.4;
    if (x >= plot.left && x <= plot.right) {
      const step = Math.min(
        SAMPLES,
        Math.max(0, Math.round(((x - plot.left) / width) * SAMPLES)),
      );
      // Close under the surface, the way light lies on a wave's face; spread
      // down into the water, they read as dashes floating in it.
      const deep = hash01(seed * 2.3 + 7);
      const below = 1 + deep * deep * depth * (0.012 + layer * 0.012);
      glint(
        x,
        surface[step] - up * below,
        (4 + layer * 3) * (0.6 + hash01(seed * 2.9) * 0.8),
        1 + layer * 0.35,
      );
    }
  }
};

/** A swell's glints' light, brighter with the treble and on nearer water. */
export const glintAlpha = (treble: number, layer: number): number =>
  0.3 + treble * 0.4 + layer * 0.08;

/**
 * A swell's crest lines: the foam wash and its bright line on the front
 * swell, a faint rim on the ones behind — whiter on the treble; in outline
 * the sea is its crests alone, at the look's line width.
 */
export const crestLines = (
  look: Pick<ISceneLook, 'filled' | 'lineWidth'>,
  music: Pick<ISceneMusic, 'treble'>,
  glow: number,
  layer: number,
) => {
  const weight = look.filled ? 1 : look.lineWidth / 1.8;
  if (layer === SWELLS.length - 1) {
    return {
      wash: { width: 6 * weight, whiten: 0.6, alpha: 0.12 + glow * 0.2 },
      line: {
        width: 1.8 * weight,
        whiten: 0.75,
        alpha: 0.55 + music.treble * 0.4,
      },
    };
  }
  return {
    line: {
      width: Math.max(1, weight),
      whiten: 0.5,
      alpha: look.filled ? 0.35 : 0.5 + layer * 0.1,
    },
  };
};

/**
 * A beat sets off a roller from somewhere in the left third; rollers cross
 * the sea in about two seconds of music and fade as they go.
 */
export const rollTide = (
  reading: Pick<ISceneReading, 'music' | 'deltaMs'>,
  state: ITideState,
): void => {
  const seconds = reading.deltaMs / 1000;
  if (reading.music.onBeat && state.rollers.length < 4) {
    state.seed += 1;
    state.rollers.push({
      at: 0.05 + hash01(state.seed) * 0.3,
      strength: clampUnit(0.5 + reading.music.bass),
    });
  }
  state.rollers = state.rollers
    .map((roller) => ({
      at: roller.at + reading.music.step * 0.35 + seconds * 0.05,
      strength: roller.strength * (1 - seconds * 0.6),
    }))
    .filter((roller) => roller.at < 1.15 && roller.strength > 0.03);
};

/**
 * The spray: up, then pulled back down, and gone; `drop` is handed where
 * each living drop is and how big. Answers how many are alive.
 */
export const moveSpray = (
  state: ITideState,
  reading: Pick<ISceneReading, 'bands' | 'deltaMs'>,
  drop: (x: number, y: number, size: number) => void,
): number => {
  const seconds = reading.deltaMs / 1000;
  const alive: ISpray[] = [];
  state.spray.forEach((one) => {
    const band = reading.bands[one.copy];
    one.age += seconds;
    if (!band || one.age > 1) {
      return;
    }
    const down = band.flipped ? -1 : 1;
    one.vy += down * 160 * seconds;
    one.x += one.vx * seconds;
    one.y += one.vy * seconds;
    drop(one.x, one.y, 1.6 * (1 - one.age));
    alive.push(one);
  });
  state.spray = alive;
  return alive.length;
};

const drawStars = (frame: ISceneFrame, from: number, to: number): void => {
  const { context, window, music } = frame;
  const stars = new Path2D();
  placeTideStars(music, window.width, from, to, (x, y, size) => {
    stars.rect(x - size / 2, y - size / 2, size, size);
  });
  context.fillStyle = `rgba(255, 255, 255, ${tideStarAlpha(music.treble).toFixed(3)})`;
  context.fill(stars);
};

/**
 * The moon, pale in the top of the ramp, with a few darker seas on its face
 * and a halo the bass opens.
 */
const drawMoon = (
  frame: ISceneFrame,
  x: number,
  y: number,
  radius: number,
  halo: number,
): void => {
  const { context, colours, music } = frame;
  const glow = context.createRadialGradient(x, y, radius * 0.9, x, y, halo);
  glow.addColorStop(
    0,
    lightInkAt(colours, 1, 0.5, moonHaloAlpha(music.pulse, frame.glow)),
  );
  glow.addColorStop(1, lightInkAt(colours, 1, 0.5, 0));
  context.fillStyle = glow;
  context.beginPath();
  context.arc(x, y, halo, 0, Math.PI * 2);
  context.fill();

  const face = context.createRadialGradient(
    x - radius * 0.3,
    y - radius * 0.3,
    radius * 0.1,
    x,
    y,
    radius,
  );
  face.addColorStop(0, 'rgba(255, 255, 255, 0.97)');
  face.addColorStop(1, lightInkAt(colours, 1, 0.55, 0.92));
  context.fillStyle = face;
  context.beginPath();
  context.arc(x, y, radius, 0, Math.PI * 2);
  context.fill();

  // The seas: soft-edged shadows, never discs — a hard edge read as bubbles.
  MOON_SEAS.forEach(([across, down, size, depth]) => {
    const seaX = x + across * radius;
    const seaY = y + down * radius;
    const sea = context.createRadialGradient(
      seaX,
      seaY,
      0,
      seaX,
      seaY,
      size * radius,
    );
    sea.addColorStop(0, inkAt(colours, 0.55, depth));
    sea.addColorStop(1, inkAt(colours, 0.55, 0));
    context.fillStyle = sea;
    context.beginPath();
    context.arc(seaX, seaY, size * radius, 0, Math.PI * 2);
    context.fill();
  });
};

/**
 * The moon's light lying on the water: a tall soft column under it, added to
 * the sea rather than painted over it, brighter on the kick.
 */
const drawMoonColumn = (
  frame: ISceneFrame,
  moonX: number,
  from: number,
  to: number,
): void => {
  const { context, plot, colours, music } = frame;
  const middle = (from + to) / 2;
  const tall = Math.abs(to - from) / 2;
  const wide = moonColumnWidth(plot.right - plot.left);
  if (tall < 1) {
    return;
  }
  context.save();
  context.globalCompositeOperation = 'lighter';
  context.translate(moonX, middle);
  context.scale(wide / tall, 1);
  const column = context.createRadialGradient(0, 0, 0, 0, 0, tall);
  column.addColorStop(0, lightInkAt(colours, 1, 0.6, moonColumnAlpha(music)));
  column.addColorStop(1, lightInkAt(colours, 1, 0.6, 0));
  context.fillStyle = column;
  context.beginPath();
  context.arc(0, 0, tall, 0, Math.PI * 2);
  context.fill();
  context.restore();
};

const drawGlints = (
  frame: ISceneFrame,
  layer: number,
  copy: number,
  moonX: number,
  surface: readonly number[],
  depth: number,
  up: number,
): void => {
  const { context, colours, music } = frame;
  const glints = new Path2D();
  placeGlints(
    frame,
    layer,
    copy,
    moonX,
    surface,
    depth,
    up,
    (x, y, length, thick) => {
      glints.rect(x - length / 2, y - thick / 2, length, thick);
    },
  );
  context.fillStyle = lightInkAt(
    colours,
    1,
    0.8,
    glintAlpha(music.treble, layer),
  );
  context.fill(glints);
};

const drawCopy = (
  frame: ISceneFrame,
  band: IAnalysisBand,
  copy: number,
  state: ITideState,
  body: Path2D | undefined,
): void => {
  const { context, plot, colours, music, look } = frame;
  const sky = tideSky(band, plot, music);
  const { depth, up, foot, farRest, moonX } = sky;

  // The sky: stars to the window's edge when this is the only copy, and the
  // moon halfway between the band's head and the far swell.
  if (frame.bands.length === 1) {
    if (band.flipped) {
      drawStars(frame, farRest, frame.window.height);
    } else {
      drawStars(frame, 0, farRest);
    }
  }
  drawMoon(frame, moonX, sky.moonY, sky.moonRadius, sky.halo);

  const xs: number[] = [];
  const ys: number[] = [];
  SWELLS.forEach((swell, layer) => {
    const traced = traceSwell(frame, band, state, layer, xs, ys);
    const { tint, surface } = traced;

    const water = new Path2D();
    smoothThrough(water, xs, ys);
    water.lineTo(plot.right, foot);
    water.lineTo(plot.left, foot);
    water.closePath();
    if (look.filled) {
      context.save();
      context.globalAlpha = look.opacity;
      if (look.ink === 'frequency') {
        // The ramp across, bass to treble, and the deep laid over it.
        context.fillStyle = rampAlong(
          context,
          colours,
          [plot.left, 0],
          [plot.right, 0],
          0.1,
          swell.alpha,
        );
        context.fill(water);
        const deep = context.createLinearGradient(0, surface, 0, foot);
        deep.addColorStop(0, 'rgba(0, 0, 0, 0)');
        deep.addColorStop(
          0.35,
          `rgba(0, 0, 0, ${(0.45 - layer * 0.08).toFixed(3)})`,
        );
        deep.addColorStop(1, 'rgba(0, 0, 0, 0.82)');
        context.fillStyle = deep;
        context.fill(water);
      } else {
        // Night water, lit from where its crests ride — the middle of its
        // own swing — so every crest catches the light and every trough
        // falls into shadow, down to the deep of the ramp at its foot.
        const fill = context.createLinearGradient(0, surface, 0, foot);
        fill.addColorStop(0, lightInkAt(colours, tint, 0.15, swell.alpha));
        fill.addColorStop(0.22, inkAt(colours, tint * 0.75, swell.alpha));
        fill.addColorStop(0.6, inkAt(colours, tint * 0.3, swell.alpha));
        fill.addColorStop(1, inkAt(colours, 0, swell.alpha));
        context.fillStyle = fill;
        context.fill(water);
      }
      context.restore();
      body?.addPath(water);
      drawGlints(frame, layer, copy, moonX, ys, depth, up);
    }

    const crest = new Path2D();
    smoothThrough(crest, xs, ys);
    const rim = (whiten: number, alpha: number) =>
      look.ink === 'frequency'
        ? rampAlong(
            context,
            colours,
            [plot.left, 0],
            [plot.right, 0],
            whiten,
            alpha,
          )
        : lightInkAt(colours, tint, whiten, alpha);
    const lines = crestLines(look, music, frame.glow, layer);
    context.save();
    context.lineJoin = 'round';
    if (lines.wash) {
      context.lineWidth = lines.wash.width;
      context.strokeStyle = rim(lines.wash.whiten, lines.wash.alpha);
      context.stroke(crest);
    }
    context.lineWidth = lines.line.width;
    context.strokeStyle = rim(lines.line.whiten, lines.line.alpha);
    context.stroke(crest);
    context.restore();

    throwSpray(state, frame, layer, traced.crestX, traced.crestY, up, copy);
  });
  if (look.filled) {
    drawMoonColumn(frame, moonX, farRest, foot);
  }
};

export const drawTide = (
  frame: ISceneFrame,
  state: ITideState,
): ISceneDrawn => {
  rollTide(frame, state);
  shapeTide(frame, state);
  const body = frame.look.textured ? new Path2D() : undefined;
  frame.bands.forEach((band, copy) => drawCopy(frame, band, copy, state, body));

  const glow = new Path2D();
  const alive = moveSpray(state, frame, (x, y, size) => {
    glow.moveTo(x + size, y);
    glow.arc(x, y, size, 0, Math.PI * 2);
  });
  if (alive > 0) {
    frame.context.fillStyle = 'rgba(255, 255, 255, 0.75)';
    frame.context.fill(glow);
  }
  return { moving: alive > 0 || state.rollers.length > 0, body };
};

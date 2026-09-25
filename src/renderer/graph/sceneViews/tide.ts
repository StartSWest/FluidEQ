/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { IAnalysisBand } from '../analysis/analysisFrame';
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
 * column: the whole sea is a score of calls.
 */

/** Points along each swell. */
const SAMPLES = 96;
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

/** The moon: how far across the plot, and its radius against the depth. */
const MOON_ACROSS = 0.72;
const MOON_SIZE = 0.055;
/** Glints of moonlight on each swell, far to near. */
const GLINTS: readonly number[] = [12, 20, 30, 44];
/** Stars over a sea that has the window to itself. */
const STARS = 70;

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
const driveOf = (frame: ISceneFrame, drive: string): number => {
  const { music } = frame;
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
const drawStars = (frame: ISceneFrame, from: number, to: number): void => {
  const { context, window, music } = frame;
  const stars = new Path2D();
  for (let star = 0; star < STARS; star += 1) {
    const x = hash01(star * 5.3 + 2) * window.width;
    const y = from + hash01(star * 8.7 + 5) * (to - from);
    const twinkle =
      0.5 + 0.5 * Math.sin(music.clock * (1.2 + hash01(star) * 2.5) + star);
    const size = 0.5 + hash01(star * 2.1) * 1.1 * (0.6 + 0.4 * twinkle);
    stars.rect(x - size / 2, y - size / 2, size, size);
  }
  context.fillStyle = `rgba(255, 255, 255, ${(0.18 + music.treble * 0.35).toFixed(3)})`;
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
): void => {
  const { context, colours, music } = frame;
  const halo = radius * (3.2 + music.bass * 1.4);
  const glow = context.createRadialGradient(x, y, radius * 0.9, x, y, halo);
  glow.addColorStop(
    0,
    lightInkAt(colours, 1, 0.5, 0.2 + music.pulse * 0.16 + frame.glow * 0.2),
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
  [
    [0.22, -0.14, 0.36, 0.2],
    [-0.26, 0.16, 0.3, 0.16],
    [0.1, 0.36, 0.22, 0.12],
    [-0.08, -0.34, 0.18, 0.1],
  ].forEach(([across, down, size, depth]) => {
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
  const width = plot.right - plot.left;
  const middle = (from + to) / 2;
  const tall = Math.abs(to - from) / 2;
  const wide = width * 0.06;
  if (tall < 1) {
    return;
  }
  context.save();
  context.globalCompositeOperation = 'lighter';
  context.translate(moonX, middle);
  context.scale(wide / tall, 1);
  const column = context.createRadialGradient(0, 0, 0, 0, 0, tall);
  column.addColorStop(
    0,
    lightInkAt(colours, 1, 0.6, 0.12 + music.bass * 0.06 + music.pulse * 0.06),
  );
  column.addColorStop(1, lightInkAt(colours, 1, 0.6, 0));
  context.fillStyle = column;
  context.beginPath();
  context.arc(0, 0, tall, 0, Math.PI * 2);
  context.fill();
  context.restore();
};

/**
 * The moon's path on one swell: short strokes of light under the moon, just
 * below the swell's surface, spread wider the nearer the water. They move on
 * the music's clock, so they sparkle while it plays and hold when it stops.
 */
const drawGlints = (
  frame: ISceneFrame,
  layer: number,
  copy: number,
  moonX: number,
  surface: readonly number[],
  depth: number,
  up: number,
): void => {
  const { context, plot, colours, music } = frame;
  const width = plot.right - plot.left;
  const count = Math.round(
    GLINTS[layer] * (0.5 + music.treble * 0.9 + music.energy * 0.3),
  );
  const spread = width * (0.025 + layer * 0.022);
  const moment = Math.floor(music.clock * 6);
  const glints = new Path2D();
  for (let glint = 0; glint < count; glint += 1) {
    const seed = layer * 97 + glint * 13.1 + copy * 211 + moment * 0.37;
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
      const y = surface[step] - up * below;
      const length = (4 + layer * 3) * (0.6 + hash01(seed * 2.9) * 0.8);
      const thick = 1 + layer * 0.35;
      glints.rect(x - length / 2, y - thick / 2, length, thick);
    }
  }
  context.fillStyle = lightInkAt(
    colours,
    1,
    0.8,
    0.3 + music.treble * 0.4 + layer * 0.08,
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
  const { context, plot, xs: columns, levels, colours, music, look } = frame;
  const width = plot.right - plot.left;
  const depth = band.bottom - band.top;
  const up = band.flipped ? 1 : -1;
  const foot = band.flipped ? band.top : band.bottom;
  const head = band.flipped ? band.bottom : band.top;
  const time = music.clock;

  // The spectrum under the sea, smoothed across a tenth of the width so it
  // reads as water rather than as a spectrum. The same for every swell.
  const reach = Math.max(1, Math.round(SAMPLES * 0.05));
  for (let step = 0; step <= SAMPLES; step += 1) {
    const x = plot.left + (step / SAMPLES) * width;
    state.shape[step] = levelAtX(columns, levels, x);
  }

  // The sky: stars to the window's edge when this is the only copy, and the
  // moon halfway between the band's head and the far swell.
  const farRest = head + (foot - head) * SWELLS[0].rest;
  if (frame.bands.length === 1) {
    if (band.flipped) {
      drawStars(frame, farRest, frame.window.height);
    } else {
      drawStars(frame, 0, farRest);
    }
  }
  const moonX = plot.left + width * MOON_ACROSS;
  drawMoon(
    frame,
    moonX,
    head + (farRest - head) * 0.42,
    Math.max(5, depth * MOON_SIZE),
  );

  SWELLS.forEach((swell, layer) => {
    const drive = driveOf(frame, swell.drive);
    const xs: number[] = [];
    const ys: number[] = [];
    const rest = head + (foot - head) * swell.rest;
    const tall = depth * swell.height * (0.45 + drive * 1.25);
    let crestX = plot.left;
    let crestY = rest;
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
          lift +=
            depth * 0.12 * roller.strength * Math.exp(-distance * distance);
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

    const water = new Path2D();
    smoothThrough(water, xs, ys);
    water.lineTo(plot.right, foot);
    water.lineTo(plot.left, foot);
    water.closePath();
    // Where on the ramp this swell's water sits (Colour by): its depth in the
    // sea for level, its loudness for heat, the middle for one colour; for
    // frequency the water runs across instead (`waterAcross`).
    const tint = inkPosition(look.ink, swell.tint, drive);
    const surface = rest + up * tall * 0.6;
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

    // Foam along the front crest: a soft wash under a bright line, whiter on
    // the treble. The swells behind carry only a faint rim of light. In
    // outline the sea is its crests alone, at the look's line width.
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
    const weight = look.filled ? 1 : look.lineWidth / 1.8;
    context.save();
    context.lineJoin = 'round';
    if (layer === SWELLS.length - 1) {
      context.lineWidth = 6 * weight;
      context.strokeStyle = rim(0.6, 0.12 + frame.glow * 0.2);
      context.stroke(crest);
      context.lineWidth = 1.8 * weight;
      context.strokeStyle = rim(0.75, 0.55 + music.treble * 0.4);
    } else {
      context.lineWidth = Math.max(1, weight);
      context.strokeStyle = rim(0.5, look.filled ? 0.35 : 0.5 + layer * 0.1);
    }
    context.stroke(crest);
    context.restore();

    // Spray off the tallest crest of the front swell, on the treble.
    if (
      look.accents &&
      layer === SWELLS.length - 1 &&
      music.treble > 0.25 &&
      state.spray.length < 140
    ) {
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
    }
  });
  if (look.filled) {
    drawMoonColumn(frame, moonX, farRest, foot);
  }
};

export const drawTide = (
  frame: ISceneFrame,
  state: ITideState,
): ISceneDrawn => {
  const seconds = frame.deltaMs / 1000;
  // A beat sets off a roller from somewhere in the left third; rollers cross
  // the sea in about two seconds of music and fade as they go.
  if (frame.music.onBeat && state.rollers.length < 4) {
    state.seed += 1;
    state.rollers.push({
      at: 0.05 + hash01(state.seed) * 0.3,
      strength: clampUnit(0.5 + frame.music.bass),
    });
  }
  state.rollers = state.rollers
    .map((roller) => ({
      at: roller.at + frame.music.step * 0.35 + seconds * 0.05,
      strength: roller.strength * (1 - seconds * 0.6),
    }))
    .filter((roller) => roller.at < 1.15 && roller.strength > 0.03);

  const body = frame.look.textured ? new Path2D() : undefined;
  frame.bands.forEach((band, copy) => drawCopy(frame, band, copy, state, body));

  // The spray: up, then pulled back down, and gone.
  const glow = new Path2D();
  const alive: ISpray[] = [];
  state.spray.forEach((drop) => {
    const band = frame.bands[drop.copy];
    drop.age += seconds;
    if (!band || drop.age > 1) {
      return;
    }
    const down = band.flipped ? -1 : 1;
    drop.vy += down * 160 * seconds;
    drop.x += drop.vx * seconds;
    drop.y += drop.vy * seconds;
    const size = 1.6 * (1 - drop.age);
    glow.moveTo(drop.x + size, drop.y);
    glow.arc(drop.x, drop.y, size, 0, Math.PI * 2);
    alive.push(drop);
  });
  state.spray = alive;
  if (alive.length > 0) {
    frame.context.fillStyle = 'rgba(255, 255, 255, 0.75)';
    frame.context.fill(glow);
  }
  return { moving: alive.length > 0 || state.rollers.length > 0, body };
};

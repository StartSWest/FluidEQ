import type { Projected } from 'common/graphStyles';
import { getEaseFactor } from 'common/smoothing';

/**
 * The hyperspace behind the Warp speed form.
 *
 * The spectrum is the warp itself: every band owns a fan of streaks flying
 * out of the vanishing point, and how fast and how long they fly is that
 * band's level, so the bass end of the tunnel roars and the treble end
 * flickers. Behind them a sky in three depths: far pinpoints that barely
 * move, a middle field that drifts, and the streaks nearest — parallax by
 * depth, from a vanishing point fixed at the centre.
 *
 * On the beat a warp ring leaves the vanishing point and rushes outward,
 * a shockwave in perspective; a hard bass hit throws an asteroid out of the
 * tunnel, a tumbling rock that grows as it nears and flies past the edge.
 * The core glows in the look's colour and breathes with the bass.
 *
 * All of it runs on the music-pace clock and reads the beat from the live
 * frame.
 */

interface ISkyStar {
  /** Angle from the vanishing point and distance out, 0..1, per depth. */
  angle: number;
  radius: number;
  /** 0 far, 1 near. */
  depth: number;
}

interface IRing {
  bornAt: number;
  strength: number;
}

interface IRock {
  angle: number;
  /** Distance out, 0..1; grows on the clock. */
  radius: number;
  spin: number;
  seed: number;
}

export interface WarpTunnel {
  sky: ISkyStar[];
  rings: IRing[];
  rocks: IRock[];
  /** Per column: the streaks' travel, 0..1 along the fan. */
  travel: number[];
  mean: number;
  bassLevel: number;
  bass: number;
  thump: number;
  clock: number;
}

// Enough to fill a fullscreen sky; each is one arc or one line, so the
// whole field is one fill and one stroke per depth.
export const SKY_STARS = 420;
export const RING_LIFE = 1.4;
// Four at once: each is a screen-sized ellipse stroke, and eight of them
// with their wakes cost more than everything else in the scene together.
const RING_LIMIT = 3;
const ROCK_LIMIT = 6;
/** Streaks per column, at three depths, and the segments a streak's waveform has. */
export const STREAK_LAYERS = 3;
const WAVE_STEPS = 6;

const noise = (seed: number) => {
  const v = Math.sin(seed * 12.9898) * 43758.5453;
  return v - Math.floor(v);
};

export const createWarpTunnel = (): WarpTunnel => ({
  sky: Array.from({ length: SKY_STARS }, (_, i) => ({
    angle: noise(i * 3 + 1) * Math.PI * 2,
    radius: noise(i * 3 + 2),
    depth: noise(i * 3 + 3) ** 1.5,
  })),
  rings: [],
  rocks: [],
  travel: [],
  mean: 0,
  bassLevel: 0,
  bass: 0,
  thump: 0,
  clock: 0,
});

const levelOf = (y: number, top: number, bottom: number) =>
  Math.max(0, Math.min(1, (bottom - y) / Math.max(1, bottom - top)));

export const advanceWarpTunnel = (
  state: WarpTunnel,
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
  if (state.travel.length !== columns.length) {
    state.travel = columns.map((_, i) => noise(i + 0.5));
  }
  const dt = Math.max(0, Math.min(0.1, seconds - state.clock));
  const elapsedMs = dt * 1000;
  // Paused, the tunnel holds: the clock is not read.
  if (!playing) {
    return;
  }
  state.clock = seconds;

  const levels = live.map(([, y]) => levelOf(y, top, bottom));
  const mean =
    levels.reduce((sum, v) => sum + v, 0) / Math.max(1, levels.length);
  const crack = mean - state.mean;
  state.mean = mean;
  const bassTo = Math.max(1, Math.floor(levels.length * 0.3));
  const bass = levels.slice(0, bassTo).reduce((s, v) => s + v, 0) / bassTo;
  state.bass += (bass - state.bass) * getEaseFactor(elapsedMs, 25);
  const beat = crack >= 0.05 && mean >= 0.15;
  if (beat) {
    state.thump = 1;
    if (state.rings.length >= RING_LIMIT) {
      state.rings.shift();
    }
    state.rings.push({ bornAt: seconds, strength: Math.min(1, crack * 6) });
  } else {
    state.thump *= 1 - getEaseFactor(elapsedMs, 140);
  }

  // The vanishing point stays at the centre. It leaned toward the loud
  // end and wandered for a while; the tunnel read as the camera drifting,
  // and only the stars should move.
  // Each column's fan flies at its own band's speed.
  columns.forEach((_, index) => {
    const level = levels[index] ?? 0;
    const speed = 0.12 + level * 0.5 + state.thump * 0.08;
    state.travel[index] = (state.travel[index] + dt * speed) % 1;
  });

  // The sky drifts outward, the near depth fastest.
  const drift = dt * (0.02 + mean * 0.08);
  state.sky.forEach((star) => {
    star.radius += drift * (0.2 + star.depth);
    if (star.radius > 1) {
      star.radius -= 1;
      star.angle = noise(star.angle * 31 + seconds) * Math.PI * 2;
    }
  });

  // A hard bass hit throws a rock out of the tunnel.
  const bassCrack = bass - state.bassLevel;
  if (bassCrack >= 0.12 && bass >= 0.4 && state.rocks.length < ROCK_LIMIT) {
    const seed = Math.floor(seconds * 7) + state.rocks.length;
    state.rocks.push({
      angle: noise(seed) * Math.PI * 2,
      radius: 0.02,
      spin: (noise(seed + 1) - 0.5) * 6,
      seed,
    });
  }
  state.rocks = state.rocks.filter((rock) => {
    rock.radius += dt * (0.25 + rock.radius * 1.6) * (0.6 + mean);
    return rock.radius < 1.3;
  });
  state.rings = state.rings.filter((ring) => seconds - ring.bornAt < RING_LIFE);
  const release = 1 - getEaseFactor(elapsedMs, 110);
  state.bassLevel = Math.max(bass, state.bassLevel * release);
};

/** Which sky depth a star is in: far, middle, near. */
const layerOf = (depth: number) => {
  if (depth < 0.33) {
    return 0;
  }
  return depth < 0.66 ? 1 : 2;
};

export interface IBand {
  path: Path2D;
  alpha: number;
}

export interface IRingPath {
  path: Path2D;
  /** The fainter rings just behind it. */
  wake: Path2D;
  alpha: number;
  width: number;
}

/** Rings in a wave's wake. */
const RING_WAKE = 2;

export const createWarpTunnelPaths = (
  state: WarpTunnel,
  columns: readonly Projected[],
  top: number,
  bottom: number,
  seconds: number,
) => {
  const left = columns[0]?.[0] ?? 0;
  const right = columns[columns.length - 1]?.[0] ?? 1;
  const width = Math.max(1, right - left);
  const height = Math.max(1, bottom - top);
  // The scene reaches a plot's width past each end and a depth above and
  // below: a scene may overflow the panel's margins.
  const reachX = width;
  const reachY = height;
  const focusX = left + width / 2;
  const focusY = top + height / 2;
  // A direction's distance to the scene's edge, so a streak at radius 1
  // is off the panel whatever its angle.
  const edgeAt = (angle: number) => {
    const cosine = Math.cos(angle);
    const sine = Math.sin(angle);
    const toX = cosine > 0 ? right + reachX - focusX : focusX - (left - reachX);
    const toY = sine > 0 ? bottom + reachY - focusY : focusY - (top - reachY);
    return Math.min(
      Math.abs(cosine) > 1e-6 ? toX / Math.abs(cosine) : Infinity,
      Math.abs(sine) > 1e-6 ? toY / Math.abs(sine) : Infinity,
    );
  };
  const out = (angle: number, radius: number): Projected => [
    focusX + Math.cos(angle) * edgeAt(angle) * radius,
    focusY + Math.sin(angle) * edgeAt(angle) * radius,
  ];

  // The sky, three depths.
  const starScale = Math.max(1, height / 600);
  const sky: IBand[] = [0.35, 0.6, 0.9].map((alpha) => ({
    path: new Path2D(),
    alpha,
  }));
  state.sky.forEach((star) => {
    const layer = layerOf(star.depth);
    const cosine = Math.cos(star.angle);
    const sine = Math.sin(star.angle);
    const reach = edgeAt(star.angle);
    const r = star.radius ** 1.5 * reach;
    const x = focusX + cosine * r;
    const y = focusY + sine * r;
    // Sized with the plot: at 2560 wide a sub-pixel star vanished.
    const size = (0.6 + layer * 0.5 + star.radius * layer) * starScale;
    const { path } = sky[layer];
    if (layer === 2) {
      // The near layer streaks a little with the level.
      const tail = size * (1 + state.mean * 10) * star.radius;
      path.moveTo(x - cosine * tail, y - sine * tail);
      path.lineTo(x, y);
    } else {
      // A square: at these sizes it is a dot, and a rect is far cheaper to
      // rasterise than an arc — four hundred arcs a frame were felt.
      path.rect(x - size, y - size, size * 2, size * 2);
    }
  });

  // The warp: the figure. Every column a fan of STREAK_LAYERS streaks from
  // the vanishing point, longer and further out the louder its band, its
  // angle fixed by the column so the bass end fans one way and the treble
  // the other.
  const shape = new Path2D();
  columns.forEach(([, y], index) => {
    const level = levelOf(y, top, bottom);
    const spread = (index / Math.max(1, columns.length - 1)) * Math.PI * 2;
    for (let layer = 0; layer < STREAK_LAYERS; layer += 1) {
      const angle = spread + layer * 2.0944 + noise(index * 7 + layer) * 0.5;
      const depth = (state.travel[index] + layer / STREAK_LAYERS) % 1;
      const radius = depth ** 2;
      const tail = Math.max(
        0,
        radius - (0.01 + level * 0.12 + state.thump * 0.02) * depth,
      );
      // Each streak is a waveform: WAVE_STEPS segments from tail to head,
      // swinging across the line of flight, the swing pinned to nothing at
      // both ends and as big as the band is loud, so a quiet band flies a
      // straight line and a loud one a wave, and the whole thing ripples
      // along on the clock.
      const [ax, ay] = out(angle, tail);
      const [bx, by] = out(angle, radius);
      const across = Math.hypot(bx - ax, by - ay);
      const nx = -(by - ay) / Math.max(1, across);
      const ny = (bx - ax) / Math.max(1, across);
      const swing = Math.min(across * 0.35, (2 + level * 22) * (0.4 + depth));
      // Drawn as quadratics through the midpoints between samples, so the
      // wave is a curve and not the zigzag six straight segments made.
      const sample = (t: number): Projected => {
        const wave =
          Math.sin(t * Math.PI * 2.5 + seconds * 9 + index) *
          Math.sin(t * Math.PI) *
          swing;
        return [ax + (bx - ax) * t + nx * wave, ay + (by - ay) * t + ny * wave];
      };
      shape.moveTo(ax, ay);
      let [px, py] = sample(1 / WAVE_STEPS);
      for (let step = 2; step <= WAVE_STEPS; step += 1) {
        const [qx, qy] = sample(step / WAVE_STEPS);
        shape.quadraticCurveTo(px, py, (px + qx) / 2, (py + qy) / 2);
        px = qx;
        py = qy;
      }
      shape.lineTo(bx, by);
    }
  });

  // The rings: shockwaves in perspective, an ellipse widening from the
  // vanishing point, fading as it goes.
  // Each ring is its own stroke, fading smoothly as it ages, with a wake
  // of RING_WAKE fainter rings just behind it, so a wave leaves a trail
  // rather than jumping between three brightnesses.
  const rings: IRingPath[] = [];
  state.rings.forEach((ring) => {
    const age = (seconds - ring.bornAt) / RING_LIFE;
    const spread = 0.6 + ring.strength * 0.4;
    const path = new Path2D();
    const wake = new Path2D();
    for (let k = 0; k <= RING_WAKE; k += 1) {
      const radius = Math.max(0, age - k * 0.045) ** 1.6;
      // Sized to the plot, not the overflow: a wave three plots wide was
      // mostly rasterised off the panel.
      const rx = width * 0.62 * radius * spread;
      const ry = height * 0.62 * radius * spread;
      const target = k === 0 ? path : wake;
      target.moveTo(focusX + rx, focusY);
      target.ellipse(focusX, focusY, rx, ry, 0, 0, Math.PI * 2);
    }
    rings.push({
      path,
      wake,
      alpha: (1 - age) ** 1.5 * (0.5 + ring.strength * 0.5),
      width: 1 + (1 - age) * 2,
    });
  });

  // The rocks: asteroids — a lumpy tumbling body, the half away from the
  // core in shadow, a crater or two, and a trail back toward the core
  // that lengthens with the beat. Each grows as it nears and swells a
  // third on the beat.
  const rocks = new Path2D();
  const rockShade = new Path2D();
  const rockEdges = new Path2D();
  const craters = new Path2D();
  const rockTrails = new Path2D();
  state.rocks.forEach((rock) => {
    const [cx, cy] = out(rock.angle, rock.radius ** 1.5);
    const size =
      (4 + rock.radius ** 2 * 60) *
      (height / 400 + 0.5) *
      (1 + state.thump * 0.12);
    const sides = 7 + Math.floor(noise(rock.seed + 2) * 3);
    const spin = seconds * rock.spin;
    const body: Projected[] = [];
    for (let i = 0; i < sides; i += 1) {
      const a = spin + (i / sides) * Math.PI * 2;
      const wobble = 0.65 + noise(rock.seed * 5 + i) * 0.6;
      body.push([
        cx + Math.cos(a) * size * wobble,
        cy + Math.sin(a) * size * wobble,
      ]);
    }
    body.forEach(([px, py], i) => {
      if (i === 0) {
        rocks.moveTo(px, py);
        rockEdges.moveTo(px, py);
      } else {
        rocks.lineTo(px, py);
        rockEdges.lineTo(px, py);
      }
    });
    rocks.closePath();
    rockEdges.closePath();
    // The shadow: the body's vertices on the side away from the core,
    // closed through the centre.
    const away = rock.angle;
    const dark = body.filter(
      ([px, py]) => (px - cx) * Math.cos(away) + (py - cy) * Math.sin(away) > 0,
    );
    if (dark.length >= 2) {
      rockShade.moveTo(cx, cy);
      dark.forEach(([px, py]) => rockShade.lineTo(px, py));
      rockShade.closePath();
    }
    // Craters: two dents that ride the spin.
    [0.3, -0.35].forEach((offset, i) => {
      const a = spin + offset * Math.PI + i;
      const r = size * (0.14 + noise(rock.seed + 9 + i) * 0.1);
      const px = cx + Math.cos(a) * size * 0.45;
      const py = cy + Math.sin(a) * size * 0.45;
      craters.moveTo(px + r, py);
      craters.arc(px, py, r, 0, Math.PI * 2);
    });
    // The trail, back toward the core.
    const trail = size * (2 + state.thump * 1.5) * rock.radius;
    rockTrails.moveTo(cx, cy);
    rockTrails.lineTo(cx - Math.cos(away) * trail, cy - Math.sin(away) * trail);
  });

  return {
    shape,
    sky,
    rings,
    rocks,
    rockShade,
    rockEdges,
    craters,
    rockTrails,
    focusX,
    focusY,
    // The core barely breathes: with the bass at full swing it pushed the
    // whole scene on every kick.
    coreRadius: Math.min(width, height) * (0.045 + state.bass * 0.025),
    bass: state.bass,
    thump: state.thump,
  };
};

export type WarpTunnelPaths = ReturnType<typeof createWarpTunnelPaths>;

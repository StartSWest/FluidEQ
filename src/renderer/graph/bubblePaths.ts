import type { Projected } from 'common/graphStyles';
import {
  BOLT_LIFE,
  bubblePhase,
  BubbleStorm,
  POP_LIFE,
  REGROW_AFTER,
} from './bubbleStorm';

interface ICentre {
  x: number;
  y: number;
}

/**
 * How big a bubble is on its way up.
 *
 * A sine over the climb put every bubble's widest point halfway and shrank
 * it to nothing well before the top, which is why the form was a shoal in
 * the lower half of a black window. A bubble grows quickly as it leaves
 * the floor, holds its size for the climb and only goes at the surface,
 * where it pops — which is what a bubble does.
 */
const riseEnvelope = (phase: number) =>
  Math.min(1, phase * 7) * Math.min(1, (1 - phase) * 9);

/** A cheap deterministic hash in [0, 1): a bolt must not re-shape per frame. */
const noise = (seed: number, step: number) => {
  const v = Math.sin(seed * 12.9898 + step * 78.233) * 43758.5453;
  return v - Math.floor(v);
};

/**
 * One strike between two bubbles: a main channel of twelve jagged segments
 * whose sideways throw shrinks toward the target, and two forks leaving it
 * part-way, thinner in the sense that they stop short. Real lightning is a
 * leader with branches, not a zigzag of even amplitude. Answers the channel
 * and the two forks, each a line through its points.
 */
const traceBolt = (a: ICentre, b: ICentre, seed: number): ICentre[][] => {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const distance = Math.max(1, Math.hypot(dx, dy));
  const nx = -dy / distance;
  const ny = dx / distance;
  const throwMax = Math.min(14, distance * 0.11);
  const segments = 12;
  const channel: ICentre[] = [a];
  for (let step = 1; step < segments; step += 1) {
    const along = step / segments;
    const sway = (noise(seed, step) - 0.5) * 2 * throwMax * (1 - along * 0.5);
    channel.push({
      x: a.x + dx * along + nx * sway,
      y: a.y + dy * along + ny * sway,
    });
  }
  channel.push(b);
  const forks = [4, 8].map((start, fork) => {
    const origin = channel[start];
    const side = noise(seed, 100 + fork) > 0.5 ? 1 : -1;
    const line: ICentre[] = [origin];
    for (let step = 1; step <= 4; step += 1) {
      const along = step / 4;
      const reach = distance * 0.28 * along;
      const sway = (noise(seed, 200 + fork * 10 + step) - 0.5) * throwMax;
      line.push({
        x:
          origin.x + (dx / distance) * reach + nx * (side * reach * 0.6 + sway),
        y:
          origin.y + (dy / distance) * reach + ny * (side * reach * 0.6 + sway),
      });
    }
    return line;
  });
  return [channel, ...forks];
};

/** How many age batches a burst and a strike are drawn in. */
export const BUBBLE_BATCHES = 4;

/** Where the refraction band runs round a bubble, in radians. */
export const REFRACTION_FROM = 0.35;
export const REFRACTION_TO = 1.35;
/** How the specular glint is turned, in radians. */
export const GLINT_TURN = -0.7;

/** One bubble as it stands this frame. */
export interface IBubble {
  /** Its centre and its wobbling radii; no radii, not drawn. */
  x: number;
  y: number;
  rx: number;
  ry: number;
  radius: number;
  /** The rim a filled bubble keeps: how thick its ring is. */
  rim: number;
  /** Its glint and refraction band, on a bubble big enough to carry them. */
  glint?: { x: number; y: number; size: number };
  refraction?: number;
}

/** A burst: its rim spreading and fading, in one of four age batches. */
export interface IBubblePop {
  /** Which bubble burst: its band times three, plus its layer. */
  index: number;
  x: number;
  y: number;
  spread: number;
  batch: number;
}

/**
 * The frame's bubbles, bursts, droplets and strikes: what both painters
 * draw from — the page's paths here, the engine per pixel
 * (`engineLooks/designed/bubblesLook.ts`).
 */
export const bubbleLayout = (
  points: readonly Projected[],
  top: number,
  bottom: number,
  scaleY: number,
  seconds: number,
  gap: number,
  storm: BubbleStorm,
) => {
  const bubbles: (IBubble | undefined)[] = [];
  const pops: IBubblePop[] = [];
  const droplets: { x: number; y: number; size: number }[] = [];
  const centres: ICentre[] = [];
  const depth = Math.max(1, bottom - top);
  const renderedDepth = depth * Math.abs(scaleY);
  const spacing =
    points.length > 1
      ? (points[points.length - 1][0] - points[0][0]) / (points.length - 1)
      : 1;
  const growth = Math.max(0.7, Math.min(2.4, Math.sqrt(renderedDepth / 360)));
  let widest = 0;
  points.forEach(([x, y], index) => {
    const energy = Math.max(0, Math.min(1, (bottom - y) / depth));
    for (let layer = 0; layer < 3; layer += 1) {
      const phase = bubblePhase(index, layer, seconds);
      const fullRadius = Math.max(
        0.3,
        Math.min(
          renderedDepth * 0.17,
          spacing *
            (1 - gap) *
            growth *
            (0.48 + energy * 0.65) *
            [1, 0.62, 0.35][layer],
        ) * riseEnvelope(phase),
      );
      const cy = (bottom - phase * depth) * scaleY;
      const cx =
        x + Math.sin(seconds * 0.4 + index * 1.7 + layer) * spacing * 0.35;
      centres[index * 3 + layer] = { x: cx, y: cy };
      const poppedAt = storm.pops.get(index * 3 + layer);
      const age =
        poppedAt === undefined ? Infinity : Math.max(0, seconds - poppedAt);
      if (age < POP_LIFE) {
        const flight = age / POP_LIFE;
        const spread = fullRadius * (1 + flight * 0.9);
        pops.push({
          index: index * 3 + layer,
          x: cx,
          y: cy,
          spread,
          batch: Math.min(BUBBLE_BATCHES - 1, Math.floor(flight * 4)),
        });
        widest = Math.max(widest, spread);
        const seed = index * 7 + layer * 3;
        for (let drop = 0; drop < 6; drop += 1) {
          const angle = ((drop + (seed % 5) * 0.2) * Math.PI * 2) / 6;
          const reach = fullRadius * (1.05 + flight * 1.9);
          // Droplets slow and shrink as they fly, like water losing speed.
          droplets.push({
            x: cx + Math.cos(angle) * reach,
            y: cy + Math.sin(angle) * reach + flight * flight * fullRadius,
            size: Math.max(0.4, fullRadius * 0.08 * (1 - flight * 0.7)),
          });
        }
      }
      const radius =
        fullRadius *
        Math.max(0, Math.min(1, (age - POP_LIFE - REGROW_AFTER) / 0.7));
      if (radius > 0.2) {
        // A rising bubble wobbles: slightly wide, then slightly tall.
        const wobble = 1 + 0.05 * Math.sin(seconds * 6 + index * 1.3 + layer);
        const glint = radius * 0.16;
        bubbles[index * 3 + layer] = {
          x: cx,
          y: cy,
          rx: radius * wobble,
          ry: radius / wobble,
          radius,
          rim: radius - Math.max(0.1, radius - Math.max(1, radius * 0.065)),
          // Specular glint: high left, where the light is; the refraction
          // band: the light coming through low on the right.
          glint:
            radius > 3
              ? { x: cx - radius * 0.42, y: cy - radius * 0.46, size: glint }
              : undefined,
          refraction: radius > 3 ? radius * 0.82 : undefined,
        };
        widest = Math.max(widest, radius * wobble);
      } else {
        bubbles[index * 3 + layer] = undefined;
      }
    }
  });
  const bolts: { batch: number; lines: ICentre[][] }[] = [];
  storm.bolts.forEach((bolt) => {
    const a = centres[bolt.from];
    const b = centres[bolt.to];
    if (!a || !b) {
      return;
    }
    const flight = Math.max(0, seconds - bolt.at) / BOLT_LIFE;
    // The storm is advanced once per frame while playing; paused, a dead
    // bolt must still not be drawn from a stale list.
    if (flight > 1) {
      return;
    }
    bolts.push({
      batch: Math.min(BUBBLE_BATCHES - 1, Math.floor(flight * 4)),
      lines: traceBolt(a, b, bolt.from * 31 + Math.floor(bolt.at * 997)),
    });
  });
  return { bubbles, pops, droplets, bolts, spacing, widest };
};

const trace = (path: Path2D, line: readonly ICentre[]) => {
  path.moveTo(line[0].x, line[0].y);
  line.slice(1).forEach((point) => path.lineTo(point.x, point.y));
};

/**
 * Soap bubbles, drawn the way the eye recognises one: a thin rim, a faint
 * glassy body, a hard specular glint high on the left and a soft refracted
 * band low on the right. A burst is an expanding, fading ring with a few
 * droplets flung from it — the rim breaking, not sparks appearing beside it.
 *
 * Pop rings are batched by age into four paths so a whole burst costs four
 * strokes whatever the band count; batch 0 is the freshest and brightest.
 */
const createBubblePaths = (
  points: readonly Projected[],
  top: number,
  bottom: number,
  scaleY: number,
  seconds: number,
  gap: number,
  filled: boolean,
  storm: BubbleStorm,
) => {
  const layout = bubbleLayout(points, top, bottom, scaleY, seconds, gap, storm);
  const beads = new Path2D();
  const shape = new Path2D();
  const body = new Path2D();
  const glints = new Path2D();
  const refraction = new Path2D();
  const rings = Array.from({ length: BUBBLE_BATCHES }, () => new Path2D());
  const droplets = new Path2D();
  layout.pops.forEach(({ x, y, spread, batch }) => {
    rings[batch].moveTo(x + spread, y);
    rings[batch].arc(x, y, spread, 0, Math.PI * 2);
  });
  layout.droplets.forEach(({ x, y, size }) => {
    droplets.moveTo(x + size, y);
    droplets.arc(x, y, size, 0, Math.PI * 2);
  });
  layout.bubbles.forEach((bubble) => {
    if (!bubble) {
      return;
    }
    const { x: cx, y: cy, rx, ry, radius } = bubble;
    beads.moveTo(cx + rx, cy);
    beads.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    beads.closePath();
    shape.moveTo(cx + rx, cy);
    shape.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    shape.closePath();
    body.moveTo(cx + rx, cy);
    body.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    body.closePath();
    if (filled) {
      const inner = radius - bubble.rim;
      shape.moveTo(cx + inner, cy);
      shape.arc(cx, cy, inner, 0, Math.PI * 2, true);
      shape.closePath();
    }
    if (bubble.glint && bubble.refraction !== undefined) {
      const { x: gx, y: gy, size } = bubble.glint;
      glints.moveTo(gx + size, gy);
      glints.ellipse(gx, gy, size * 1.5, size, GLINT_TURN, 0, Math.PI * 2);
      const reach = bubble.refraction;
      refraction.moveTo(
        cx + Math.cos(REFRACTION_FROM) * reach,
        cy + Math.sin(REFRACTION_FROM) * reach,
      );
      refraction.arc(cx, cy, reach, REFRACTION_FROM, REFRACTION_TO);
    }
  });
  const bolts = Array.from({ length: BUBBLE_BATCHES }, () => new Path2D());
  layout.bolts.forEach(({ batch, lines }) =>
    lines.forEach((line) => trace(bolts[batch], line)),
  );
  return {
    beads,
    shape,
    body,
    glints,
    refraction,
    rings,
    droplets,
    bolts,
    layout,
  };
};

export default createBubblePaths;

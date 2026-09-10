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
 * leader with branches, not a zigzag of even amplitude.
 */
const traceBolt = (
  path: Path2D,
  a: ICentre,
  b: ICentre,
  seed: number,
): void => {
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
  path.moveTo(channel[0].x, channel[0].y);
  channel.slice(1).forEach((point) => path.lineTo(point.x, point.y));
  [4, 8].forEach((start, fork) => {
    const origin = channel[start];
    const side = noise(seed, 100 + fork) > 0.5 ? 1 : -1;
    path.moveTo(origin.x, origin.y);
    for (let step = 1; step <= 4; step += 1) {
      const along = step / 4;
      const reach = distance * 0.28 * along;
      const sway = (noise(seed, 200 + fork * 10 + step) - 0.5) * throwMax;
      path.lineTo(
        origin.x + (dx / distance) * reach + nx * (side * reach * 0.6 + sway),
        origin.y + (dy / distance) * reach + ny * (side * reach * 0.6 + sway),
      );
    }
  });
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
  const beads = new Path2D();
  const shape = new Path2D();
  const body = new Path2D();
  const glints = new Path2D();
  const refraction = new Path2D();
  const rings = Array.from({ length: 4 }, () => new Path2D());
  const droplets = new Path2D();
  const centres: ICentre[] = [];
  const depth = Math.max(1, bottom - top);
  const renderedDepth = depth * Math.abs(scaleY);
  const spacing =
    points.length > 1
      ? (points[points.length - 1][0] - points[0][0]) / (points.length - 1)
      : 1;
  const growth = Math.max(0.7, Math.min(2.4, Math.sqrt(renderedDepth / 360)));
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
        const ring = rings[Math.min(3, Math.floor(flight * 4))];
        const spread = fullRadius * (1 + flight * 0.9);
        ring.moveTo(cx + spread, cy);
        ring.arc(cx, cy, spread, 0, Math.PI * 2);
        const seed = index * 7 + layer * 3;
        for (let drop = 0; drop < 6; drop += 1) {
          const angle = ((drop + (seed % 5) * 0.2) * Math.PI * 2) / 6;
          const reach = fullRadius * (1.05 + flight * 1.9);
          // Droplets slow and shrink as they fly, like water losing speed.
          const size = Math.max(0.4, fullRadius * 0.08 * (1 - flight * 0.7));
          const dx = cx + Math.cos(angle) * reach;
          const dy =
            cy + Math.sin(angle) * reach + flight * flight * fullRadius;
          droplets.moveTo(dx + size, dy);
          droplets.arc(dx, dy, size, 0, Math.PI * 2);
        }
      }
      const radius =
        fullRadius *
        Math.max(0, Math.min(1, (age - POP_LIFE - REGROW_AFTER) / 0.7));
      if (radius > 0.2) {
        // A rising bubble wobbles: slightly wide, then slightly tall.
        const wobble = 1 + 0.05 * Math.sin(seconds * 6 + index * 1.3 + layer);
        const rx = radius * wobble;
        const ry = radius / wobble;
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
          const inner = Math.max(0.1, radius - Math.max(1, radius * 0.065));
          shape.moveTo(cx + inner, cy);
          shape.arc(cx, cy, inner, 0, Math.PI * 2, true);
          shape.closePath();
        }
        if (radius > 3) {
          // Specular glint: high left, where the light is.
          const glint = radius * 0.16;
          const gx = cx - radius * 0.42;
          const gy = cy - radius * 0.46;
          glints.moveTo(gx + glint, gy);
          glints.ellipse(gx, gy, glint * 1.5, glint, -0.7, 0, Math.PI * 2);
          // Refraction band: the light coming through low on the right.
          refraction.moveTo(
            cx + Math.cos(0.35) * radius * 0.82,
            cy + Math.sin(0.35) * radius * 0.82,
          );
          refraction.arc(cx, cy, radius * 0.82, 0.35, 1.35);
        }
      }
    }
  });
  const bolts = Array.from({ length: 4 }, () => new Path2D());
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
    traceBolt(
      bolts[Math.min(3, Math.floor(flight * 4))],
      a,
      b,
      bolt.from * 31 + Math.floor(bolt.at * 997),
    );
  });
  return { beads, shape, body, glints, refraction, rings, droplets, bolts };
};

export default createBubblePaths;

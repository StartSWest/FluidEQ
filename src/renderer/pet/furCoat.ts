/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { IPetPose } from './petPose';
import {
  type IFurFrame,
  type IFurPalette,
  type TRgb,
  mix,
  rgba,
  WHITE,
} from './furFace';

/**
 * Her coat: the tufts that make her outline, the single hairs past it, and
 * the belly and hair on her body (`furPaint.ts` draws the rest of her).
 */

interface ITuft {
  angle: number;
  length: number;
  curl: number;
  width: number;
  flicks: boolean;
}

interface ISurfaceHair {
  x: number;
  y: number;
  length: number;
}

interface IFur {
  tufts: readonly ITuft[];
  wisps: readonly ITuft[];
  hair: readonly ISurfaceHair[];
}

/** Her fur, the same every time she is drawn: a fixed seed. */
let fur: IFur | undefined;
const furOf = (): IFur => {
  if (fur) {
    return fur;
  }
  let seed = 11;
  const random = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
  const tufts: ITuft[] = [];
  for (let index = 0; index < 96; index += 1) {
    tufts.push({
      angle: (index / 96) * Math.PI * 2 + (random() - 0.5) * 0.05,
      length: random(),
      curl: random() - 0.5,
      width: 0.55 + random() * 0.6,
      flicks: random() > 0.55,
    });
  }
  const wisps: ITuft[] = [];
  for (let index = 0; index < 140; index += 1) {
    wisps.push({
      angle: random() * Math.PI * 2,
      length: random(),
      curl: random() - 0.5,
      width: 1,
      flicks: random() > 0.55,
    });
  }
  const hair: ISurfaceHair[] = [];
  while (hair.length < 240) {
    const x = random() * 2 - 1;
    const y = random() * 2 - 1;
    if (x * x + y * y <= 0.8) {
      hair.push({ x, y, length: 0.045 + random() * 0.05 });
    }
  }
  fur = { tufts, wisps, hair };
  return fur;
};

/** A pear, not a ball: she sits, so she is wider at the bottom. */
export const rim = (
  angle: number,
  centreY: number,
  radius: number,
  k: number,
) => {
  const sin = Math.sin(angle);
  const r = radius * k * (1 + 0.12 * sin - 0.04 * Math.max(0, -sin) ** 4);
  return [Math.cos(angle) * r, centreY + sin * r * 0.95] as const;
};

export const bodyPath = (
  context: CanvasRenderingContext2D,
  centreY: number,
  radius: number,
) => {
  context.beginPath();
  for (let index = 0; index <= 72; index += 1) {
    const [x, y] = rim((index / 72) * Math.PI * 2, centreY, radius, 1);
    if (index === 0) {
      context.moveTo(x, y);
    } else {
      context.lineTo(x, y);
    }
  }
  context.closePath();
};

/** How much light a point of her edge faces: 1 to the top left, -1 away. */
const litAt = (angle: number) =>
  -(Math.cos(angle) * 0.6 + Math.sin(angle) * 0.8);

const shadeOf = (palette: IFurPalette, lit: number): TRgb =>
  lit > 0
    ? mix(palette.tone, palette.light, lit * 0.85)
    : mix(palette.tone, palette.dark, -lit * 0.8);

/** How far the music stands a tuft up, by where it grows. */
const standOf = (pose: IPetPose, angle: number, tuft: ITuft) => {
  const sin = Math.sin(angle);
  const down = Math.max(0, sin) ** 2;
  const up = Math.max(0, -sin) ** 2;
  const side = Math.cos(angle) ** 2;
  return (
    down * pose.furBass * 0.9 +
    side * pose.furMid * 0.55 +
    up * (pose.furTreble * 0.5 + (tuft.flicks ? pose.furHat * 0.6 : 0))
  );
};

export const paintTufts = (
  context: CanvasRenderingContext2D,
  frame: IFurFrame,
  centreY: number,
  radius: number,
  count: number,
  k: number,
  lengthScale: number,
  alpha: number,
) => {
  const { pose, palette } = frame;
  const { tufts } = furOf();
  const levels = new Map<number, Path2D>();
  const step = tufts.length / count;
  for (let index = 0; index < count; index += 1) {
    const tuft = tufts[Math.floor(index * step)];
    const { angle } = tuft;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const [x0, y0] = rim(angle, centreY, radius, k);
    // Pressed short where she sits on it.
    const seat = 1 - 0.75 * Math.max(0, sin) ** 3;
    const length =
      radius *
      (0.07 + 0.1 * tuft.length) *
      lengthScale *
      seat *
      (1 + standOf(pose, angle, tuft));
    const swing = pose.furSwing * (0.45 + tuft.length) + tuft.curl * 0.4;
    let dx = cos * Math.cos(swing) - sin * Math.sin(swing);
    let dy =
      cos * Math.sin(swing) +
      sin * Math.cos(swing) +
      0.2 * Math.max(0, sin) * Math.abs(cos);
    const size = Math.hypot(dx, dy);
    dx /= size;
    dy /= size;
    const px = -dy;
    const py = dx;
    const half = radius * 0.06 * tuft.width;
    const curl = tuft.curl * length * 0.6;
    const level = Math.round(((litAt(angle) + 1) / 2) * 7);
    let path = levels.get(level);
    if (!path) {
      path = new Path2D();
      levels.set(level, path);
    }
    const midX = x0 + dx * length * 0.5 + px * curl * 0.4;
    const midY = y0 + dy * length * 0.5 + py * curl * 0.4;
    path.moveTo(x0 - px * half, y0 - py * half);
    path.quadraticCurveTo(
      midX - px * half * 0.4,
      midY - py * half * 0.4,
      x0 + dx * length + px * curl,
      y0 + dy * length + py * curl,
    );
    path.quadraticCurveTo(
      midX + px * half * 0.4,
      midY + py * half * 0.4,
      x0 + px * half,
      y0 + py * half,
    );
    path.closePath();
  }
  levels.forEach((path, level) => {
    context.fillStyle = rgba(shadeOf(palette, (level / 7) * 2 - 1), alpha);
    context.fill(path);
  });
};

/** Single hairs past the outline, bright where the light comes from. */
export const paintWisps = (
  context: CanvasRenderingContext2D,
  frame: IFurFrame,
  centreY: number,
  radius: number,
  count: number,
) => {
  const { pose, palette, ratio } = frame;
  const { wisps } = furOf();
  const lit = new Path2D();
  const shade = new Path2D();
  for (let index = 0; index < count; index += 1) {
    const wisp = wisps[index];
    const { angle } = wisp;
    const sin = Math.sin(angle);
    const [x0, y0] = rim(angle, centreY, radius, 1.03);
    const length =
      radius *
      (0.05 + 0.06 * wisp.length) *
      (1 - 0.8 * Math.max(0, sin) ** 3) *
      (1 + standOf(pose, angle, wisp));
    const swing = pose.furSwing * (0.7 + wisp.length) + wisp.curl * 0.6;
    const dx = Math.cos(angle + swing);
    const dy = Math.sin(angle + swing) + 0.3 * Math.max(0, sin);
    const path = litAt(angle) > -0.2 ? lit : shade;
    path.moveTo(x0, y0);
    path.quadraticCurveTo(
      x0 + dx * length * 0.6 - dy * wisp.curl * length * 0.5,
      y0 + dy * length * 0.6 + dx * wisp.curl * length * 0.5,
      x0 + dx * length,
      y0 + dy * length,
    );
  }
  context.lineCap = 'round';
  context.lineWidth = Math.max(0.45 / ratio, radius * 0.013);
  context.strokeStyle = rgba(mix(palette.light, WHITE, 0.35), 0.5);
  context.stroke(lit);
  context.strokeStyle = rgba(palette.tone, 0.35);
  context.stroke(shade);
};

export const paintBodySurface = (
  context: CanvasRenderingContext2D,
  frame: IFurFrame,
  centreY: number,
  radius: number,
  small: boolean,
  big: boolean,
) => {
  const { palette, pose, ratio } = frame;
  context.save();
  bodyPath(context, centreY, radius);
  context.clip();
  context.save();
  context.translate(pose.faceX * radius * 0.15, centreY + radius * 0.5);
  context.scale(1, 0.8);
  const belly = context.createRadialGradient(
    0,
    -radius * 0.08,
    0,
    0,
    0,
    radius * 0.7,
  );
  belly.addColorStop(0, rgba(palette.belly, 0.95));
  belly.addColorStop(0.55, rgba(palette.belly, 0.6));
  belly.addColorStop(1, rgba(palette.belly, 0));
  context.fillStyle = belly;
  context.beginPath();
  context.arc(0, 0, radius * 0.7, 0, Math.PI * 2);
  context.fill();
  context.restore();
  // Where she sits, the fur is in her own shade.
  const seat = context.createLinearGradient(0, -radius * 0.35, 0, 0);
  seat.addColorStop(0, rgba(palette.dark, 0));
  seat.addColorStop(1, rgba(palette.dark, 0.45));
  context.fillStyle = seat;
  context.fillRect(-radius * 1.3, -radius * 0.35, radius * 2.6, radius * 0.4);
  if (!small) {
    const lit = new Path2D();
    const shade = new Path2D();
    const { hair } = furOf();
    const count = big ? 240 : 140;
    for (let index = 0; index < count; index += 1) {
      const strand = hair[index];
      const x = strand.x * radius * 0.95;
      const y = centreY + strand.y * radius * 0.92;
      let dx = strand.x * 0.8;
      let dy = strand.y + 0.9;
      const size = Math.hypot(dx, dy) || 1;
      dx /= size;
      dy /= size;
      const path = strand.x + strand.y < -0.15 ? lit : shade;
      path.moveTo(x, y);
      path.lineTo(
        x + dx * radius * strand.length,
        y + dy * radius * strand.length,
      );
    }
    context.lineWidth = Math.max(0.45 / ratio, radius * 0.016);
    context.strokeStyle = rgba(mix(palette.light, WHITE, 0.2), 0.16);
    context.stroke(lit);
    context.strokeStyle = rgba(palette.dark, 0.14);
    context.stroke(shade);
  }
  context.restore();
};

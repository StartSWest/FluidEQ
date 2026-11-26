/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  bodyPath,
  paintBodySurface,
  paintTufts,
  paintWisps,
  rim,
} from './furCoat';
import {
  type IFurFrame,
  paintFace,
  paintStar,
  rgba,
  mix,
  WHITE,
} from './furFace';

export { furPalette, type IFurFrame, type IFurPalette } from './furFace';

/**
 * The pet drawn on a canvas: a small furry creature in her mint, lit from the
 * top left, her outline made of fur rather than drawn, two floppy ears with
 * pink inside, glossy eyes with lids, headphones on her head, feet and paws.
 * No outline, no glow, no shadow under her.
 *
 * Her fur is filled tufts in the colour of the body where they grow, so the
 * edge is soft and lit like the body; a ring of lines read as a sea urchin.
 * The tufts stand up with the music by where they grow - bass at her feet,
 * mids at her sides, treble at the top - and swing behind her moves.
 *
 * Everything is measured in her body's radius, which is 0.3 of the square she
 * is given, so she is the same creature at 22, 36 and 126 px; below 60 px the
 * surface hair and the toe pads are left out, which at that size are noise.
 */

const paintEar = (
  context: CanvasRenderingContext2D,
  frame: IFurFrame,
  side: -1 | 1,
  centreY: number,
  radius: number,
  detailed: boolean,
) => {
  const { palette, pose, ratio } = frame;
  const phi = side < 0 ? -0.56 : 0.54;
  const length = radius * (side < 0 ? 0.8 : 0.66);
  const width = radius * 0.3;
  const turn = side < 0 ? pose.earLeft : pose.earRight;
  const [x, y] = rim(-Math.PI / 2 + phi, centreY, radius, 0.8);
  context.save();
  context.translate(x, y);
  context.rotate(phi * 0.75 + turn);
  const shape = (s: number) => {
    context.beginPath();
    context.moveTo(-width * s, 0);
    context.bezierCurveTo(
      -width * s * 1.12,
      -length * s * 0.45,
      -width * s * 0.5,
      -length * s * 0.98,
      0,
      -length * s,
    );
    context.bezierCurveTo(
      width * s * 0.5,
      -length * s * 0.98,
      width * s * 1.12,
      -length * s * 0.45,
      width * s,
      0,
    );
    context.closePath();
  };
  const outer = context.createLinearGradient(-width, 0, width * 0.4, -length);
  outer.addColorStop(0, rgba(mix(palette.tone, palette.dark, 0.25)));
  outer.addColorStop(0.6, rgba(palette.tone));
  outer.addColorStop(1, rgba(palette.light));
  context.fillStyle = outer;
  shape(1);
  context.fill();
  const inner = context.createLinearGradient(0, 0, 0, -length);
  inner.addColorStop(0, rgba(mix(palette.inner, palette.nose, 0.35)));
  inner.addColorStop(1, rgba(mix(palette.inner, WHITE, 0.2)));
  context.save();
  context.translate(0, -length * 0.04);
  context.fillStyle = inner;
  shape(0.6);
  context.fill();
  context.restore();
  if (detailed) {
    // The light caught in the fine hair on the ear's rim and inside it.
    context.strokeStyle = rgba(mix(palette.light, WHITE, 0.3), 0.5);
    context.lineWidth = Math.max(0.5 / ratio, radius * 0.012);
    context.lineCap = 'round';
    context.beginPath();
    for (let k = 0; k < 9; k += 1) {
      const t = 0.15 + k * 0.09;
      const ex = -width * (1.02 - t * 0.85);
      const ey = -length * t;
      context.moveTo(ex, ey);
      context.lineTo(ex - radius * 0.06, ey - radius * 0.035);
      context.moveTo(-ex, ey);
      context.lineTo(-ex + radius * 0.06, ey - radius * 0.035);
    }
    for (let k = 0; k < 5; k += 1) {
      const hx = (k - 2) * width * 0.12;
      context.moveTo(hx, -length * 0.12);
      context.lineTo(hx * 1.4, -length * 0.42);
    }
    context.moveTo(0, -length);
    context.lineTo(
      -radius * 0.02 + turn * radius * 0.15,
      -length - radius * 0.09,
    );
    context.stroke();
  }
  context.restore();
};

/**
 * Headphones on her head: the band over her crown between the ears, a cup on
 * each side seen edge-on, the speakers' rims lighting with the bass.
 */
const paintHeadphones = (
  context: CanvasRenderingContext2D,
  frame: IFurFrame,
  centreY: number,
  radius: number,
) => {
  const { palette, pose } = frame;
  context.strokeStyle = rgba(palette.band);
  context.lineWidth = radius * 0.085;
  context.lineCap = 'round';
  context.beginPath();
  context.ellipse(
    0,
    centreY + radius * 0.02,
    radius,
    radius * 1.06,
    0,
    Math.PI * 1.06,
    Math.PI * 1.94,
  );
  context.stroke();
  context.strokeStyle = 'rgba(255,255,255,0.18)';
  context.lineWidth = radius * 0.022;
  context.beginPath();
  context.ellipse(
    0,
    centreY + radius * 0.02,
    radius * 0.985,
    radius * 1.045,
    0,
    Math.PI * 1.2,
    Math.PI * 1.5,
  );
  context.stroke();
  [-1, 1].forEach((side) => {
    const pulse = 1 + 0.08 * pose.speaker;
    context.save();
    context.translate(side * radius * 0.98, centreY + radius * 0.04);
    context.scale(pulse, pulse);
    const cup = context.createLinearGradient(
      -radius * 0.14,
      -radius * 0.24,
      radius * 0.14,
      radius * 0.24,
    );
    cup.addColorStop(0, rgba(palette.cupLight));
    cup.addColorStop(1, rgba(palette.cupDark));
    context.fillStyle = cup;
    context.beginPath();
    context.ellipse(0, 0, radius * 0.14, radius * 0.25, 0, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = rgba(palette.speaker, 0.55 + 0.45 * pose.speaker);
    context.lineWidth = radius * 0.04;
    context.beginPath();
    context.ellipse(
      side * radius * 0.03,
      0,
      radius * 0.075,
      radius * 0.17,
      0,
      0,
      Math.PI * 2,
    );
    context.stroke();
    context.fillStyle = 'rgba(255,255,255,0.3)';
    context.beginPath();
    context.ellipse(
      -radius * 0.04,
      -radius * 0.13,
      radius * 0.035,
      radius * 0.06,
      0.2,
      0,
      Math.PI * 2,
    );
    context.fill();
    context.restore();
  });
};

const paintLimbs = (
  context: CanvasRenderingContext2D,
  frame: IFurFrame,
  centreY: number,
  radius: number,
  small: boolean,
) => {
  const { palette, pose } = frame;
  [-1, 1].forEach((side) => {
    const lift = (side < 0 ? pose.footLeft : pose.footRight) * radius * 0.3;
    const fx = side * radius * 0.42;
    const fy = -radius * 0.08 - lift;
    const foot = context.createRadialGradient(
      fx - radius * 0.07,
      fy - radius * 0.07,
      radius * 0.02,
      fx,
      fy,
      radius * 0.3,
    );
    foot.addColorStop(0, rgba(mix(palette.light, WHITE, 0.15)));
    foot.addColorStop(1, rgba(mix(palette.tone, palette.dark, 0.35)));
    context.fillStyle = foot;
    context.beginPath();
    context.ellipse(
      fx,
      fy,
      radius * 0.27,
      radius * 0.155,
      side * -0.1,
      0,
      Math.PI * 2,
    );
    context.fill();
    if (!small) {
      context.fillStyle = rgba(palette.inner, 0.9);
      context.beginPath();
      context.ellipse(
        fx,
        fy + radius * 0.025,
        radius * 0.085,
        radius * 0.055,
        0,
        0,
        Math.PI * 2,
      );
      context.fill();
      for (let toe = -1; toe <= 1; toe += 1) {
        context.beginPath();
        context.arc(
          fx + toe * radius * 0.085,
          fy - radius * 0.065,
          radius * 0.03,
          0,
          Math.PI * 2,
        );
        context.fill();
      }
    }
  });
  [-1, 1].forEach((side) => {
    const tap = (side < 0 ? pose.pawLeft : pose.pawRight) * radius * 0.06;
    const px = side * radius * 0.3;
    const py = centreY + radius * 0.6 - tap;
    const paw = context.createRadialGradient(
      px - radius * 0.04,
      py - radius * 0.04,
      0,
      px,
      py,
      radius * 0.15,
    );
    paw.addColorStop(0, rgba(mix(palette.light, WHITE, 0.1)));
    paw.addColorStop(1, rgba(mix(palette.tone, palette.dark, 0.15)));
    context.fillStyle = paw;
    context.beginPath();
    context.ellipse(
      px,
      py,
      radius * 0.13,
      radius * 0.1,
      side * 0.45,
      0,
      Math.PI * 2,
    );
    context.fill();
  });
};

/**
 * Draw her into whatever `context` is already drawing, its origin at the
 * top left of her square's room and one unit a CSS px: the share card puts
 * her into its own picture this way.
 */
/**
 * Where her feet stand below her square's middle, as a share of it: from her
 * ear tips (0.365 above) to her feet (0.365 below) she is centred in it, and
 * fills it top to bottom but for a quarter on either side. At 0.44 her top
 * third was empty, and in the titlebar she looked small in her button.
 */
const GROUND = 0.345;

export const drawFurPet = (
  context: CanvasRenderingContext2D,
  frame: IFurFrame,
) => {
  const { art, pad, pose, palette } = frame;
  const side = art + pad * 2;
  const radius = art * 0.3;
  const small = art < 60;
  const big = art >= 170;
  // How many tufts and hairs her size can show.
  const bySize = (few: number, some: number, many: number) => {
    if (small) {
      return few;
    }
    return big ? many : some;
  };
  const shrink = frame.mood === 'miss' ? 0.95 : 1;
  context.save();
  context.translate(
    side / 2 + pose.swayX * radius,
    side / 2 + art * GROUND - pose.hop * radius,
  );
  context.rotate(pose.lean);
  context.scale(
    pose.scaleX * (1 + frame.press * 0.04) * shrink,
    pose.scaleY * (1 - frame.press * 0.08) * shrink,
  );
  const centreY = -radius * 0.98;
  paintEar(context, frame, -1, centreY, radius, !small);
  paintEar(context, frame, 1, centreY, radius, !small);
  paintTufts(context, frame, centreY, radius, bySize(44, 72, 96), 0.95, 1, 1);
  paintWisps(context, frame, centreY, radius, bySize(30, 90, 140));
  const body = context.createRadialGradient(
    -radius * 0.36,
    centreY - radius * 0.5,
    radius * 0.05,
    0,
    centreY + radius * 0.05,
    radius * 1.12,
  );
  body.addColorStop(0, rgba(palette.light));
  body.addColorStop(0.5, rgba(palette.tone));
  body.addColorStop(1, rgba(mix(palette.tone, palette.dark, 0.8)));
  context.fillStyle = body;
  bodyPath(context, centreY, radius);
  context.fill();
  paintBodySurface(context, frame, centreY, radius, small, big);
  paintTufts(
    context,
    frame,
    centreY,
    radius,
    bySize(36, 72, 96),
    0.92,
    0.5,
    0.5,
  );
  paintLimbs(context, frame, centreY, radius, small);
  paintHeadphones(context, frame, centreY, radius);
  paintFace(context, frame, centreY, radius);
  if (frame.star > 0.01) {
    paintStar(context, frame, radius * 1.02, centreY - radius, radius * 0.2);
  }
  context.restore();
};

/** Paint one frame of her onto a canvas that is her square and its room. */
export const paintFurPet = (
  context: CanvasRenderingContext2D,
  frame: IFurFrame,
) => {
  const side = frame.art + frame.pad * 2;
  context.setTransform(frame.ratio, 0, 0, frame.ratio, 0, 0);
  context.clearRect(0, 0, side, side);
  drawFurPet(context, frame);
};

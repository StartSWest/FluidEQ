/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { ILamp } from 'common/lighting/lightingModel';
import {
  average,
  BODY,
  BODY_EDGE,
  body,
  colourAt,
  css,
  glowDot,
  lightLine,
  lightRing,
  roundRect,
  underglow,
  type TContext,
  type TDevicePainter,
} from './deskPaintKit';

/**
 * The mouse area: mice, their docks and charging pads, bungees, pads and
 * desk-length mats — each drawn where its lights really are.
 */

export const paintMouse: TDevicePainter = (c, e, rgb) => {
  // Underglow first, so the body sits in its own light.
  if (rgb) {
    c.save();
    c.shadowColor = css(average(rgb), 0.8);
    c.shadowBlur = e.width * 0.45;
    roundRect(c, e.x, e.y, e.width, e.height, e.width / 2);
    c.fillStyle = BODY;
    c.fill();
    c.restore();
  }
  body(c, e.x, e.y, e.width, e.height, e.width / 2);
  c.strokeStyle = 'rgba(214, 233, 247, 0.08)';
  c.beginPath();
  c.moveTo(e.x + e.width / 2, e.y + e.height * 0.06);
  c.lineTo(e.x + e.width / 2, e.y + e.height * 0.42);
  c.stroke();
  e.device.lamps.forEach((lamp, index) => {
    glowDot(
      c,
      e.x + lamp.u * e.width,
      e.y + lamp.v * e.height,
      Math.max(2.2, e.width * (lamp.reach > 0.14 ? 0.07 : 0.04)),
      colourAt(rgb, index),
      Boolean(rgb),
    );
  });
};

/**
 * A Mouse Dock Pro or Mouse Dock Chroma: a low rounded puck the mouse rests
 * on, its eight-zone light round the base spilling onto the desk.
 */
export const paintMouseDock: TDevicePainter = (c, e, rgb) => {
  const cx = e.x + e.width / 2;
  const cy = e.y + e.height * 0.58;
  underglow(c, cx, cy + e.height * 0.12, e.width * 0.75, e.height * 0.55, rgb);
  lightRing(
    c,
    e,
    rgb,
    [cx, cy + e.height * 0.08],
    [e.width * 0.48, e.height * 0.34],
    Math.max(2.4, e.height * 0.07),
  );
  // The puck, its charging contacts on top.
  c.save();
  c.shadowColor = 'rgba(2, 6, 18, 0.45)';
  c.shadowBlur = 10;
  c.beginPath();
  c.ellipse(cx, cy, e.width * 0.44, e.height * 0.3, 0, 0, Math.PI * 2);
  c.fillStyle = BODY;
  c.fill();
  c.restore();
  c.beginPath();
  c.ellipse(cx, cy, e.width * 0.44, e.height * 0.3, 0, 0, Math.PI * 2);
  c.strokeStyle = BODY_EDGE;
  c.lineWidth = 1;
  c.stroke();
  c.beginPath();
  c.ellipse(
    cx,
    cy - e.height * 0.03,
    e.width * 0.3,
    e.height * 0.17,
    0,
    0,
    Math.PI * 2,
  );
  c.strokeStyle = 'rgba(230, 232, 235, 0.12)';
  c.stroke();
  [-0.06, 0.06].forEach((offset) => {
    c.fillStyle = 'rgba(230, 232, 235, 0.35)';
    c.fillRect(cx + e.width * offset - 2, cy - e.height * 0.05, 4, 3);
  });
};

/** A round Qi charging pad with a soft top and a ring of light under it. */
export const paintChargingPad: TDevicePainter = (c, e, rgb) => {
  const cx = e.x + e.width / 2;
  const cy = e.y + e.height / 2;
  underglow(c, cx, cy, e.width * 0.7, e.height * 0.62, rgb);
  lightRing(
    c,
    e,
    rgb,
    [cx, cy + e.height * 0.04],
    [e.width * 0.48, e.height * 0.44],
    Math.max(2.2, e.height * 0.06),
  );
  c.beginPath();
  c.ellipse(cx, cy, e.width * 0.42, e.height * 0.36, 0, 0, Math.PI * 2);
  c.fillStyle = '#121416';
  c.fill();
  c.strokeStyle = BODY_EDGE;
  c.stroke();
  c.beginPath();
  c.ellipse(cx, cy, e.width * 0.12, e.height * 0.1, 0, 0, Math.PI * 2);
  c.strokeStyle = 'rgba(230, 232, 235, 0.16)';
  c.stroke();
};

/** A mouse bungee: a weighted base lit underneath, a spring arm rising back. */
export const paintMouseBungee: TDevicePainter = (c, e, rgb) => {
  const baseY = e.y + e.height * 0.66;
  const baseHeight = e.height * 0.3;
  underglow(
    c,
    e.x + e.width / 2,
    baseY + baseHeight * 0.8,
    e.width * 0.7,
    baseHeight,
    rgb,
  );
  lightLine(
    c,
    [e.x + e.width * 0.14, baseY + baseHeight * 0.96],
    [e.x + e.width * 0.86, baseY + baseHeight * 0.96],
    Math.max(2.4, baseHeight * 0.14),
    average(rgb),
    Boolean(rgb),
  );
  body(
    c,
    e.x + e.width * 0.08,
    baseY,
    e.width * 0.84,
    baseHeight,
    baseHeight * 0.45,
  );
  // The arm: a spring coiled up to the cable clip.
  c.strokeStyle = '#3a3d40';
  c.lineWidth = Math.max(2, e.width * 0.05);
  c.lineCap = 'round';
  c.beginPath();
  c.moveTo(e.x + e.width * 0.5, baseY + baseHeight * 0.2);
  c.quadraticCurveTo(
    e.x + e.width * 0.46,
    e.y + e.height * 0.3,
    e.x + e.width * 0.62,
    e.y + e.height * 0.06,
  );
  c.stroke();
  glowDot(
    c,
    e.x + e.width * 0.63,
    e.y + e.height * 0.05,
    3,
    [90, 94, 98],
    false,
  );
};

/** The light strip round a pad's edge, one run per lamp on its nearest side. */
const edgeLights = (
  c: TContext,
  lamps: readonly ILamp[],
  rgb: Uint8Array | undefined,
  x: number,
  y: number,
  w: number,
  h: number,
  thickness: number,
) => {
  const inset = 4;
  const left = x + inset;
  const right = x + w - inset;
  const top = y + inset;
  const bottom = y + h - inset;
  const side = (lamp: ILamp) => {
    const distances = [lamp.v, 1 - lamp.u, 1 - lamp.v, lamp.u];
    return distances.indexOf(Math.min(...distances));
  };
  const perSide = [0, 0, 0, 0];
  lamps.forEach((lamp) => {
    perSide[side(lamp)] += 1;
  });
  lamps.forEach((lamp, index) => {
    const edge = side(lamp);
    const colour = colourAt(rgb, index);
    const lit = Boolean(rgb);
    const horizontal = edge === 0 || edge === 2;
    const span = horizontal ? right - left : bottom - top;
    const half = span / Math.max(1, perSide[edge]) / 2 - 1.5;
    // Each run stays on its own edge: a lamp near a corner, alone on its
    // side, would otherwise reach past the corner into the room.
    if (horizontal) {
      const px = left + lamp.u * (right - left);
      const py = edge === 0 ? top : bottom;
      lightLine(
        c,
        [Math.max(left, px - half), py],
        [Math.min(right, px + half), py],
        thickness,
        colour,
        lit,
      );
    } else {
      const px = edge === 3 ? left : right;
      const py = top + lamp.v * (bottom - top);
      lightLine(
        c,
        [px, Math.max(top, py - half)],
        [px, Math.min(bottom, py + half)],
        thickness,
        colour,
        lit,
      );
    }
  });
};

const cloth = (
  c: TContext,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) => {
  roundRect(c, x, y, w, h, r);
  c.fillStyle = '#101214';
  c.fill();
  // The weave, so the surface reads as a mat and not a hole.
  c.save();
  roundRect(c, x, y, w, h, r);
  c.clip();
  c.strokeStyle = 'rgba(214, 233, 247, 0.025)';
  c.lineWidth = 1;
  for (let line = y + 8; line < y + h - 6; line += 6) {
    c.beginPath();
    c.moveTo(x + 6, line);
    c.lineTo(x + w - 6, line);
    c.stroke();
  }
  c.restore();
  roundRect(c, x, y, w, h, r);
  c.strokeStyle = BODY_EDGE;
  c.lineWidth = 1;
  c.stroke();
};

export const paintMousepad: TDevicePainter = (c, e, rgb) => {
  cloth(c, e.x, e.y, e.width, e.height, 10);
  edgeLights(c, e.device.lamps, rgb, e.x, e.y, e.width, e.height, 3);
};

/**
 * A desk-length mat — Strider Chroma, Goliathus Extended — under the keyboard
 * and the mouse, lit round its edge like a pad but as long as the desk.
 */
export const paintDeskMat: TDevicePainter = (c, e, rgb) => {
  underglow(
    c,
    e.x + e.width / 2,
    e.y + e.height,
    e.width * 0.55,
    e.height * 0.35,
    rgb,
  );
  cloth(c, e.x, e.y, e.width, e.height, 14);
  edgeLights(c, e.device.lamps, rgb, e.x, e.y, e.width, e.height, 3.4);
};

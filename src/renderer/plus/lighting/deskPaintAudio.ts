/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { ILamp } from 'common/lighting/lightingModel';
import {
  average,
  bodyTone,
  BODY_EDGE,
  body,
  colourAt,
  css,
  lightArc,
  lightLine,
  lightRing,
  roundRect,
  underglow,
  type TColour,
  type TDevicePainter,
  tone,
} from './deskPaintKit';

/**
 * Headsets, their stands, speakers, soundbars and microphones — each lit where
 * Razer puts the light: earcup rings, a stand's base, light thrown on the wall
 * behind a speaker, the front edge of a soundbar.
 */

export const paintHeadset: TDevicePainter = (c, e, rgb) => {
  const cupWidth = e.width * 0.24;
  const cupHeight = e.height * 0.52;
  const cupsY = e.y + e.height * 0.4;
  c.strokeStyle = tone(0.22);
  c.lineWidth = Math.max(6, e.width * 0.07);
  c.lineCap = 'round';
  c.beginPath();
  c.ellipse(
    e.x + e.width / 2,
    cupsY + cupHeight * 0.25,
    e.width / 2 - cupWidth / 2,
    e.height * 0.62,
    0,
    Math.PI,
    Math.PI * 2,
  );
  c.stroke();
  c.lineWidth = 1;
  // Each ear cup carries a ring of light round its outer face; the lamps on
  // the left of the picture light the left cup's ring, the rest the right.
  [
    { cupX: e.x, onThisCup: (lamp: ILamp) => lamp.u < 0.5 },
    {
      cupX: e.x + e.width - cupWidth,
      onThisCup: (lamp: ILamp) => lamp.u >= 0.5,
    },
  ].forEach(({ cupX, onThisCup }) => {
    body(c, cupX, cupsY, cupWidth, cupHeight, cupWidth * 0.45);
    const cupLamps = e.device.lamps
      .map((lamp, index) => ({ lamp, index }))
      .filter(({ lamp }) => onThisCup(lamp));
    const centre: [number, number] = [
      cupX + cupWidth / 2,
      cupsY + cupHeight / 2,
    ];
    const radii: [number, number] = [cupWidth * 0.3, cupHeight * 0.32];
    const share = (Math.PI * 2) / Math.max(1, cupLamps.length);
    cupLamps.forEach(({ index }, position) => {
      const start = -Math.PI / 2 + position * share + 0.12;
      lightArc(
        c,
        centre,
        radii,
        [start, start + share - 0.24],
        Math.max(2.4, cupWidth * 0.09),
        colourAt(rgb, index),
        Boolean(rgb),
      );
    });
  });
};

/**
 * A headset stand after the Base Station V2 Chroma: a round weighted base
 * with its ring of light spilling onto the desk, a slim aluminium upright,
 * and a curved rubber ledge at the top the headband rests on.
 */
export const paintHeadsetStand: TDevicePainter = (c, e, rgb) => {
  const cx = e.x + e.width / 2;
  const baseHeight = e.height * 0.1;
  const baseY = e.y + e.height - baseHeight;
  underglow(
    c,
    cx,
    baseY + baseHeight * 0.9,
    e.width * 0.8,
    baseHeight * 1.4,
    rgb,
  );
  // Upright: a flat bar, lit on its left edge by the room.
  const poleWidth = e.width * 0.11;
  const poleTop = e.y + e.height * 0.1;
  const metal = c.createLinearGradient(
    cx - poleWidth / 2,
    0,
    cx + poleWidth / 2,
    0,
  );
  metal.addColorStop(0, tone(0.15));
  metal.addColorStop(0.35, tone(0.34));
  metal.addColorStop(1, tone(0.11));
  roundRect(
    c,
    cx - poleWidth / 2,
    poleTop,
    poleWidth,
    baseY - poleTop + 2,
    poleWidth * 0.3,
  );
  c.fillStyle = metal;
  c.fill();
  // The ledge: a shallow arc the headband sits in.
  c.strokeStyle = tone(0.22);
  c.lineWidth = Math.max(5, e.height * 0.03);
  c.lineCap = 'round';
  c.beginPath();
  c.ellipse(
    cx,
    poleTop + e.height * 0.02,
    e.width * 0.34,
    e.height * 0.05,
    0,
    Math.PI * 1.08,
    Math.PI * 1.92,
  );
  c.stroke();
  // Base: a flat disc, its light ring round the lower edge.
  c.save();
  c.shadowColor = 'rgba(2, 6, 18, 0.45)';
  c.shadowBlur = 12;
  c.beginPath();
  c.ellipse(
    cx,
    baseY + baseHeight * 0.45,
    e.width * 0.46,
    baseHeight * 0.55,
    0,
    0,
    Math.PI * 2,
  );
  c.fillStyle = bodyTone();
  c.fill();
  c.restore();
  c.beginPath();
  c.ellipse(
    cx,
    baseY + baseHeight * 0.45,
    e.width * 0.46,
    baseHeight * 0.55,
    0,
    0,
    Math.PI * 2,
  );
  c.strokeStyle = BODY_EDGE;
  c.lineWidth = 1;
  c.stroke();
  lightRing(
    c,
    e,
    rgb,
    [cx, baseY + baseHeight * 0.62],
    [e.width * 0.44, baseHeight * 0.42],
    Math.max(2.2, baseHeight * 0.16),
  );
};

/** The lamps on one side of the picture, or all of them when none are. */
const sideColour = (
  lamps: readonly ILamp[],
  rgb: Uint8Array | undefined,
  side: 'left' | 'right' | undefined,
): TColour => {
  if (!rgb) {
    return average(undefined);
  }
  const chosen = lamps
    .map((lamp, index) => ({ lamp, index }))
    .filter(
      ({ lamp }) => !side || (side === 'left' ? lamp.u < 0.5 : lamp.u >= 0.5),
    );
  if (chosen.length === 0) {
    return average(rgb);
  }
  const total = chosen.reduce<TColour>(
    (sum, { index }) => {
      const colour = colourAt(rgb, index);
      return [sum[0] + colour[0], sum[1] + colour[1], sum[2] + colour[2]];
    },
    [0, 0, 0],
  );
  return [
    total[0] / chosen.length,
    total[1] / chosen.length,
    total[2] / chosen.length,
  ];
};

/**
 * One speaker of a pair (Nommo V2): a rounded cabinet with its driver, the
 * light projected from its back onto the wall behind it.
 */
export const paintSpeaker: TDevicePainter = (c, e, rgb) => {
  const colour = sideColour(e.device.lamps, rgb, e.part);
  if (rgb) {
    const cx = e.x + e.width / 2;
    const cy = e.y + e.height * 0.42;
    const glow = c.createRadialGradient(cx, cy, 0, cx, cy, e.height * 0.9);
    glow.addColorStop(0, css(colour, 0.5));
    glow.addColorStop(1, css(colour, 0));
    c.fillStyle = glow;
    c.fillRect(cx - e.height, cy - e.height, e.height * 2, e.height * 2);
  }
  body(c, e.x, e.y, e.width, e.height * 0.9, e.width * 0.22);
  const cx = e.x + e.width / 2;
  const driverY = e.y + e.height * 0.46;
  const radius = e.width * 0.32;
  c.beginPath();
  c.arc(cx, driverY, radius, 0, Math.PI * 2);
  c.fillStyle = tone(0.03);
  c.fill();
  c.strokeStyle = BODY_EDGE;
  c.stroke();
  c.beginPath();
  c.arc(cx, driverY, radius * 0.35, 0, Math.PI * 2);
  c.fillStyle = tone(0.15);
  c.fill();
  // Its foot.
  roundRect(
    c,
    e.x + e.width * 0.18,
    e.y + e.height * 0.9,
    e.width * 0.64,
    e.height * 0.08,
    3,
  );
  c.fillStyle = tone(0.15);
  c.fill();
};

/**
 * A soundbar (Leviathan V2): a long, low bar on small feet, its zones in a
 * strip along the lower front edge lighting the desk in front of it.
 */
export const paintSoundbar: TDevicePainter = (c, e, rgb) => {
  underglow(
    c,
    e.x + e.width / 2,
    e.y + e.height,
    e.width * 0.55,
    e.height * 0.9,
    rgb,
  );
  body(c, e.x, e.y, e.width, e.height * 0.82, e.height * 0.3);
  // The grille.
  c.save();
  roundRect(c, e.x + 4, e.y + 4, e.width - 8, e.height * 0.5, e.height * 0.2);
  c.clip();
  c.fillStyle = 'rgba(230, 232, 235, 0.05)';
  for (let hole = e.x + 8; hole < e.x + e.width - 6; hole += 6) {
    for (let row = e.y + 8; row < e.y + e.height * 0.5; row += 5) {
      c.fillRect(hole, row, 1.6, 1.6);
    }
  }
  c.restore();
  const { lamps } = e.device;
  const ordered = lamps
    .map((lamp, index) => ({ lamp, index }))
    .sort((a, b) => a.lamp.u - b.lamp.u);
  const count = Math.max(1, ordered.length);
  const stripY = e.y + e.height * 0.74;
  const span = e.width - e.height * 0.6;
  const start = e.x + e.height * 0.3;
  ordered.forEach(({ index }, position) => {
    const from = start + (position / count) * span + 1.5;
    const to = start + ((position + 1) / count) * span - 1.5;
    lightLine(
      c,
      [from, stripY],
      [to, stripY],
      Math.max(2.4, e.height * 0.07),
      colourAt(rgb, index),
      Boolean(rgb),
    );
  });
  // Feet.
  [0.12, 0.88].forEach((at) => {
    roundRect(
      c,
      e.x + e.width * at - 8,
      e.y + e.height * 0.82,
      16,
      e.height * 0.14,
      3,
    );
    c.fillStyle = tone(0.15);
    c.fill();
  });
};

/**
 * A microphone (Seiren V3 Chroma): a cylindrical capsule with its lit band,
 * held by a yoke on a round desk stand.
 */
export const paintMicrophone: TDevicePainter = (c, e, rgb) => {
  const cx = e.x + e.width / 2;
  const capsuleWidth = e.width * 0.62;
  const capsuleHeight = e.height * 0.58;
  const capsuleY = e.y;
  // Stand: a round foot and a short neck.
  const footY = e.y + e.height * 0.9;
  c.beginPath();
  c.ellipse(cx, footY, e.width * 0.46, e.height * 0.06, 0, 0, Math.PI * 2);
  c.fillStyle = bodyTone();
  c.fill();
  c.strokeStyle = BODY_EDGE;
  c.stroke();
  roundRect(
    c,
    cx - 3,
    capsuleY + capsuleHeight,
    6,
    footY - capsuleY - capsuleHeight,
    2,
  );
  c.fillStyle = tone(0.22);
  c.fill();
  // Yoke either side of the capsule.
  c.strokeStyle = tone(0.22);
  c.lineWidth = 3;
  c.beginPath();
  c.moveTo(cx - capsuleWidth * 0.62, capsuleY + capsuleHeight * 0.5);
  c.lineTo(cx - capsuleWidth * 0.62, capsuleY + capsuleHeight * 1.02);
  c.lineTo(cx + capsuleWidth * 0.62, capsuleY + capsuleHeight * 1.02);
  c.lineTo(cx + capsuleWidth * 0.62, capsuleY + capsuleHeight * 0.5);
  c.stroke();
  c.lineWidth = 1;
  body(
    c,
    cx - capsuleWidth / 2,
    capsuleY,
    capsuleWidth,
    capsuleHeight,
    capsuleWidth / 2,
  );
  // Grille lines at the top.
  c.strokeStyle = 'rgba(230, 232, 235, 0.08)';
  for (let row = 1; row <= 3; row += 1) {
    const y = capsuleY + capsuleHeight * (0.12 + row * 0.07);
    c.beginPath();
    c.moveTo(cx - capsuleWidth * 0.34, y);
    c.lineTo(cx + capsuleWidth * 0.34, y);
    c.stroke();
  }
  // The lit zones, stacked up the body.
  const { lamps } = e.device;
  const ordered = lamps
    .map((lamp, index) => ({ lamp, index }))
    .sort((a, b) => b.lamp.v - a.lamp.v);
  const count = Math.max(1, ordered.length);
  const top = capsuleY + capsuleHeight * 0.46;
  const bottom = capsuleY + capsuleHeight * 0.92;
  ordered.forEach(({ index }, position) => {
    const y = bottom - ((position + 0.5) / count) * (bottom - top);
    lightLine(
      c,
      [cx - capsuleWidth * 0.3, y],
      [cx + capsuleWidth * 0.3, y],
      Math.max(2, ((bottom - top) / count) * 0.55),
      colourAt(rgb, index),
      Boolean(rgb),
    );
  });
};

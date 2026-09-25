/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  acrossPicture,
  average,
  bodyTone,
  BODY_EDGE,
  body,
  colourAt,
  css,
  glowDot,
  lightLine,
  roundRect,
  strip,
  underglow,
  type TDevicePainter,
  tone,
} from './deskPaintKit';

/**
 * Gear that stands apart from the desk's surface: controllers, towers and
 * eGPU enclosures, audio mixers, and anything not recognised.
 */

/**
 * A controller (Wolverine V2 Chroma): grips, two sticks and the face buttons,
 * its light in a strip down each grip — the lamps on the left of the picture
 * down the left grip, the rest down the right.
 */
export const paintController: TDevicePainter = (c, e, rgb) => {
  const { x, y, width: w, height: h } = e;
  c.save();
  c.shadowColor = 'rgba(2, 6, 18, 0.45)';
  c.shadowBlur = 12;
  c.beginPath();
  c.moveTo(x + w * 0.2, y + h * 0.12);
  c.lineTo(x + w * 0.8, y + h * 0.12);
  c.quadraticCurveTo(x + w, y + h * 0.18, x + w * 0.96, y + h * 0.7);
  c.quadraticCurveTo(x + w * 0.9, y + h, x + w * 0.74, y + h * 0.86);
  c.lineTo(x + w * 0.26, y + h * 0.86);
  c.quadraticCurveTo(x + w * 0.1, y + h, x + w * 0.04, y + h * 0.7);
  c.quadraticCurveTo(x, y + h * 0.18, x + w * 0.2, y + h * 0.12);
  c.closePath();
  c.fillStyle = bodyTone();
  c.fill();
  c.restore();
  c.strokeStyle = BODY_EDGE;
  c.lineWidth = 1;
  c.stroke();
  [
    [0.32, 0.4],
    [0.6, 0.62],
  ].forEach(([u, v]) => {
    c.beginPath();
    c.arc(x + w * u, y + h * v, h * 0.1, 0, Math.PI * 2);
    c.fillStyle = tone(0.22);
    c.fill();
  });
  [
    [0.72, 0.32],
    [0.78, 0.4],
    [0.66, 0.4],
    [0.72, 0.48],
  ].forEach(([u, v]) => {
    c.beginPath();
    c.arc(x + w * u, y + h * v, h * 0.035, 0, Math.PI * 2);
    c.fillStyle = tone(0.28);
    c.fill();
  });
  const ordered = acrossPicture(e);
  const half = Math.ceil(ordered.length / 2);
  [
    { lamps: ordered.slice(0, half), from: [0.13, 0.3], to: [0.1, 0.72] },
    { lamps: ordered.slice(half), from: [0.87, 0.3], to: [0.9, 0.72] },
  ].forEach(({ lamps, from, to }) => {
    const count = Math.max(1, lamps.length);
    lamps.forEach(({ index }, position) => {
      const at = (position + 0.5) / count;
      glowDot(
        c,
        x + w * (from[0] + (to[0] - from[0]) * at),
        y + h * (from[1] + (to[1] - from[1]) * at),
        Math.max(2, Math.min(3.2, (h * 0.42) / count / 2)),
        colourAt(rgb, index),
        Boolean(rgb),
      );
    });
  });
};

/**
 * A tower beside the desk (Tomahawk case, Core X Chroma eGPU): a tall dark box
 * with a window glowing from inside and a bar of light under its front.
 */
export const paintTower: TDevicePainter = (c, e, rgb) => {
  underglow(
    c,
    e.x + e.width / 2,
    e.y + e.height,
    e.width * 0.8,
    e.height * 0.18,
    rgb,
  );
  body(c, e.x, e.y, e.width, e.height * 0.96, 8);
  const colour = average(rgb);
  // The side window, lit from inside.
  roundRect(
    c,
    e.x + e.width * 0.12,
    e.y + e.height * 0.08,
    e.width * 0.76,
    e.height * 0.66,
    6,
  );
  if (rgb) {
    const inside = c.createLinearGradient(0, e.y, 0, e.y + e.height * 0.74);
    inside.addColorStop(0, css(colour, 0.08));
    inside.addColorStop(1, css(colour, 0.32));
    c.fillStyle = inside;
  } else {
    c.fillStyle = 'rgba(230, 232, 235, 0.03)';
  }
  c.fill();
  c.strokeStyle = 'rgba(230, 232, 235, 0.14)';
  c.lineWidth = 1;
  c.stroke();
  strip(
    c,
    e,
    rgb,
    e.x + e.width * 0.08,
    e.x + e.width * 0.92,
    e.y + e.height * 0.88,
    Math.max(2.6, e.height * 0.014),
  );
};

/**
 * An audio mixer (Razer Audio Mixer): four fader channels, each lit along its
 * track — the lamps split across the channels in the order they cross the
 * picture, and stacked up each track.
 */
export const paintMixer: TDevicePainter = (c, e, rgb) => {
  body(c, e.x, e.y, e.width, e.height, 8);
  const channels = 4;
  const ordered = acrossPicture(e);
  const top = e.y + e.height * 0.16;
  const bottom = e.y + e.height * 0.84;
  for (let channel = 0; channel < channels; channel += 1) {
    const cx = e.x + e.width * (0.2 + channel * 0.2);
    const first = Math.floor((channel / channels) * ordered.length);
    const last = Math.floor(((channel + 1) / channels) * ordered.length);
    const lamps = ordered.slice(first, Math.max(first + 1, last));
    const share = (bottom - top) / Math.max(1, lamps.length);
    lamps.forEach(({ index }, position) => {
      lightLine(
        c,
        [cx + 6, bottom - share * position - 1],
        [cx + 6, bottom - share * (position + 1) + 1],
        2.2,
        colourAt(rgb, index),
        Boolean(rgb),
      );
    });
    roundRect(c, cx - 2, top, 4, bottom - top, 2);
    c.fillStyle = tone(0.03);
    c.fill();
    // The fader cap, each at its own level.
    roundRect(
      c,
      cx - 9,
      top + (bottom - top) * (0.2 + (channel % 3) * 0.22),
      18,
      9,
      2,
    );
    c.fillStyle = tone(0.34);
    c.fill();
  }
};

/** Anything else: a round lit object with its lamps round its edge. */
export const paintAccessory: TDevicePainter = (c, e, rgb) => {
  const cx = e.x + e.width / 2;
  const cy = e.y + e.height / 2;
  const radius = Math.min(e.width, e.height) * 0.42;
  c.save();
  c.shadowColor = 'rgba(0, 0, 0, 0.55)';
  c.shadowBlur = 16;
  c.beginPath();
  c.arc(cx, cy, radius, 0, Math.PI * 2);
  c.fillStyle = bodyTone();
  c.fill();
  c.restore();
  e.device.lamps.forEach((_lamp, index) => {
    const angle =
      (index / Math.max(1, e.device.lamps.length)) * Math.PI * 2 - Math.PI / 2;
    glowDot(
      c,
      cx + Math.cos(angle) * radius * 0.78,
      cy + Math.sin(angle) * radius * 0.78,
      3,
      colourAt(rgb, index),
      Boolean(rgb),
    );
  });
};

/**
 * A gaming chair (Soma Chroma) beside the desk: its backrest and headrest
 * wings, lit down both side edges of the upper backrest — the lamps on the
 * left of the picture down the left edge, the rest down the right.
 */
export const paintChair: TDevicePainter = (c, e, rgb) => {
  const { x, y, width: w, height: h } = e;
  underglow(c, x + w / 2, y + h, w * 0.7, h * 0.08, rgb);
  // The base and gas lift under the seat.
  c.strokeStyle = tone(0.22);
  c.lineWidth = Math.max(3, w * 0.04);
  c.lineCap = 'round';
  c.beginPath();
  c.moveTo(x + w / 2, y + h * 0.74);
  c.lineTo(x + w / 2, y + h * 0.94);
  c.moveTo(x + w * 0.18, y + h * 0.97);
  c.lineTo(x + w * 0.82, y + h * 0.97);
  c.stroke();
  // Seat.
  body(c, x + w * 0.04, y + h * 0.64, w * 0.92, h * 0.12, w * 0.08);
  // Backrest: narrower at the waist, wings round the head.
  c.save();
  c.shadowColor = 'rgba(2, 6, 18, 0.45)';
  c.shadowBlur = 14;
  c.beginPath();
  c.moveTo(x + w * 0.2, y + h * 0.66);
  c.lineTo(x + w * 0.12, y + h * 0.3);
  c.quadraticCurveTo(x + w * 0.04, y + h * 0.06, x + w * 0.26, y + h * 0.02);
  c.lineTo(x + w * 0.74, y + h * 0.02);
  c.quadraticCurveTo(x + w * 0.96, y + h * 0.06, x + w * 0.88, y + h * 0.3);
  c.lineTo(x + w * 0.8, y + h * 0.66);
  c.closePath();
  c.fillStyle = bodyTone();
  c.fill();
  c.restore();
  c.strokeStyle = BODY_EDGE;
  c.lineWidth = 1;
  c.stroke();
  // The headrest's opening.
  roundRect(c, x + w * 0.38, y + h * 0.08, w * 0.24, h * 0.05, h * 0.02);
  c.fillStyle = tone(0.03);
  c.fill();
  const ordered = acrossPicture(e);
  const half = Math.ceil(ordered.length / 2);
  [
    { lamps: ordered.slice(0, half), top: [0.13, 0.14], bottom: [0.17, 0.44] },
    { lamps: ordered.slice(half), top: [0.87, 0.14], bottom: [0.83, 0.44] },
  ].forEach(({ lamps, top, bottom }) => {
    const share = 1 / Math.max(1, lamps.length);
    lamps.forEach(({ index }, position) => {
      const from = position * share;
      const to = (position + 1) * share;
      lightLine(
        c,
        [
          x + w * (top[0] + (bottom[0] - top[0]) * from),
          y + h * (top[1] + (bottom[1] - top[1]) * from),
        ],
        [
          x + w * (top[0] + (bottom[0] - top[0]) * to),
          y + h * (top[1] + (bottom[1] - top[1]) * to),
        ],
        Math.max(2.4, w * 0.03),
        colourAt(rgb, index),
        Boolean(rgb),
      );
    });
  });
};

/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { IPlacedDevice } from './deskGeometry';
import { readSurface } from '../../utils/theme';

/**
 * The drawing tools every device picture on the desk is made with: dark solid
 * bodies with a lit top edge and a shadow, strips, arcs and dots of light that
 * bloom in their own colour, and the colour of one lamp.
 *
 * `rgb` is three sRGB bytes per lamp, in the device's lamp order, or undefined
 * for a device drawn unlit (muted, not reachable, nothing playing).
 */

export type TContext = CanvasRenderingContext2D;
export type TColour = [number, number, number];
export type TDevicePainter = (
  c: TContext,
  entry: IPlacedDevice,
  rgb: Uint8Array | undefined,
) => void;

/**
 * The desk's greys, as steps up from the theme's own floor.
 *
 * They were fixed charcoals — #151719 and its neighbours. On the Black theme
 * that is a dark desk in a dark room; on Ocean it was black cut-outs on
 * slate, which is what Ivan asked to have made better on both themes
 * (2026-09-22). Each tone is the floor the stage stands on (`--surface-base`)
 * blended toward a cool light grey by `t`, so the hardware is always the
 * same steps lighter than what it stands on, in that floor's own cast:
 * charcoal on Black, slate grey on Ocean. Cached per floor colour, because
 * the painters ask on every frame.
 */
const NEUTRAL: TColour = [156, 164, 172];
const BODY_TONE = 0.11;
let toneFloor = '';
const tones = new Map<number, TColour>();
export const toneRgb = (t: number): TColour => {
  const floor = readSurface('--surface-base', '#050608');
  if (floor !== toneFloor) {
    toneFloor = floor;
    tones.clear();
  }
  const known = tones.get(t);
  if (known) {
    return known;
  }
  const hex = /^#([0-9a-f]{6})$/i.exec(floor)?.[1] ?? '050608';
  const base = [0, 2, 4].map((at) => parseInt(hex.slice(at, at + 2), 16));
  const mixed: TColour = [
    Math.round(base[0] + (NEUTRAL[0] - base[0]) * t),
    Math.round(base[1] + (NEUTRAL[1] - base[1]) * t),
    Math.round(base[2] + (NEUTRAL[2] - base[2]) * t),
  ];
  tones.set(t, mixed);
  return mixed;
};
export const tone = (t: number): string => css(toneRgb(t));
export const bodyTone = () => tone(BODY_TONE);
export const BODY_EDGE = 'rgba(230, 232, 235, 0.22)';
export const BODY_HIGHLIGHT = 'rgba(230, 232, 235, 0.045)';
/** An unlit lamp: a lens a few steps above the body. */
const unlit = (): TColour => toneRgb(0.25);

export const colourAt = (rgb: Uint8Array | undefined, lamp: number): TColour =>
  rgb && rgb.length >= (lamp + 1) * 3
    ? [rgb[lamp * 3], rgb[lamp * 3 + 1], rgb[lamp * 3 + 2]]
    : unlit();

export const css = ([r, g, b]: TColour, alpha = 1) =>
  `rgba(${r}, ${g}, ${b}, ${alpha})`;

/** Ambient light on the keycap remains visible even when its LED is black. */
export const mixWithBody = (colour: TColour, amount: number) =>
  `rgb(${colour
    .map((channel, index) =>
      Math.round(Math.min(255, toneRgb(BODY_TONE)[index] + channel * amount)),
    )
    .join(', ')})`;

export const average = (rgb: Uint8Array | undefined): TColour => {
  if (!rgb || rgb.length < 3) {
    return unlit();
  }
  let r = 0;
  let g = 0;
  let b = 0;
  const count = rgb.length / 3;
  for (let index = 0; index < rgb.length; index += 3) {
    r += rgb[index];
    g += rgb[index + 1];
    b += rgb[index + 2];
  }
  return [r / count, g / count, b / count];
};

export const roundRect = (
  c: TContext,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) => {
  c.beginPath();
  c.roundRect(x, y, w, h, Math.max(0, Math.min(r, w / 2, h / 2)));
};

/** A strip of light: a line with its own bloom. */
export const lightLine = (
  c: TContext,
  from: [number, number],
  to: [number, number],
  thickness: number,
  colour: TColour,
  lit: boolean,
) => {
  c.save();
  c.lineCap = 'round';
  c.lineWidth = thickness;
  c.strokeStyle = css(colour, lit ? 1 : 0.5);
  if (lit) {
    c.shadowColor = css(colour, 0.95);
    c.shadowBlur = thickness * 4;
  }
  c.beginPath();
  c.moveTo(from[0], from[1]);
  c.lineTo(to[0], to[1]);
  c.stroke();
  c.restore();
};

/** An arc of light round a centre, for rings of lamps. */
export const lightArc = (
  c: TContext,
  centre: [number, number],
  radii: [number, number],
  angles: [number, number],
  thickness: number,
  colour: TColour,
  lit: boolean,
) => {
  c.save();
  c.lineCap = 'round';
  c.lineWidth = thickness;
  c.strokeStyle = css(colour, lit ? 1 : 0.5);
  if (lit) {
    c.shadowColor = css(colour, 0.95);
    c.shadowBlur = thickness * 4;
  }
  c.beginPath();
  c.ellipse(centre[0], centre[1], radii[0], radii[1], 0, angles[0], angles[1]);
  c.stroke();
  c.restore();
};

/** A device's lamps with their indices, in the order they cross the picture. */
export const acrossPicture = (entry: IPlacedDevice) =>
  entry.device.lamps
    .map((lamp, index) => ({ lamp, index }))
    .sort((a, b) => a.lamp.u - b.lamp.u);

/**
 * A device's lamps as one horizontal run of light from `left` to `right`,
 * each lamp one segment in the order its position crosses the picture.
 */
export const strip = (
  c: TContext,
  entry: IPlacedDevice,
  rgb: Uint8Array | undefined,
  left: number,
  right: number,
  y: number,
  thickness: number,
) => {
  const ordered = acrossPicture(entry);
  const share = (right - left) / Math.max(1, ordered.length);
  // Round caps reach half a line past each end, so separate segments need
  // that much room; lamps packed closer than that read as one lit line.
  const gap =
    share < thickness * 3 ? 0 : Math.min(share * 0.2, 1.5) + thickness / 2;
  ordered.forEach(({ index }, position) => {
    const from = left + share * position + gap;
    const to = Math.max(from, left + share * (position + 1) - gap);
    lightLine(
      c,
      [from, y],
      [to, y],
      thickness,
      colourAt(rgb, index),
      Boolean(rgb),
    );
  });
};

/**
 * A ring of lamps round an ellipse, each lamp one arc in the order its
 * position goes round the device's picture.
 */
export const lightRing = (
  c: TContext,
  entry: IPlacedDevice,
  rgb: Uint8Array | undefined,
  centre: [number, number],
  radii: [number, number],
  thickness: number,
) => {
  const ordered = entry.device.lamps
    .map((lamp, index) => ({
      index,
      angle: Math.atan2(lamp.v - 0.5, lamp.u - 0.5),
    }))
    .sort((a, b) => a.angle - b.angle);
  const share = (Math.PI * 2) / Math.max(1, ordered.length);
  const gap = Math.min(0.12, share * 0.2);
  ordered.forEach(({ index }, position) => {
    const start = -Math.PI + position * share + gap / 2;
    lightArc(
      c,
      centre,
      radii,
      [start, start + share - gap],
      thickness,
      colourAt(rgb, index),
      Boolean(rgb),
    );
  });
};

/** A dark solid object: its shadow on the desk, its body, its top edge. */
export const body = (
  c: TContext,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) => {
  c.save();
  c.shadowColor = 'rgba(2, 6, 18, 0.42)';
  c.shadowBlur = 14;
  c.shadowOffsetY = 6;
  roundRect(c, x, y, w, h, r);
  c.fillStyle = bodyTone();
  c.fill();
  c.restore();
  roundRect(c, x, y, w, h, r);
  c.strokeStyle = BODY_EDGE;
  c.lineWidth = 1;
  c.stroke();
  const shine = c.createLinearGradient(0, y, 0, y + h * 0.4);
  shine.addColorStop(0, BODY_HIGHLIGHT);
  shine.addColorStop(1, 'rgba(230, 232, 235, 0)');
  roundRect(c, x + 1, y + 1, w - 2, h * 0.4, r);
  c.fillStyle = shine;
  c.fill();
};

export const glowDot = (
  c: TContext,
  x: number,
  y: number,
  radius: number,
  colour: TColour,
  lit: boolean,
) => {
  c.save();
  if (lit) {
    c.shadowColor = css(colour, 0.95);
    c.shadowBlur = radius * 3;
  }
  c.fillStyle = css(colour, lit ? 1 : 0.6);
  c.beginPath();
  c.arc(x, y, radius, 0, Math.PI * 2);
  c.fill();
  c.restore();
};

/** A soft pool of a device's light under it: underglow on the desk. */
export const underglow = (
  c: TContext,
  cx: number,
  cy: number,
  radiusX: number,
  radiusY: number,
  rgb: Uint8Array | undefined,
) => {
  if (!rgb) {
    return;
  }
  const [r, g, b] = average(rgb);
  c.save();
  c.translate(cx, cy);
  c.scale(1, radiusY / Math.max(1, radiusX));
  const light = c.createRadialGradient(0, 0, 0, 0, 0, radiusX);
  light.addColorStop(0, `rgba(${r}, ${g}, ${b}, 0.55)`);
  light.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
  c.fillStyle = light;
  c.fillRect(-radiusX, -radiusX, radiusX * 2, radiusX * 2);
  c.restore();
};

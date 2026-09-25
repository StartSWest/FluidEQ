/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { ILamp } from 'common/lighting/lightingModel';
import {
  body,
  colourAt,
  css,
  mixWithBody,
  roundRect,
  type TContext,
  type TDevicePainter,
  tone,
} from './deskPaintKit';

/**
 * Keyboards and keypads: a plate of keycaps, each lit from under its cap in
 * its own lamp's colour, the light escaping round the skirt onto the plate.
 */

const keys = (
  c: TContext,
  lamps: readonly ILamp[],
  rgb: Uint8Array | undefined,
  x: number,
  y: number,
  w: number,
  h: number,
) => {
  // Key size from how densely the lamps sit: a 22-wide grid is 22 keys a row.
  const columns = Math.max(1, Math.round(Math.sqrt((lamps.length * w) / h)));
  const rows = Math.max(1, Math.ceil(lamps.length / columns));
  const size = Math.min(w / columns, h / rows);
  const cap = size * 0.84;
  const lit = Boolean(rgb);
  lamps.forEach((lamp, index) => {
    const colour = colourAt(rgb, index);
    const kx = x + lamp.u * w - cap / 2;
    const ky = y + lamp.v * h - cap / 2;
    if (lit) {
      c.save();
      c.shadowColor = css(colour, 0.9);
      c.shadowBlur = cap * 0.9;
      roundRect(c, kx, ky, cap, cap, cap * 0.2);
      c.fillStyle = css(colour, 0.85);
      c.fill();
      c.restore();
    }
    // The cap: dark plastic lit from inside, its top face a little lighter
    // than its skirt.
    roundRect(
      c,
      kx + cap * 0.06,
      ky + cap * 0.04,
      cap * 0.88,
      cap * 0.86,
      cap * 0.18,
    );
    c.fillStyle = mixWithBody(colour, lit ? 0.45 : 0.12);
    c.fill();
    c.strokeStyle = 'rgba(214, 233, 247, 0.12)';
    c.lineWidth = 0.6;
    c.stroke();
    roundRect(
      c,
      kx + cap * 0.16,
      ky + cap * 0.1,
      cap * 0.68,
      cap * 0.6,
      cap * 0.14,
    );
    c.fillStyle = mixWithBody(colour, lit ? 0.62 : 0.16);
    c.fill();
    if (lit) {
      // The legend, where the light shines straight through.
      c.fillStyle = css(colour, 0.95);
      c.fillRect(kx + cap * 0.36, ky + cap * 0.34, cap * 0.28, cap * 0.09);
    }
  });
};

export const paintKeyboard: TDevicePainter = (c, e, rgb) => {
  body(c, e.x, e.y, e.width, e.height, e.height * 0.08);
  const inset = e.height * 0.08;
  keys(
    c,
    e.device.lamps,
    rgb,
    e.x + inset,
    e.y + inset,
    e.width - inset * 2,
    e.height - inset * 2,
  );
};

/** A Tartarus-style keypad: its key block, and the palm rest below it. */
export const paintKeypad: TDevicePainter = (c, e, rgb) => {
  const keysHeight = e.height * 0.62;
  body(c, e.x, e.y, e.width, e.height, e.width * 0.12);
  // The palm rest: a raised pad across the lower part.
  roundRect(
    c,
    e.x + e.width * 0.1,
    e.y + keysHeight + e.height * 0.06,
    e.width * 0.8,
    e.height * 0.26,
    e.width * 0.08,
  );
  c.fillStyle = 'rgba(230, 232, 235, 0.05)';
  c.fill();
  const inset = e.width * 0.08;
  keys(
    c,
    e.device.lamps,
    rgb,
    e.x + inset,
    e.y + inset,
    e.width - inset * 2,
    keysHeight - inset,
  );
};

/**
 * A laptop seen from above and in front: its lid rising behind the deck, the
 * lit keyboard on the deck, and a touchpad below the keys.
 */
export const paintLaptop: TDevicePainter = (c, e, rgb) => {
  const lidHeight = e.height * 0.18;
  // The lid's back, a slim lit edge of screen above the hinge.
  roundRect(c, e.x + e.width * 0.04, e.y, e.width * 0.92, lidHeight, 6);
  c.fillStyle = tone(0.07);
  c.fill();
  c.strokeStyle = 'rgba(230, 232, 235, 0.18)';
  c.lineWidth = 1;
  c.stroke();
  const deckY = e.y + lidHeight - 2;
  const deckHeight = e.height - lidHeight + 2;
  body(c, e.x, deckY, e.width, deckHeight, 8);
  const keysHeight = deckHeight * 0.62;
  const inset = e.width * 0.05;
  keys(
    c,
    e.device.lamps,
    rgb,
    e.x + inset,
    deckY + deckHeight * 0.08,
    e.width - inset * 2,
    keysHeight,
  );
  roundRect(
    c,
    e.x + e.width * 0.34,
    deckY + deckHeight * 0.76,
    e.width * 0.32,
    deckHeight * 0.18,
    4,
  );
  c.strokeStyle = 'rgba(230, 232, 235, 0.14)';
  c.stroke();
};

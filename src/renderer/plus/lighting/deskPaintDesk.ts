/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  acrossPicture,
  average,
  BODY,
  BODY_EDGE,
  body,
  colourAt,
  css,
  roundRect,
  strip,
  underglow,
  type TDevicePainter,
} from './deskPaintKit';

/**
 * What stands on the desk or lights the room around it: laptop and monitor
 * stands and docks lit along their lower edge, light strips washing the wall,
 * light bars on the monitor, and lamps.
 */

/** Laptop Stand Chroma: an aluminium wedge at 18°, lit along the bottom. */
export const paintLaptopStand: TDevicePainter = (c, e, rgb) => {
  underglow(
    c,
    e.x + e.width / 2,
    e.y + e.height,
    e.width * 0.55,
    e.height * 0.5,
    rgb,
  );
  c.save();
  c.shadowColor = 'rgba(2, 6, 18, 0.42)';
  c.shadowBlur = 12;
  c.beginPath();
  c.moveTo(e.x, e.y + e.height * 0.92);
  c.lineTo(e.x + e.width * 0.04, e.y + e.height * 0.2);
  c.lineTo(e.x + e.width * 0.96, e.y + e.height * 0.2);
  c.lineTo(e.x + e.width, e.y + e.height * 0.92);
  c.closePath();
  const face = c.createLinearGradient(0, e.y, 0, e.y + e.height);
  face.addColorStop(0, '#2a2d30');
  face.addColorStop(1, '#151719');
  c.fillStyle = face;
  c.fill();
  c.restore();
  c.strokeStyle = BODY_EDGE;
  c.lineWidth = 1;
  c.stroke();
  strip(
    c,
    e,
    rgb,
    e.x + e.width * 0.04,
    e.x + e.width * 0.96,
    e.y + e.height * 0.95,
    Math.max(2.4, e.height * 0.04),
  );
};

/**
 * Monitor Stand Chroma: a riser under the monitor with a keyboard's room
 * beneath it, its underglow along the front edge.
 */
export const paintMonitorStand: TDevicePainter = (c, e, rgb) => {
  underglow(
    c,
    e.x + e.width / 2,
    e.y + e.height,
    e.width * 0.55,
    e.height * 1.2,
    rgb,
  );
  // The legs, and the open space between them.
  [0, 0.92].forEach((at) => {
    roundRect(
      c,
      e.x + e.width * at,
      e.y + e.height * 0.3,
      e.width * 0.08,
      e.height * 0.66,
      3,
    );
    c.fillStyle = '#1b1d1f';
    c.fill();
  });
  body(c, e.x, e.y, e.width, e.height * 0.34, 6);
  strip(
    c,
    e,
    rgb,
    e.x + e.width * 0.1,
    e.x + e.width * 0.9,
    e.y + e.height * 0.4,
    Math.max(2.4, e.height * 0.08),
  );
};

/** A Thunderbolt or handheld dock: a flat box lit along its bottom edge. */
export const paintDock: TDevicePainter = (c, e, rgb) => {
  underglow(
    c,
    e.x + e.width / 2,
    e.y + e.height,
    e.width * 0.6,
    e.height * 0.9,
    rgb,
  );
  body(c, e.x, e.y, e.width, e.height * 0.82, 6);
  // Ports along the front.
  for (let port = 0; port < 4; port += 1) {
    roundRect(
      c,
      e.x + e.width * (0.14 + port * 0.12),
      e.y + e.height * 0.34,
      e.width * 0.08,
      e.height * 0.16,
      2,
    );
    c.fillStyle = '#0a0b0d';
    c.fill();
  }
  strip(
    c,
    e,
    rgb,
    e.x + e.width * 0.06,
    e.x + e.width * 0.94,
    e.y + e.height * 0.88,
    Math.max(2.4, e.height * 0.08),
  );
};

/**
 * A light strip (Chroma light strip set, ARGB controller, HDK): a diffused
 * strip along the wall behind the desk, washing the wall in its colours.
 */
export const paintLightStrip: TDevicePainter = (c, e, rgb) => {
  const cy = e.y + e.height / 2;
  if (rgb) {
    // The wash follows the strip's colours along its length, not one average.
    const along = c.createLinearGradient(e.x, 0, e.x + e.width, 0);
    const ordered = acrossPicture(e);
    ordered.forEach(({ index }, position) => {
      along.addColorStop(
        (position + 0.5) / ordered.length,
        css(colourAt(rgb, index), 0.2),
      );
    });
    // Fading bands rather than a blur filter: this is drawn every frame, and
    // a canvas blur over the desk's width costs far more than a few fills.
    c.save();
    c.fillStyle = along;
    const bands = 16;
    const reach = e.height * 6;
    for (let band = 0; band < bands; band += 1) {
      const t = band / bands;
      c.globalAlpha = (1 - t) * (1 - t) * 0.5;
      c.fillRect(e.x, cy - reach * (t + 1 / bands), e.width, reach / bands);
      c.fillRect(e.x, cy + (reach / 3) * t, e.width, reach / 3 / bands);
    }
    c.restore();
  }
  roundRect(
    c,
    e.x,
    cy - e.height * 0.3,
    e.width,
    e.height * 0.6,
    e.height * 0.3,
  );
  c.fillStyle = '#16181a';
  c.fill();
  strip(
    c,
    e,
    rgb,
    e.x + 6,
    e.x + e.width - 6,
    cy,
    Math.max(3, e.height * 0.34),
  );
};

/**
 * A monitor light bar (Aether Monitor Light Bar): clamped on the monitor's top
 * edge, its RGB thrown back onto the wall behind the screen.
 */
export const paintLightBar: TDevicePainter = (c, e, rgb) => {
  if (rgb) {
    const [r, g, b] = average(rgb);
    const cx = e.x + e.width / 2;
    c.save();
    c.translate(cx, e.y);
    c.scale(1, 0.45);
    const halo = c.createRadialGradient(0, 0, 0, 0, 0, e.width * 0.7);
    halo.addColorStop(0, `rgba(${r}, ${g}, ${b}, 0.42)`);
    halo.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
    c.fillStyle = halo;
    c.fillRect(-e.width * 0.7, -e.width * 0.7, e.width * 1.4, e.width * 0.7);
    c.restore();
  }
  strip(
    c,
    e,
    rgb,
    e.x + 6,
    e.x + e.width - 6,
    e.y + e.height * 0.3,
    Math.max(2.4, e.height * 0.22),
  );
  body(c, e.x, e.y + e.height * 0.4, e.width, e.height * 0.46, e.height * 0.2);
  // The clamp over the monitor's edge.
  roundRect(
    c,
    e.x + e.width / 2 - 12,
    e.y + e.height * 0.8,
    24,
    e.height * 0.34,
    3,
  );
  c.fillStyle = '#1b1d1f';
  c.fill();
};

/** A lamp (Aether Lamp, Key Light Chroma): a glowing column on a round foot. */
export const paintLamp: TDevicePainter = (c, e, rgb) => {
  const cx = e.x + e.width / 2;
  const colour = average(rgb);
  underglow(c, cx, e.y + e.height * 0.55, e.width * 1.1, e.height * 0.7, rgb);
  roundRect(
    c,
    e.x + e.width * 0.12,
    e.y,
    e.width * 0.76,
    e.height * 0.86,
    e.width * 0.3,
  );
  if (rgb) {
    const shade = c.createLinearGradient(0, e.y, 0, e.y + e.height * 0.86);
    shade.addColorStop(0, css(colour, 0.95));
    shade.addColorStop(1, css(colour, 0.55));
    c.save();
    c.shadowColor = css(colour, 0.9);
    c.shadowBlur = e.width * 0.5;
    c.fillStyle = shade;
    c.fill();
    c.restore();
  } else {
    c.fillStyle = '#1d2023';
    c.fill();
  }
  c.strokeStyle = BODY_EDGE;
  c.lineWidth = 1;
  c.stroke();
  c.beginPath();
  c.ellipse(
    cx,
    e.y + e.height * 0.92,
    e.width * 0.46,
    e.height * 0.07,
    0,
    0,
    Math.PI * 2,
  );
  c.fillStyle = BODY;
  c.fill();
  c.stroke();
};

/**
 * A Raptor 27's base: the wide forged foot under the screen, its Chroma
 * strips lighting the desk beneath it.
 */
export const paintMonitorBase: TDevicePainter = (c, e, rgb) => {
  const cx = e.x + e.width / 2;
  underglow(c, cx, e.y + e.height, e.width * 0.6, e.height * 1.6, rgb);
  // The neck rising to the screen, over the plain monitor's own.
  roundRect(c, cx - 14, e.y - 16, 28, 24, 4);
  c.fillStyle = '#2a2d30';
  c.fill();
  c.beginPath();
  c.moveTo(e.x + e.width * 0.06, e.y + e.height * 0.3);
  c.lineTo(e.x + e.width * 0.94, e.y + e.height * 0.3);
  c.lineTo(e.x + e.width, e.y + e.height * 0.82);
  c.lineTo(e.x, e.y + e.height * 0.82);
  c.closePath();
  const face = c.createLinearGradient(0, e.y, 0, e.y + e.height);
  face.addColorStop(0, '#34373a');
  face.addColorStop(1, '#17191b');
  c.fillStyle = face;
  c.fill();
  c.strokeStyle = BODY_EDGE;
  c.lineWidth = 1;
  c.stroke();
  strip(
    c,
    e,
    rgb,
    e.x + e.width * 0.04,
    e.x + e.width * 0.96,
    e.y + e.height * 0.94,
    Math.max(2.4, e.height * 0.12),
  );
};

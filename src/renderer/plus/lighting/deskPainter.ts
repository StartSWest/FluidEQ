/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { ILamp } from 'common/lighting/lightingModel';
import {
  DESK_HEIGHT,
  MONITOR,
  DESK_WIDTH,
  monitorForDesk,
  type IPlacedDevice,
} from './deskLayout';

/**
 * The desk, drawn: each device as a softly lit object on a satin surface, its lamps
 * lit in the colours actually sent to it, and that light falling on the desk
 * around it. The devices are solid shapes with a highlight along the top edge
 * and a shadow under them, because a lamp only reads as light against
 * something that is not.
 *
 * `colours` holds three sRGB bytes per lamp, in the device's lamp order; a
 * device with none (muted, or nothing playing) is drawn unlit.
 */

export interface IDeskPaint {
  placed: readonly IPlacedDevice[];
  /** Drawn unlit and faint behind everything: where devices would stand. */
  faint: readonly IPlacedDevice[];
  colours: ReadonlyMap<string, Uint8Array>;
  /** The scene as the lamps see it, or undefined while nothing plays. */
  grid: { width: number; height: number; rgb: Uint8Array } | undefined;
  image?: ImageBitmap;
}

type TContext = CanvasRenderingContext2D;

// Device discovery does not report the housing finish. Use neutral charcoal
// silhouettes; thin edges give them definition without implying white hardware.
const BODY = '#151719';
const BODY_EDGE = 'rgba(230, 232, 235, 0.22)';
const BODY_HIGHLIGHT = 'rgba(230, 232, 235, 0.045)';
const UNLIT: [number, number, number] = [43, 45, 48];

const colourAt = (
  rgb: Uint8Array | undefined,
  lamp: number,
): [number, number, number] =>
  rgb && rgb.length >= (lamp + 1) * 3
    ? [rgb[lamp * 3], rgb[lamp * 3 + 1], rgb[lamp * 3 + 2]]
    : UNLIT;

const css = ([r, g, b]: [number, number, number], alpha = 1) =>
  `rgba(${r}, ${g}, ${b}, ${alpha})`;

const BODY_RGB: [number, number, number] = [18, 19, 21];

/** Ambient light on the keycap remains visible even when its LED is black. */
const mixWithBody = (colour: [number, number, number], amount: number) =>
  `rgb(${colour
    .map((channel, index) =>
      Math.round(Math.min(255, BODY_RGB[index] + channel * amount)),
    )
    .join(', ')})`;

/** A strip of light: a line with its own bloom. */
const lightLine = (
  c: TContext,
  from: [number, number],
  to: [number, number],
  thickness: number,
  colour: [number, number, number],
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
const lightArc = (
  c: TContext,
  centre: [number, number],
  radii: [number, number],
  angles: [number, number],
  thickness: number,
  colour: [number, number, number],
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

const average = (rgb: Uint8Array | undefined): [number, number, number] => {
  if (!rgb || rgb.length < 3) {
    return UNLIT;
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

const roundRect = (
  c: TContext,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) => {
  c.beginPath();
  c.roundRect(x, y, w, h, Math.min(r, w / 2, h / 2));
};

/** A dark solid object: its shadow on the desk, its body, its top edge. */
const body = (
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
  c.fillStyle = BODY;
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

const glowDot = (
  c: TContext,
  x: number,
  y: number,
  radius: number,
  colour: [number, number, number],
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

/** Light from a device falling on the desk around it. */
const spill = (
  c: TContext,
  entry: IPlacedDevice,
  rgb: Uint8Array | undefined,
) => {
  if (!rgb) {
    return;
  }
  const [r, g, b] = average(rgb);
  const cx = entry.x + entry.width / 2;
  const cy = entry.y + entry.height * 0.75;
  const radius = Math.max(entry.width, entry.height) * 0.9;
  const light = c.createRadialGradient(cx, cy, 0, cx, cy, radius);
  light.addColorStop(0, `rgba(${r}, ${g}, ${b}, 0.22)`);
  light.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
  c.fillStyle = light;
  c.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);
};

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
      // The light escaping round the cap's skirt onto the plate.
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

const paintKeyboard = (
  c: TContext,
  e: IPlacedDevice,
  rgb: Uint8Array | undefined,
) => {
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

const paintMouse = (
  c: TContext,
  e: IPlacedDevice,
  rgb: Uint8Array | undefined,
) => {
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

const paintMousepad = (
  c: TContext,
  e: IPlacedDevice,
  rgb: Uint8Array | undefined,
) => {
  roundRect(c, e.x, e.y, e.width, e.height, 10);
  c.fillStyle = '#101214';
  c.fill();
  // The cloth: a faint weave, so the surface reads as a pad and not a hole.
  c.strokeStyle = 'rgba(214, 233, 247, 0.025)';
  for (let line = e.y + 8; line < e.y + e.height - 6; line += 6) {
    c.beginPath();
    c.moveTo(e.x + 6, line);
    c.lineTo(e.x + e.width - 6, line);
    c.stroke();
  }
  c.strokeStyle = BODY_EDGE;
  roundRect(c, e.x, e.y, e.width, e.height, 10);
  c.stroke();

  // The light strip round the edge, one run per lamp on the side it is
  // nearest, each as long as its share of that side.
  const { lamps } = e.device;
  const inset = 4;
  const left = e.x + inset;
  const right = e.x + e.width - inset;
  const top = e.y + inset;
  const bottom = e.y + e.height - inset;
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
    if (horizontal) {
      const px = left + lamp.u * (right - left);
      const py = edge === 0 ? top : bottom;
      lightLine(c, [px - half, py], [px + half, py], 3, colour, lit);
    } else {
      const px = edge === 3 ? left : right;
      const py = top + lamp.v * (bottom - top);
      lightLine(c, [px, py - half], [px, py + half], 3, colour, lit);
    }
  });
};

const paintHeadset = (
  c: TContext,
  e: IPlacedDevice,
  rgb: Uint8Array | undefined,
) => {
  const cupWidth = e.width * 0.24;
  const cupHeight = e.height * 0.52;
  const cupsY = e.y + e.height * 0.4;
  c.strokeStyle = '#282b2e';
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

const paintStand = (
  c: TContext,
  e: IPlacedDevice,
  rgb: Uint8Array | undefined,
) => {
  const baseHeight = e.height * 0.12;
  const baseY = e.y + e.height - baseHeight;
  const cx = e.x + e.width / 2;
  // Pole and hook.
  roundRect(
    c,
    cx - e.width * 0.05,
    e.y + e.height * 0.08,
    e.width * 0.1,
    e.height * 0.82,
    4,
  );
  const metal = c.createLinearGradient(
    cx - e.width * 0.05,
    0,
    cx + e.width * 0.05,
    0,
  );
  metal.addColorStop(0, '#17191b');
  metal.addColorStop(0.45, '#36383a');
  metal.addColorStop(1, '#1b1d1f');
  c.fillStyle = metal;
  c.fill();
  roundRect(
    c,
    cx - e.width * 0.3,
    e.y + e.height * 0.05,
    e.width * 0.6,
    e.height * 0.05,
    6,
  );
  c.fill();
  body(c, e.x, baseY, e.width, baseHeight, baseHeight / 2);
  // The ring of light round the base, in the order its lamps go round.
  const ordered = e.device.lamps
    .map((lamp, index) => ({
      index,
      angle: Math.atan2(lamp.v - 0.5, lamp.u - 0.5),
    }))
    .sort((a, b) => a.angle - b.angle);
  const share = (Math.PI * 2) / Math.max(1, ordered.length);
  ordered.forEach(({ index }, position) => {
    const start = -Math.PI + position * share + 0.06;
    lightArc(
      c,
      [cx, baseY + baseHeight * 0.55],
      [e.width * 0.44, baseHeight * 0.3],
      [start, start + share - 0.12],
      Math.max(2.2, baseHeight * 0.14),
      colourAt(rgb, index),
      Boolean(rgb),
    );
  });
};

const paintSpeaker = (
  c: TContext,
  e: IPlacedDevice,
  rgb: Uint8Array | undefined,
) => {
  body(c, e.x, e.y, e.width, e.height, e.width * 0.18);
  [0.3, 0.68].forEach((at, cone) => {
    const radius = e.width * (cone === 0 ? 0.24 : 0.32);
    c.beginPath();
    c.arc(e.x + e.width / 2, e.y + e.height * at, radius, 0, Math.PI * 2);
    c.fillStyle = '#090a0c';
    c.fill();
    c.strokeStyle = BODY_EDGE;
    c.stroke();
  });
  e.device.lamps.forEach((lamp, index) => {
    glowDot(
      c,
      e.x + e.width * 0.08,
      e.y + lamp.v * e.height,
      2.6,
      colourAt(rgb, index),
      Boolean(rgb),
    );
    glowDot(
      c,
      e.x + e.width * 0.92,
      e.y + lamp.v * e.height,
      2.6,
      colourAt(rgb, index),
      Boolean(rgb),
    );
  });
};

const paintAccessory = (
  c: TContext,
  e: IPlacedDevice,
  rgb: Uint8Array | undefined,
) => {
  const cx = e.x + e.width / 2;
  const cy = e.y + e.height / 2;
  const radius = Math.min(e.width, e.height) * 0.42;
  c.save();
  c.shadowColor = 'rgba(0, 0, 0, 0.55)';
  c.shadowBlur = 16;
  c.beginPath();
  c.arc(cx, cy, radius, 0, Math.PI * 2);
  c.fillStyle = BODY;
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

const PAINTERS = {
  keyboard: paintKeyboard,
  keypad: paintKeyboard,
  mouse: paintMouse,
  mousepad: paintMousepad,
  headset: paintHeadset,
  stand: paintStand,
  speaker: paintSpeaker,
  accessory: paintAccessory,
} as const;

/** Draw order: pads first, stands before what hangs on them, mice on top. */
const LAYER: Record<keyof typeof PAINTERS, number> = {
  mousepad: 0,
  speaker: 1,
  stand: 1,
  keyboard: 2,
  keypad: 2,
  accessory: 2,
  headset: 3,
  mouse: 4,
};

/** The lamps' grid as an image, kept between frames and refilled in place. */
let screenSource: { canvas: OffscreenCanvas; image: ImageData } | undefined;

/**
 * The monitor shows the scene as the lamps see it. Keep the picture inside
 * its bezel; an outer glow forms a visible cutoff at the preview boundary.
 */
const paintMonitor = (
  c: TContext,
  grid: IDeskPaint['grid'],
  monitor: typeof MONITOR,
  preview?: ImageBitmap,
) => {
  const { x, y, width, height } = monitor;
  const bezel = 6;
  // Neck and foot.
  c.fillStyle = '#26292c';
  roundRect(c, x + width / 2 - 10, y + height, 20, 26, 3);
  c.fill();
  roundRect(c, x + width / 2 - 52, y + height + 24, 104, 8, 4);
  c.fill();

  body(c, x - bezel, y - bezel, width + bezel * 2, height + bezel * 2, 8);
  c.fillStyle = '#04080c';
  c.fillRect(x, y, width, height);
  if (!grid) {
    return;
  }
  if (
    !screenSource ||
    screenSource.image.width !== grid.width ||
    screenSource.image.height !== grid.height
  ) {
    screenSource = {
      canvas: new OffscreenCanvas(grid.width, grid.height),
      image: new ImageData(grid.width, grid.height),
    };
  }
  const { canvas, image } = screenSource;
  const cells = grid.width * grid.height;
  for (let cell = 0; cell < cells; cell += 1) {
    image.data[cell * 4] = grid.rgb[cell * 3];
    image.data[cell * 4 + 1] = grid.rgb[cell * 3 + 1];
    image.data[cell * 4 + 2] = grid.rgb[cell * 3 + 2];
    image.data[cell * 4 + 3] = 255;
  }
  canvas.getContext('2d')?.putImageData(image, 0, 0);

  c.imageSmoothingEnabled = true;
  c.imageSmoothingQuality = 'high';
  c.drawImage(preview ?? canvas, x, y, width, height);
};

export const paintDesk = (canvas: HTMLCanvasElement, paint: IDeskPaint) => {
  const c = canvas.getContext('2d');
  if (!c) {
    return;
  }
  // The desk stays centred over the panel's theme surface. Keeping the ground
  // in CSS makes theme changes repaint even when no lighting frames arrive.
  const scale = Math.min(
    canvas.width / DESK_WIDTH,
    canvas.height / DESK_HEIGHT,
  );
  const offsetX = (canvas.width - DESK_WIDTH * scale) / 2;
  const offsetY = (canvas.height - DESK_HEIGHT * scale) / 2;
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.clearRect(0, 0, canvas.width, canvas.height);
  c.setTransform(scale, 0, 0, scale, offsetX, offsetY);

  paintMonitor(
    c,
    paint.grid,
    monitorForDesk(paint.placed.length ? paint.placed : paint.faint),
    paint.image,
  );

  const byLayer = (entries: readonly IPlacedDevice[]) =>
    [...entries].sort((a, b) => LAYER[a.device.kind] - LAYER[b.device.kind]);
  if (paint.faint.length > 0) {
    c.save();
    c.globalAlpha = 0.38;
    byLayer(paint.faint).forEach((entry) =>
      PAINTERS[entry.device.kind](c, entry, undefined),
    );
    c.restore();
  }

  const ordered = byLayer(paint.placed);
  ordered.forEach((entry) =>
    spill(c, entry, paint.colours.get(entry.device.key)),
  );
  ordered.forEach((entry) => {
    PAINTERS[entry.device.kind](c, entry, paint.colours.get(entry.device.key));
  });
};

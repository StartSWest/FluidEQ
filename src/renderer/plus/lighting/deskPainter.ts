/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { TDeviceForm } from 'common/lighting/deviceForms';
import {
  DESK_HEIGHT,
  DESK_WIDTH,
  MONITOR,
  monitorForDesk,
  type IPlacedDevice,
} from './deskGeometry';
import {
  paintHeadset,
  paintHeadsetStand,
  paintMicrophone,
  paintSoundbar,
  paintSpeaker,
} from './deskPaintAudio';
import {
  paintDock,
  paintLamp,
  paintLaptopStand,
  paintLightBar,
  paintLightStrip,
  paintMonitorBase,
  paintMonitorStand,
} from './deskPaintDesk';
import {
  paintAccessory,
  paintChair,
  paintController,
  paintMixer,
  paintTower,
} from './deskPaintGear';
import { paintKeyboard, paintKeypad, paintLaptop } from './deskPaintKeyboards';
import {
  average,
  body,
  type TContext,
  type TDevicePainter,
} from './deskPaintKit';
import {
  paintChargingPad,
  paintDeskMat,
  paintMouse,
  paintMouseBungee,
  paintMouseDock,
  paintMousepad,
} from './deskPaintPointing';

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

/** Every form's picture: what the member recognises as their own device. */
const PAINTERS: Readonly<Record<TDeviceForm, TDevicePainter>> = {
  'keyboard-full': paintKeyboard,
  'keyboard-tkl': paintKeyboard,
  'keyboard-compact': paintKeyboard,
  laptop: paintLaptop,
  keypad: paintKeypad,
  mouse: paintMouse,
  'mouse-dock': paintMouseDock,
  'charging-pad': paintChargingPad,
  'mouse-bungee': paintMouseBungee,
  mousepad: paintMousepad,
  'desk-mat': paintDeskMat,
  headset: paintHeadset,
  'headset-stand': paintHeadsetStand,
  speakers: paintSpeaker,
  soundbar: paintSoundbar,
  microphone: paintMicrophone,
  'laptop-stand': paintLaptopStand,
  'monitor-stand': paintMonitorStand,
  dock: paintDock,
  'light-strip': paintLightStrip,
  'light-bar': paintLightBar,
  lamp: paintLamp,
  controller: paintController,
  tower: paintTower,
  mixer: paintMixer,
  monitor: paintMonitorBase,
  chair: paintChair,
  accessory: paintAccessory,
};

/**
 * Draw order, lowest first. Negative layers go behind the monitor: a light
 * strip on the wall, a desk-length mat the monitor's foot stands on, and a
 * riser. Then pads, stands and docks under what rests on them, headsets on
 * their stands, and mice on top of everything they sit on.
 */
const LAYER: Readonly<Record<TDeviceForm, number>> = {
  'light-strip': -3,
  'desk-mat': -2,
  'monitor-stand': -1,
  mousepad: 1,
  soundbar: 2,
  speakers: 2,
  microphone: 2,
  lamp: 2,
  'light-bar': 2,
  tower: 2,
  'laptop-stand': 2,
  dock: 2,
  mixer: 2,
  monitor: 2,
  chair: 2,
  'headset-stand': 2,
  'charging-pad': 2,
  'mouse-dock': 2,
  'mouse-bungee': 2,
  'keyboard-full': 3,
  'keyboard-tkl': 3,
  'keyboard-compact': 3,
  laptop: 3,
  keypad: 3,
  controller: 3,
  accessory: 3,
  headset: 4,
  mouse: 5,
};

/**
 * Forms that already paint the light they throw on their surroundings — a
 * wall wash, a halo — and whose size would make a round pool cover the desk.
 */
const OWN_SPILL: ReadonlySet<TDeviceForm> = new Set([
  'light-strip',
  'light-bar',
  'desk-mat',
]);

/** A pool of light wider than this reads as a tinted desk, not a device. */
const SPILL_RADIUS_MAX = 240;

/** The lamps' grid as an image, kept between frames and refilled in place. */
let screenSource: { canvas: OffscreenCanvas; image: ImageData } | undefined;

/** Light from a device falling on the desk around it. */
const spill = (
  c: TContext,
  entry: IPlacedDevice,
  rgb: Uint8Array | undefined,
) => {
  if (!rgb || OWN_SPILL.has(entry.form)) {
    return;
  }
  const [r, g, b] = average(rgb);
  const cx = entry.x + entry.width / 2;
  const cy = entry.y + entry.height * 0.75;
  const radius = Math.min(
    SPILL_RADIUS_MAX,
    Math.max(entry.width, entry.height) * 0.9,
  );
  const light = c.createRadialGradient(cx, cy, 0, cx, cy, radius);
  light.addColorStop(0, `rgba(${r}, ${g}, ${b}, 0.22)`);
  light.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
  c.fillStyle = light;
  c.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);
};

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
  c.beginPath();
  c.roundRect(x + width / 2 - 10, y + height, 20, 26, 3);
  c.fill();
  c.beginPath();
  c.roundRect(x + width / 2 - 52, y + height + 24, 104, 8, 4);
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

const byLayer = (entries: readonly IPlacedDevice[]) =>
  [...entries].sort((a, b) => LAYER[a.form] - LAYER[b.form]);

/** One depth of the desk: the faint placeholders, the light, the devices. */
const paintLayer = (
  c: TContext,
  faint: readonly IPlacedDevice[],
  placed: readonly IPlacedDevice[],
  colours: ReadonlyMap<string, Uint8Array>,
) => {
  if (faint.length > 0) {
    c.save();
    c.globalAlpha = 0.38;
    faint.forEach((entry) => PAINTERS[entry.form](c, entry, undefined));
    c.restore();
  }
  placed.forEach((entry) => spill(c, entry, colours.get(entry.device.key)));
  placed.forEach((entry) =>
    PAINTERS[entry.form](c, entry, colours.get(entry.device.key)),
  );
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

  const faint = byLayer(paint.faint);
  const placed = byLayer(paint.placed);
  const behind = (entry: IPlacedDevice) => LAYER[entry.form] < 0;
  const inFront = (entry: IPlacedDevice) => LAYER[entry.form] >= 0;

  paintLayer(c, faint.filter(behind), placed.filter(behind), paint.colours);
  paintMonitor(
    c,
    paint.grid,
    monitorForDesk(paint.placed.length ? paint.placed : paint.faint),
    paint.image,
  );
  paintLayer(c, faint.filter(inFront), placed.filter(inFront), paint.colours);
};

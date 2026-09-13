/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { KIND_PREVIEW_LAMPS } from 'common/lighting/lampLayouts';
import type {
  ILightingDevice,
  TLightingKind,
} from 'common/lighting/lightingModel';

/**
 * Where each found device stands on the drawn desk.
 *
 * A desk, not a list: the keyboard in the middle, a mousepad to its right
 * with the mouse on it, a stand to the left with a headset hung on it, other
 * headsets above the keyboard, speakers at the two ends. Only what was found
 * is placed, and the row is scaled to fit, so one keyboard is a big keyboard
 * and a full Razer desk still fits the width.
 *
 * In a fixed drawing space of `DESK_WIDTH × DESK_HEIGHT`; the canvas scales it.
 */

export const DESK_WIDTH = 1000;
export const DESK_HEIGHT = 440;

/**
 * The monitor at the back of the desk, showing the scene as the lamps see it
 * — the one picture every device below takes its colours from. 16:9, like
 * the grid it shows.
 */
export const MONITOR = { x: 320, y: 10, width: 360, height: 202.5 };

export interface IPlacedDevice {
  device: ILightingDevice;
  x: number;
  y: number;
  width: number;
  height: number;
  /** A headset drawn hanging on a stand, rather than standing on the desk. */
  onStand: boolean;
}

const SIZE: Record<TLightingKind, { width: number; height: number }> = {
  keyboard: { width: 440, height: 176 },
  keypad: { width: 120, height: 168 },
  mousepad: { width: 290, height: 300 },
  mouse: { width: 88, height: 148 },
  headset: { width: 180, height: 116 },
  stand: { width: 130, height: 290 },
  speaker: { width: 82, height: 210 },
  accessory: { width: 96, height: 96 },
};

/**
 * The desk drawn faintly while nothing has been found: a keyboard, a mousepad
 * with its mouse and a headset on its stand, so the stage shows where the
 * member's devices will be rather than a monitor alone in an empty room.
 */
export const PLACEHOLDER_DESK: readonly ILightingDevice[] = (
  ['stand', 'headset', 'keyboard', 'mousepad', 'mouse'] as const
).map((kind) => ({
  key: `placeholder:${kind}`,
  name: '',
  kind,
  route: 'none',
  lamps: KIND_PREVIEW_LAMPS[kind],
  channel: '',
  muted: false,
}));

const GAP = 28;
const MARGIN = 24;
const BASELINE = DESK_HEIGHT - 26;
/** A headset hung on a stand is this much wider than the stand's pole. */
const HUNG_WIDTH = 1.3;

/** Row order, left to right; headsets and a mouse on a pad are placed apart. */
const ROW_ORDER: readonly TLightingKind[] = [
  'stand',
  'keypad',
  'keyboard',
  'mousepad',
  'mouse',
  'accessory',
];

export const layoutDesk = (
  devices: readonly ILightingDevice[],
): IPlacedDevice[] => {
  const byKind = (kind: TLightingKind) =>
    devices.filter((device) => device.kind === kind);
  const speakers = byKind('speaker');
  const headsets = byKind('headset');
  const pads = byKind('mousepad');
  const mice = byKind('mouse');

  // A mouse sits on a mousepad when there is one, so it takes no row space.
  const rowDevices: ILightingDevice[] = [];
  if (speakers[0]) {
    rowDevices.push(speakers[0]);
  }
  ROW_ORDER.forEach((kind) => {
    if (kind === 'mouse' && pads.length > 0) {
      rowDevices.push(...mice.slice(pads.length));
      return;
    }
    rowDevices.push(...byKind(kind));
  });
  rowDevices.push(...speakers.slice(1));
  // With nothing to stand on, a headset is part of the row.
  const hasAnchor =
    rowDevices.some((device) => device.kind === 'keyboard') ||
    rowDevices.some((device) => device.kind === 'stand');
  if (!hasAnchor) {
    rowDevices.push(...headsets);
  }

  // A stand carrying a headset takes the headset's width in the row: the cups
  // hang past the pole, and at the end of a full desk they ran off its edge.
  const hung = new Set(
    rowDevices
      .filter((device) => device.kind === 'stand')
      .slice(0, headsets.length),
  );
  const slotWidth = (device: ILightingDevice) =>
    SIZE[device.kind].width * (hung.has(device) ? HUNG_WIDTH : 1);
  const rowWidth =
    rowDevices.reduce((sum, device) => sum + slotWidth(device), 0) +
    GAP * Math.max(0, rowDevices.length - 1);
  const available = DESK_WIDTH - MARGIN * 2;
  const tallest = Math.max(
    0,
    ...rowDevices.map((device) => SIZE[device.kind].height),
  );
  const roomAbove = BASELINE - MONITOR.y - 16;
  const scale = Math.min(
    1.25,
    rowWidth > 0 ? available / rowWidth : 1,
    tallest > 0 ? roomAbove / tallest : 1,
  );

  const placed: IPlacedDevice[] = [];
  let x = (DESK_WIDTH - rowWidth * scale) / 2;
  rowDevices.forEach((device) => {
    const width = SIZE[device.kind].width * scale;
    const height = SIZE[device.kind].height * scale;
    const slot = slotWidth(device) * scale;
    placed.push({
      device,
      x: x + (slot - width) / 2,
      y: BASELINE - height,
      width,
      height,
      onStand: false,
    });
    x += slot + GAP * scale;
  });

  // Mice on their pads, towards the pad's right, where a hand rests.
  placed
    .filter((entry) => entry.device.kind === 'mousepad')
    .forEach((pad, index) => {
      const mouse = mice[index];
      if (!mouse) {
        return;
      }
      const width = SIZE.mouse.width * scale;
      const height = SIZE.mouse.height * scale;
      placed.push({
        device: mouse,
        x: pad.x + pad.width * 0.62 - width / 2,
        y: pad.y + pad.height * 0.45 - height / 2,
        width,
        height,
        onStand: false,
      });
    });

  if (hasAnchor) {
    const stands = placed.filter((entry) => entry.device.kind === 'stand');
    const keyboard = placed.find((entry) => entry.device.kind === 'keyboard');
    headsets.forEach((device, index) => {
      const width = SIZE.headset.width * scale;
      const height = SIZE.headset.height * scale;
      const stand = stands[index];
      if (stand) {
        // Hung on the stand's hook, cups either side of the pole.
        const hungWidth = stand.width * HUNG_WIDTH;
        const hungHeight =
          hungWidth * (SIZE.headset.height / SIZE.headset.width);
        placed.push({
          device,
          x: stand.x + stand.width / 2 - hungWidth / 2,
          y: stand.y + stand.height * 0.02,
          width: hungWidth,
          height: hungHeight,
          onStand: true,
        });
        return;
      }
      // Beside the monitor, alternating sides, lying on the desk behind the
      // keyboard.
      const free = index - Math.min(index, stands.length);
      const side = free % 2 === 0 ? -1 : 1;
      const step = Math.floor(free / 2);
      const offset = step * (width + GAP);
      const x =
        side < 0
          ? MONITOR.x - GAP - width - offset
          : MONITOR.x + MONITOR.width + GAP + offset;
      placed.push({
        device,
        x: Math.min(DESK_WIDTH - width - 8, Math.max(8, x)),
        y: MONITOR.y + MONITOR.height * 0.3,
        width,
        height,
        onStand: false,
      });
      if (keyboard) {
        // Never over the keys.
        const last = placed[placed.length - 1];
        last.y = Math.min(last.y, keyboard.y - height - 10);
      }
    });
  }

  return placed;
};

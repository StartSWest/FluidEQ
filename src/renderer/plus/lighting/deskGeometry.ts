/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { FORM_OF_KIND, type TDeviceForm } from 'common/lighting/deviceForms';
import { KIND_PREVIEW_LAMPS } from 'common/lighting/lampLayouts';
import type {
  ILightingDevice,
  TLightingKind,
} from 'common/lighting/lightingModel';

/**
 * The drawn desk's measurements: its drawing space, the monitor at its back,
 * how big each form of device is, and what a placed device carries.
 *
 * Sizes are roughly millimetres, with depth foreshortened: a full keyboard is
 * 440 wide, a Firefly pad 290, a Strider Chroma mat nearly the whole desk.
 * In a fixed drawing space of `DESK_WIDTH × DESK_HEIGHT`; the canvas scales it.
 */

export const DESK_WIDTH = 1000;
export const DESK_HEIGHT = 500;

/**
 * The monitor at the back of the desk, showing the scene as the lamps see it
 * — the one picture every device below takes its colours from. 16:9, like
 * the grid it shows.
 */
export const MONITOR = { x: 320, y: 10, width: 360, height: 202.5 };

export interface IPlacedDevice {
  device: ILightingDevice;
  form: TDeviceForm;
  x: number;
  y: number;
  width: number;
  height: number;
  /** A headset drawn hanging on a stand, rather than lying on the desk. */
  onStand: boolean;
  /**
   * One of a pair drawn from a single device — speakers either side of the
   * monitor — lit by the lamps on its own side of the picture.
   */
  part?: 'left' | 'right';
}

/** Width and height in desk units before the front row is scaled. */
export const SIZE: Readonly<
  Record<TDeviceForm, { width: number; height: number }>
> = {
  'keyboard-full': { width: 440, height: 150 },
  'keyboard-tkl': { width: 360, height: 150 },
  'keyboard-compact': { width: 300, height: 128 },
  laptop: { width: 360, height: 176 },
  keypad: { width: 150, height: 150 },
  mouse: { width: 70, height: 122 },
  'mouse-dock': { width: 90, height: 62 },
  'charging-pad': { width: 104, height: 70 },
  'mouse-bungee': { width: 80, height: 104 },
  mousepad: { width: 290, height: 210 },
  'desk-mat': { width: 900, height: 280 },
  headset: { width: 180, height: 116 },
  'headset-stand': { width: 130, height: 290 },
  speakers: { width: 92, height: 150 },
  soundbar: { width: 380, height: 54 },
  microphone: { width: 72, height: 176 },
  'laptop-stand': { width: 300, height: 110 },
  'monitor-stand': { width: 420, height: 46 },
  dock: { width: 150, height: 52 },
  'light-strip': { width: 860, height: 14 },
  'light-bar': { width: 300, height: 22 },
  lamp: { width: 82, height: 176 },
  controller: { width: 150, height: 100 },
  tower: { width: 170, height: 300 },
  mixer: { width: 150, height: 112 },
  // Only its lit base is placed: the screen is the desk's own monitor.
  monitor: { width: 280, height: 24 },
  chair: { width: 150, height: 300 },
  accessory: { width: 96, height: 96 },
};

export const formOfDevice = (device: ILightingDevice): TDeviceForm =>
  device.form ?? FORM_OF_KIND[device.kind];

export const isKeyboardForm = (form: TDeviceForm) =>
  form === 'keyboard-full' ||
  form === 'keyboard-tkl' ||
  form === 'keyboard-compact' ||
  form === 'laptop';

/** Forms placed around the monitor rather than in the front row. */
const AROUND_MONITOR: ReadonlySet<TDeviceForm> = new Set([
  'desk-mat',
  'monitor-stand',
  'soundbar',
  'monitor',
  'light-bar',
  'light-strip',
  'speakers',
  'microphone',
  'lamp',
  'headset',
]);

/** Space kept above the monitor. */
export const MONITOR_TOP = 12;

/**
 * The smallest the screen is drawn. Below this the front row is scaled down
 * instead: a laptop raised on its stand under a monitor on a riser behind a
 * soundbar left the screen no room at all, and everything under it was drawn
 * over it.
 */
export const MIN_MONITOR_HEIGHT = 150;

/**
 * What stands under the screen, measured down from its bottom edge: its foot,
 * the riser the foot stands on, a soundbar in front, and the gap before the
 * keyboard.
 */
export const underMonitor = (raised: boolean, soundbar: boolean) => {
  const foot = 32;
  const standTop = foot - 6;
  const standBottom = raised ? standTop + SIZE['monitor-stand'].height : foot;
  const soundbarHeight = SIZE.soundbar.height * 0.9;
  // In front of the riser's legs, or in front of the foot on the desk.
  const soundbarTop = raised ? standBottom - soundbarHeight * 0.55 : 14;
  const bottom = soundbar ? soundbarTop + soundbarHeight : standBottom;
  return { standTop, soundbarTop, soundbarHeight, height: bottom + 10 };
};

/**
 * The screen belongs above the keyboard, not the centre of the whole desk,
 * as large as the room above what stands under it allows. Decided from the
 * front row and which of those things exist — never from where they were
 * drawn, because they are placed under the monitor and would otherwise move
 * the monitor they are under.
 */
export const monitorForDesk = (
  placed: readonly IPlacedDevice[],
  raised = placed.some((entry) => entry.form === 'monitor-stand'),
  soundbar = placed.some((entry) => entry.form === 'soundbar'),
  speakers = placed.some((entry) => entry.form === 'speakers'),
) => {
  const keyboards = placed.filter((entry) => isKeyboardForm(entry.form));
  if (keyboards.length === 0) {
    return { ...MONITOR, y: 24 };
  }
  // Over the middle of the keyboards, however many there are.
  const keyboard = {
    y: Math.min(...keyboards.map((entry) => entry.y)),
    centre:
      (Math.min(...keyboards.map((entry) => entry.x)) +
        Math.max(...keyboards.map((entry) => entry.x + entry.width))) /
      2,
  };
  const below = underMonitor(raised, soundbar).height;
  // A pair of speakers stands either side of the screen, so a keyboard at the
  // desk's end moves the screen in far enough for the outer one.
  const flank = speakers ? SIZE.speakers.width * 0.9 + 28 : 16;
  const front = placed.filter((entry) => !AROUND_MONITOR.has(entry.form));
  const place = (bottom: number) => {
    const height = Math.max(
      MIN_MONITOR_HEIGHT,
      Math.min(MONITOR.height, bottom - below - MONITOR_TOP),
    );
    const width = height * (MONITOR.width / MONITOR.height);
    const x = Math.max(
      flank,
      Math.min(DESK_WIDTH - width - flank, keyboard.centre - width / 2),
    );
    return { width, height, x, y: bottom - below - height };
  };
  // Moved in for the speakers, the screen can stand over a mousepad taller
  // than the keyboard; it then stands behind the pad instead, smaller.
  const first = place(keyboard.y);
  const tallest = Math.min(
    keyboard.y,
    ...front
      .filter(
        (entry) =>
          entry.x < first.x + first.width && entry.x + entry.width > first.x,
      )
      .map((entry) => entry.y),
  );
  if (tallest >= keyboard.y) {
    return first;
  }
  // Behind a tower there is no room at all; overlapping it is the lesser harm.
  const behind = place(tallest);
  return behind.y >= 0 ? behind : first;
};

export type TMonitor = ReturnType<typeof monitorForDesk>;

/**
 * The desk drawn faintly while nothing has been found: a keyboard, a mousepad
 * with its mouse and a headset on its stand, so the stage shows where the
 * member's devices will be rather than a monitor alone in an empty room.
 */
export const PLACEHOLDER_DESK: readonly ILightingDevice[] = (
  ['stand', 'headset', 'keyboard', 'mousepad', 'mouse'] as const
).map((kind: TLightingKind) => ({
  key: `placeholder:${kind}`,
  name: '',
  kind,
  form: FORM_OF_KIND[kind],
  route: 'none',
  lamps: KIND_PREVIEW_LAMPS[kind],
  channel: '',
  muted: false,
}));

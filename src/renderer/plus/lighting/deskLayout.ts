/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { TDeviceForm } from 'common/lighting/deviceForms';
import type { ILightingDevice } from 'common/lighting/lightingModel';
import placeAroundMonitor from './deskBackRow';
import {
  DESK_HEIGHT,
  DESK_WIDTH,
  formOfDevice,
  isKeyboardForm,
  MIN_MONITOR_HEIGHT,
  MONITOR_TOP,
  monitorForDesk,
  SIZE,
  underMonitor,
  type IPlacedDevice,
} from './deskGeometry';

/**
 * Where each found device stands on the drawn desk, by what it is.
 *
 * A desk, not a list. Along the front, left to right: headset stands, keypads
 * and controllers, the keyboard (or laptop, on its stand if there is one), the
 * mouse area — its pad with the mouse on it and a dock or charging pad at the
 * back — then mixers, docks and towers. A desk-length mat lies under the
 * keyboard and the mouse. The monitor stands behind the keyboard; speakers
 * flank it, a soundbar sits under it, a light bar on it and a light strip
 * along the wall behind; microphones and lamps take the back corners. Only
 * what was found is placed, and the front row is scaled to fit, so one
 * keyboard is a big keyboard and a full desk still fits.
 */

const GAP = 28;
const MARGIN = 24;
const BASELINE = DESK_HEIGHT - 26;
/** A headset hung on a stand is this much wider than the stand's pole. */
const HUNG_WIDTH = 1.3;

/** The front row's order, left to right; the mouse area is one slot. */
const LEFT_OF_KEYBOARD: readonly TDeviceForm[] = [
  'headset-stand',
  'keypad',
  'controller',
];
const RIGHT_OF_MOUSE: readonly TDeviceForm[] = [
  'mixer',
  'dock',
  'accessory',
  'tower',
  'chair',
];
const MOUSE_AREA: readonly TDeviceForm[] = [
  'mousepad',
  'mouse',
  'mouse-dock',
  'charging-pad',
  'mouse-bungee',
];

interface ISlot {
  width: number;
  height: number;
  place: (x: number, scale: number) => IPlacedDevice[];
}

const single = (
  device: ILightingDevice,
  form: TDeviceForm,
  widen = 1,
): ISlot => ({
  width: SIZE[form].width * widen,
  height: SIZE[form].height,
  place: (x, scale) => {
    const width = SIZE[form].width * scale;
    const height = SIZE[form].height * scale;
    const slot = SIZE[form].width * widen * scale;
    return [
      {
        device,
        form,
        x: x + (slot - width) / 2,
        y: BASELINE - height,
        width,
        height,
        onStand: false,
      },
    ];
  },
});

/** How far a laptop stand lifts the laptop, in the stand's own heights. */
const LAPTOP_RISE = 0.5;

/**
 * A laptop raised on its stand: the stand's wedge under the laptop's back,
 * its lit bottom edge showing below the deck.
 */
const laptopOnStand = (
  laptop: ILightingDevice,
  stand: ILightingDevice,
): ISlot => {
  const rise = SIZE['laptop-stand'].height * LAPTOP_RISE;
  return {
    width: SIZE.laptop.width,
    height: SIZE.laptop.height + rise,
    place: (x, scale) => {
      const width = SIZE.laptop.width * scale;
      const height = SIZE.laptop.height * scale;
      const standWidth = width * 0.92;
      const standHeight = SIZE['laptop-stand'].height * scale;
      return [
        {
          device: stand,
          form: 'laptop-stand',
          x: x + (width - standWidth) / 2,
          y: BASELINE - standHeight,
          width: standWidth,
          height: standHeight,
          onStand: false,
        },
        {
          device: laptop,
          form: 'laptop',
          x,
          y: BASELINE - rise * scale - height,
          width,
          height,
          onStand: false,
        },
      ];
    },
  };
};

/**
 * The mouse area: a pad if there is one (or the bare desk, or a desk mat),
 * a bungee, dock or charging pad along its back left, and the mouse to their
 * right where a hand rests — never on top of them.
 */
const mouseArea = (
  pad: ILightingDevice | undefined,
  mice: readonly ILightingDevice[],
  extras: readonly { device: ILightingDevice; form: TDeviceForm }[],
): ISlot => {
  const EXTRA_GAP = 10;
  const MOUSE_GAP = 12;
  // A bungee's arm reaches over the pad from the back left corner.
  const ordered = [...extras].sort(
    (a, b) =>
      Number(b.form === 'mouse-bungee') - Number(a.form === 'mouse-bungee'),
  );
  const extrasWidth = ordered.reduce(
    (sum, { form }) => sum + SIZE[form].width + EXTRA_GAP,
    0,
  );
  const miceWidth = mice.length * (SIZE.mouse.width + MOUSE_GAP);
  const area = pad
    ? SIZE.mousepad
    : { width: Math.max(170, 32 + extrasWidth + miceWidth), height: 190 };
  return {
    width: area.width,
    height: area.height,
    place: (x, scale) => {
      const width = area.width * scale;
      const height = area.height * scale;
      const y = BASELINE - height;
      const placed: IPlacedDevice[] = [];
      if (pad) {
        placed.push({
          device: pad,
          form: 'mousepad',
          x,
          y,
          width,
          height,
          onStand: false,
        });
      }
      let cursor = x + 16 * scale;
      ordered.forEach(({ device, form }) => {
        const w = SIZE[form].width * scale;
        placed.push({
          device,
          form,
          x: cursor,
          y: y + height * 0.06,
          width: w,
          height: SIZE[form].height * scale,
          onStand: false,
        });
        cursor += w + EXTRA_GAP * scale;
      });
      const w = SIZE.mouse.width * scale;
      const h = SIZE.mouse.height * scale;
      // The mice side by side round where a hand rests, clear of the extras.
      const spacing = w + MOUSE_GAP * scale;
      const firstCentre = Math.max(
        x + width * (pad ? 0.62 : 0.5) - ((mice.length - 1) * spacing) / 2,
        cursor + w / 2 + 6 * scale,
      );
      mice.forEach((mouse, index) => {
        placed.push({
          device: mouse,
          form: 'mouse',
          x: firstCentre + index * spacing - w / 2,
          y: y + height * 0.55 - h / 2,
          width: w,
          height: h,
          onStand: false,
        });
      });
      return placed;
    },
  };
};

const layoutDesk = (devices: readonly ILightingDevice[]): IPlacedDevice[] => {
  const entries = devices.map((device) => ({
    device,
    form: formOfDevice(device),
  }));
  const of = (form: TDeviceForm) =>
    entries.filter((entry) => entry.form === form).map((entry) => entry.device);
  const headsets = of('headset');
  const stands = of('headset-stand');

  const slots: ISlot[] = [];
  LEFT_OF_KEYBOARD.forEach((form) =>
    of(form).forEach((device, index) =>
      slots.push(
        single(
          device,
          form,
          // A stand carrying a headset takes the headset's width in the row:
          // the cups hang past the pole, and at the end of a full desk they ran
          // off its edge.
          form === 'headset-stand' && index < headsets.length ? HUNG_WIDTH : 1,
        ),
      ),
    ),
  );
  const keyboardStart = slots.length;
  // Laptop stands carry the laptops, in order; a stand with no laptop left
  // for it stands on its own to the right of the mouse.
  const laptopStands = [...of('laptop-stand')];
  entries
    .filter((entry) => isKeyboardForm(entry.form))
    .forEach((entry) => {
      const stand = entry.form === 'laptop' ? laptopStands.shift() : undefined;
      slots.push(
        stand
          ? laptopOnStand(entry.device, stand)
          : single(entry.device, entry.form),
      );
    });
  const keyboardEnd = slots.length;

  const pads = of('mousepad');
  const mice = of('mouse');
  const extras = entries.filter(
    (entry) =>
      MOUSE_AREA.includes(entry.form) &&
      entry.form !== 'mousepad' &&
      entry.form !== 'mouse',
  );
  const hasMouseArea = pads.length > 0 || mice.length > 0 || extras.length > 0;
  if (hasMouseArea) {
    slots.push(mouseArea(pads[0], mice, extras));
    // More pads than one: the rest stand on their own.
    pads.slice(1).forEach((pad) => slots.push(single(pad, 'mousepad')));
  }
  const mouseEnd = slots.length;
  laptopStands.forEach((device) => slots.push(single(device, 'laptop-stand')));
  RIGHT_OF_MOUSE.forEach((form) =>
    of(form).forEach((device) => slots.push(single(device, form))),
  );
  // With nothing to stand on or beside, a headset is part of the row.
  const anchored = keyboardEnd > keyboardStart || stands.length > 0;
  if (!anchored) {
    headsets.forEach((device) => slots.push(single(device, 'headset')));
  }

  const rowWidth =
    slots.reduce((sum, slot) => sum + slot.width, 0) +
    GAP * Math.max(0, slots.length - 1);
  const tallest = Math.max(0, ...slots.map((slot) => slot.height));
  const roomAbove = BASELINE - 40;
  // The keyboard's slot also has to leave the monitor above it its least
  // height, with whatever stands under the monitor.
  const keyboardTallest = Math.max(
    0,
    ...slots.slice(keyboardStart, keyboardEnd).map((slot) => slot.height),
  );
  const monitorRoom =
    BASELINE -
    MONITOR_TOP -
    MIN_MONITOR_HEIGHT -
    underMonitor(of('monitor-stand').length > 0, of('soundbar').length > 0)
      .height;
  const scale = Math.min(
    1,
    rowWidth > 0 ? (DESK_WIDTH - MARGIN * 2) / rowWidth : 1,
    tallest > 0 ? roomAbove / tallest : 1,
    keyboardTallest > 0 ? monitorRoom / keyboardTallest : 1,
  );

  const placed: IPlacedDevice[] = [];
  const slotStarts: number[] = [];
  let x = (DESK_WIDTH - rowWidth * scale) / 2;
  slots.forEach((slot) => {
    slotStarts.push(x);
    placed.push(...slot.place(x, scale));
    x += (slot.width + GAP) * scale;
  });

  // A desk-length mat lies under the keyboard and the mouse area.
  of('desk-mat').forEach((mat, index) => {
    const from = slotStarts[keyboardStart] ?? slotStarts[0] ?? MARGIN;
    const lastSlot = Math.max(keyboardStart, mouseEnd - 1);
    const to =
      slotStarts[lastSlot] !== undefined
        ? slotStarts[lastSlot] + slots[lastSlot].width * scale
        : DESK_WIDTH - MARGIN;
    const padding = 26 * scale;
    const width = Math.min(DESK_WIDTH - 12, to - from + padding * 2);
    const height = Math.min(SIZE['desk-mat'].height * scale, BASELINE - 60);
    placed.push({
      device: mat,
      form: 'desk-mat',
      x: Math.max(6, from - padding),
      y: BASELINE + 14 * scale - height - index * 10,
      width,
      height,
      onStand: false,
    });
  });

  const monitor = monitorForDesk(
    placed,
    of('monitor-stand').length > 0,
    of('soundbar').length > 0,
    of('speakers').length > 0,
  );
  const placedStands = placed.filter((entry) => entry.form === 'headset-stand');
  placed.push(
    ...placeAroundMonitor({
      monitor,
      placed,
      of,
      // Headsets beyond the stands lie beside the monitor; with no keyboard
      // or stand at all they were already given a place in the front row.
      looseHeadsets: anchored ? headsets.slice(placedStands.length) : [],
    }),
  );

  // Hung on the stands' hooks, cups either side of the pole.
  headsets
    .slice(0, anchored ? placedStands.length : 0)
    .forEach((device, index) => {
      const stand = placedStands[index];
      const hungWidth = stand.width * HUNG_WIDTH;
      placed.push({
        device,
        form: 'headset',
        x: stand.x + stand.width / 2 - hungWidth / 2,
        y: stand.y + stand.height * 0.02,
        width: hungWidth,
        height: hungWidth * (SIZE.headset.height / SIZE.headset.width),
        onStand: true,
      });
    });

  return placed;
};

export default layoutDesk;

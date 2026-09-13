/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { TDeviceForm } from 'common/lighting/deviceForms';
import type { ILightingDevice } from 'common/lighting/lightingModel';
import {
  DESK_WIDTH,
  SIZE,
  underMonitor,
  type IPlacedDevice,
  type TMonitor,
} from './deskGeometry';

/**
 * Everything placed around the monitor once the front row stands: the riser
 * and soundbar under it, a lit monitor's base, the light bar on it and the
 * light strip on the wall behind, and — either side of it — speakers,
 * microphones, lamps and headsets that have no stand to hang on.
 */

const EDGE = 6;
const BESIDE_GAP = 18;
/** The least a thing beside the monitor shrinks to before it may overlap. */
const MIN_FIT = 0.5;

interface IAroundMonitor {
  monitor: TMonitor;
  /** The front row and the desk mat, already placed. */
  placed: readonly IPlacedDevice[];
  of: (form: TDeviceForm) => ILightingDevice[];
  /** Headsets with no stand to hang on. */
  looseHeadsets: readonly ILightingDevice[];
}

const placeAroundMonitor = ({
  monitor,
  placed,
  of,
  looseHeadsets,
}: IAroundMonitor): IPlacedDevice[] => {
  const around: IPlacedDevice[] = [];
  const monitorBottom = monitor.y + monitor.height;
  const centre = monitor.x + monitor.width / 2;
  const raised = of('monitor-stand').length > 0;
  const under = underMonitor(raised, of('soundbar').length > 0);
  const add = (
    device: ILightingDevice,
    form: TDeviceForm,
    box: { x: number; y: number; width: number; height: number },
  ) => around.push({ device, form, ...box, onStand: false });

  of('monitor-stand').forEach((device) => {
    const width = Math.min(SIZE['monitor-stand'].width, monitor.width * 1.25);
    add(device, 'monitor-stand', {
      x: centre - width / 2,
      y: monitorBottom + under.standTop,
      width,
      height: SIZE['monitor-stand'].height,
    });
  });
  of('soundbar').forEach((device, index) => {
    const width = Math.min(SIZE.soundbar.width, monitor.width * 1.05);
    add(device, 'soundbar', {
      x: centre - width / 2 + index * 14,
      y: monitorBottom + under.soundbarTop - index * 10,
      width,
      height: under.soundbarHeight,
    });
  });
  // A monitor that is itself lit (Raptor 27) is the monitor already drawn;
  // what it adds is its lit base, under the screen.
  of('monitor').forEach((device) => {
    add(device, 'monitor', {
      x: centre - SIZE.monitor.width / 2,
      y: monitorBottom + 14,
      width: SIZE.monitor.width,
      height: SIZE.monitor.height,
    });
  });
  of('light-bar').forEach((device) => {
    const width = Math.min(SIZE['light-bar'].width, monitor.width * 0.8);
    add(device, 'light-bar', {
      x: centre - width / 2,
      y: Math.max(2, monitor.y - SIZE['light-bar'].height - 4),
      width,
      height: SIZE['light-bar'].height,
    });
  });
  of('light-strip').forEach((device, index) => {
    add(device, 'light-strip', {
      x: (DESK_WIDTH - SIZE['light-strip'].width) / 2,
      y: monitor.y + monitor.height * 0.62 + index * 22,
      width: SIZE['light-strip'].width,
      height: SIZE['light-strip'].height,
    });
  });

  // Beside the monitor, from the inside out. Each stands on the line of the
  // monitor's foot, unless something under it reaches higher — a mousepad or
  // a tower in the front row, a riser wider than the screen — in which case
  // it stands behind that, smaller if it has to be.
  const beneath = [
    ...placed.filter((entry) => entry.form !== 'desk-mat'),
    ...around.filter((entry) => entry.form !== 'light-strip'),
  ];
  const ceilingOver = (from: number, to: number) =>
    Math.min(
      monitorBottom + 30,
      ...beneath
        .filter((entry) => entry.x < to && entry.x + entry.width > from)
        .map((entry) => entry.y - 6),
    );
  const next = { left: monitor.x - 22, right: monitor.x + monitor.width + 22 };
  const room = (side: 'left' | 'right') =>
    side === 'left' ? next.left - EDGE : DESK_WIDTH - EDGE - next.right;
  const beside = (
    device: ILightingDevice,
    form: TDeviceForm,
    preferred: 'left' | 'right',
    options: { part?: 'left' | 'right'; hops?: boolean } = {},
  ) => {
    const fullWidth = SIZE[form].width * 0.9;
    const fullHeight = SIZE[form].height * 0.9;
    const other = preferred === 'left' ? 'right' : 'left';
    // A pair of speakers keeps its sides; anything else takes the side with
    // room, or the one with more of it.
    let side = preferred;
    if (options.hops && room(preferred) < fullWidth) {
      side =
        room(other) >= fullWidth || room(other) > room(preferred)
          ? other
          : preferred;
    }
    // Where a side is full, a narrower copy fits beside the last one rather
    // than drawing over it.
    const across = Math.min(1, Math.max(MIN_FIT, room(side) / fullWidth));
    const slotWidth = fullWidth * across;
    const slotX =
      side === 'left'
        ? Math.max(EDGE, next.left - slotWidth)
        : Math.min(DESK_WIDTH - EDGE - slotWidth, next.right);
    next[side] =
      side === 'left' ? slotX - BESIDE_GAP : slotX + slotWidth + BESIDE_GAP;
    const floor = ceilingOver(slotX, slotX + slotWidth);
    const fit = Math.min(
      across,
      Math.max(MIN_FIT, (floor - EDGE) / Math.max(1, fullHeight)),
    );
    const width = fullWidth * fit;
    const height = fullHeight * fit;
    around.push({
      device,
      form,
      // Shrunk towards the monitor, so the gap beside it stays the same.
      x: side === 'left' ? slotX + slotWidth - width : slotX,
      y: floor - height,
      width,
      height,
      onStand: false,
      ...(options.part ? { part: options.part } : {}),
    });
  };
  of('speakers').forEach((device) => {
    beside(device, 'speakers', 'left', { part: 'left' });
    beside(device, 'speakers', 'right', { part: 'right' });
  });
  of('microphone').forEach((device) =>
    beside(device, 'microphone', 'left', { hops: true }),
  );
  of('lamp').forEach((device) =>
    beside(device, 'lamp', 'right', { hops: true }),
  );
  looseHeadsets.forEach((device, index) =>
    beside(device, 'headset', index % 2 === 0 ? 'left' : 'right', {
      hops: true,
    }),
  );
  return around;
};

export default placeAroundMonitor;

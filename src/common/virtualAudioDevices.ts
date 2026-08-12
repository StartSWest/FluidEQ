/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import { normalizeDeviceName } from './audioDeviceBridge';
import { IAudioDevice } from './constants';

/**
 * Recognising somebody else's virtual audio device.
 *
 * FluidEQ deliberately ships no driver — the README sells that as a feature,
 * and writing a kernel-level virtual sound card would end it. But a user who
 * has already installed VB-Cable or Voicemeeter has the one thing Equalizer
 * APO cannot do: real routing, with no added latency, working whether or not
 * FluidEQ is running.
 *
 * When that is present it is strictly better than the mirror, so the UI needs
 * to know. FluidEQ's contribution then shrinks to what it is good at — the EQ
 * on each real endpoint — and the fan-out belongs to the driver, which is the
 * correct division of labour.
 *
 * Detection is by name because that is all Windows offers here. These are
 * product names shipped by the vendor rather than anything a user types, so
 * they are far more stable than a display name in general — but this is still
 * a heuristic, and it only ever *adds* an option. Getting it wrong shows a
 * hint that does not apply; it never routes audio anywhere.
 */

export enum VirtualDeviceEnum {
  VB_CABLE = 'vbCable',
  VOICEMEETER = 'voicemeeter',
}

export interface IVirtualDeviceMatch {
  kind: VirtualDeviceEnum;
  /**
   * Which of the driver's inputs this is. Voicemeeter exposes three, and a
   * user pointing an application at one of them needs to be told which.
   */
  inputLabel: string;
}

/**
 * Ordered most specific first, and it has to stay that way: "voicemeeter aux
 * input" also starts with "voicemeeter", so a general rule placed above a
 * specific one would swallow it and label every Voicemeeter input as the
 * first one.
 *
 * Matched as a prefix rather than an exact name because Windows appends the
 * driver in parentheses — "CABLE Input (VB-Audio Virtual Cable)" — and that
 * suffix varies between versions of the same product.
 */
const VIRTUAL_DEVICE_RULES: {
  prefix: string;
  kind: VirtualDeviceEnum;
  inputLabel: string;
}[] = [
  {
    prefix: 'voicemeeter aux input',
    kind: VirtualDeviceEnum.VOICEMEETER,
    inputLabel: 'Aux',
  },
  {
    prefix: 'voicemeeter vaio3 input',
    kind: VirtualDeviceEnum.VOICEMEETER,
    inputLabel: 'VAIO3',
  },
  {
    prefix: 'voicemeeter vaio3',
    kind: VirtualDeviceEnum.VOICEMEETER,
    inputLabel: 'VAIO3',
  },
  {
    prefix: 'voicemeeter input',
    kind: VirtualDeviceEnum.VOICEMEETER,
    inputLabel: 'Main',
  },
  {
    prefix: 'cable input',
    kind: VirtualDeviceEnum.VB_CABLE,
    inputLabel: 'Main',
  },
];

/**
 * Identify an endpoint as one of the virtual inputs we know about.
 *
 * Returns `undefined` for an ordinary sound card, which is the common case.
 */
export const identifyVirtualDevice = (
  device: IAudioDevice,
): IVirtualDeviceMatch | undefined => {
  const name = normalizeDeviceName(device.name);
  const rule = VIRTUAL_DEVICE_RULES.find((candidate) =>
    name.startsWith(candidate.prefix),
  );
  return rule ? { kind: rule.kind, inputLabel: rule.inputLabel } : undefined;
};

/**
 * Whether any routing driver is installed at all.
 *
 * This is the question the UI actually asks, because it decides which of the
 * two routes to lead with: with a driver present the honest advice is to use
 * it and skip the mirror's latency entirely.
 */
export const hasVirtualRouting = (devices: IAudioDevice[]): boolean =>
  devices.some((device) => identifyVirtualDevice(device) !== undefined);

/**
 * The virtual inputs, in the order they were given, for listing in the UI.
 */
export const getVirtualDevices = (
  devices: IAudioDevice[],
): (IAudioDevice & { virtual: IVirtualDeviceMatch })[] =>
  devices.flatMap((device) => {
    const virtual = identifyVirtualDevice(device);
    return virtual ? [{ ...device, virtual }] : [];
  });

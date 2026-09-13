/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  KIND_PREVIEW_LAMPS,
  lampArrayLamps,
} from '../../common/lighting/lampLayouts';
import type {
  ILamp,
  ILightingDevice,
  ILightingSettings,
  TLightingKind,
  TSynapseState,
} from '../../common/lighting/lightingModel';
import {
  isRazerLightingCandidate,
  razerKindOf,
} from '../../common/lighting/razerDevices';
import {
  LAMP_ARRAY_KIND,
  type ILampArrayEvent,
  type IRazerEvent,
} from './lightingWire';

/**
 * The devices on the page: what Windows Dynamic Lighting and Razer's devices
 * report, merged into one row per physical device.
 *
 * A Razer device can be both — a Kraken V4 Pro is a Windows lighting device
 * and a Razer Chroma one — and appears once, under Razer's name, found by the
 * Windows device container the two share.
 */

export interface IWindowsDevice {
  event: ILampArrayEvent;
  lamps: ILamp[];
  kind: TLightingKind;
  /** Windows' last word on whether FluidEQ may light it; unknown until read. */
  available: boolean | undefined;
}

export const RAZER_VENDOR_ID = 0x1532;

export const kindOfLampArray = (event: ILampArrayEvent): TLightingKind => {
  switch (event.kind) {
    case LAMP_ARRAY_KIND.keyboard:
      return 'keyboard';
    case LAMP_ARRAY_KIND.mouse:
      return 'mouse';
    case LAMP_ARRAY_KIND.headset:
    case LAMP_ARRAY_KIND.wearable:
      return 'headset';
    case LAMP_ARRAY_KIND.speaker:
      return 'speaker';
    default:
      // "Peripheral" covers mousepads, stands, webcams and microphones alike;
      // the name is the better guess where it says which.
      if (event.vendorId === RAZER_VENDOR_ID) {
        return razerKindOf(event.name);
      }
      return /\bpad\b|mat\b/i.test(event.name) ? 'mousepad' : 'accessory';
  }
};

export const toWindowsDevice = (event: ILampArrayEvent): IWindowsDevice => ({
  event,
  lamps: lampArrayLamps(event.positions, event.width, event.height),
  kind: kindOfLampArray(event),
  available: undefined,
});

export const windowsKey = (event: ILampArrayEvent) => `windows:${event.id}`;
export const razerKey = (container: string) => `razer:${container}`;

/**
 * Which row lights a Windows device's lamps: its own, or the Razer row of the
 * same physical device. `undefined` for none (not listed at all).
 */
export const rowKeyOfWindowsDevice = (
  device: IWindowsDevice,
  razer: ReadonlyMap<string, IRazerEvent>,
): string => {
  const shared = device.event.container && razer.get(device.event.container);
  return shared && isRazerLightingCandidate(shared.name)
    ? razerKey(shared.container)
    : windowsKey(device.event);
};

/** Every Razer device Razer Chroma would light, by container. */
export const razerCandidates = (
  razer: ReadonlyMap<string, IRazerEvent>,
): IRazerEvent[] =>
  [...razer.values()]
    .filter((entry) => isRazerLightingCandidate(entry.name))
    .sort((a, b) => a.name.localeCompare(b.name));

export const buildDeviceList = (
  windows: ReadonlyMap<number, IWindowsDevice>,
  razer: ReadonlyMap<string, IRazerEvent>,
  settings: ILightingSettings,
  synapse: TSynapseState,
): ILightingDevice[] => {
  const synapseLights = synapse === 'running' || synapse === 'unknown';
  const rows: ILightingDevice[] = [];

  razerCandidates(razer).forEach((entry) => {
    const key = razerKey(entry.container);
    const windowsTwin = [...windows.values()].find(
      (device) => device.event.container === entry.container,
    );
    const kind = windowsTwin?.kind ?? razerKindOf(entry.name);
    let route: ILightingDevice['route'] = 'none';
    if (synapseLights) {
      route = 'synapse';
    } else if (windowsTwin) {
      route = 'windows';
    }
    rows.push({
      key,
      name: entry.name,
      kind,
      route,
      lamps: windowsTwin?.lamps ?? KIND_PREVIEW_LAMPS[kind],
      // Synapse lights by kind of device, so every Razer device it reaches is
      // one channel; through Windows each is its own.
      channel: route === 'synapse' ? 'synapse' : key,
      muted: route !== 'synapse' && settings.muted.includes(key),
    });
  });

  [...windows.values()]
    .filter(
      (device) =>
        rowKeyOfWindowsDevice(device, razer) === windowsKey(device.event),
    )
    .sort((a, b) => a.event.name.localeCompare(b.event.name))
    .forEach((device) => {
      const key = windowsKey(device.event);
      rows.push({
        key,
        name: device.event.name,
        kind: device.kind,
        route: 'windows',
        lamps: device.lamps,
        channel: key,
        muted: settings.muted.includes(key),
      });
    });

  return rows;
};

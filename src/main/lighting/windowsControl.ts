/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type {
  IWindowsHold,
  TLightingVendor,
  TWindowsBackground,
  TWindowsHoldReason,
} from '../../common/lighting/lightingModel';
import type { TIdentityOutcome } from './lightingIdentity';
import type {
  IDeviceLightingSettings,
  ILightingSettingsEvent,
} from './lightingWire';

/**
 * Why Windows is keeping a device's lamps from FluidEQ, from what the member
 * set on the Dynamic Lighting page — so the page can name the one setting in
 * the way instead of "Windows is holding them".
 *
 * Windows decides who lights a device and says only "not available"; the
 * reasons below are read off the settings it decides from, in the order a
 * member has to fix them. Pure: the service passes what it has.
 */

/**
 * What the identity registration means for Windows devices held back while
 * FluidEQ is behind other windows. Not yet asked (lighting never switched on
 * this launch) and still registering both read as checking, so the page does
 * not promise a Settings entry it has not confirmed.
 */
export const windowsBackgroundOf = (
  identity: TIdentityOutcome | 'pending' | undefined,
): TWindowsBackground => {
  if (identity === 'registered') {
    return 'possible';
  }
  if (identity === 'developer-mode-off') {
    return 'needs-developer-mode';
  }
  return identity === undefined || identity === 'pending'
    ? 'checking'
    : 'unavailable';
};

export interface IHeldDevice {
  name: string;
  /** Windows' device interface id, `\\?\HID#...`. */
  id: string;
  vendorId: number;
}

const VENDOR_IDS: Readonly<Record<number, TLightingVendor>> = {
  0x1532: 'razer',
  0x046d: 'logitech',
  0x0b05: 'asus',
};

/** A device a vendor's software names but whose USB vendor id it does not own. */
const VENDOR_NAMES: readonly (readonly [RegExp, TLightingVendor])[] = [
  [/^razer\b/i, 'razer'],
  [/^logitech\b/i, 'logitech'],
  [/^(asus|rog)\b/i, 'asus'],
];

const vendorOf = (device: IHeldDevice): TLightingVendor | undefined =>
  VENDOR_IDS[device.vendorId] ??
  VENDOR_NAMES.find(([pattern]) => pattern.test(device.name))?.[1];

/** Settings keys a device by its interface path without `\\?\`. */
const settingsKeyOf = (id: string) => id.replace(/^\\\\\?\\/, '').toLowerCase();

const sameList = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length &&
  a.every((entry, index) => entry.toLowerCase() === b[index].toLowerCase());

const RANK: readonly TWindowsHoldReason[] = [
  'unavailable',
  'needs-developer-mode',
  'dynamic-lighting-off',
  'not-first',
  'waiting',
];

interface IDiagnosis {
  reason: TWindowsHoldReason;
  above: readonly string[];
}

const diagnose = (
  device: IHeldDevice,
  background: TWindowsBackground | undefined,
  settings: ILightingSettingsEvent | undefined,
  familyName: string | undefined,
): IDiagnosis => {
  if (background === 'unavailable') {
    return { reason: 'unavailable', above: [] };
  }
  if (background === 'needs-developer-mode') {
    return { reason: 'needs-developer-mode', above: [] };
  }
  if (background !== 'possible' || !familyName || !settings?.present) {
    // Still registering, or a helper started before the registration: the
    // next helper has the identity, and Windows' answer follows it.
    return { reason: 'waiting', above: [] };
  }
  const own: IDeviceLightingSettings | undefined = settings.devices.find(
    (entry) => entry.id.toLowerCase() === settingsKeyOf(device.id),
  );
  if (settings.enabled === false || own?.enabled === false) {
    return { reason: 'dynamic-lighting-off', above: [] };
  }
  // A device's own list wins where it has one; Windows copies the global one
  // into it the first time the device is seen.
  const order = own?.providers ?? settings.providers ?? [];
  const position = order.findIndex(
    (provider) => provider.toLowerCase() === familyName.toLowerCase(),
  );
  if (position !== 0) {
    return {
      reason: 'not-first',
      above: position < 0 ? order : order.slice(0, position),
    };
  }
  return { reason: 'waiting', above: [] };
};

export const describeWindowsHold = (
  held: readonly IHeldDevice[],
  background: TWindowsBackground | undefined,
  settings: ILightingSettingsEvent | undefined,
  familyName: string | undefined,
): IWindowsHold | undefined => {
  if (held.length === 0) {
    return undefined;
  }
  const diagnosed = held.map((device) => ({
    device,
    ...diagnose(device, background, settings, familyName),
  }));
  // The most actionable reason any held device has: fixing it comes first.
  const reason =
    RANK[Math.min(...diagnosed.map((entry) => RANK.indexOf(entry.reason)))];
  const chosen = diagnosed.filter((entry) => entry.reason === reason);
  const above: string[] = [];
  chosen.forEach((entry) =>
    entry.above.forEach((provider) => {
      if (
        !above.some((known) => known.toLowerCase() === provider.toLowerCase())
      ) {
        above.push(provider);
      }
    }),
  );
  const globalOrder = settings?.providers;
  const vendors = [
    ...new Set(
      chosen
        .map((entry) => vendorOf(entry.device))
        .filter((vendor): vendor is TLightingVendor => vendor !== undefined),
    ),
  ];
  return {
    reason,
    devices: chosen.map((entry) => entry.device.name),
    above,
    resetNeeded: Boolean(
      globalOrder &&
      settings?.devices.some(
        (entry) => entry.providers && !sameList(entry.providers, globalOrder),
      ),
    ),
    foregroundFirst: settings?.foregroundFirst !== false,
    vendors,
  };
};

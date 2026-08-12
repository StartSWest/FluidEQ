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

import { IAudioDevice } from './constants';

/**
 * Bridging the two names Windows and Chromium have for the same speaker.
 *
 * Every other part of the multiple-output feature sits on top of this, so it is
 * worth being precise about what the two sides actually are:
 *
 * - **Windows / Equalizer APO** identify an endpoint by GUID. `IAudioDevice.id`
 *   is the full MMDevice id (`{0.0.0.00000000}.{guid}`) and `guid` is the tail
 *   of it. `Device:` lines in the APO config are written against that, and
 *   device profiles are keyed on it. It is stable across reboots and renames.
 * - **Chromium** wants a `deviceId` from `enumerateDevices()` for `setSinkId`.
 *   It is a per-origin hash that shares nothing with the GUID and is not
 *   derivable from it.
 *
 * The only thing joining them is the display name, which both sides read from
 * the same Windows property (`PKEY_Device_FriendlyName`) and which is neither
 * guaranteed unique nor stable — two things can be called "Speakers", and a
 * user can rename either of them.
 *
 * So matching is by exact name, and **anything less than exactly one match
 * refuses**. There is deliberately no fuzzy fallback: the failure mode of a
 * near-miss is playing a correction into the wrong speaker while the UI claims
 * otherwise, and a user who is told "we cannot tell these two apart" can
 * rename one in Windows and be done. A user silently mirrored to the wrong
 * device has no idea anything needs fixing.
 */

/**
 * The Chromium half of an output, as `enumerateDevices()` reports it.
 *
 * Structural rather than `MediaDeviceInfo` so the matching is testable without
 * a browser — `MediaDeviceInfo` cannot be constructed in jsdom.
 */
export interface IMediaOutputDevice {
  deviceId: string;
  label: string;
  groupId?: string;
}

export enum DeviceMatchEnum {
  /** Exactly one output carries this name. `sinkId` is safe to use. */
  MATCHED = 'matched',
  /** The name does not pick out one output. Refuse rather than guess. */
  AMBIGUOUS = 'ambiguous',
  /** Chromium is not offering this endpoint at all. */
  UNMATCHED = 'unmatched',
  /** Chromium is withholding every label, so no match is possible yet. */
  LABELS_HIDDEN = 'labelsHidden',
}

export interface IAudioDeviceMatch {
  /** The Windows endpoint GUID. This is what gets persisted, never `sinkId`. */
  guid: string;
  name: string;
  status: DeviceMatchEnum;
  /** Chromium sink id. Only ever present when the status is MATCHED. */
  sinkId?: string;
  /** The sink ids that tied, so the UI can say how bad the collision is. */
  tiedSinkIds?: string[];
}

/**
 * Chromium's aliases, which are not endpoints.
 *
 * `default` and `communications` are pointers to whatever Windows currently
 * calls the default output, and they are excluded from matching for two
 * separate reasons, either of which is sufficient:
 *
 * 1. They move. A mirror aimed at `default` silently retargets the moment the
 *    user changes their default output — precisely the "wrong speaker without
 *    being told" outcome the exact-match rule exists to prevent.
 * 2. Their labels are prefixed ("Default - Speakers (Realtek)"), so they never
 *    match a Windows friendly name anyway, and leaving them in would only make
 *    real endpoints look ambiguous by colliding on a name nobody has.
 */
const PSEUDO_SINK_IDS = new Set(['default', 'communications']);

/**
 * The USB id Chromium adds and Windows does not.
 *
 * Chromium appends the vendor and product id to the label of a **USB** audio
 * device, to tell two identical products apart:
 *
 *     Windows:   Speakers (Razer Leviathan V2)
 *     Chromium:  Speakers (Razer Leviathan V2) (1532:0532)
 *
 * Anything that is not USB — onboard Realtek, an NVIDIA HDMI output — gets no
 * suffix and already matches byte for byte. So this is not a fuzzy allowance
 * for names that are merely similar; it is one exact, mechanical difference,
 * and every USB endpoint on a machine has it.
 *
 * Deliberately narrow: four hex digits, a colon, four hex digits, in trailing
 * parentheses. A real name ending in brackets — "(NVIDIA High Definition
 * Audio)" — cannot match it, and the refusal rule is untouched, because two
 * devices that collide *after* the suffix comes off are still ambiguous and
 * still refused.
 */
const USB_PRODUCT_ID = /\s*\([0-9a-f]{4}:[0-9a-f]{4}\)$/i;

/**
 * Both sides read the same Windows property, so the strings normally agree
 * byte for byte. The normalisation absorbs only differences that are never
 * meaningful: surrounding space, a doubled space inside, case, and the USB id
 * above. `toLocaleLowerCase` rather than `toLowerCase`, matching how
 * `filterVisibleAudioDevices` already folds names in `src/main/deviceProfiles`.
 */
export const normalizeDeviceName = (name: string): string =>
  name
    .trim()
    .replace(USB_PRODUCT_ID, '')
    .replace(/\s+/g, ' ')
    .toLocaleLowerCase();

/** Real endpoints only: no aliases, nothing without a usable id. */
const getMatchableOutputs = (
  outputs: IMediaOutputDevice[],
): IMediaOutputDevice[] =>
  outputs.filter(
    (output) => output.deviceId && !PSEUDO_SINK_IDS.has(output.deviceId),
  );

/**
 * Match every Windows endpoint against the outputs Chromium is offering.
 *
 * Returns one result per input device, in the order given, so a caller can zip
 * it back onto its own list without another lookup.
 */
export const matchAudioDevices = (
  devices: IAudioDevice[],
  outputs: IMediaOutputDevice[],
): IAudioDeviceMatch[] => {
  const matchable = getMatchableOutputs(outputs);

  // Chromium blanks every label until the origin has been granted media
  // permission. That is a completely different problem from a name that does
  // not match — the fix is a permission, not a rename — so it gets its own
  // status rather than presenting as "we could not find your speakers".
  //
  // Guarded on there being outputs at all: an empty list is a machine with no
  // outputs, which is UNMATCHED, not a permission failure.
  const areLabelsHidden =
    matchable.length > 0 && matchable.every((output) => !output.label.trim());

  const outputsByName = new Map<string, IMediaOutputDevice[]>();
  matchable.forEach((output) => {
    const key = normalizeDeviceName(output.label);
    if (!key) {
      return;
    }
    const existing = outputsByName.get(key);
    if (existing) {
      existing.push(output);
    } else {
      outputsByName.set(key, [output]);
    }
  });

  // Duplicates on the Windows side too, and not redundant with the check
  // above. `filterVisibleAudioDevices` already collapses same-named endpoints
  // before the app ever sees them, so by the time a list reaches here two
  // "Speakers" may have become one — which would match a single Chromium
  // output and look perfectly unambiguous while actually being a coin flip.
  // Callers that can supply the unfiltered list should, and this catches them
  // when they do.
  const duplicatedNames = new Set<string>();
  const seenNames = new Set<string>();
  devices.forEach((device) => {
    const key = normalizeDeviceName(device.name);
    if (!key) {
      return;
    }
    if (seenNames.has(key)) {
      duplicatedNames.add(key);
    }
    seenNames.add(key);
  });

  return devices.map((device) => {
    const base = { guid: device.guid, name: device.name };
    const key = normalizeDeviceName(device.name);

    if (areLabelsHidden) {
      return { ...base, status: DeviceMatchEnum.LABELS_HIDDEN };
    }
    if (!key) {
      return { ...base, status: DeviceMatchEnum.UNMATCHED };
    }

    const candidates = outputsByName.get(key) ?? [];
    const tiedSinkIds = candidates.map((candidate) => candidate.deviceId);

    if (duplicatedNames.has(key)) {
      return { ...base, status: DeviceMatchEnum.AMBIGUOUS, tiedSinkIds };
    }
    if (candidates.length === 0) {
      return { ...base, status: DeviceMatchEnum.UNMATCHED };
    }
    if (candidates.length > 1) {
      return { ...base, status: DeviceMatchEnum.AMBIGUOUS, tiedSinkIds };
    }
    return {
      ...base,
      status: DeviceMatchEnum.MATCHED,
      sinkId: candidates[0].deviceId,
    };
  });
};

/**
 * Re-resolve a persisted mirror target to a sink id usable right now.
 *
 * **Persist the GUID, never the sink id.** Chromium's `deviceId` is salted per
 * origin and is reset whenever the user clears site data, so a stored sink id
 * can silently start pointing at nothing — or, worse, at a different endpoint.
 * The GUID is what Windows and APO already agree on and what device profiles
 * are keyed on, so it is the only thing worth writing down; the sink id is
 * derived again on every run.
 *
 * Returns `undefined` when the endpoint itself is gone — unplugged or
 * disabled — which is distinct from it being present but unmatchable, and the
 * caller should say so differently.
 */
export const resolveMirrorSinkId = (
  guid: string,
  devices: IAudioDevice[],
  outputs: IMediaOutputDevice[],
): IAudioDeviceMatch | undefined => {
  const index = devices.findIndex((device) => device.guid === guid);
  if (index < 0) {
    return undefined;
  }
  return matchAudioDevices(devices, outputs)[index];
};

/**
 * Whether an endpoint may be used as a mirror target at all.
 *
 * The mirror plays what FluidEQ captured, and on Windows the capture is a
 * loopback of the default output. Aiming it back at the endpoint it is
 * capturing closes the loop: captured audio is EQ'd, played into the same
 * output, captured again a moment later, and round it goes — a genuine
 * howl-round that builds with every pass, not merely a doubled signal.
 *
 * Kept separate from name matching because it is a different question. A
 * device can match perfectly and still be an illegal target.
 */
export const isEligibleMirrorTarget = (
  device: IAudioDevice,
  captureSourceGuid?: string,
): boolean => {
  if (!device.isActive) {
    return false;
  }
  if (captureSourceGuid) {
    return device.guid !== captureSourceGuid;
  }
  // Without an explicit capture source, the default endpoint is what Windows
  // loopback is giving us, so it is the one to keep out.
  return !device.isDefault;
};

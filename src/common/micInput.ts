/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Which of Chromium's audio inputs is a Windows microphone.
 *
 * Chromium hands out device ids salted per origin, never the endpoint's id,
 * so the label is the only thing the two share — and Chromium does not use
 * Windows' name as it is: a USB device's label ends in its vendor and product
 * ids, and the default and communications devices are listed a second time
 * behind a prefix. Ivan's Kraken is "Microphone (Razer Kraken V4 Pro USB -
 * Chat)" to Windows and "Microphone (Razer Kraken V4 Pro USB - Chat)
 * (1532:0567)" to Chromium; an exact match found nothing, the tab opened no
 * stream, and the engine — which only runs while something records — never
 * started on the mic (2026-11-22).
 */

export interface IMediaInput {
  kind: string;
  label: string;
  deviceId: string;
}

/** Chromium's prefixes for the duplicate entries of the default devices. */
const ROLE_PREFIX = /^(?:default|communications) - /i;
/** A USB device's " (vvvv:pppp)" vendor and product ids. */
const USB_IDS = / \([0-9a-f]{4}:[0-9a-f]{4}\)$/i;

const bare = (label: string) =>
  label.trim().replace(ROLE_PREFIX, '').replace(USB_IDS, '').toLowerCase();

/**
 * The device id of the input whose label is `windowsName`, preferring the
 * plain entry over its "Default - " or "Communications - " twin (the twin
 * follows whatever device holds the role, not this one).
 */
export const micInputFor = (
  devices: readonly IMediaInput[],
  windowsName: string,
): string | undefined => {
  const wanted = windowsName.trim().toLowerCase();
  if (!wanted) {
    return undefined;
  }
  const matching = devices.filter(
    (device) => device.kind === 'audioinput' && bare(device.label) === wanted,
  );
  return (
    matching.find((device) => !ROLE_PREFIX.test(device.label.trim())) ??
    matching[0]
  )?.deviceId;
};

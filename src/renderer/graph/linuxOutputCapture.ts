/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { Translate } from 'common/i18n';

/**
 * The live capture on Linux: the FluidEQ Engine's "FluidEQ Monitor" input.
 *
 * On Windows the graph, the top wave and the output meter are drawn from the
 * output's loopback, which `getDisplayMedia` hands out. Chromium on Linux has
 * no loopback, and lists only real inputs — no sound-server monitor among
 * them — so every live display stood still. The engine therefore publishes
 * what it hands the output, after the EQ, as an ordinary input of its own
 * (`native/linux/engine/pw_monitor.cpp`, `pulse_monitor.cpp`), and this opens
 * it by its name. `getDisplayMedia` is never asked here: under Wayland it is
 * the desktop portal's screen picker, a dialog for something nobody chose.
 *
 * Absent — the engine not running yet, or between two outputs — the start
 * fails and the hook tries again on the next `devicechange`, which is the
 * monitor appearing.
 */
export const MONITOR_LABEL = 'FluidEQ Monitor';

const findMonitor = async (): Promise<string | undefined> => {
  const devices = await navigator.mediaDevices.enumerateDevices();
  return devices.find(
    (device) => device.kind === 'audioinput' && device.label === MONITOR_LABEL,
  )?.deviceId;
};

const captureLinuxOutput = async (t: Translate): Promise<MediaStream> => {
  const deviceId = await findMonitor();
  if (!deviceId) {
    throw new Error(t('eq.smart.error.noMonitor'));
  }
  // Chromium's voice processing off, as on Windows (`captureSystemOutput`
  // says why): this is a measurement of the output, not a call.
  return navigator.mediaDevices.getUserMedia({
    audio: {
      deviceId: { exact: deviceId },
      autoGainControl: false,
      echoCancellation: false,
      noiseSuppression: false,
    },
    video: false,
  });
};

export default captureLinuxOutput;

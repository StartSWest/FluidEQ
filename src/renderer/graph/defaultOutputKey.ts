/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { reportError } from '../utils/logger';

/**
 * Which output Chromium says Windows is playing through, as a comparable key.
 *
 * The loopback is bound to the default output at the moment it is granted and
 * stays bound to it after Windows moves on. Chromium learns of a new default
 * from Windows' own notification and says so with `devicechange`; the default
 * entry's group and label then name the new device. Read before a capture is
 * asked for and again at every `devicechange`, a different key is the capture
 * being on an output nobody is listening to any more — which is what the
 * output switch used to wait a fixed 450 ms for, guessing when Windows would
 * be done handing the endpoint over.
 *
 * Empty where the list cannot be read or has no default entry, which compares
 * equal to itself and so never asks for a rebind on its own.
 */
const readDefaultOutputKey = async (): Promise<string> => {
  if (!navigator.mediaDevices?.enumerateDevices) {
    return '';
  }
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const output = devices.find(
      (device) =>
        device.kind === 'audiooutput' && device.deviceId === 'default',
    );
    return output ? `${output.groupId}|${output.label}` : '';
  } catch (error) {
    // Not worth failing a capture over: an unreadable list leaves the output
    // change itself as the only thing that rebinds, as it always was.
    reportError('The output list could not be read for the capture', error);
    return '';
  }
};

export default readDefaultOutputKey;

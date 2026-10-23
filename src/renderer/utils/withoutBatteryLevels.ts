/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { IAudioDevice } from 'common/constants';

/**
 * The outputs as they stand, without a battery level among them.
 *
 * For a reading that failed: the list on screen is kept, because the outputs
 * have not gone anywhere, but a level is shown only from the reading that just
 * succeeded — an old number left up would be a guess passed off as a
 * measurement (Ivan, 2026-10-02: "if it fails to get it don't show the
 * battery percent because it will be fake"). The same list back when none
 * carries one, so nothing redraws for it.
 */
const withoutBatteryLevels = (devices: IAudioDevice[]): IAudioDevice[] =>
  devices.some((device) => typeof device.batteryPercent === 'number')
    ? devices.map(({ batteryPercent, ...device }) => device)
    : devices;

export default withoutBatteryLevels;

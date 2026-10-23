/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  capabilitiesFor,
  type IPlatformCapabilities,
} from 'common/platformCapabilities';

/**
 * This window's platform's engine, from the platform the preload reports.
 *
 * A window with no preload is a unit test rendering one panel, and every one
 * of those was written against Windows, so that is what it is taken as. The
 * app itself always has the preload's answer.
 */
const windowCapabilities = (): IPlatformCapabilities =>
  capabilitiesFor(window.electron?.platform ?? 'win32');

export default windowCapabilities;

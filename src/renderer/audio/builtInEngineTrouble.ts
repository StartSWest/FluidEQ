/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { IPlatformCapabilities } from 'common/platformCapabilities';
import type { TEngineTrouble } from './engineTrouble';

/**
 * A trouble card as it can be acted on where the engine ships inside the app
 * (macOS): what is not running, and nothing that cannot help.
 *
 * Every repair the card offers is Windows' — restarting its audio service,
 * installing the engine that sits beside the app, switching to Equalizer
 * APO — and none of them exists on a Mac. A card that listed the rack as not
 * running and then offered to restart Windows audio would fail at the press,
 * so there the card says what is off and is put away with "Got it".
 */
const builtInEngineTrouble = (
  trouble: TEngineTrouble | undefined,
  capabilities: IPlatformCapabilities,
): TEngineTrouble | undefined => {
  if (!capabilities.builtInEngine || trouble?.kind !== 'problems') {
    return trouble;
  }
  return {
    ...trouble,
    canRestartHelp: false,
    canApoHelp: false,
    canInstallHelp: false,
  };
};

export default builtInEngineTrouble;

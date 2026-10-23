/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * What this platform's audio engine is, so no panel has to guess.
 *
 * FluidEQ was written where Equalizer APO exists and the FluidEQ Engine is
 * installed into Windows' audio service. On macOS neither holds: there is no
 * APO, and the engine ships inside the app and runs from it
 * (`native/mac-engine`). The engine dialog, the engine's name above the EQ
 * and the install checks each ask one of the two questions below rather than
 * which OS this is, so a platform that declares its row here is understood by
 * all of them at once.
 *
 * Everything else about the engine is the same on both — the EQ and the DSP
 * rack on every app's sound, the statuses it writes, the version its
 * features are gated on — and is deliberately not a question here.
 */
export interface IPlatformCapabilities {
  /** Equalizer APO can be installed, and its own config files are read and written. */
  apoConfig: boolean;
  /**
   * The FluidEQ Engine ships inside the app and runs while it does: nothing
   * to install, nothing to attach, no system service to restart.
   */
  builtInEngine: boolean;
}

const NOTHING: IPlatformCapabilities = {
  apoConfig: false,
  builtInEngine: false,
};

const BY_PLATFORM: Partial<Record<NodeJS.Platform, IPlatformCapabilities>> = {
  win32: { apoConfig: true, builtInEngine: false },
  darwin: { apoConfig: false, builtInEngine: true },
  // No engine yet: neither question has a yes.
  linux: NOTHING,
};

/**
 * A fresh object every call.
 *
 * Handing out the shared record would let one panel's defensive `= false`
 * become every panel's answer, and the resulting bug reads as "the feature
 * disappeared after visiting that screen".
 */
export const capabilitiesFor = (
  platform: NodeJS.Platform,
): IPlatformCapabilities => ({ ...(BY_PLATFORM[platform] ?? NOTHING) });

/**
 * The FluidEQ Engine is the only engine here, and it is part of the app:
 * there is no engine to choose between and none to install. macOS today.
 */
export const isFluidEngineBuiltIn = (
  capabilities: IPlatformCapabilities,
): boolean => capabilities.builtInEngine;

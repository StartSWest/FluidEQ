/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Whether macOS lets the FluidEQ Engine hear what the Mac plays: its answer
 * under Screen & System Audio Recording, read by the engine itself
 * (`FluidEQ-Engine --audio-permission`). `unknown` is everything that is not a
 * yes or a no — not asked yet, no engine built, a platform with no such
 * question — and is never a reason to say anything to the listener.
 */
export type TMacAudioPermission = 'granted' | 'denied' | 'unknown';

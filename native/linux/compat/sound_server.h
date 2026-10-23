/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Which sound server this session runs.
 *
 * Answered by PipeWire's socket, never by its library: a PulseAudio desktop
 * often has libpipewire installed (screen sharing uses it) with no PipeWire
 * audio server behind it, and choosing PipeWire there opens nothing. Shared
 * by the engine and the DSP host so the two never pick differently.
 */
#ifndef FLUIDEQ_LINUX_SOUND_SERVER_H
#define FLUIDEQ_LINUX_SOUND_SERVER_H

namespace fluideq_linux {

/** PipeWire's socket for this user exists (PIPEWIRE_REMOTE honoured). */
bool pipewire_running();

}  // namespace fluideq_linux

#endif  // FLUIDEQ_LINUX_SOUND_SERVER_H

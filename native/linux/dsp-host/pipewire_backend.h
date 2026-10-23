/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The DSP host's Linux outputs: PipeWire where it runs, ALSA everywhere
 * else (a PulseAudio desktop routes ALSA's "default" to PulseAudio, so the
 * Library still plays through the listener's chosen output there).
 * `create_audio_backend` (backend_select.cpp) picks between them.
 */
#ifndef FLUIDEQ_LINUX_DSP_HOST_BACKENDS_H
#define FLUIDEQ_LINUX_DSP_HOST_BACKENDS_H

#include <memory>
#include <string>

#include "../../dsp-host/src/audio_backend.h"
#include "../pipewire/pw_api.h"

namespace fluideq_linux {

/** Null with `error` set when this machine has no PipeWire client library. */
std::unique_ptr<IAudioOutputBackend> make_pipewire_backend(
    const FeqBackendHooks& hooks, std::string& error);

/** Null with `error` set when this machine has no ALSA library. */
std::unique_ptr<IAudioOutputBackend> make_alsa_backend(
    const FeqBackendHooks& hooks, std::string& error);

}  // namespace fluideq_linux

#endif  // FLUIDEQ_LINUX_DSP_HOST_BACKENDS_H

/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * `create_audio_backend` for Linux: PipeWire when this session runs it,
 * ALSA otherwise, the unsupported stub only when neither library exists.
 */

#include <cstdio>
#include <string>

#include "../compat/sound_server.h"
#include "pipewire_backend.h"

/**
 * The shared stub (`dsp-host/src/platform/unsupported_backend.cpp`),
 * compiled on Linux with its factory renamed to this (linux/CMakeLists.txt),
 * so it stays the last resort without a line of it changing.
 */
std::unique_ptr<IAudioOutputBackend> create_unsupported_audio_backend(
    const FeqBackendHooks& hooks);

std::unique_ptr<IAudioOutputBackend> create_audio_backend(
    const FeqBackendHooks& hooks) {
  std::string pipewire_why = "PipeWire is not running for this user";
  if (fluideq_linux::pipewire_running()) {
    if (auto backend = fluideq_linux::make_pipewire_backend(hooks, pipewire_why)) {
      return backend;
    }
  }
  std::string alsa_why;
  if (auto backend = fluideq_linux::make_alsa_backend(hooks, alsa_why)) {
    return backend;
  }
  std::fprintf(stderr, "FluidEQ-DSP: no audio output: %s; %s\n",
               pipewire_why.c_str(), alsa_why.c_str());
  return create_unsupported_audio_backend(hooks);
}

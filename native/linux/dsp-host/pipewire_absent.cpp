/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * `make_pipewire_backend` for a build made without PipeWire's headers: the
 * host then plays through ALSA alone, which a PipeWire desktop also accepts
 * (pipewire-alsa), at the cost of a second buffer in the path.
 */

#include "pipewire_backend.h"

namespace fluideq_linux {

std::unique_ptr<IAudioOutputBackend> make_pipewire_backend(
    const FeqBackendHooks& hooks, std::string& error) {
  (void)hooks;
  error = "this build of FluidEQ has no PipeWire support";
  return nullptr;
}

}  // namespace fluideq_linux

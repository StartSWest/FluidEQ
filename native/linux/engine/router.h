/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The engine's place in the sound server, whichever server the desktop runs:
 * a "FluidEQ" output every application plays into, the engine over what
 * arrives there, and the result on the real output the listener chose
 * (`pw_router.h` for PipeWire, `pulse_router.h` for PulseAudio).
 */
#ifndef FLUIDEQ_LINUX_ROUTER_H
#define FLUIDEQ_LINUX_ROUTER_H

#include <string>

namespace fluideq_linux {

/**
 * Share Audio's two endpoints of the engine's own: the sink the window plays
 * other computers' sound into, and the input it sends this computer's from
 * (`pw_share.cpp`, `pulse_share.cpp`). Neither is ever an output to choose.
 */
inline constexpr const char* kShareSinkName = "fluideq_share";
inline constexpr const char* kShareSinkDescription = "FluidEQ Share In";
inline constexpr const char* kSendSourceDescription = "FluidEQ Send";

struct RouterOptions {
  /** A real output's name to play to, always; empty follows the default. */
  std::string target;
  /** Make "FluidEQ" the default output while running (and give it back on exit). */
  bool take_default = true;
  /** The sink's name in the sound server: one per user session. */
  std::string sink_name = "fluideq_sink";
  std::string sink_description = "FluidEQ";
};

class SoundRouter {
 public:
  virtual ~SoundRouter() = default;

  /**
   * Gives the default output back, closes the streams and retires the
   * engine, waiting for the server to have the default first. Idempotent.
   */
  virtual void shutdown() noexcept = 0;

  /** Readable once the connection to the server is gone. */
  virtual int lost_fd() const noexcept = 0;

  /**
   * Play to the output named `name` (PipeWire's `node.name`, PulseAudio's
   * sink name). Done as the desktop does it — the output becomes the
   * configured default, the router follows it there and makes "FluidEQ"
   * the default again — so a pick in FluidEQ and one in the system's sound
   * settings are the same event. Any thread; ignored under `--target`.
   */
  virtual void select_output(const std::string& name) noexcept = 0;
};

}  // namespace fluideq_linux

#endif  // FLUIDEQ_LINUX_ROUTER_H

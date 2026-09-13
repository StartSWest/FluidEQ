/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#pragma once

#include <memory>

#include "event_sink.h"

namespace fluideq_lighting {

// The Razer devices plugged into this machine, by name.
//
// Razer Synapse's local service lights devices by kind — "the keyboard", "the
// headset" — and never says which ones exist. The page still has to say
// "Razer Basilisk V3", so the names come from Windows: every Razer USB device
// shows up as HID interfaces under vendor 0x1532, and each interface belongs to
// a device container whose name is the product's. One event per container,
// however many interfaces it has.
class RazerDevices final {
 public:
  explicit RazerDevices(EventSink& sink);
  ~RazerDevices();

  RazerDevices(const RazerDevices&) = delete;
  RazerDevices& operator=(const RazerDevices&) = delete;

  void start();
  void stop();

 private:
  struct State;
  std::shared_ptr<State> state_;
};

}  // namespace fluideq_lighting

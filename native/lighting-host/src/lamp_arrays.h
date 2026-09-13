/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#pragma once

#include <memory>

#include "event_sink.h"
#include "wire.h"

namespace fluideq_lighting {

// Every Windows Dynamic Lighting device on the machine, as it comes and goes,
// and the colours the app sends each one.
//
// Reported, never decided: the helper says what Windows describes — the name,
// the kind, where each lamp sits in metres — and the main process decides
// what to light and how. Windows' own rules (the app in front gets the lamps;
// a background app only with Settings' permission) are reported the same
// way, as `available` flipping, never worked around.
class LampArrays final {
 public:
  explicit LampArrays(EventSink& sink);
  ~LampArrays();

  LampArrays(const LampArrays&) = delete;
  LampArrays& operator=(const LampArrays&) = delete;

  void start();
  void stop();
  void set_colours(const ColoursFrame& frame);

 private:
  struct State;
  std::shared_ptr<State> state_;
};

}  // namespace fluideq_lighting

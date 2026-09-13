/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#pragma once

#include <memory>

#include "event_sink.h"

namespace fluideq_lighting {

// What the member chose in Settings > Personalization > Dynamic Lighting, as
// Windows keeps it under HKCU\Software\Microsoft\Lighting: whether Dynamic
// Lighting is on, whether an app in front always wins, and the Background
// light control order — once for all devices and once per device (per USB
// port), by package family name ("WindowsLighting" is Windows' own
// controller).
//
// Read, never written. Windows decides who lights a device; this only lets
// the page say which of the member's settings stands between FluidEQ and the
// lamps, instead of "Windows is holding them". Undocumented by Microsoft but
// what the Settings page writes on Windows 11 23H2 through 25H2.
//
// One `lighting-settings` line when started and one more whenever the member
// changes anything there, woken by RegNotifyChangeKeyValue — never polled.
class LightingSettings final {
 public:
  explicit LightingSettings(EventSink& sink);
  ~LightingSettings();

  LightingSettings(const LightingSettings&) = delete;
  LightingSettings& operator=(const LightingSettings&) = delete;

  void start();
  void stop();

 private:
  struct State;
  std::shared_ptr<State> state_;
};

}  // namespace fluideq_lighting

/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#pragma once

#ifndef NOMINMAX
#define NOMINMAX
#endif
#ifndef WIN32_LEAN_AND_MEAN
#define WIN32_LEAN_AND_MEAN
#endif
#include <Windows.h>

#include <array>
#include <functional>

#include "fluideq/scene/lamp_ear.h"

namespace feq::scene {

/** What the one hearing the output is told and asked. */
struct EarHooks {
  /** Its settings brought up to date, just before a block is heard. */
  std::function<void(LampEar& ear)> tune;
  /** A frame heard, on the ear's own thread. */
  std::function<void(const HeardLampFrame& frame)> heard;
};

inline constexpr int kEarStopped = 0;
inline constexpr int kEarFailed = 1;

/**
 * The default output heard, as the window hears it, until `stop` or `parent`
 * is signalled: opened again whenever Windows moves the default or the one
 * heard goes, and while none can be opened, tried again on each change
 * Windows reports — never on a clock. Where the output cannot be heard at all
 * its own silence is the clock. Runs on the calling thread, as Windows'
 * "Audio" task; `kEarStopped`, or `kEarFailed` when it could not start.
 */
int hear_default_output(HANDLE stop, HANDLE parent,
                        const std::array<double, 3>& accent, EarHooks hooks);

}  // namespace feq::scene

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

#include <string>

namespace feq::scene {

/**
 * `FluidEQ-Scenes --mode desktop`: the desktop backgrounds, drawn by C++
 * instead of a hidden Electron page per monitor (`wallpaper/surface.ts`).
 * Main opens a monitor, is told its window, has the desktop helper place it
 * behind the icons, and then shows, tunes, pauses and closes it; every
 * monitor draws what the one ear hears. Ends when main's input does or
 * `parent` goes: 0, or 1 when the output could not be heard at all, or 4 when
 * main's messages stopped making sense.
 */
int run_desktop(const std::wstring& angle_dir, HANDLE parent);

}  // namespace feq::scene

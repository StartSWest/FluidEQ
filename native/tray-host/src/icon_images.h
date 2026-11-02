/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#pragma once

/**
 * The tray's pictures at the size each display scale asks for, picked out of
 * the .ico's own drawings rather than one picture resampled (`tray.ts`: "the
 * difference between a crisp mark and a resampled smudge"): the notification
 * icon, and a menu item's mark as the 32-bit premultiplied bitmap a menu
 * draws with its alpha.
 */

#ifndef NOMINMAX
#define NOMINMAX
#endif
#ifndef WIN32_LEAN_AND_MEAN
#define WIN32_LEAN_AND_MEAN
#endif
#include <windows.h>

#include <string>

namespace feq::tray {

/** The .ico in `path` at `size` pixels square; null when unreadable. */
HICON load_icon(const std::wstring& path, int size);

/** A menu's mark from an .ico; null when unreadable. COM must be initialised
 * on the calling thread. */
HBITMAP load_menu_bitmap(const std::wstring& path, int size);

}  // namespace feq::tray

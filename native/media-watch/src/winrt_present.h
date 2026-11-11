/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#pragma once

#include <winrt/base.h>

namespace fluideq_media {

/**
 * A WinRT answer that has to be there, or the failure every caller already
 * handles.
 *
 * Windows can answer a call with success and no object. A session whose
 * player is closing hands back no playback info, between the player going
 * and the manager's SessionsChanged that says so, and C++/WinRT calls the
 * next method on the empty answer regardless: a read through address zero,
 * an access violation that no `catch` sees. That is how the media helper
 * died in a 2.4.0 report after 51 minutes (exit code 0xC0000005), and how
 * sessions starting, changing and closing under it killed it within a
 * minute here — at the playback status read in `report` (main.cpp). Every
 * object answer the helper reads further goes through this.
 */
template <typename T>
T present(T answer) {
  if (!answer) {
    throw winrt::hresult_error(E_POINTER, L"Windows answered with nothing");
  }
  return answer;
}

}  // namespace fluideq_media

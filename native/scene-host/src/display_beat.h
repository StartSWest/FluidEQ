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

struct IDXGIOutput;

/*
 * The beat a desktop scene is drawn on: its monitor's own vertical blank,
 * as the page's frames arrived on the display's. A monitor loop waits for
 * it once per turn and draws on the turns its pace says are due
 * (`frame_pacing.h`), so a frame never waits in a queue behind others and a
 * pace of thirty on a 144 Hz monitor is the page's 29, not a guess.
 */

namespace feq::scene {

class DisplayBeat {
 public:
  DisplayBeat() = default;
  ~DisplayBeat();
  DisplayBeat(const DisplayBeat&) = delete;
  DisplayBeat& operator=(const DisplayBeat&) = delete;

  /**
   * The monitor `window` stands on, found again after a display change.
   * Without it the composition's own beat is waited on instead.
   */
  void follow(HWND window);
  /**
   * Waits for the next vertical blank. False when there is none to wait for
   * — the display gone from under it — and the caller waits for Windows to
   * say something changed rather than turning again at once.
   */
  bool wait();

 private:
  void release();
  IDXGIOutput* output_ = nullptr;
};

}  // namespace feq::scene

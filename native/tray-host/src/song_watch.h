/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#pragma once

#include <memory>

#include "fluideq/io/loop.h"
#include "tray_model.h"

/*
 * The FluidEQ Engine told which song is playing while Electron is gone:
 * main's media job (`songProgramme.ts`) carried on by the tray from the
 * handover main leaves with. Windows' media sessions are read by the same
 * `FluidEQ-Media.exe` main runs, the engine's statuses are re-read whenever
 * Windows says its folder changed, and the output Windows plays through is
 * followed by Windows' own notification — nothing polls, nothing waits on a
 * clock. What it writes and remembers is `SongTeller`'s and
 * `SongLevelStore`'s, held to main's code. Started when main has left with
 * a handover; stopped the moment a FluidEQ connects again, which takes the
 * job back.
 */

namespace feq::tray {

class SongWatch {
 public:
  /** The job running on `loop`; null when the media helper cannot start. */
  static std::shared_ptr<SongWatch> start(io::Loop& loop,
                                          SongsHandover handover);
  virtual ~SongWatch() = default;
  /** Everything it started, let go; safe to call twice. */
  virtual void stop() = 0;
};

}  // namespace feq::tray

/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * What the engine tells the app about the output it plays to.
 *
 * `status-{GUID}.json` in the engine's root, beside its configuration folder
 * — the Windows effect's own file (`status_file.h`), printed by the same
 * `status_json`, about the output by the `{GUID}` the app knows it by
 * (`endpoint_guid`). The app reads a Mac exactly as it reads Windows: the
 * delay the DSP page lists stage by stage, the room's chip, Game mode, and
 * the song live leveling finished, which the app remembers so the next play
 * of it is levelled from its first second.
 *
 * Only the text is shared. Writing it is this file's: the effect's writer
 * asks Windows for its folders and counts the effect instances an output
 * has, and a Mac has one engine process following one output.
 */
#ifndef FLUIDEQ_MAC_ENGINE_STATUS_REPORT_H
#define FLUIDEQ_MAC_ENGINE_STATUS_REPORT_H

#include <string>
#include <utility>
#include <vector>

#include "status_file.h"

namespace fluideq_engine {
class Graph;
}

namespace fluideq_mac {

/**
 * The stages that delay the sound, by the app's names, in the order the sound
 * meets them — only those adding something, or running at all.
 *
 * The Windows effect's `latency_parts_of` (`watcher.cpp`), which lives in a
 * file of the effect's own; a stage added there has to be added here too, or
 * the DSP page on a Mac leaves it out of the list (the total stays right: it
 * is the graph's own `latency_frames`).
 */
std::vector<std::pair<std::string, unsigned>> latency_parts_of(
    const fluideq_engine::Graph& graph);

class StatusFiles {
 public:
  /** `root` is the folder the app reads statuses from. */
  explicit StatusFiles(std::string root);

  /**
   * `status`, whole: written aside and renamed into place, so the app never
   * reads half of one. False, with the step and the reason in `why`, when it
   * could not be.
   */
  bool write(const fluideq_engine::EngineStatus& status,
             std::string& why) const;

 private:
  std::string root_;
};

}  // namespace fluideq_mac

#endif  // FLUIDEQ_MAC_ENGINE_STATUS_REPORT_H

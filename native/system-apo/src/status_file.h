/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * What the engine is doing on one output, told to the app.
 *
 * The engine used to say nothing to anybody but its own log, so an engine
 * that never loaded, a convolution file it could not read and an EQ that was
 * working all looked the same from the app: nothing on screen. This is the
 * other direction of the owner pipe — a small file per output,
 * `<engine root>\status-{GUID}.json`, rewritten whole whenever the engine
 * locks for that output, changes what it runs there, or lets it go. The app
 * reads it (`src/main/engineHealth.ts`) and says so when something is wrong.
 *
 * A file rather than a message down the pipe: the pipe is served by the app
 * with Node's default security, which gives everybody else read access only,
 * and the engine runs as LOCAL SERVICE.
 */
#ifndef FLUIDEQ_ENGINE_STATUS_FILE_H
#define FLUIDEQ_ENGINE_STATUS_FILE_H

#include <string>
#include <vector>

namespace fluideq_engine {

struct EngineStatus {
  /** `{GUID}`, as the watcher's endpoint has it. No file without one. */
  std::wstring endpoint;
  /** Windows has this output's audio going through the engine right now. */
  bool locked = false;
  /** And the engine is changing it, rather than passing it through. */
  bool processing = false;
  /** Why it is passing it through, when it is; empty when processing. */
  std::string reason;
  /**
   * What was asked for and is not happening, as `Graph::problems` codes
   * plus the watcher's own: "reload-failed", "unwatched".
   */
  std::vector<std::string> problems;
};

/**
 * The file's contents. Pure, so a test can hold it to the shape the app
 * parses; `at` is an ISO-8601 UTC time.
 */
std::string status_json(const EngineStatus& status, unsigned long pid,
                        const std::string& at);

/**
 * Writes `status_json` for this process, now, replacing any previous file
 * whole — written aside and renamed into place, so the app never reads half
 * of one. False when it could not; never throws.
 */
bool write_status(const EngineStatus& status) noexcept;

/**
 * One engine instance's say in its output's status file.
 *
 * Windows can run one output through several instances of the engine in the
 * same audiodg.exe — one per signal-processing mode — and they all share the
 * output's one file. Letting each of them write "not locked" as it stopped
 * told the app the engine had let go of an output another instance was
 * still playing through, and the app would then have called a working engine
 * broken. So the instances running each output are counted, process-wide,
 * and only the last one out says the output is let go.
 */
class StatusShare {
 public:
  StatusShare() = default;
  StatusShare(const StatusShare&) = delete;
  StatusShare& operator=(const StatusShare&) = delete;
  /** Leaves, if `leave` was never called. */
  ~StatusShare();

  /**
   * Writes `status`, which must be a locked one, and counts this instance
   * among the output's the first time. False when the file could not be
   * written — the instance is counted in all the same, because it is running
   * the output whether or not the app has been told.
   */
  bool publish(const EngineStatus& status) noexcept;

  /**
   * Counts this instance out. The last one out on its output writes "not
   * locked"; the others write nothing. False only when that write failed.
   */
  bool leave() noexcept;

 private:
  // The output this instance is counted on; empty while it is not.
  std::wstring endpoint_;
};

}  // namespace fluideq_engine

#endif  // FLUIDEQ_ENGINE_STATUS_FILE_H

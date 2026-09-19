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

#include <atomic>
#include <memory>
#include <optional>
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
  /**
   * Some instance on this output has actually had the stream's audio in its
   * hands since Windows built this output's chain.
   *
   * `locked` and `processing` are both about what the engine was asked to do
   * and both were true on a machine where the EQ did nothing at all: Windows
   * created the engine in one of the output's effect slots, and the music
   * went through a chain that slot is not part of. From the app that is
   * indistinguishable from a working engine — which is how a user sat with
   * an output whose every reading said healthy and whose sound was
   * untouched. This is the one fact that tells them apart, and it is worth a
   * field of its own because no wording of `reason` could: the engine has no
   * way of knowing it is being passed over, only that no audio has reached
   * it. Counted for the output rather than the instance, because Windows
   * runs one instance per signal-processing mode and only one of them
   * carries what is playing.
   */
  bool carried = false;
  /**
   * The engine sees FluidEQ running (`owner_link.h`). False is its own reason
   * to pass the output through, and the one the app must tell apart from an
   * EQ that simply asks for nothing: while FluidEQ is open it means the line
   * between the two is down. A field rather than `reason`'s wording, which is
   * a sentence for people and free to change.
   */
  bool owner = true;
  /** Why it is passing it through, when it is; empty when processing. */
  std::string reason;
  /**
   * What was asked for and is not happening, as `Graph::problems` codes
   * plus the watcher's own: "reload-failed", "unwatched".
   */
  std::vector<std::string> problems;
  /** How many channels the stream Windows locked has. */
  unsigned channels = 0;
  /**
   * What the room does with them: `off`, `no-head` (asked for, no head
   * file), `front-stage` (two channels), `5.1`, `7.1`, or `on` for another
   * width. The card's chip reads this.
   */
  std::string room = "off";
  /**
   * The delay this output's audio has — what the DSP page shows a listener
   * as their lag — as the frames it adds, the rate those are frames of, and
   * the stages it comes from, by the app's names (`curves`, `guard`,
   * `eqPhase`, `curvePhase`, `convolution`, `linearEq`, `restoration`,
   * `leveler`, `room`, `bassPunch`, `maximizer`, `headroom`, `safety`).
   * A stage that adds nothing is left out. Measured, not estimated: every
   * part is what that stage holds the audio back by, and the total is the
   * number `GetLatency` hands Windows.
   */
  unsigned rate = 0;
  unsigned latency = 0;
  std::vector<std::pair<std::string, unsigned>> latency_parts;
  std::vector<std::string> latency_active;
  /** Game mode: the Gaming preset on the rack, or the Games voicing. */
  bool game_mode = false;
  /**
   * The last named song live leveling finished on this output: sixteen hex
   * digits of the app's own hash, the loudest settled level and peak it
   * heard, and how many seconds of music that was learned from. A string id
   * because a JSON number cannot carry 64 bits into JavaScript intact. The app
   * remembers the level, so the song is levelled from its first second the
   * next time it plays.
   */
  struct FinishedSong {
    std::string id;
    double level_lufs = -120;
    double peak_db = -120;
    double seconds = 0;
  };
  std::optional<FinishedSong> last_song;
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
 * of one. False when it could not, with which step and Windows' error code
 * in `why` when one is given; never throws.
 *
 * The rename is made with POSIX semantics where Windows offers them (1607
 * and later): the app reads this file at the same moments the engine writes
 * it — its first read at launch landed on the engine's first write — and an
 * ordinary `MoveFileEx` over a file somebody holds open fails, which left
 * the app a status from an earlier stream and had it restart Windows audio
 * to mend an engine that was running.
 */
bool write_status(const EngineStatus& status,
                  std::string* why = nullptr) noexcept;

/**
 * The flag that says audio has reached the engine on this output, shared by
 * every instance running it in this process — see `EngineStatus::carried`.
 *
 * Handed out on the control thread, which may allocate; the audio thread
 * only ever stores `true` through the pointer it was given at lock time. It
 * goes back to false when the last instance on the output lets go, so it
 * always means "since Windows built the chain this instance is in" rather
 * than "ever", which would hide a chain that stopped carrying anything.
 */
std::shared_ptr<std::atomic<bool>> output_carried_flag(
    const std::wstring& endpoint);

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
   * the output whether or not the app has been told. `why` as `write_status`.
   */
  bool publish(const EngineStatus& status,
               std::string* why = nullptr) noexcept;

  /**
   * Counts this instance out. The last one out on its output writes "not
   * locked"; the others write nothing. False only when that write failed,
   * `why` as `write_status`.
   */
  bool leave(std::string* why = nullptr) noexcept;

 private:
  // The output this instance is counted on; empty while it is not.
  std::wstring endpoint_;
};

}  // namespace fluideq_engine

#endif  // FLUIDEQ_ENGINE_STATUS_FILE_H

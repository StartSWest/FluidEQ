/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#include "watcher.h"

#include <process.h>

#include <algorithm>
#include <exception>
#include <memory>
#include <string>
#include <string_view>
#include <vector>

#include "chain_signature.h"
#include "config_file.h"
#include "paths.h"

namespace fluideq_engine {

namespace {

// Blocks the audio thread must complete after a publish before the graphs
// older than it can be destroyed.
//
// Two, not one. The block in flight when the new graph was stored may already
// have read the previous `pending` and be about to run the old graph; only
// the block after that one is guaranteed to have started after the store was
// visible. Counting completed blocks, `blocks >= at + 2` means both of them
// are finished and every block from here on runs the new graph or a later
// one.
constexpr uint64_t kGraceBlocks = 2;

/**
 * The change-notification handle, closed on every way out of `run()`.
 *
 * `run()` builds log strings and can therefore throw, and the thread
 * procedure above it swallows what escapes. A handle leaked on that path
 * would hold a directory open for as long as audiodg.exe lives, on a machine
 * that has already run out of memory once.
 */
class ChangeNotification {
 public:
  explicit ChangeNotification(HANDLE handle) noexcept : handle_(handle) {}
  ~ChangeNotification() { close(); }

  ChangeNotification(const ChangeNotification&) = delete;
  ChangeNotification& operator=(const ChangeNotification&) = delete;

  bool valid() const noexcept {
    return handle_ != nullptr && handle_ != INVALID_HANDLE_VALUE;
  }
  HANDLE get() const noexcept { return handle_; }

  void close() noexcept {
    if (valid()) {
      FindCloseChangeNotification(handle_);
    }
    handle_ = INVALID_HANDLE_VALUE;
  }

 private:
  HANDLE handle_;
};

/**
 * The link's own lines, under no endpoint: it belongs to the process, not to
 * any one of the outputs whose watchers share it.
 */
void log_owner(std::string_view message) noexcept {
  trace(no_endpoint(), message);
}

}  // namespace

// ---------------------------------------------------------------------------

Watcher::Watcher(GraphSlot& slot, Log& log, Endpoint endpoint,
                 std::wstring config_dir, uint32_t sample_rate,
                 uint32_t channels, uint32_t max_frames)
    : slot_(slot),
      log_(log),
      endpoint_(std::move(endpoint)),
      config_dir_(std::move(config_dir)),
      sample_rate_(sample_rate),
      channels_(channels),
      max_frames_(max_frames) {}

Watcher::~Watcher() { stop(); }

void Watcher::load_initial() {
  // A separate display connection cannot affect the engine's owner signal.
  try {
    analysis_ = std::make_unique<AnalysisLink>(endpoint_.guid, sample_rate_, channels_);
  } catch (...) {
    log_.write("DSP displays unavailable; audio processing continues");
  }
  try {
    leveling_ = leveling_for(endpoint_.guid);
  } catch (...) {
    log_.write("song leveling memory unavailable; leveling relearns per stream");
  }
  if (endpoint_.guid.empty()) {
    // Windows handed this instance no device collection, so there is no way
    // to tell which `Device:` blocks apply. Everything unguarded still does.
    log_.write("no endpoint identified; only unguarded configuration applies");
  }
  if (!is_directory(config_dir_)) {
    log_.write("configuration directory " + to_utf8(config_dir_) +
               " is not present; waiting for it");
  }
  // Before the first reload, so the first graph already knows whether
  // FluidEQ is there — `acquire` has tried the pipe by the time it returns.
  owner_ = OwnerLink::acquire(owner_pipe_name(), &log_owner);
  if (owner_ == nullptr) {
    log_.write("cannot tell whether FluidEQ is running; the configuration "
               "applies whether it is or not");
  }
  reload(Carry::State);
}

bool Watcher::owner_present() const noexcept {
  return owner_ == nullptr || owner_->present();
}

bool Watcher::start() {
  stop_event_ = CreateEventW(nullptr, TRUE, FALSE, nullptr);
  if (stop_event_ == nullptr) {
    log_.write("could not create the stop event; configuration changes will "
               "not be picked up");
    return false;
  }
  reset_event_ = CreateEventW(nullptr, FALSE, FALSE, nullptr);
  if (reset_event_ == nullptr) {
    CloseHandle(stop_event_);
    stop_event_ = nullptr;
    log_.write("could not create the reset event; the effect would keep its "
               "filter state across a pipeline flush");
    return false;
  }
  if (owner_ != nullptr) {
    owner_event_ = CreateEventW(nullptr, FALSE, FALSE, nullptr);
    try {
      if (owner_event_ != nullptr) {
        owner_->subscribe(owner_event_);
      }
    } catch (...) {
      CloseHandle(owner_event_);
      owner_event_ = nullptr;
    }
    if (owner_event_ == nullptr) {
      // FluidEQ coming or going is then only noticed at the next change in
      // the configuration directory, which a starting app always makes.
      log_.write("could not subscribe to FluidEQ coming and going");
    }
  }
  unsigned id = 0;
  // `_beginthreadex` rather than `CreateThread`: this thread runs the C++
  // runtime — strings, vectors, the resolver — and the CRT wants to know
  // about a thread before that thread uses it.
  const uintptr_t handle =
      _beginthreadex(nullptr, 0, &Watcher::thread_entry, this, 0, &id);
  if (handle == 0) {
    CloseHandle(stop_event_);
    stop_event_ = nullptr;
    CloseHandle(reset_event_);
    reset_event_ = nullptr;
    if (owner_event_ != nullptr) {
      owner_->unsubscribe(owner_event_);
      CloseHandle(owner_event_);
      owner_event_ = nullptr;
    }
    log_.write("could not start the configuration watcher; changes will not "
               "be picked up");
    return false;
  }
  thread_ = reinterpret_cast<HANDLE>(handle);
  // Below normal inside audiodg.exe, whose audio threads run far above it:
  // designing a 4097-tap FIR must never be scheduled against the callback
  // that has 10 ms to fill a buffer.
  SetThreadPriority(thread_, THREAD_PRIORITY_BELOW_NORMAL);
  return true;
}

void Watcher::stop() noexcept {
  if (thread_ != nullptr) {
    SetEvent(stop_event_);
    WaitForSingleObject(thread_, INFINITE);
    CloseHandle(thread_);
    thread_ = nullptr;
  }
  if (stop_event_ != nullptr) {
    CloseHandle(stop_event_);
    stop_event_ = nullptr;
  }
  // After the join for the same reason the stop event is: the thread waits on
  // it, and closing a handle a wait is standing on is undefined.
  if (reset_event_ != nullptr) {
    CloseHandle(reset_event_);
    reset_event_ = nullptr;
  }
  // Unsubscribed before it is closed: the link may be setting it from its own
  // thread right up until `unsubscribe` returns.
  if (owner_event_ != nullptr) {
    owner_->unsubscribe(owner_event_);
    CloseHandle(owner_event_);
    owner_event_ = nullptr;
  }
  // The last watcher to let go ends the link's thread and its connection.
  owner_.reset();
  // Windows has let this output go: say so, or the app goes on reading a
  // "locked" left by an engine that is no longer running it.
  report_status(false);
  // Only now: until the thread has joined it is still the owner of these.
  slot_.clear();
  for (const Retired& retired : owned_) {
    delete retired.graph;
  }
  owned_.clear();
  analysis_.reset();
}

unsigned __stdcall Watcher::thread_entry(void* self) {
  // Nothing may leave this thread. It runs inside audiodg.exe, and an
  // exception escaping a thread procedure there is a terminate() that takes
  // every output on the machine down with it — building a path string when
  // the process is out of memory is enough to reach here.
  try {
    static_cast<Watcher*>(self)->run();
  } catch (...) {
    // The endpoint keeps whatever graph was last published; it simply stops
    // following further changes.
  }
  return 0;
}

void Watcher::run() {
  // FILE_NAME covers a create, a rename and a delete; LAST_WRITE and SIZE
  // cover external editors rewriting in place. The app publishes complete
  // profiles by rename, so FILE_NAME is required even for an existing file.
  constexpr DWORD kFilter = FILE_NOTIFY_CHANGE_LAST_WRITE |
                            FILE_NOTIFY_CHANGE_SIZE |
                            FILE_NOTIFY_CHANGE_FILE_NAME;

  for (;;) {
    // The configuration directory may not exist yet — the engine can be
    // attached before the app has ever written a profile. Waiting on the
    // deepest ancestor that does exist turns "not there yet" into an event
    // instead of a retry loop.
    const std::wstring watched = deepest_existing(config_dir_);
    if (watched.empty()) {
      break;
    }
    const ChangeNotification change(
        FindFirstChangeNotificationW(watched.c_str(), TRUE, kFilter));
    if (!change.valid()) {
      log_.write("cannot watch " + to_utf8(watched) +
                 "; configuration changes will not be picked up");
      unwatched_ = true;
      report_status(true);
      break;
    }
    const bool watching_config = watched == config_dir_;
    if (watching_config) {
      // A write that landed between the last resolve and this notification
      // being armed would otherwise never be seen.
      reload(Carry::State);
    }

    bool rearm = false;
    // The link's event last, and only when there is one: a null handle in the
    // array fails the whole wait.
    HANDLE handles[4] = {stop_event_, reset_event_, change.get(),
                         owner_event_};
    const DWORD count = owner_event_ != nullptr ? 4 : 3;
    while (!rearm) {
      const DWORD woke =
          WaitForMultipleObjects(count, handles, FALSE, INFINITE);
      if (woke == WAIT_OBJECT_0) {
        return;
      }
      if (woke == WAIT_OBJECT_0 + 1) {
        // `Reset` asked for it. A fresh graph whatever the configuration says,
        // and no state carried into it — see `request_reset`.
        reload(Carry::Nothing);
        continue;
      }
      if (count == 4 && woke == WAIT_OBJECT_0 + 3) {
        // FluidEQ came or went. The reload reads which, and either builds the
        // configuration's graph or a pass-through one.
        reload(Carry::State);
        continue;
      }
      if (woke != WAIT_OBJECT_0 + 2) {
        rearm = true;  // The handle went bad; rebuild the watch.
        break;
      }
      // A starting app writes into this directory before anything else, so a
      // change here is the moment a missing pipe may have become a present
      // one. Asked before the reload rather than after: the link connects on
      // its own thread and wakes this one again when it has.
      if (owner_ != nullptr) {
        owner_->retry();
      }
      if (watching_config) {
        reload(Carry::State);
      } else if (is_directory(config_dir_)) {
        rearm = true;  // It exists now: watch it directly instead.
        break;
      }
      if (FindNextChangeNotification(change.get()) == 0) {
        rearm = true;  // Usually the watched directory itself was removed.
      }
    }
  }

  // Nothing left to watch. Waiting here is not a poll and costs nothing; the
  // alternative — returning — would leave `stop()` joining a thread that had
  // already gone, which is fine, but this keeps the audio running with
  // whatever graph was last published rather than silently abandoning the
  // endpoint's ability to be reconfigured without a restart.
  //
  // The reset event is waited on as well: a pipeline flush must still clear
  // the filter state on an endpoint whose configuration directory has gone.
  HANDLE idle_handles[2] = {stop_event_, reset_event_};
  for (;;) {
    const DWORD woke =
        WaitForMultipleObjects(2, idle_handles, FALSE, INFINITE);
    if (woke != WAIT_OBJECT_0 + 1) {
      return;  // Stop, or a wait that cannot be repeated.
    }
    reload(Carry::Nothing);
  }
}

bool Watcher::stop_requested() const noexcept {
  // Before `start()` there is no event and nothing has asked to stop:
  // `load_initial` runs this same path on the caller's thread.
  return stop_event_ != nullptr &&
         WaitForSingleObject(stop_event_, 0) == WAIT_OBJECT_0;
}

void Watcher::request_reset() noexcept {
  // Null before `start()` and after `stop()`. Both are states in which there
  // is nothing to reset: no thread is running and no graph is on the audio
  // thread. `LockForProcess`/`UnlockForProcess` and `Reset` all arrive on the
  // audio engine's non-real-time thread, so this handle cannot be closed
  // underneath the call.
  if (reset_event_ != nullptr) {
    SetEvent(reset_event_);
  }
}

void Watcher::reload(Carry carry) {
  if (analysis_) analysis_->retry();
  try {
    const FileProvider provider = [](const std::wstring& path) {
      return read_config_file(path);
    };
    // With FluidEQ gone, nothing is read at all: the graph is built from an
    // empty chain, which is pass-through, rack included.
    const bool owner = owner_present();
    const Chain chain =
        owner ? resolve_chain(config_dir_, endpoint_, provider) : Chain{};
    // `UnlockForProcess` waits for this thread with no timeout, so every
    // phase that takes real time is followed by a chance to abandon: the
    // resolve above reads a directory of files, the construction below
    // designs a FIR and allocates a convolver per channel.
    if (stop_requested()) {
      return;
    }

    // FluidEQ's presence is part of what was loaded: the same files with and
    // without it build different graphs.
    std::string next = signature_of(chain) + (owner ? "|o=1" : "|o=0");
    // Before the comparison and outside the signature: a new song is a
    // change worth reading on every wake, and never one worth a new chain.
    const bool finished_song = owner && follow_programme();
    // A reset rebuilds even when the configuration is byte-for-byte what it
    // already was: the whole point of the rebuild is the state, not the
    // chain.
    if (carry == Carry::State && have_signature_ && next == signature_) {
      if (finished_song) {
        report_status(true);
      }
      return;
    }

    auto graph = std::make_unique<Graph>(
        chain, sample_rate_, channels_, max_frames_,
        leveling_ ? leveling_->memory() : nullptr);
    if (stop_requested()) {
      // The half-built graph dies with the `unique_ptr`, having never been
      // reachable from the slot. Recording the signature is left undone with
      // it, so an abandoned rebuild cannot be mistaken for a loaded one.
      return;
    }
    if (carry == Carry::State) {
      graph->request_state_transfer();
    }
    // Said once, as the graph that did it is replaced: a count that only
    // ever lived on the audio thread, where nothing may write a log line.
    if (const Graph* previous = slot_.active()) {
      const uint32_t silenced = previous->silenced_blocks();
      if (silenced > 0) {
        log_.write("silenced " + std::to_string(silenced) +
                   " block(s) whose samples were not all real numbers");
      }
    }
    log_chain(chain, *graph, owner);
    const bool processing = !graph->is_passthrough();
    std::vector<std::string> problems = graph->problems();
    publish(std::move(graph));
    signature_.swap(next);
    have_signature_ = true;
    last_processing_ = processing;
    last_owner_ = owner;
    graph_problems_.swap(problems);
    reload_failed_ = false;
    report_status(true);
  } catch (const std::exception& error) {
    log_.write(std::string("configuration reload failed: ") + error.what());
    reload_failed_ = true;
    report_status(true);
  } catch (...) {
    log_.write("configuration reload failed");
    reload_failed_ = true;
    report_status(true);
  }
}

void Watcher::publish(std::unique_ptr<Graph> graph) {
  if (analysis_) graph->set_meters(analysis_->meters(), analysis_->activity());
  if (analysis_) graph->set_output_meters(&analysis_->output_gain, &analysis_->output_enabled, &analysis_->output_active);
  // Ownership is recorded before the graph becomes reachable: if this
  // allocation throws, the unique_ptr still holds the only reference and
  // frees it, and the audio thread never saw it.
  owned_.push_back(Retired{graph.get(), 0});
  Graph* const raw = graph.release();

  slot_.set_latency(raw->latency_frames());
  Graph* const unconsumed = slot_.publish(raw);
  // Read after the exchange: a block that increments this counter from here
  // on cannot have adopted anything older than what was just published.
  owned_.back().blocks_at_publish = slot_.blocks();

  if (unconsumed != nullptr) {
    // The exchange took it back out of `pending` still unread, which is proof
    // the audio thread never adopted it — the common case on an idle endpoint,
    // and what stops a user dragging a band with nothing playing from piling
    // up a graph per frame until the stream starts.
    const auto found = std::find_if(
        owned_.begin(), owned_.end(),
        [unconsumed](const Retired& at) { return at.graph == unconsumed; });
    if (found != owned_.end()) {
      delete found->graph;
      owned_.erase(found);
    }
  }
  reclaim();
}

void Watcher::reclaim() {
  const uint64_t blocks = slot_.blocks();
  // Entries are in publish order and their block counts never decrease, so
  // the newest entry whose grace period has elapsed is a boundary: every
  // entry before it was superseded by something the audio thread has already
  // taken up, and cannot be reached again.
  size_t boundary = 0;
  for (size_t at = owned_.size(); at > 0; --at) {
    if (blocks >= owned_[at - 1].blocks_at_publish + kGraceBlocks) {
      boundary = at - 1;
      break;
    }
  }
  for (size_t at = 0; at < boundary; ++at) {
    delete owned_[at].graph;
  }
  owned_.erase(owned_.begin(),
               owned_.begin() + static_cast<ptrdiff_t>(boundary));
}

}  // namespace fluideq_engine

/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The player's system volume on PulseAudio and pipewire-pulse. Linux had
 * no volume helper, so the existing player fader disappeared on this OS.
 * This speaks the Windows helper's protocol, following the default sink
 * through server notifications rather than running mixer commands on a clock.
 * stdin closing ends it, including when the owning app crashes.
 */

#include "../pulse/pa_api.h"

#include <poll.h>
#include <sys/eventfd.h>
#include <unistd.h>

#include <algorithm>
#include <cerrno>
#include <cmath>
#include <csignal>
#include <cstdio>
#include <cstdlib>
#include <string>

namespace {

namespace pa = fluideq_linux::pa;
constexpr uint32_t kNormalVolume = 0x10000;
constexpr uint32_t kNoSink = UINT32_MAX;

class Volume {
 public:
  explicit Volume(const pa::Api& api) : api_(api) {}
  ~Volume() {
    if (started_) api_.mainloop_lock(loop_);
    if (context_ != nullptr) {
      api_.context_set_state_callback(context_, nullptr, nullptr);
      api_.context_set_subscribe_callback(context_, nullptr, nullptr);
      api_.context_disconnect(context_);
    }
    if (started_) {
      api_.mainloop_unlock(loop_);
      api_.mainloop_stop(loop_);
    }
    if (context_ != nullptr) api_.context_unref(context_);
    if (loop_ != nullptr) api_.mainloop_free(loop_);
    if (lost_ >= 0) ::close(lost_);
  }

  bool start() {
    lost_ = eventfd(0, EFD_CLOEXEC | EFD_NONBLOCK);
    loop_ = api_.mainloop_new();
    if (lost_ < 0 || loop_ == nullptr) return false;
    context_ = api_.context_new(api_.mainloop_get_api(loop_), "FluidEQ Volume");
    if (context_ == nullptr) return false;
    api_.context_set_state_callback(context_, state_changed, this);
    if (api_.mainloop_start(loop_) < 0) return false;
    started_ = true;
    api_.mainloop_lock(loop_);
    bool connected = api_.context_connect(context_, nullptr,
                                          pa::kNoAutospawn, nullptr) >= 0;
    while (connected) {
      const int state = api_.context_get_state(context_);
      if (state == pa::kContextReady) break;
      if (state == pa::kContextFailed || state == pa::kContextTerminated) {
        connected = false;
        break;
      }
      api_.mainloop_wait(loop_);
    }
    if (connected) {
      api_.context_set_subscribe_callback(context_, changed, this);
      release(api_.context_subscribe(context_,
          pa::kSubscribeSink | pa::kSubscribeServer, subscribed, this));
    }
    api_.mainloop_unlock(loop_);
    return connected;
  }

  int lost_fd() const { return lost_; }

  bool command(const std::string& line) {
    const bool mute = line == "mute 0" || line == "mute 1";
    double level = 0;
    if (!mute) {
      if (line.rfind("set ", 0) != 0 || line.size() > 32) return false;
      char* end = nullptr;
      const char* number = line.c_str() + 4;
      level = std::strtod(number, &end);
      if (end == number || *end != '\0' || !std::isfinite(level) ||
          level < 0 || level > 1) return false;
    }
    api_.mainloop_lock(loop_);
    if (sink_ != kNoSink && api_.context_get_state(context_) == pa::kContextReady) {
      if (mute) {
        release(api_.context_set_sink_mute_by_index(context_, sink_,
            line.back() == '1' ? 1 : 0, written, this));
      } else {
        pa::cvolume wanted = volume_;
        // Keep the desktop's channel balance: a stereo master fader must
        // not silently centre a balance the listener set elsewhere.
        api_.cvolume_scale(&wanted,
            static_cast<uint32_t>(std::lround(level * kNormalVolume)));
        release(api_.context_set_sink_volume_by_index(context_, sink_,
            &wanted, written, this));
      }
    }
    api_.mainloop_unlock(loop_);
    return true;
  }

 private:
  void release(pa::operation* operation) {
    if (operation != nullptr) api_.operation_unref(operation);
  }

  void lost() {
    const uint64_t one = 1;
    const ssize_t sent = ::write(lost_, &one, sizeof(one));
    (void)sent;
  }

  void none() {
    sink_ = kNoSink;
    std::puts("none");
    std::fflush(stdout);
  }

  void refresh() {
    if (api_.context_get_state(context_) != pa::kContextReady) return;
    if (reading_) {
      again_ = true;
      return;
    }
    reading_ = true;
    pa::operation* operation =
        api_.context_get_server_info(context_, server_read, this);
    if (operation == nullptr) {
      reading_ = false;
      none();
    }
    release(operation);
  }

  void finished() {
    reading_ = false;
    if (again_) {
      again_ = false;
      refresh();
    }
  }

  static void state_changed(pa::context*, void* data) {
    auto& self = *static_cast<Volume*>(data);
    const int state = self.api_.context_get_state(self.context_);
    self.api_.mainloop_signal(self.loop_, 0);
    if (state == pa::kContextFailed || state == pa::kContextTerminated) {
      self.lost();
    }
  }

  static void subscribed(pa::context*, int success, void* data) {
    auto& self = *static_cast<Volume*>(data);
    if (success != 0) self.refresh();
    else self.lost();
  }

  static void changed(pa::context*, int event, uint32_t index, void* data) {
    auto& self = *static_cast<Volume*>(data);
    const int facility = event & pa::kEventFacilityMask;
    if (facility == pa::kEventServer ||
        (facility == pa::kEventSink &&
         (index == self.sink_ || self.sink_ == kNoSink))) self.refresh();
  }

  static void written(pa::context*, int, void* data) {
    static_cast<Volume*>(data)->refresh();
  }

  static void server_read(pa::context*, const pa::server_info* info, void* data) {
    auto& self = *static_cast<Volume*>(data);
    if (info == nullptr || info->default_sink_name == nullptr ||
        info->default_sink_name[0] == '\0') {
      self.none();
      self.finished();
      return;
    }
    const std::string name = info->default_sink_name;
    // Never send a drag to the old output while the new one's reading is
    // in flight. Server and sink reads are serialised, so an older answer
    // cannot put a previous default back into the slider.
    if (name != self.name_) self.sink_ = kNoSink;
    self.name_ = name;
    pa::operation* operation = self.api_.context_get_sink_info_by_name(
        self.context_, name.c_str(), sink_read, &self);
    if (operation == nullptr) {
      self.none();
      self.finished();
    }
    self.release(operation);
  }

  static void sink_read(pa::context*, const pa::sink_info* info,
                         int end, void* data) {
    auto& self = *static_cast<Volume*>(data);
    if (end != 0) {
      if (end < 0) self.none();
      self.finished();
      return;
    }
    if (info == nullptr || info->volume.channels == 0 ||
        info->volume.channels > pa::kChannelsMax) {
      self.none();
      return;
    }
    self.sink_ = info->index;
    self.volume_ = info->volume;
    const uint32_t maximum = *std::max_element(
        self.volume_.values, self.volume_.values + self.volume_.channels);
    const double level = std::min(1.0,
        static_cast<double>(maximum) / kNormalVolume);
    std::printf("volume\t%.4f\t%d\n", level, info->mute != 0 ? 1 : 0);
    std::fflush(stdout);
  }

  const pa::Api& api_;
  pa::mainloop* loop_ = nullptr;
  pa::context* context_ = nullptr;
  bool started_ = false;
  int lost_ = -1;
  uint32_t sink_ = kNoSink;
  pa::cvolume volume_{};
  std::string name_;
  bool reading_ = false;
  bool again_ = false;
};

int run(Volume& volume) {
  pollfd waits[2] = {{STDIN_FILENO, POLLIN, 0},
                     {volume.lost_fd(), POLLIN, 0}};
  std::string pending;
  for (;;) {
    // No deadline: only a command, the owner's pipe closing, or the sound
    // server's disconnect callback wakes the helper.
    if (::poll(waits, 2, -1) < 0) {
      if (errno == EINTR) continue;
      return 1;
    }
    if (waits[1].revents != 0) {
      std::puts("none");
      std::fflush(stdout);
      return 2;
    }
    if (waits[0].revents == 0) continue;
    char buffer[4096];
    const ssize_t got = ::read(STDIN_FILENO, buffer, sizeof(buffer));
    if (got == 0) return 0;
    if (got < 0) {
      if (errno == EINTR) continue;
      return 1;
    }
    pending.append(buffer, static_cast<size_t>(got));
    for (size_t end = pending.find('\n'); end != std::string::npos;
         end = pending.find('\n')) {
      std::string line = pending.substr(0, end);
      pending.erase(0, end + 1);
      if (!line.empty() && line.back() == '\r') line.pop_back();
      if (!volume.command(line)) return 1;
    }
    if (pending.size() > 32) return 1;
  }
}

}  // namespace

int main() {
  std::signal(SIGPIPE, SIG_IGN);
  std::string error;
  const pa::Api* api = pa::api(error);
  if (api != nullptr) {
    Volume volume(*api);
    if (volume.start()) return run(volume);
    error = "the desktop sound server could not be opened";
  }
  std::fprintf(stderr, "FluidEQ-Volume: %s\n", error.c_str());
  std::puts("none");
  return 2;
}

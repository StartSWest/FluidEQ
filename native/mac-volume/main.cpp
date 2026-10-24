/* FluidEQ — GPL-3.0-or-later */
#include "output_volume.h"
#include "parent_watch.h"
#include <sys/event.h>
#include <unistd.h>
#include <cerrno>
#include <cmath>
#include <cstdio>
#include <cstdlib>
#include <csignal>
#include <string>
#include <sstream>

namespace {
constexpr uintptr_t kChanged = 1;
struct Watch {
  int queue;
  static OSStatus changed(AudioObjectID, UInt32, const AudioObjectPropertyAddress*, void* context) {
    const auto& self = *static_cast<Watch*>(context);
    struct kevent wake{};
    EV_SET(&wake, kChanged, EVFILT_USER, 0, NOTE_TRIGGER, 0, nullptr);
    kevent(self.queue, &wake, 1, nullptr, 0, nullptr);
    return noErr;
  }
};
bool say(const std::string& line) {
  return std::fputs((line + "\n").c_str(), stdout) >= 0 && std::fflush(stdout) == 0;
}
const AudioObjectPropertyAddress kSystem[] = {
  {kAudioHardwarePropertyDefaultOutputDevice, kAudioObjectPropertyScopeGlobal, kAudioObjectPropertyElementMain},
  {kAudioHardwarePropertyDevices, kAudioObjectPropertyScopeGlobal, kAudioObjectPropertyElementMain},
};
bool command(const std::string& line, feq::macvolume::OutputVolume& output, std::string& last) {
  std::istringstream fields(line);
  std::string kind, token, target, extra;
  if (!(fields >> kind >> token)) return false;
  const auto before = output.read();
  AudioObjectID expected = before.device;
  if (fields >> target) {
    char* end = nullptr;
    const auto id = std::strtoull(target.c_str(), &end, 10);
    if (end != target.c_str() + target.size() || id == 0 || id > UINT32_MAX || fields >> extra) return false;
    expected = static_cast<AudioObjectID>(id);
  }
  if (kind == "mute" && (token == "0" || token == "1")) {
    output.mute(token == "1", expected);
  } else if (kind == "set") {
    char* end = nullptr;
    const auto level = std::strtof(token.c_str(), &end);
    if (end != token.c_str() + token.size() || !std::isfinite(level) || level < 0 || level > 1) return false;
    output.set(level, expected);
  } else return false;
  // Always query back, including refused writes and a device switched while
  // a command was travelling. The renderer never mistakes intent for success.
  const auto applied = output.read();
  // An OS change back to the pre-drag value must be compared with what was
  // just acknowledged, rather than an older notification's cached value.
  last = applied.line(false);
  return say(applied.line(true));
}
}
int main(int argc, char** argv) {
  std::signal(SIGPIPE, SIG_IGN);
  feq_watch_parent(static_cast<uint32_t>(getppid()), nullptr);
  if (argc == 2 && std::string(argv[1]) == "--read") {
    feq::macvolume::OutputVolume output(nullptr, nullptr);
    return say(output.read().line(false)) ? 0 : 1;
  }
  const int queue = kqueue();
  if (queue < 0) return 1;
  Watch watch{queue};
  int result = 0;
  {
    feq::macvolume::OutputVolume output(Watch::changed, &watch);
    struct kevent subscriptions[2]{};
    EV_SET(&subscriptions[0], kChanged, EVFILT_USER, EV_ADD | EV_CLEAR, 0, 0, nullptr);
    EV_SET(&subscriptions[1], STDIN_FILENO, EVFILT_READ, EV_ADD, 0, 0, nullptr);
    if (kevent(queue, subscriptions, 2, nullptr, 0, nullptr) != 0) return 1;
    for (const auto& where : kSystem)
      if (AudioObjectAddPropertyListener(kAudioObjectSystemObject, &where, Watch::changed, &watch) != noErr) return 1;
    std::string last = output.read().line(false);
    bool live = say("ready\t2") && say(last);
    std::string pending;
    while (live) {
      struct kevent event{};
      if (kevent(queue, nullptr, 0, &event, 1, nullptr) < 0) {
        if (errno == EINTR) continue;
        result = 1; break;
      }
      if (event.filter == EVFILT_USER) {
        const auto next = output.read().line(false);
        if (next != last) { last = next; live = say(next); }
      } else if (event.filter == EVFILT_READ) {
        char bytes[256];
        const auto count = ::read(STDIN_FILENO, bytes, sizeof(bytes));
        if (count <= 0) break;
        for (ssize_t i = 0; i < count && live; ++i) {
          if (bytes[i] == '\r') continue;
          if (bytes[i] == '\n') {
            live = command(pending, output, last);
            if (!live) result = 2;
            pending.clear();
          } else if (pending.size() < 128) pending.push_back(bytes[i]);
          else { live = false; result = 2; }
        }
      }
    }
    for (const auto& where : kSystem)
      AudioObjectRemovePropertyListener(kAudioObjectSystemObject, &where, Watch::changed, &watch);
  }
  ::close(queue);
  return result;
}

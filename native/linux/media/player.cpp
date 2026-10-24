/* FluidEQ — GPL-3.0-or-later */
#include "player.h"
#include <algorithm>
#include <cstring>

namespace fluideq_linux::media {
namespace {
std::string text(const bus::Api& a, bus::Message* m, const char* type) {
  const char* found = nullptr;
  return a.read(m, type, &found) > 0 && found != nullptr ? found : "";
}

bool metadata(const bus::Api& a, bus::Message* m, Player& p) {
  if (a.enter(m, 'a', "{sv}") <= 0) return false;
  while (a.enter(m, 'e', "sv") > 0) {
    const std::string key = text(a, m, "s");
    char type = 0;
    const char* contents = nullptr;
    if (a.peek(m, &type, &contents) <= 0 || type != 'v') return false;
    const std::string signature = contents == nullptr ? "" : contents;
    if (a.enter(m, 'v', signature.c_str()) <= 0) return false;
    if (key == "xesam:title" && signature == "s") {
      p.reading.title = text(a, m, "s");
    } else if (key == "xesam:artist" && signature == "as") {
      if (a.enter(m, 'a', "s") <= 0) return false;
      const char* artist = nullptr;
      while (a.read(m, "s", &artist) > 0) {
        if (artist == nullptr || *artist == '\0') continue;
        if (!p.reading.artist.empty()) p.reading.artist += ", ";
        p.reading.artist += artist;
      }
      if (a.exit(m) < 0) return false;
    } else if (key == "mpris:trackid" && signature == "o") {
      p.track = text(a, m, "o");
    } else if (key == "mpris:artUrl" && signature == "s") {
      p.artwork = text(a, m, "s");
    } else if (key == "mpris:length" && signature == "x") {
      int64_t micros = 0;
      if (a.read(m, "x", &micros) < 0) return false;
      p.reading.duration_ms = std::max<int64_t>(0, micros / 1000);
    } else if (a.skip(m, signature.c_str()) < 0) {
      return false;
    }
    if (a.exit(m) < 0 || a.exit(m) < 0) return false;
  }
  return a.exit(m) >= 0;
}
}  // namespace

bool read_player(const bus::Api& a, bus::Connection* c,
                 const std::string& name, Player& p) {
  bus::Message* message = nullptr;
  if (a.call_method(c, name.c_str(), bus::kPath, bus::kProperties,
                    "GetAll", nullptr, &message, "s", bus::kPlayer) < 0)
    return false;
  const auto read = [&]() {
    p.reading.app = name;
    if (a.enter(message, 'a', "{sv}") <= 0) return false;
    while (a.enter(message, 'e', "sv") > 0) {
      const std::string key = text(a, message, "s");
      char type = 0;
      const char* contents = nullptr;
      if (a.peek(message, &type, &contents) <= 0 || type != 'v') return false;
      const std::string signature = contents == nullptr ? "" : contents;
      if (a.enter(message, 'v', signature.c_str()) <= 0) return false;
      if (key == "Metadata" && signature == "a{sv}") {
        if (!metadata(a, message, p)) return false;
      } else if (key == "PlaybackStatus" && signature == "s") {
        p.reading.is_playing = text(a, message, "s") == "Playing";
      } else if (key == "Position" && signature == "x") {
        int64_t micros = 0;
        if (a.read(message, "x", &micros) < 0) return false;
        p.reading.position_ms = std::max<int64_t>(0, micros / 1000);
      } else if (signature == "b") {
        int value = 0;
        if (a.read(message, "b", &value) < 0) return false;
        if (key == "CanGoNext") p.reading.can_next = value != 0;
        else if (key == "CanGoPrevious") p.reading.can_previous = value != 0;
        else if (key == "CanSeek") p.reading.can_seek = value != 0;
        else if (key == "CanControl") p.can_control = value != 0;
      } else if (a.skip(message, signature.c_str()) < 0) {
        return false;
      }
      if (a.exit(message) < 0 || a.exit(message) < 0) return false;
    }
    if (a.exit(message) < 0) return false;
    p.reading.can_next = p.can_control && p.reading.can_next;
    p.reading.can_previous = p.can_control && p.reading.can_previous;
    p.reading.can_seek = p.can_control && p.reading.can_seek && !p.track.empty();
    return true;
  };
  const bool ok = read();
  a.message_unref(message);
  return ok;
}
}  // namespace fluideq_linux::media

/* FluidEQ — GPL-3.0-or-later */
#pragma once

#include <cstdint>
#include <string>

// sd-bus is a stable C ABI. Loading it rather than linking keeps the helper
// optional on desktops without libsystemd; no Node/Electron addon is needed.
namespace fluideq_linux::bus {
struct Connection;
struct Message;
struct Slot;
struct Error;
using Handler = int (*)(Message*, void*, Error*);

struct Api {
  int (*open_user)(Connection**);
  Connection* (*close_unref)(Connection*);
  int (*process)(Connection*, Message**);
  int (*get_fd)(Connection*);
  int (*get_events)(Connection*);
  int (*add_match)(Connection*, Slot**, const char*, Handler, void*);
  int (*call_method)(Connection*, const char*, const char*, const char*,
                     const char*, Error*, Message**, const char*, ...);
  Message* (*message_unref)(Message*);
  int (*read)(Message*, const char*, ...);
  int (*enter)(Message*, char, const char*);
  int (*exit)(Message*);
  int (*skip)(Message*, const char*);
  int (*peek)(Message*, char*, const char**);
};

const Api* api(std::string& error);
constexpr const char* kPath = "/org/mpris/MediaPlayer2";
constexpr const char* kPlayer = "org.mpris.MediaPlayer2.Player";
constexpr const char* kProperties = "org.freedesktop.DBus.Properties";
constexpr const char* kBus = "org.freedesktop.DBus";
constexpr const char* kBusPath = "/org/freedesktop/DBus";
}  // namespace fluideq_linux::bus

/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#include "sound_server.h"

#include <sys/stat.h>

#include <cstdlib>
#include <string>

namespace fluideq_linux {

bool pipewire_running() {
  const char* remote = std::getenv("PIPEWIRE_REMOTE");
  std::string socket;
  if (remote != nullptr && remote[0] == '/') {
    socket = remote;
  } else {
    const char* dir = std::getenv("PIPEWIRE_RUNTIME_DIR");
    if (dir == nullptr) dir = std::getenv("XDG_RUNTIME_DIR");
    if (dir == nullptr) return false;
    socket = std::string(dir) + "/" + (remote != nullptr ? remote : "pipewire-0");
  }
  struct stat info {};
  return ::stat(socket.c_str(), &info) == 0 && S_ISSOCK(info.st_mode);
}

}  // namespace fluideq_linux

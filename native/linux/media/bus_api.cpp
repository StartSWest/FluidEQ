/* FluidEQ — GPL-3.0-or-later */
#include "bus_api.h"
#include <dlfcn.h>
#include <type_traits>

namespace fluideq_linux::bus {
const Api* api(std::string& error) {
  static Api out{};
  static bool loaded = false;
  if (loaded) return &out;
  void* library = dlopen("libsystemd.so.0", RTLD_NOW | RTLD_LOCAL);
  if (library == nullptr) {
    error = "libsystemd.so.0 is not installed";
    return nullptr;
  }
  const auto bind = [&](const char* name, auto& slot) {
    slot = reinterpret_cast<std::remove_reference_t<decltype(slot)>>(
        dlsym(library, name));
    if (slot == nullptr) error = std::string("sd-bus has no ") + name;
    return slot != nullptr;
  };
  loaded = bind("sd_bus_open_user", out.open_user) &&
      bind("sd_bus_flush_close_unref", out.close_unref) &&
      bind("sd_bus_process", out.process) &&
      bind("sd_bus_get_fd", out.get_fd) &&
      bind("sd_bus_get_events", out.get_events) &&
      bind("sd_bus_add_match", out.add_match) &&
      bind("sd_bus_call_method", out.call_method) &&
      bind("sd_bus_message_unref", out.message_unref) &&
      bind("sd_bus_message_read", out.read) &&
      bind("sd_bus_message_enter_container", out.enter) &&
      bind("sd_bus_message_exit_container", out.exit) &&
      bind("sd_bus_message_skip", out.skip) &&
      bind("sd_bus_message_peek_type", out.peek);
  // These function pointers have process lifetime, like the sound APIs.
  return loaded ? &out : nullptr;
}
}  // namespace fluideq_linux::bus

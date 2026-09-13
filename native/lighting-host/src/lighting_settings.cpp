/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#include "lighting_settings.h"

#define WIN32_LEAN_AND_MEAN
#include <windows.h>

#include <unknwn.h>
#include <winrt/base.h>

#include <algorithm>
#include <array>
#include <cwchar>
#include <optional>
#include <string>
#include <thread>
#include <utility>
#include <vector>

#include "json_text.h"

namespace fluideq_lighting {

namespace {

constexpr wchar_t kLightingKey[] = L"Software\\Microsoft\\Lighting";
constexpr wchar_t kMicrosoftKey[] = L"Software\\Microsoft";

// A registry key handle closed on every path out.
class Key final {
 public:
  Key() = default;
  explicit Key(HKEY handle) : handle_(handle) {}
  ~Key() { reset(); }
  Key(const Key&) = delete;
  Key& operator=(const Key&) = delete;
  Key(Key&& other) noexcept : handle_(std::exchange(other.handle_, nullptr)) {}
  Key& operator=(Key&& other) noexcept {
    if (this != &other) {
      reset();
      handle_ = std::exchange(other.handle_, nullptr);
    }
    return *this;
  }

  static Key open(HKEY parent, const wchar_t* path, REGSAM access) {
    HKEY handle = nullptr;
    if (RegOpenKeyExW(parent, path, 0, access, &handle) != ERROR_SUCCESS) {
      return {};
    }
    return Key(handle);
  }

  [[nodiscard]] HKEY get() const { return handle_; }
  explicit operator bool() const { return handle_ != nullptr; }

 private:
  void reset() {
    if (handle_ != nullptr) {
      RegCloseKey(handle_);
      handle_ = nullptr;
    }
  }
  HKEY handle_ = nullptr;
};

std::optional<bool> read_flag(HKEY key, const wchar_t* name) {
  DWORD value = 0;
  DWORD size = sizeof(value);
  if (RegGetValueW(key, nullptr, name, RRF_RT_REG_DWORD, nullptr, &value,
                   &size) != ERROR_SUCCESS) {
    return std::nullopt;
  }
  return value != 0;
}

// The Background light control order: values named 1, 2, 3… holding package
// family names, in the order the member dragged them.
std::optional<std::vector<std::string>> read_providers(HKEY parent) {
  const Key providers = Key::open(parent, L"Providers", KEY_READ);
  if (!providers) {
    return std::nullopt;
  }
  std::vector<std::pair<unsigned long, std::string>> entries;
  for (DWORD index = 0;; ++index) {
    wchar_t name[32];
    DWORD name_length = static_cast<DWORD>(std::size(name));
    wchar_t data[512];
    DWORD data_size = sizeof(data);
    DWORD type = 0;
    const LSTATUS status =
        RegEnumValueW(providers.get(), index, name, &name_length, nullptr,
                      &type, static_cast<BYTE*>(static_cast<void*>(data)),
                      &data_size);
    if (status == ERROR_NO_MORE_ITEMS) {
      break;
    }
    if (status != ERROR_SUCCESS || type != REG_SZ) {
      continue;
    }
    const std::size_t characters = data_size / sizeof(wchar_t);
    std::wstring value(data, characters);
    while (!value.empty() && value.back() == L'\0') {
      value.pop_back();
    }
    wchar_t* end = nullptr;
    const unsigned long order = std::wcstoul(name, &end, 10);
    if (end == name) {
      continue;
    }
    entries.emplace_back(order, winrt::to_string(value));
  }
  std::sort(entries.begin(), entries.end(),
            [](const auto& a, const auto& b) { return a.first < b.first; });
  std::vector<std::string> ordered;
  ordered.reserve(entries.size());
  for (auto& entry : entries) {
    ordered.push_back(std::move(entry.second));
  }
  return ordered;
}

JsonLine& add_flag(JsonLine& line, std::string_view key,
                   const std::optional<bool>& value) {
  if (value) {
    line.boolean(key, *value);
  }
  return line;
}

// The whole of what Settings holds, as one line. Absent values stay absent:
// a device page never opened has no flags of its own and follows the global
// ones.
std::string describe(HKEY lighting) {
  JsonLine line("lighting-settings");
  if (lighting == nullptr) {
    return line.boolean("present", false).finish();
  }
  line.boolean("present", true);
  add_flag(line, "enabled", read_flag(lighting, L"AmbientLightingEnabled"));
  add_flag(line, "foregroundFirst",
           read_flag(lighting, L"ControlledByForegroundApp"));
  if (const auto providers = read_providers(lighting)) {
    line.texts("providers", *providers);
  }

  std::vector<std::string> devices;
  const Key all = Key::open(lighting, L"Devices", KEY_READ);
  if (all) {
    for (DWORD index = 0;; ++index) {
      wchar_t name[512];
      DWORD length = static_cast<DWORD>(std::size(name));
      const LSTATUS status = RegEnumKeyExW(all.get(), index, name, &length,
                                           nullptr, nullptr, nullptr, nullptr);
      if (status == ERROR_NO_MORE_ITEMS) {
        break;
      }
      if (status != ERROR_SUCCESS) {
        continue;
      }
      const Key device = Key::open(all.get(), name, KEY_READ);
      if (!device) {
        continue;
      }
      JsonLine entry = JsonLine::nested();
      entry.text("id", winrt::to_string(std::wstring_view(name, length)));
      add_flag(entry, "enabled", read_flag(device.get(), L"AmbientLightingEnabled"));
      add_flag(entry, "foregroundFirst",
               read_flag(device.get(), L"ControlledByForegroundApp"));
      if (const auto providers = read_providers(device.get())) {
        entry.texts("providers", *providers);
      }
      devices.push_back(entry.object());
    }
  }
  line.objects("devices", devices);
  return line.finish();
}

}  // namespace

struct LightingSettings::State {
  explicit State(EventSink& events) : sink(events) {}

  EventSink& sink;
  HANDLE stop_event = nullptr;
  std::thread thread;
  std::string last;

  void report(HKEY lighting) {
    std::string line = describe(lighting);
    // Settings writes several values for one change; say it once.
    if (line != last) {
      last = line;
      sink.write(line);
    }
  }

  // Waits on the lighting key when it exists, and on its parent's list of
  // subkeys when it does not yet: Windows creates it the first time the
  // Dynamic Lighting page or a lighting device is used.
  //
  // The watched handle stays open for as long as it is watched: closing a key
  // signals its notification, and a loop that reopened the key each time
  // would wake itself forever. The event is reset before every re-arm for the
  // same reason, when the parent is swapped for the lighting key.
  void run() {
    const HANDLE changed = CreateEventW(nullptr, TRUE, FALSE, nullptr);
    if (changed == nullptr) {
      return;
    }
    Key lighting =
        Key::open(HKEY_CURRENT_USER, kLightingKey, KEY_READ | KEY_NOTIFY);
    Key parent;
    report(lighting.get());
    for (;;) {
      if (!lighting && !parent) {
        parent = Key::open(HKEY_CURRENT_USER, kMicrosoftKey, KEY_NOTIFY);
        if (!parent) {
          break;
        }
      }
      ResetEvent(changed);
      const LSTATUS armed =
          lighting ? RegNotifyChangeKeyValue(
                         lighting.get(), TRUE,
                         REG_NOTIFY_CHANGE_NAME | REG_NOTIFY_CHANGE_LAST_SET,
                         changed, TRUE)
                   : RegNotifyChangeKeyValue(parent.get(), FALSE,
                                             REG_NOTIFY_CHANGE_NAME, changed,
                                             TRUE);
      if (armed != ERROR_SUCCESS) {
        break;
      }
      const std::array<HANDLE, 2> handles{stop_event, changed};
      const DWORD woke = WaitForMultipleObjects(
          static_cast<DWORD>(handles.size()), handles.data(), FALSE, INFINITE);
      if (woke != WAIT_OBJECT_0 + 1) {
        break;
      }
      if (!lighting) {
        lighting =
            Key::open(HKEY_CURRENT_USER, kLightingKey, KEY_READ | KEY_NOTIFY);
        if (!lighting) {
          continue;
        }
        parent = Key();
      }
      report(lighting.get());
    }
    CloseHandle(changed);
  }
};

LightingSettings::LightingSettings(EventSink& sink)
    : state_(std::make_shared<State>(sink)) {}

LightingSettings::~LightingSettings() { stop(); }

void LightingSettings::start() {
  if (state_->thread.joinable()) {
    return;
  }
  state_->stop_event = CreateEventW(nullptr, TRUE, FALSE, nullptr);
  if (state_->stop_event == nullptr) {
    return;
  }
  state_->thread = std::thread([state = state_] { state->run(); });
}

void LightingSettings::stop() {
  if (!state_->thread.joinable()) {
    return;
  }
  SetEvent(state_->stop_event);
  state_->thread.join();
  CloseHandle(state_->stop_event);
  state_->stop_event = nullptr;
}

}  // namespace fluideq_lighting

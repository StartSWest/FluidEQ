/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The status file's text, held to the exact shape `src/main/engineHealth.ts`
 * parses — the two sides of that file are in different languages, and a
 * field one of them names differently fails as "the engine is not running"
 * on a machine where it is. And the count behind "locked", which fails the
 * same way when one of two instances on an output stops.
 */

#include "../src/status_file.h"

#define WIN32_LEAN_AND_MEAN
#include <windows.h>

#include <cstdio>
#include <string>

using fluideq_engine::EngineStatus;
using fluideq_engine::StatusShare;
using fluideq_engine::status_json;

namespace {

int g_failures = 0;

void check_impl(bool ok, const char* expr, const char* file, int line) {
  if (!ok) {
    std::printf("  FAIL %s:%d: %s\n", file, line, expr);
    ++g_failures;
  }
}

#define CHECK(...) check_impl((__VA_ARGS__), #__VA_ARGS__, __FILE__, __LINE__)

void a_processing_output() {
  std::printf("an output being processed, with nothing missing\n");
  EngineStatus status;
  status.endpoint = L"{947B0242-A1CF-4483-A44E-B72DA462C901}";
  status.locked = true;
  status.processing = true;
  const std::string text =
      status_json(status, 4242, "2026-09-11T12:00:00.000Z");
  CHECK(text ==
        "{\"version\":1,\"endpoint\":\"{947B0242-A1CF-4483-A44E-B72DA462C901}\","
        "\"pid\":4242,\"locked\":true,\"processing\":true,\"owner\":true,"
        "\"reason\":\"\",\"problems\":[],"
        "\"at\":\"2026-09-11T12:00:00.000Z\"}\r\n");
}

void a_pass_through_with_problems() {
  std::printf("pass-through, its reason, and what is missing\n");
  EngineStatus status;
  status.endpoint = L"{AAAA}";
  status.locked = true;
  status.owner = false;
  status.reason = "FluidEQ is not running";
  status.problems = {"convolution", "reload-failed"};
  const std::string text = status_json(status, 7, "t");
  CHECK(text.find("\"processing\":false") != std::string::npos);
  CHECK(text.find("\"owner\":false") != std::string::npos);
  CHECK(text.find("\"reason\":\"FluidEQ is not running\"") !=
        std::string::npos);
  CHECK(text.find("\"problems\":[\"convolution\",\"reload-failed\"]") !=
        std::string::npos);
}

void a_finished_song() {
  std::printf("the last song leveling finished, in the exact shape the app parses\n");
  EngineStatus status;
  status.endpoint = L"{AAAA}";
  status.locked = true;
  status.processing = true;
  status.last_song =
      EngineStatus::FinishedSong{"00000000000a11ce", -11.844, -0.6251, 184.25};
  CHECK(status_json(status, 7, "t") ==
        "{\"version\":1,\"endpoint\":\"{AAAA}\",\"pid\":7,\"locked\":true,"
        "\"processing\":true,\"owner\":true,\"reason\":\"\",\"problems\":[],"
        "\"lastSong\":{\"id\":\"00000000000a11ce\",\"level\":-11.84,"
        "\"peak\":-0.63,\"seconds\":184.25},\"at\":\"t\"}\r\n");
  // Positive control for the field being optional: without a song the text
  // is exactly what every earlier engine wrote.
  status.last_song.reset();
  CHECK(status_json(status, 7, "t").find("lastSong") == std::string::npos);
}

void text_is_escaped() {
  std::printf("quotes, backslashes and control characters are escaped\n");
  EngineStatus status;
  status.endpoint = L"{\x00e9}";  // Not ASCII: replaced, not guessed at.
  status.reason = "a \"quoted\" \\ path\nand a newline";
  const std::string text = status_json(status, 1, "t");
  CHECK(text.find("\"endpoint\":\"{?}\"") != std::string::npos);
  CHECK(text.find("\\\"quoted\\\" \\\\ path\\u000aand") != std::string::npos);
}

void linear_phase_fallback_is_reported() {
  EngineStatus status;
  status.problems = {"eq-phase"};
  CHECK(status_json(status, 7, "t").find("\"problems\":[\"eq-phase\"]") != std::string::npos);
  status.problems.clear();
  CHECK(status_json(status, 7, "t").find("\"problems\":[]") != std::string::npos);
}

std::string read_all(const std::wstring& path) {
  const HANDLE file = CreateFileW(path.c_str(), GENERIC_READ,
                                  FILE_SHARE_READ | FILE_SHARE_DELETE, nullptr,
                                  OPEN_EXISTING, FILE_ATTRIBUTE_NORMAL, nullptr);
  if (file == INVALID_HANDLE_VALUE) {
    return std::string();
  }
  std::string text(4096, '\0');
  DWORD read = 0;
  if (ReadFile(file, text.data(), static_cast<DWORD>(text.size()), &read,
               nullptr) == 0) {
    read = 0;
  }
  CloseHandle(file);
  text.resize(read);
  return text;
}

bool says_locked(const std::wstring& path, bool locked) {
  return read_all(path).find(locked ? "\"locked\":true" : "\"locked\":false") !=
         std::string::npos;
}

bool leftover_temporaries(const std::wstring& root) {
  WIN32_FIND_DATAW found = {};
  const HANDLE search = FindFirstFileW((root + L"\\*.tmp").c_str(), &found);
  if (search == INVALID_HANDLE_VALUE) {
    return false;
  }
  FindClose(search);
  return true;
}

void instances_share_an_output() {
  std::printf("the last instance out on an output is the one that lets it go\n");
  wchar_t temp[MAX_PATH] = {};
  const DWORD length = GetTempPathW(MAX_PATH, temp);
  CHECK(length > 0 && length < MAX_PATH);
  const std::wstring root = std::wstring(temp) + L"fluideq-engine-status-" +
                            std::to_wstring(GetCurrentProcessId());
  CHECK(CreateDirectoryW(root.c_str(), nullptr) != 0);
  CHECK(SetEnvironmentVariableW(L"FLUIDEQ_ENGINE_ROOT", root.c_str()) != 0);
  const std::wstring path = root + L"\\status-{BBBB}.json";

  EngineStatus status;
  status.endpoint = L"{BBBB}";
  status.locked = true;
  status.processing = true;
  {
    StatusShare first;
    StatusShare second;
    CHECK(first.publish(status));
    CHECK(second.publish(status));
    // A reload republishes: still one instance, or the count never drains.
    CHECK(second.publish(status));
    CHECK(first.leave());
    CHECK(says_locked(path, true));  // `second` is still playing through it.
    CHECK(second.leave());
    CHECK(says_locked(path, false));  // Positive control: leaving does write.

    StatusShare third;
    CHECK(third.publish(status));
    CHECK(says_locked(path, true));
  }
  // `third` never left by hand; going away is leaving.
  CHECK(says_locked(path, false));
  CHECK(!leftover_temporaries(root));

  DeleteFileW(path.c_str());
  CHECK(RemoveDirectoryW(root.c_str()) != 0);
  SetEnvironmentVariableW(L"FLUIDEQ_ENGINE_ROOT", nullptr);
}

}  // namespace

int main() {
  std::printf("fluideq engine status file\n");
  a_processing_output();
  a_pass_through_with_problems();
  a_finished_song();
  text_is_escaped();
  linear_phase_fallback_is_reported();
  instances_share_an_output();
  if (g_failures == 0) {
    std::printf("\nall checks passed\n");
    return 0;
  }
  std::printf("\n%d check(s) failed\n", g_failures);
  return 1;
}

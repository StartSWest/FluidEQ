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
  status.channels = 2;
  const std::string text =
      status_json(status, 4242, "2026-09-11T12:00:00.000Z");
  CHECK(text ==
        "{\"version\":1,\"endpoint\":\"{947B0242-A1CF-4483-A44E-B72DA462C901}\","
        "\"pid\":4242,\"locked\":true,\"processing\":true,"
        "\"carried\":false,\"owner\":true,"
        "\"reason\":\"\",\"problems\":[],\"channels\":2,\"room\":\"off\","
        "\"rate\":0,\"latency\":0,\"latencyParts\":{},\"latencyActive\":[],\"gameMode\":false,"
        "\"at\":\"2026-09-11T12:00:00.000Z\"}\r\n");
  // The room's state rides with the count the card needs to name it.
  status.channels = 8;
  status.room = "7.1";
  CHECK(status_json(status, 4242, "t").find(
            "\"channels\":8,\"room\":\"7.1\",\"rate\"") != std::string::npos);
  // Whether sound has reached the engine here: false beside a locked,
  // processing output is the one state the app calls broken and every
  // other field calls healthy, so it is written either way rather than
  // left out when it is false.
  status.carried = true;
  CHECK(status_json(status, 4242, "t").find("\"carried\":true,\"owner\"") !=
        std::string::npos);
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
        "\"processing\":true,\"carried\":false,\"owner\":true,"
        "\"reason\":\"\",\"problems\":[],"
        "\"lastSong\":{\"id\":\"00000000000a11ce\",\"level\":-11.84,"
        "\"peak\":-0.63,\"seconds\":184.25},\"channels\":0,\"room\":\"off\","
        "\"rate\":0,\"latency\":0,\"latencyParts\":{},\"latencyActive\":[],\"gameMode\":false,"
        "\"at\":\"t\"}\r\n");
  // Positive control for the field being optional: without a song the text
  // is exactly what every earlier engine wrote.
  status.last_song.reset();
  CHECK(status_json(status, 7, "t").find("lastSong") == std::string::npos);
}

/**
 * A second output the engine plays from another output's engine, in the
 * exact shape the app parses (`engineHealth.test.ts` holds the same text).
 */
void a_second_output() {
  std::printf("a second output played from another output's engine\n");
  EngineStatus status;
  status.endpoint = L"{BBBB}";
  status.locked = true;
  status.split = EngineStatus::Split{
      L"{0a0a0a0a-1111-2222-3333-444455556666}", "playing", 12.737, 2};
  CHECK(status_json(status, 7, "t") ==
        "{\"version\":1,\"endpoint\":\"{BBBB}\",\"pid\":7,\"locked\":true,"
        "\"processing\":false,\"carried\":false,\"owner\":true,"
        "\"reason\":\"\",\"problems\":[],\"channels\":0,\"room\":\"off\","
        "\"rate\":0,\"latency\":0,\"latencyParts\":{},\"latencyActive\":[],"
        "\"gameMode\":false,\"split\":{\"from\":"
        "\"{0a0a0a0a-1111-2222-3333-444455556666}\",\"state\":\"playing\","
        "\"lagMs\":12.74,\"sourceDspMs\":0.00,\"outputEqMs\":0.00,"
        "\"underruns\":2},\"at\":\"t\"}\r\n");
  // Raw fan-out carries no source DSP latency; the receiver reports its
  // complete rack + curves separately from the ring/resampling delay.
  status.rate = 48000;
  status.latency = 960;
  status.latency_parts = {{"leveling", 480}, {"curves", 480}};
  status.split->output_eq_ms = 20;
  const auto processed = status_json(status, 7, "t");
  CHECK(processed.find("\"rate\":48000,\"latency\":960") != std::string::npos);
  CHECK(processed.find("\"lagMs\":12.74,\"sourceDspMs\":0.00,\"outputEqMs\":20.00") !=
        std::string::npos);
  // Positive control for the field being optional: an output that plays no
  // other's sound says nothing about it, as every earlier engine did.
  status.split.reset();
  CHECK(status_json(status, 7, "t").find("split") == std::string::npos);
}

/**
 * How long the engine takes over each block, in the exact shape the app
 * parses (`engineHealth.test.ts` holds the same text), and the arithmetic
 * behind it. GitHub issue 30: a reporter's sound cut in and out as Exciter
 * bands were added, and nothing the engine wrote could say whether it had
 * been too slow for that machine.
 */
void how_long_blocks_take() {
  std::printf("how long the engine takes over its blocks\n");
  using fluideq_engine::BlockTiming;
  using fluideq_engine::describe_timing;
  using fluideq_engine::timing_step;
  constexpr uint64_t kTicks = 10000000;  // QueryPerformanceFrequency's usual
  constexpr uint32_t kFrames = 528;      // 11 ms at 48 kHz
  constexpr uint64_t kBlockTicks = 110000;

  BlockTiming timing;
  CHECK(timing.read().blocks == 0);
  CHECK(describe_timing(timing.read()) == "no block timed yet");
  // An engine well inside its time: a tenth of each block.
  for (int block = 0; block < 100; ++block) {
    CHECK(timing.record(kBlockTicks / 10, kTicks, kFrames, 48000) == 100);
  }
  BlockTiming::Reading quick = timing.read();
  CHECK(quick.blocks == 100 && quick.over_half == 0);
  CHECK(quick.slowest_permille == 100 && timing_step(100) == 0);
  // Positive control: one block deliberately slow, at 55% of its time, is the
  // one the reading names, and the only one counted over half.
  CHECK(timing.record(kBlockTicks * 55 / 100, kTicks, kFrames, 48000) == 550);
  CHECK(timing.record(kBlockTicks / 10, kTicks, kFrames, 48000) == 550);
  const BlockTiming::Reading slow = timing.read();
  CHECK(slow.blocks == 102 && slow.over_half == 1);
  CHECK(slow.slowest_permille == 550 && timing_step(550) == 2);
  CHECK(describe_timing(slow) ==
        "slowest block 6.05 ms of its 11.00 ms (55%), 1 of 102 over half");
  // Slowest is a share, not a duration: a short block that took half its
  // time is slower than a long one that took a third, though fewer ms.
  BlockTiming mixed;
  mixed.record(36667, kTicks, 1100, 48000);  // 3.67 of 22.92 ms, 16%
  mixed.record(55000, kTicks, kFrames, 48000);  // 5.50 of 11.00 ms, 50%
  const BlockTiming::Reading share = mixed.read();
  CHECK(share.slowest_permille == 500);
  CHECK(share.period_ms == 11.0 && share.over_half == 0);
  // A call a debugger held for minutes is a block past its time, not an
  // overflow; and steps stop at twice the period.
  BlockTiming held;
  held.record(kTicks * 600, kTicks, kFrames, 48000);
  CHECK(held.read().slowest_permille > 50000);
  CHECK(timing_step(held.read().slowest_permille) == 8);
  // Nothing to divide by is no block at all.
  CHECK(held.record(1, 0, kFrames, 48000) == held.read().slowest_permille);
  CHECK(held.read().blocks == 1);

  EngineStatus status;
  status.endpoint = L"{CCCC}";
  status.locked = true;
  status.processing = true;
  status.load = slow;
  CHECK(status_json(status, 7, "t") ==
        "{\"version\":1,\"endpoint\":\"{CCCC}\",\"pid\":7,\"locked\":true,"
        "\"processing\":true,\"carried\":false,\"owner\":true,"
        "\"reason\":\"\",\"problems\":[],\"channels\":0,\"room\":\"off\","
        "\"rate\":0,\"latency\":0,\"latencyParts\":{},\"latencyActive\":[],"
        "\"gameMode\":false,\"load\":{\"blocks\":102,\"overHalf\":1,"
        "\"slowestMs\":6.05,\"periodMs\":11.00},\"at\":\"t\"}\r\n");
  // Positive control for the field being optional: an output with no block
  // timed says nothing about it, as every earlier engine did.
  status.load.reset();
  CHECK(status_json(status, 7, "t").find("load") == std::string::npos);
}

/**
 * The delay, stage by stage, in the exact shape the app parses — and game
 * mode. What the DSP page shows a listener as their lag; `engineHealth.test`
 * holds the app to the same text.
 */
void the_delay_and_game_mode() {
  std::printf("the delay stage by stage, and game mode\n");
  EngineStatus status;
  status.endpoint = L"{AAAA}";
  status.locked = true;
  status.processing = true;
  status.rate = 48000;
  status.latency = 3621;
  status.latency_parts = {{"bassPunch", 549}, {"room", 512}, {"curves", 2560}};
  status.game_mode = true;
  const std::string text = status_json(status, 7, "t");
  CHECK(text.find("\"rate\":48000,\"latency\":3621,"
                  "\"latencyParts\":{\"bassPunch\":549,\"room\":512,"
                  "\"curves\":2560},\"latencyActive\":[],\"gameMode\":true,\"at\"") !=
        std::string::npos);
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

/**
 * The app reads the file at the moments the engine writes it — its first
 * read at launch met the engine's first write, and the plain rename failed
 * against the reader's handle. The reader is Node, which opens with every
 * share mode; the write has to land over that handle, and a write that
 * cannot land has to say why.
 */
void a_reader_does_not_stop_the_write() {
  std::printf("a status is written over a file the app is reading\n");
  wchar_t temp[MAX_PATH] = {};
  const DWORD length = GetTempPathW(MAX_PATH, temp);
  CHECK(length > 0 && length < MAX_PATH);
  const std::wstring root = std::wstring(temp) + L"fluideq-engine-status-r" +
                            std::to_wstring(GetCurrentProcessId());
  CHECK(CreateDirectoryW(root.c_str(), nullptr) != 0);
  CHECK(SetEnvironmentVariableW(L"FLUIDEQ_ENGINE_ROOT", root.c_str()) != 0);
  const std::wstring path = root + L"\\status-{CCCC}.json";

  EngineStatus status;
  status.endpoint = L"{CCCC}";
  status.locked = false;
  CHECK(fluideq_engine::write_status(status));
  CHECK(says_locked(path, false));

  // Held open exactly as Node's `fs.readFile` holds it (libuv's share mode).
  const HANDLE reader = CreateFileW(
      path.c_str(), GENERIC_READ,
      FILE_SHARE_READ | FILE_SHARE_WRITE | FILE_SHARE_DELETE, nullptr,
      OPEN_EXISTING, FILE_ATTRIBUTE_NORMAL, nullptr);
  CHECK(reader != INVALID_HANDLE_VALUE);
  status.locked = true;
  status.processing = true;
  std::string why;
  const bool written = fluideq_engine::write_status(status, &why);
  CHECK(written);
  if (!written) {
    std::printf("  why: %s\n", why.c_str());
  }
  CloseHandle(reader);
  CHECK(says_locked(path, true));
  CHECK(!leftover_temporaries(root));

  // Positive control for the reason: a root that is not there names itself.
  DeleteFileW(path.c_str());
  CHECK(RemoveDirectoryW(root.c_str()) != 0);
  why.clear();
  CHECK(!fluideq_engine::write_status(status, &why));
  CHECK(why.find("engine root") != std::string::npos);
  SetEnvironmentVariableW(L"FLUIDEQ_ENGINE_ROOT", nullptr);
}

}  // namespace

int main() {
  std::printf("fluideq engine status file\n");
  a_processing_output();
  a_pass_through_with_problems();
  a_finished_song();
  a_second_output();
  how_long_blocks_take();
  the_delay_and_game_mode();
  text_is_escaped();
  linear_phase_fallback_is_reported();
  instances_share_an_output();
  a_reader_does_not_stop_the_write();
  if (g_failures == 0) {
    std::printf("\nall checks passed\n");
    return 0;
  }
  std::printf("\n%d check(s) failed\n", g_failures);
  return 1;
}

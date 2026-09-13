/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * How many times a failed engine command is tried, and that every try after
 * the first waits for Windows first — on fakes, because the real waits are
 * on somebody's audio service.
 */

#include <cstdio>
#include <string>
#include <vector>

#include "../setup/retry.h"

using fluideq_engine::setup::CommandResult;
using fluideq_engine::setup::is_service_settling;
using fluideq_engine::setup::kCommandTries;
using fluideq_engine::setup::run_with_retries;

namespace {

int g_failures = 0;

void check_impl(bool ok, const char* expr, const char* file, int line) {
  if (!ok) {
    std::printf("  FAIL %s:%d: %s\n", file, line, expr);
    ++g_failures;
  }
}

#define CHECK(...) check_impl((__VA_ARGS__), #__VA_ARGS__, __FILE__, __LINE__)

/** Every call, in order: "try" or "settle". */
struct Calls {
  std::vector<std::string> made;
  int tries() const {
    int count = 0;
    for (const std::string& call : made) {
      count += call == "try" ? 1 : 0;
    }
    return count;
  }
};

void a_command_that_works_runs_once() {
  std::printf("a command that works is run once and never waits\n");
  Calls calls;
  const CommandResult result = run_with_retries(
      kCommandTries,
      [&calls](CommandResult& attempt) {
        calls.made.push_back("try");
        attempt.ok = true;
      },
      [&calls](std::wstring&) {
        calls.made.push_back("settle");
        return true;
      });
  CHECK(result.ok);
  CHECK(calls.made == std::vector<std::string>{"try"});
}

void a_command_that_works_the_second_time() {
  std::printf("a failure is waited out and tried again\n");
  Calls calls;
  const CommandResult result = run_with_retries(
      kCommandTries,
      [&calls](CommandResult& attempt) {
        calls.made.push_back("try");
        attempt.ok = calls.tries() >= 2;
        if (!attempt.ok) {
          attempt.error = L"Audiosrv is stopping";
        }
      },
      [&calls](std::wstring&) {
        calls.made.push_back("settle");
        return true;
      });
  CHECK(result.ok);
  // The error of the try that failed must not leak into the one that worked.
  CHECK(result.error.empty());
  CHECK((calls.made == std::vector<std::string>{"try", "settle", "try"}));
}

void a_command_that_never_works() {
  std::printf("three tries, a wait before each of the last two, then the failure\n");
  Calls calls;
  const CommandResult result = run_with_retries(
      kCommandTries,
      [&calls](CommandResult& attempt) {
        calls.made.push_back("try");
        attempt.ok = false;
        attempt.error = L"try " + std::to_wstring(calls.tries());
      },
      [&calls](std::wstring&) {
        calls.made.push_back("settle");
        return true;
      });
  CHECK(kCommandTries == 3);
  CHECK(!result.ok);
  CHECK((calls.made == std::vector<std::string>{"try", "settle", "try",
                                                "settle", "try"}));
  // The last try's reason, and how many tries it took to get there.
  CHECK(result.error == L"failed 3 times; the last time: try 3");
}

void a_wait_that_fails_ends_the_tries() {
  std::printf("when Windows audio cannot be waited for, no more tries\n");
  Calls calls;
  const CommandResult result = run_with_retries(
      kCommandTries,
      [&calls](CommandResult& attempt) {
        calls.made.push_back("try");
        attempt.ok = false;
        attempt.error = L"could not attach";
      },
      [&calls](std::wstring& why) {
        calls.made.push_back("settle");
        why = L"access is denied";
        return false;
      });
  CHECK(!result.ok);
  CHECK((calls.made == std::vector<std::string>{"try", "settle"}));
  CHECK(result.error.find(L"could not attach") != std::wstring::npos);
  CHECK(result.error.find(L"access is denied") != std::wstring::npos);
}

void each_try_starts_clean() {
  std::printf("each try starts from an empty result\n");
  int made = 0;
  const CommandResult result = run_with_retries(
      kCommandTries,
      [&made](CommandResult& attempt) {
        ++made;
        // A result carried over would already hold the last try's endpoint.
        CHECK(attempt.endpoints.empty());
        CHECK(attempt.ok);
        attempt.endpoints.push_back({});
        attempt.ok = made == 3;
      },
      [](std::wstring&) { return true; });
  CHECK(result.ok);
  CHECK(result.endpoints.size() == 1);
}

void settling_states() {
  std::printf("only a service part way through a change is still settling\n");
  // SERVICE_STOPPED 1, START_PENDING 2, STOP_PENDING 3, RUNNING 4,
  // CONTINUE_PENDING 5, PAUSE_PENDING 6, PAUSED 7.
  CHECK(!is_service_settling(1));
  CHECK(is_service_settling(2));
  CHECK(is_service_settling(3));
  CHECK(!is_service_settling(4));
  CHECK(is_service_settling(5));
  CHECK(is_service_settling(6));
  CHECK(!is_service_settling(7));
}

}  // namespace

int main() {
  std::printf("fluideq engine command retries\n");
  a_command_that_works_runs_once();
  a_command_that_works_the_second_time();
  a_command_that_never_works();
  a_wait_that_fails_ends_the_tries();
  each_try_starts_clean();
  settling_states();
  if (g_failures == 0) {
    std::printf("\nall checks passed\n");
    return 0;
  }
  std::printf("\n%d check(s) failed\n", g_failures);
  return 1;
}

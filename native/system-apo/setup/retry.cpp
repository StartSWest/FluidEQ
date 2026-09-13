/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#include "retry.h"

namespace fluideq_engine::setup {

namespace {

// The service control manager's pending states, spelled out here so this file
// needs no Windows header: SERVICE_START_PENDING, SERVICE_STOP_PENDING,
// SERVICE_CONTINUE_PENDING and SERVICE_PAUSE_PENDING.
constexpr unsigned long kStartPending = 2;
constexpr unsigned long kStopPending = 3;
constexpr unsigned long kContinuePending = 5;
constexpr unsigned long kPausePending = 6;

}  // namespace

CommandResult run_with_retries(
    int tries, const std::function<void(CommandResult&)>& attempt,
    const std::function<bool(std::wstring&)>& settle) {
  const int limit = tries < 1 ? 1 : tries;
  CommandResult result;
  for (int made = 1;; ++made) {
    result = CommandResult{};
    attempt(result);
    if (result.ok) {
      return result;
    }
    if (made == limit) {
      if (limit > 1) {
        result.error = L"failed " + std::to_wstring(limit) +
                       L" times; the last time: " + result.error;
      }
      return result;
    }
    std::wstring why;
    if (!settle(why)) {
      result.error += L"; not tried again, because Windows audio could not be "
                      L"waited for: " +
                      why;
      return result;
    }
  }
}

bool is_service_settling(unsigned long state) noexcept {
  return state == kStartPending || state == kStopPending ||
         state == kContinuePending || state == kPausePending;
}

}  // namespace fluideq_engine::setup

/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * `suspend-mic-effects` and `restore-mic-effects` (`own_effects.h`): a
 * microphone's own effects taken off, recorded first, and put back exactly.
 * Apart from `commands.cpp` so neither grows past what one can read.
 */

#include <algorithm>
#include <optional>
#include <string>
#include <vector>

#include "backup.h"
#include "com_paths.h"
#include "commands.h"
#include "endpoints.h"
#include "own_effects.h"
#include "registry.h"

namespace fluideq_engine::setup {

namespace {

/** Only a microphone: an output's effects are its own business. */
bool is_microphone(const std::wstring& guid, std::wstring& error) {
  std::vector<Endpoint> microphones;
  if (!list_capture_endpoints(microphones, error)) {
    return false;
  }
  const bool found = std::any_of(
      microphones.begin(), microphones.end(),
      [&guid](const Endpoint& each) { return equal_ci(each.guid, guid); });
  if (!found) {
    error = guid + L" is not a microphone";
  }
  return found;
}

/**
 * One microphone's own effects off. Recorded before anything is written, so
 * a run that dies between the two leaves a mic whose effects can still be
 * put back.
 */
bool suspend_one(const std::wstring& guid, std::wstring& error) {
  if (!is_microphone(guid, error)) {
    return false;
  }
  FxValues before;
  if (!read_fx_values(guid, before, error)) {
    return false;
  }
  const FxPlan plan = plan_suspend_others(before, kEngineClsid);
  if (!plan.changed) {
    // Nothing but the FluidEQ Engine runs here: nothing is written, and
    // nothing recorded that a restore would later "put back".
    return true;
  }
  if (!save_mic_own_off_once(guid, before, error)) {
    return false;
  }
  return write_fx_values(guid, before, plan.after, error);
}

}  // namespace

bool restore_mic_own_one(const std::wstring& guid, std::wstring& error) {
  const std::optional<FxValues> saved = load_mic_own_off(guid);
  if (!saved.has_value()) {
    return true;
  }
  FxValues current;
  if (!read_fx_values(guid, current, error)) {
    return false;
  }
  // The record written back, the FluidEQ Engine kept wherever it is now.
  const FxPlan plan = plan_restore_own(current, *saved, kEngineClsid);
  if (plan.changed && !write_fx_values(guid, current, plan.after, error)) {
    return false;
  }
  // Only once it is back: a record kept after a failed write is the next
  // attempt's chance at it.
  remove_mic_own_off(guid);
  return true;
}

void suspend_mic_own(const std::vector<std::wstring>& guids,
                     CommandResult& result) {
  for (const std::wstring& guid : guids) {
    EndpointResult one;
    one.guid = guid;
    one.attached = true;
    if (!suspend_one(guid, one.error)) {
      if (one.error.empty()) {
        one.error = L"the microphone's own effects could not be taken off";
      }
      result.ok = false;
      result.error = one.error;
    }
    result.endpoints.push_back(one);
  }
}

void restore_mic_own(const std::vector<std::wstring>& guids,
                     CommandResult& result) {
  for (const std::wstring& guid : guids) {
    EndpointResult one;
    one.guid = guid;
    one.attached = true;
    if (!restore_mic_own_one(guid, one.error)) {
      if (one.error.empty()) {
        one.error = L"the microphone's own effects could not be put back";
      }
      result.ok = false;
      result.error = one.error;
    }
    result.endpoints.push_back(one);
  }
}

void restore_mic_own_all(CommandResult& result) {
  restore_mic_own(mic_own_off_endpoints(), result);
}

}  // namespace fluideq_engine::setup

/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#include "fx_modes.h"

#include <optional>
#include <string>
#include <vector>

namespace fluideq_engine::setup {

const wchar_t kRawProcessingMode[] = L"{9E90EA20-B493-4FD1-A1A8-7E1361A956CF}";

namespace {

bool lists_mode(const std::vector<std::wstring>& modes,
                std::wstring_view mode) {
  for (const std::wstring& entry : modes) {
    if (equal_ci(entry, mode)) {
      return true;
    }
  }
  return false;
}

/** The `modes[]` index of a list or single slot; none for the pre-8.1 pair. */
std::optional<int> modes_index_of(Slot slot) {
  switch (slot) {
    case Slot::Sfx:
    case Slot::SfxSingle:
      return kSfx;
    case Slot::Mfx:
    case Slot::MfxSingle:
      return kMfx;
    case Slot::Efx:
    case Slot::EfxSingle:
      return kEfx;
    default:
      return std::nullopt;
  }
}

/** Where `clsid`'s slot keeps its modes, wherever it sits in one that has. */
std::optional<int> modes_index_of(const FxValues& values,
                                  std::wstring_view clsid) {
  const std::optional<Slot> slot = slot_of(values, clsid);
  return slot.has_value() ? modes_index_of(*slot) : std::nullopt;
}

}  // namespace

std::vector<std::wstring> modes_for_empty_slot(const FxValues& values, int at) {
  std::vector<std::wstring> modes{std::wstring(kDefaultProcessingMode)};
  if (at == kEfx) {
    return modes;
  }
  // The other per-stream slot only: the endpoint effect's value can hold
  // DEFAULT and nothing else, so it has nothing to add.
  const int other = at == kSfx ? kMfx : kSfx;
  if (!values.modes[other].has_value()) {
    return modes;
  }
  for (const std::wstring& mode : *values.modes[other]) {
    if (!mode.empty() && !equal_ci(mode, kRawProcessingMode) &&
        !lists_mode(modes, mode)) {
      modes.push_back(mode);
    }
  }
  return modes;
}

bool mode_missing(const FxValues& values, std::wstring_view clsid) {
  const std::optional<int> at = modes_index_of(values, clsid);
  return at.has_value() && !values.modes[*at].has_value();
}

FxPlan plan_mode_in_place(const FxValues& before, std::wstring_view clsid) {
  FxPlan plan;
  plan.after = before;
  const std::optional<int> at = modes_index_of(before, clsid);
  if (at.has_value() && !before.modes[*at].has_value()) {
    plan.after.modes[*at] = modes_for_empty_slot(before, *at);
  }
  plan.changed = plan.after != before;
  return plan;
}

}  // namespace fluideq_engine::setup

/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#include "capture_slots.h"

#include <optional>
#include <string>

namespace fluideq_engine::setup {

namespace {

/** Nothing registered there, or only Windows' own default effect. */
bool takeable(const std::optional<std::wstring>& value) {
  return !value.has_value() || value->empty() ||
         is_windows_default_apo(*value);
}

}  // namespace

bool slot_exists_on_capture(Slot slot) { return slot != Slot::Gfx; }

Slot default_capture_slot_for(const FxValues& original, bool combined) {
  if (is_legacy_only(original) && takeable(original.legacy[kLfx])) {
    return Slot::Lfx;
  }
  if (is_single_only(original)) {
    const Slot ones[] = {Slot::EfxSingle, Slot::MfxSingle, Slot::SfxSingle};
    const int indexes[] = {kEfx, kMfx, kSfx};
    for (int at = 0; at < 3; ++at) {
      if (takeable(original.single[indexes[at]])) {
        return ones[at];
      }
    }
  }
  return combined ? Slot::Mfx : Slot::Efx;
}

}  // namespace fluideq_engine::setup

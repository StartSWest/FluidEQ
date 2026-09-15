/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#include "slot_report.h"

#include <optional>
#include <string>
#include <vector>

#include "json.h"

namespace fluideq_engine::setup {

namespace {

const wchar_t* const kSlotNames[kSlotCount] = {L"sfx", L"mfx", L"efx"};
const wchar_t* const kLegacyNames[kLegacyCount] = {L"lfx", L"gfx"};

void append_effect(std::wstring& out, bool& first, const wchar_t* slot,
                   const wchar_t* from, const std::wstring& clsid,
                   const NameLookup& name) {
  if (!first) {
    out += L',';
  }
  first = false;
  out += L"{\"slot\":\"";
  out += slot;
  out += L"\",\"from\":\"";
  out += from;
  out += L"\",\"clsid\":\"";
  out += json_escape(clsid);
  out += L"\",\"name\":\"";
  out += json_escape(name ? name(clsid) : std::wstring());
  out += L"\"}";
}

}  // namespace

std::wstring describe_slots(const FxValues& values, const NameLookup& name) {
  std::wstring out = L"\"effects\":[";
  bool first = true;
  int empty = 0;
  for (int slot = 0; slot < kSlotCount; ++slot) {
    bool held = false;
    if (values.composite[slot].has_value()) {
      for (const std::wstring& clsid : *values.composite[slot]) {
        if (clsid.empty()) {
          continue;
        }
        held = true;
        append_effect(out, first, kSlotNames[slot], L"list", clsid, name);
      }
    }
    if (values.single[slot].has_value() && !values.single[slot]->empty()) {
      held = true;
      append_effect(out, first, kSlotNames[slot], L"single",
                    *values.single[slot], name);
    }
    if (!held) {
      ++empty;
    }
  }
  for (int at = 0; at < kLegacyCount; ++at) {
    if (values.legacy[at].has_value() && !values.legacy[at]->empty()) {
      append_effect(out, first, kLegacyNames[at], L"legacy",
                    *values.legacy[at], name);
    }
  }
  out += L"],\"emptySlots\":";
  out += std::to_wstring(empty);
  return out;
}

}  // namespace fluideq_engine::setup

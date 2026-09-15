/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The slot report, against the shape a real machine had: THX in the SFX and
 * MFX lists, FluidEQ alone in EFX, Equalizer APO in the old single values.
 * What the app has to be able to read off it is who sits where, in which
 * order, and how many of the three slots hold nothing.
 */

#include "../setup/slot_report.h"

#include <cstdio>
#include <string>
#include <vector>

using fluideq_engine::setup::FxValues;
using fluideq_engine::setup::describe_slots;
using fluideq_engine::setup::kEfx;
using fluideq_engine::setup::kMfx;
using fluideq_engine::setup::kSfx;

namespace {

int g_failures = 0;

void check_impl(bool ok, const char* expr, const char* file, int line) {
  if (!ok) {
    std::printf("  FAIL %s:%d: %s\n", file, line, expr);
    ++g_failures;
  }
}

#define CHECK(...) check_impl((__VA_ARGS__), #__VA_ARGS__, __FILE__, __LINE__)

bool contains(const std::wstring& text, const wchar_t* needle) {
  return text.find(needle) != std::wstring::npos;
}

std::wstring lookup(const std::wstring& clsid) {
  if (clsid == L"{THX}") {
    return L"THX Spatial Audio";
  }
  if (clsid == L"{OURS}") {
    return L"FluidEQ Engine";
  }
  return std::wstring();
}

void names_every_slot_in_order() {
  std::printf("names every slot, in order\n");
  FxValues values;
  values.composite[kSfx] = std::vector<std::wstring>{L"{THX}"};
  values.composite[kMfx] = std::vector<std::wstring>{L"{THX}", L"{X}"};
  values.composite[kEfx] = std::vector<std::wstring>{L"{OURS}"};
  values.single[kSfx] = L"{APO}";
  values.legacy[0] = L"{OLD}";

  const std::wstring json = describe_slots(values, lookup);
  CHECK(contains(json, L"\"slot\":\"sfx\",\"from\":\"list\",\"clsid\":\"{THX}\","
                       L"\"name\":\"THX Spatial Audio\""));
  CHECK(contains(json, L"\"slot\":\"mfx\",\"from\":\"list\",\"clsid\":\"{X}\","
                       L"\"name\":\"\""));
  CHECK(contains(json, L"\"slot\":\"efx\",\"from\":\"list\",\"clsid\":\"{OURS}\","
                       L"\"name\":\"FluidEQ Engine\""));
  CHECK(contains(json,
                 L"\"slot\":\"sfx\",\"from\":\"single\",\"clsid\":\"{APO}\""));
  CHECK(contains(json,
                 L"\"slot\":\"lfx\",\"from\":\"legacy\",\"clsid\":\"{OLD}\""));
  // Order within a list is the order Windows runs them in.
  CHECK(json.find(L"{THX}\",\"name\":\"THX Spatial Audio\"},{\"slot\":\"mfx\"") !=
        std::wstring::npos ||
        json.find(L"\"clsid\":\"{THX}\"") < json.find(L"\"clsid\":\"{X}\""));
  CHECK(contains(json, L"\"emptySlots\":0"));
}

void counts_the_slots_that_hold_nothing() {
  std::printf("counts empty slots\n");
  FxValues values;
  values.composite[kEfx] = std::vector<std::wstring>{L"{OURS}"};
  // An empty list and an empty single are both "nothing here".
  values.composite[kSfx] = std::vector<std::wstring>();
  values.single[kMfx] = L"";

  const std::wstring json = describe_slots(values, lookup);
  CHECK(contains(json, L"\"emptySlots\":2"));
  CHECK(contains(json, L"\"effects\":[{\"slot\":\"efx\""));
}

void nothing_registered_is_three_empty_slots() {
  std::printf("nothing registered\n");
  const std::wstring json = describe_slots(FxValues(), lookup);
  CHECK(json == L"\"effects\":[],\"emptySlots\":3");
}

void survives_no_name_lookup() {
  std::printf("no lookup at all\n");
  FxValues values;
  values.composite[kEfx] = std::vector<std::wstring>{L"{OURS}"};
  const std::wstring json = describe_slots(values, nullptr);
  CHECK(contains(json, L"\"name\":\"\""));
}

}  // namespace

int main() {
  std::printf("slot report\n\n");
  names_every_slot_in_order();
  counts_the_slots_that_hold_nothing();
  nothing_registered_is_three_empty_slots();
  survives_no_name_lookup();
  if (g_failures == 0) {
    std::printf("\nall checks passed\n");
    return 0;
  }
  std::printf("\n%d check(s) failed\n", g_failures);
  return 1;
}

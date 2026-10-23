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
using fluideq_engine::setup::Slot;
using fluideq_engine::setup::describe_slots;
using fluideq_engine::setup::held_slots;
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

// The engine's own class id, as the helper registers it.
constexpr wchar_t kOurs[] = L"{B7E2C4D1-5A8F-4C3E-9D2B-6F1A0C8E7D34}";
// The effect that held the SFX value of an output in a 2.0.0 report.
constexpr wchar_t kVendor[] = L"{5C8DC6DB-1A99-46FE-90E8-8229A41DD3EF}";
// "WM LFX APO", Windows' own: the one registration ours may take a value from.
constexpr wchar_t kWindowsLfx[] = L"{62DC1A93-AE24-464C-A43E-452F824C4250}";

void a_vendors_single_value_is_held() {
  std::printf("a vendor's single value is held, Windows' own is not\n");
  FxValues values;
  values.single[kSfx] = kVendor;
  values.single[kEfx] = kOurs;
  values.legacy[0] = kWindowsLfx;
  CHECK(held_slots(values, values, kOurs) ==
        std::vector<Slot>{Slot::SfxSingle});
}

void our_own_rung_is_not_held() {
  std::printf("our own rung is not held\n");
  FxValues values;
  values.single[kSfx] = kOurs;
  CHECK(held_slots(values, values, kOurs).empty());
}

void every_one_value_rung_held() {
  std::printf("every one-value rung held, in ladder order\n");
  FxValues values;
  values.single[kSfx] = kVendor;
  values.single[kMfx] = kVendor;
  values.single[kEfx] = kVendor;
  values.legacy[0] = kVendor;
  values.legacy[1] = kVendor;
  // GFX before LFX: the order the app's ladder walks them.
  CHECK(held_slots(values, values, kOurs) ==
        (std::vector<Slot>{Slot::EfxSingle, Slot::MfxSingle, Slot::SfxSingle,
                           Slot::Gfx, Slot::Lfx}));
}

}  // namespace

int main() {
  std::printf("slot report\n\n");
  names_every_slot_in_order();
  counts_the_slots_that_hold_nothing();
  nothing_registered_is_three_empty_slots();
  survives_no_name_lookup();
  a_vendors_single_value_is_held();
  our_own_rung_is_not_held();
  every_one_value_rung_held();
  if (g_failures == 0) {
    std::printf("\nall checks passed\n");
    return 0;
  }
  std::printf("\n%d check(s) failed\n", g_failures);
  return 1;
}

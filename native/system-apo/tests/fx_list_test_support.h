/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/** What the effect-list tests are written in: the list edit's names, CHECK, the published class ids, and a whole-structure comparison that prints both sides. */
#ifndef FLUIDEQ_FX_LIST_TEST_SUPPORT_H
#define FLUIDEQ_FX_LIST_TEST_SUPPORT_H

#include "../setup/fx_list.h"
#include <cstdio>
#include <optional>
#include <string>
#include <vector>

namespace feq_fx_list_test {

using fluideq_engine::setup::FxPlan;
using fluideq_engine::setup::FxValues;
using fluideq_engine::setup::Slot;
using fluideq_engine::setup::from_json;
using fluideq_engine::setup::default_slot_for;
using fluideq_engine::setup::is_attached;
using fluideq_engine::setup::is_legacy_only;
using fluideq_engine::setup::is_single_only;
using fluideq_engine::setup::kDefaultProcessingMode;
using fluideq_engine::setup::kEfx;
using fluideq_engine::setup::kGfx;
using fluideq_engine::setup::kLfx;
using fluideq_engine::setup::kMfx;
using fluideq_engine::setup::kSfx;
using fluideq_engine::setup::plan_attach;
using fluideq_engine::setup::plan_detach;
using fluideq_engine::setup::plan_move;
using fluideq_engine::setup::plan_restore_apo;
using fluideq_engine::setup::plan_suspend_apo;
using fluideq_engine::setup::slot_of;
using fluideq_engine::setup::to_json;

inline int g_failures = 0;

inline void check_impl(bool ok, const char* expr, const char* file, int line) {
  if (!ok) {
    std::printf("  FAIL %s:%d: %s\n", file, line, expr);
    ++g_failures;
  }
}

// Variadic so that a brace-init-list argument, whose commas the preprocessor
// would otherwise split on, arrives as one expression.
#define CHECK(...) check_impl((__VA_ARGS__), #__VA_ARGS__, __FILE__, __LINE__)

// The class id the helper writes, spelled out rather than included from the
// effect's own header: this is the published contract, and a test that took
// it from the source it checks would follow the value if it ever moved.
constexpr wchar_t kOurs[] = L"{B7E2C4D1-5A8F-4C3E-9D2B-6F1A0C8E7D34}";
// The same id as Windows itself writes it — vendors and the audio stack use
// mixed case in these values, so the match has to be case-insensitive.
constexpr wchar_t kOursLower[] = L"{b7e2c4d1-5a8f-4c3e-9d2b-6f1a0c8e7d34}";
// Stand-ins for whatever the machine's own driver registered.
constexpr wchar_t kVendorSfx[] = L"{62DC1A93-CE3E-4B2C-9B3B-9F1B0E2A0001}";
constexpr wchar_t kVendorMfx[] = L"{62DC1A93-CE3E-4B2C-9B3B-9F1B0E2A0002}";
constexpr wchar_t kVendorEfx[] = L"{62DC1A93-CE3E-4B2C-9B3B-9F1B0E2A0003}";
constexpr wchar_t kLegacyLfx[] = L"{62DC1A93-CE3E-4B2C-9B3B-9F1B0E2A0004}";
constexpr wchar_t kLegacyGfx[] = L"{62DC1A93-CE3E-4B2C-9B3B-9F1B0E2A0005}";
// A processing mode that is not DEFAULT — RAW, MOVIE and COMMUNICATIONS are
// all real, and a vendor that named one of them meant it.
constexpr wchar_t kVendorMode[] = L"{9CF2A70B-F377-403B-BD6B-360863E0355C}";
// Equalizer APO's own, as its Device Selector writes it. Spelled out here for
// the same reason ours is: it is the published contract with another program,
// and a test that read it from the source it checks would prove nothing.
constexpr wchar_t kApoMfx[] = L"{EACD2258-FCAC-4FF4-B36D-419E924A6D79}";
constexpr wchar_t kApoEfx[] = L"{EC1CC9CE-FAED-4822-828A-82A81A6F018F}";
// Windows' own inbox effects, as it registers them (the published contract
// again; a test reading them from the source proves nothing). Two pairs, and
// knowing only the first is what refused the engine a slot Windows itself
// was sitting in: all four are named "WM LFX APO" or "WM GFX APO" and all
// four are served by WMALFXGFXDSP.dll, and which pair an endpoint carries
// varies by machine.
constexpr wchar_t kWindowsLfx[] = L"{62dc1a93-ae24-464c-a43e-452f824c4250}";
constexpr wchar_t kWindowsGfx[] = L"{637C490D-EEE3-4C0A-973F-371958802DA2}";
constexpr wchar_t kWindowsLfx2[] = L"{C9453E73-8C5C-4463-9984-AF8BAB2F5447}";
constexpr wchar_t kWindowsGfx2[] = L"{13ab3ebd-137e-4903-9d89-60be8277fd17}";

inline std::vector<std::wstring> list(std::initializer_list<const wchar_t*> items) {
  std::vector<std::wstring> result;
  for (const wchar_t* item : items) {
    result.emplace_back(item);
  }
  return result;
}

/** The whole structure, printed the way a failing case needs to be read. */
inline void describe(const char* label, const FxValues& values) {
  std::printf("  %s:\n", label);
  for (int slot = 0; slot < fluideq_engine::setup::kSlotCount; ++slot) {
    std::printf("    single[%d]=%ls composite[%d]=", slot,
                values.single[slot] ? values.single[slot]->c_str()
                                    : L"(absent)",
                slot);
    if (!values.composite[slot]) {
      std::printf("(absent)");
    } else {
      for (const std::wstring& entry : *values.composite[slot]) {
        std::printf("%ls ", entry.c_str());
      }
    }
    std::printf(" wasSz[%d]=%s modes[%d]=", slot,
                values.composite_was_sz[slot] ? "yes" : "no", slot);
    if (!values.modes[slot]) {
      std::printf("(absent)\n");
    } else {
      for (const std::wstring& entry : *values.modes[slot]) {
        std::printf("%ls ", entry.c_str());
      }
      std::printf("\n");
    }
  }
  for (int slot = 0; slot < fluideq_engine::setup::kLegacyCount; ++slot) {
    std::printf("    legacy[%d]=%ls\n", slot,
                values.legacy[slot] ? values.legacy[slot]->c_str()
                                    : L"(absent)");
  }
}

inline void expect_values(const FxValues& actual, const FxValues& expected,
                   const char* label) {
  if (actual == expected) {
    return;
  }
  std::printf("  FAIL %s: values differ\n", label);
  describe("expected", expected);
  describe("actual", actual);
  ++g_failures;
}

}  // namespace feq_fx_list_test

#endif  // FLUIDEQ_FX_LIST_TEST_SUPPORT_H

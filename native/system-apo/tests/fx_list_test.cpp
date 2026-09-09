/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The list edit, against the endpoint shapes that actually exist.
 *
 * Every fixture here is a shape a real machine hands the helper: a Realtek
 * output that already carries composite lists, an output Equalizer APO has
 * taken over with singles only, and an output still registered the way
 * Windows 7 did it. The registry is nowhere in this file — the decision is
 * pure, so the failure mode that matters (a vendor's effect dropped out of a
 * list nobody looked at afterwards) is caught here rather than on somebody's
 * speakers.
 *
 * Each case asserts the WHOLE resulting structure rather than the one field
 * it is about. An edit that appends correctly and quietly drops pid 5 passes
 * every check that only looks at pid 15.
 */

#include "../setup/fx_list.h"

#include <cstdio>
#include <optional>
#include <string>
#include <vector>

using fluideq_engine::setup::FxPlan;
using fluideq_engine::setup::FxValues;
using fluideq_engine::setup::Slot;
using fluideq_engine::setup::from_json;
using fluideq_engine::setup::is_attached;
using fluideq_engine::setup::kDefaultProcessingMode;
using fluideq_engine::setup::kEfx;
using fluideq_engine::setup::kMfx;
using fluideq_engine::setup::kSfx;
using fluideq_engine::setup::plan_attach;
using fluideq_engine::setup::plan_detach;
using fluideq_engine::setup::to_json;

namespace {

int g_failures = 0;

void check_impl(bool ok, const char* expr, const char* file, int line) {
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

std::vector<std::wstring> list(std::initializer_list<const wchar_t*> items) {
  std::vector<std::wstring> result;
  for (const wchar_t* item : items) {
    result.emplace_back(item);
  }
  return result;
}

/** The whole structure, printed the way a failing case needs to be read. */
void describe(const char* label, const FxValues& values) {
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
    std::printf(" modes[%d]=", slot);
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

void expect_values(const FxValues& actual, const FxValues& expected,
                   const char* label) {
  if (actual == expected) {
    return;
  }
  std::printf("  FAIL %s: values differ\n", label);
  describe("expected", expected);
  describe("actual", actual);
  ++g_failures;
}

// ---------------------------------------------------------------------------

/**
 * This machine's Realtek output: all three composite lists already written,
 * the singles gone, and a mode list beside the EFX one.
 *
 * The whole of the expected result is "pid 15 grew by one entry at the end".
 * Anything else the edit touches here is a change to a driver's registration
 * that nobody asked for.
 */
void modern_with_composites() {
  std::printf("modern with composites\n");
  FxValues before;
  before.composite[kSfx] = list({kVendorSfx});
  before.composite[kMfx] = list({kVendorMfx});
  before.composite[kEfx] = list({kVendorEfx});
  before.modes[kEfx] = list({kDefaultProcessingMode});

  FxValues expected = before;
  expected.composite[kEfx] = list({kVendorEfx, kOurs});

  const FxPlan plan = plan_attach(before, kOurs, Slot::Efx);
  CHECK(plan.changed);
  expect_values(plan.after, expected, "modern_with_composites");
}

/**
 * Equalizer APO's shape: it registers itself as a single, so the lists have
 * to be created and its class id carried into them first.
 *
 * Getting this wrong is the loud failure — a composite list that exists but
 * does not name E-APO turns its whole configuration off, on a machine whose
 * owner installed FluidEQ expecting the opposite.
 */
void modern_singles_only() {
  std::printf("modern singles only\n");
  FxValues before;
  before.single[kSfx] = kVendorSfx;
  before.single[kMfx] = kVendorMfx;

  FxValues expected;
  expected.single[kSfx] = kVendorSfx;
  expected.single[kMfx] = kVendorMfx;
  expected.composite[kSfx] = list({kVendorSfx});
  expected.composite[kMfx] = list({kVendorMfx});
  expected.composite[kEfx] = list({kOurs});
  expected.modes[kEfx] = list({kDefaultProcessingMode});

  const FxPlan plan = plan_attach(before, kOurs, Slot::Efx);
  CHECK(plan.changed);
  expect_values(plan.after, expected, "modern_singles_only");
}

/** Pre-8.1 registration: LFX and GFX, mirrored forward and left in place. */
void legacy_only() {
  std::printf("legacy only\n");
  FxValues before;
  before.legacy[0] = kLegacyLfx;
  before.legacy[1] = kLegacyGfx;

  FxValues expected;
  expected.legacy[0] = kLegacyLfx;
  expected.legacy[1] = kLegacyGfx;
  expected.composite[kSfx] = list({kLegacyLfx});
  expected.composite[kMfx] = list({kLegacyGfx});
  expected.composite[kEfx] = list({kOurs});
  expected.modes[kEfx] = list({kDefaultProcessingMode});

  const FxPlan plan = plan_attach(before, kOurs, Slot::Efx);
  CHECK(plan.changed);
  expect_values(plan.after, expected, "legacy_only");
}

/**
 * Attaching twice writes nothing the second time.
 *
 * `changed` is what stops the helper rewriting a driver's key on every launch
 * of the app, and a registry write to an endpoint is not free: the audio
 * stack notices it.
 */
void already_attached() {
  std::printf("already attached\n");
  FxValues before;
  before.composite[kEfx] = list({kVendorEfx, kOurs});
  before.modes[kEfx] = list({kDefaultProcessingMode});

  const FxPlan plan = plan_attach(before, kOurs, Slot::Efx);
  CHECK(!plan.changed);
  expect_values(plan.after, before, "already_attached");
  CHECK(is_attached(before, kOurs));
}

/** `--slot mfx`: pid 14 and the mode list beside it, nothing else moves. */
void mfx_slot() {
  std::printf("mfx slot\n");
  FxValues before;
  before.composite[kMfx] = list({kVendorMfx});
  before.composite[kEfx] = list({kVendorEfx});
  before.modes[kEfx] = list({kDefaultProcessingMode});

  FxValues expected = before;
  expected.composite[kMfx] = list({kVendorMfx, kOurs});
  expected.modes[kMfx] = list({kDefaultProcessingMode});

  const FxPlan plan = plan_attach(before, kOurs, Slot::Mfx);
  CHECK(plan.changed);
  expect_values(plan.after, expected, "mfx_slot");
}

/**
 * Detach deletes exactly the two keys the attach created, and nothing else.
 *
 * The mirrored lists stay: they only repeat what the vendor had already
 * registered in pid 5 and pid 6, and Windows now reads them instead. Deleting
 * them would take the driver's own effects off the endpoint.
 */
void detach_restores_created_keys() {
  std::printf("detach restores created keys\n");
  FxValues backup;
  backup.single[kSfx] = kVendorSfx;
  backup.single[kMfx] = kVendorMfx;

  const FxValues attached = plan_attach(backup, kOurs, Slot::Efx).after;

  FxValues expected;
  expected.single[kSfx] = kVendorSfx;
  expected.single[kMfx] = kVendorMfx;
  expected.composite[kSfx] = list({kVendorSfx});
  expected.composite[kMfx] = list({kVendorMfx});

  const FxPlan plan = plan_detach(attached, backup, kOurs);
  CHECK(plan.changed);
  expect_values(plan.after, expected, "detach_restores_created_keys");
  CHECK(!is_attached(plan.after, kOurs));
}

/** A list somebody else also writes into keeps its other entries and itself. */
void detach_keeps_others_in_list() {
  std::printf("detach keeps others in list\n");
  FxValues backup;
  backup.composite[kEfx] = list({kVendorEfx});
  backup.modes[kEfx] = list({kDefaultProcessingMode});

  FxValues current = backup;
  current.composite[kEfx] = list({kVendorEfx, kOurs});

  const FxPlan plan = plan_detach(current, backup, kOurs);
  CHECK(plan.changed);
  expect_values(plan.after, backup, "detach_keeps_others_in_list");
}

/**
 * The stack writes these class ids in whatever case it likes.
 *
 * A case-sensitive match attaches a second copy of the effect on every run
 * and never finds the first one again to remove it.
 */
void case_insensitive_match() {
  std::printf("case insensitive match\n");
  FxValues before;
  before.composite[kEfx] = list({kOursLower});
  before.modes[kEfx] = list({kDefaultProcessingMode});

  CHECK(is_attached(before, kOurs));
  const FxPlan attach = plan_attach(before, kOurs, Slot::Efx);
  CHECK(!attach.changed);
  expect_values(attach.after, before, "case_insensitive_match attach");

  const FxValues backup;
  const FxPlan detach = plan_detach(before, backup, kOurs);
  CHECK(detach.changed);
  expect_values(detach.after, FxValues(), "case_insensitive_match detach");
}

/**
 * A backup survives being written and read again, escaping included.
 *
 * The strings in these values come out of somebody else's registry key and
 * are not guaranteed to be class ids at all. A quote or a backslash written
 * straight into the file produces a backup that cannot be read back, which is
 * only discovered at uninstall time when it is the one thing that could have
 * put the endpoint back.
 */
void json_round_trip() {
  std::printf("json round trip\n");
  FxValues values;
  values.single[kSfx] = L"quote \" and backslash \\ and newline \n";
  values.composite[kEfx] = list({kVendorEfx, kOurs});
  values.legacy[1] = L"{62DC1A93-CE3E-4B2C-9B3B-9F1B0E2A0005}";
  values.modes[kMfx] = list({kDefaultProcessingMode});

  const std::wstring text = to_json(values);
  CHECK(text.find(L"\\\"") != std::wstring::npos);
  CHECK(text.find(L"\\\\") != std::wstring::npos);
  CHECK(text.find(L"\\n") != std::wstring::npos);
  CHECK(text.find(L'\n') == std::wstring::npos);

  const std::optional<FxValues> parsed = from_json(text);
  CHECK(parsed.has_value());
  if (parsed.has_value()) {
    expect_values(*parsed, values, "json_round_trip");
  }

  // An empty structure is a legitimate backup: an endpoint with no effect
  // registration at all is what a USB headset looks like.
  const std::optional<FxValues> empty = from_json(to_json(FxValues()));
  CHECK(empty.has_value());
  if (empty.has_value()) {
    expect_values(*empty, FxValues(), "json_round_trip empty");
  }

  CHECK(!from_json(L"").has_value());
  CHECK(!from_json(L"not json at all").has_value());
  CHECK(!from_json(L"{\"single\":[null,null]}").has_value());
  CHECK(!from_json(L"{\"single\":[null,null,null]").has_value());
}

}  // namespace

int main() {
  std::printf("fx list\n\n");
  modern_with_composites();
  modern_singles_only();
  legacy_only();
  already_attached();
  mfx_slot();
  detach_restores_created_keys();
  detach_keeps_others_in_list();
  case_insensitive_match();
  json_round_trip();

  if (g_failures == 0) {
    std::printf("\nall checks passed\n");
    return 0;
  }
  std::printf("\n%d check(s) failed\n", g_failures);
  return 1;
}

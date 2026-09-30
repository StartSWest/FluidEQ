/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The list edit beside Equalizer APO, against the endpoint shapes that
 * actually exist: its entries taken out of every list and single value and
 * put back exactly, a vendor's never touched, class ids matched whatever
 * their case, and the saved state's JSON read back as it was written.
 *
 * Attaching, moving and detaching the FluidEQ Engine is fx_list_test.cpp;
 * both share fx_list_test_support.h.
 */
#include "../setup/fx_list.h"
#include <cstdio>
#include <optional>
#include <string>
#include <vector>
#include "fx_list_test_support.h"

using namespace feq_fx_list_test;

namespace {

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
  // The value type travels with the value. A backup that records the entries
  // and forgets that pid 14 was a single string cannot put the endpoint back
  // the way it was found, and nothing would ever notice.
  values.composite_was_sz[kMfx] = true;

  const std::wstring text = to_json(values);
  CHECK(text.find(L"\\\"") != std::wstring::npos);
  CHECK(text.find(L"\\\\") != std::wstring::npos);
  CHECK(text.find(L"\\n") != std::wstring::npos);
  CHECK(text.find(L'\n') == std::wstring::npos);

  CHECK(text.find(L"\"compositeWasSz\":[false,true,false]") !=
        std::wstring::npos);

  const std::optional<FxValues> parsed = from_json(text);
  CHECK(parsed.has_value());
  if (parsed.has_value()) {
    expect_values(*parsed, values, "json_round_trip");
    CHECK(parsed->composite_was_sz[kMfx]);
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
  // A document that is otherwise ours but says nothing about the value types
  // is refused rather than assumed to mean "all three were lists". Assuming
  // is how a `REG_SZ` never comes back.
  CHECK(!from_json(L"{\"single\":[null,null,null],\"composite\":"
                   L"[null,null,null],\"legacy\":[null,null],\"modes\":"
                   L"[null,null,null]}")
             .has_value());
  CHECK(!from_json(L"{\"single\":[null,null,null],\"composite\":"
                   L"[null,null,null],\"compositeWasSz\":[false,0,false],"
                   L"\"legacy\":[null,null],\"modes\":[null,null,null]}")
             .has_value());
}

/**
 * Switching to the FluidEQ Engine takes Equalizer APO out of the lists.
 *
 * The case that made this necessary: both engines registered on the same
 * output, APO in MFX and ours in EFX, and which one a stream actually went
 * through depended on its processing mode. Both reported attached, neither
 * reported a fault, and the sound went through the wrong one.
 */
void suspend_removes_apo_and_keeps_everyone_else() {
  std::printf("suspend removes Equalizer APO\n");
  FxValues before;
  before.composite[kMfx] = list({kApoMfx, kVendorMfx});
  before.composite[kEfx] = list({kVendorEfx, kOurs});
  before.modes[kEfx] = list({kDefaultProcessingMode});

  const FxPlan plan = plan_suspend_apo(before);
  CHECK(plan.changed);

  FxValues expected = before;
  expected.composite[kMfx] = list({kVendorMfx});
  expect_values(plan.after, expected, "suspend");
}

/**
 * Equalizer APO registered the old way — one class id in pid 6 and no lists.
 *
 * Removing it means creating the list Windows reads instead, which must carry
 * every other single forward or the machine's own effects go with it.
 */
void suspend_mirrors_singles_before_removing() {
  std::printf("suspend mirrors singles first\n");
  FxValues before;
  before.single[kSfx] = kVendorSfx;
  before.single[kMfx] = kApoMfx;

  const FxPlan plan = plan_suspend_apo(before);
  CHECK(plan.changed);

  FxValues expected = before;
  expected.composite[kSfx] = list({kVendorSfx});
  expected.composite[kMfx] = std::vector<std::wstring>();
  // Out of the old value as well as out of the list mirrored from it: left
  // there, it is what makes the app report Equalizer APO as still on this
  // output. The vendor's own single beside it is mirrored and kept.
  expected.single[kMfx].reset();
  expect_values(plan.after, expected, "suspend from singles");
}

/**
 * The shape Ivan's own machine was in: THX in the composite SFX and MFX
 * lists, FluidEQ alone in EFX, and Equalizer APO in the OLD single values,
 * where its "Install as SFX/MFX" troubleshooting option puts it.
 *
 * Windows ignores those while the lists exist, so removing them changes no
 * sound — but they are what every "is Equalizer APO here" answer is read
 * from, and the vendor's own entries beside them must come out untouched.
 */
void suspend_takes_apo_out_of_the_old_single_values() {
  std::printf("suspend clears the old single values\n");
  FxValues before;
  before.composite[kSfx] = list({kVendorSfx});
  before.composite[kMfx] = list({kVendorMfx});
  before.composite[kEfx] = list({kOurs});
  before.single[kSfx] = kApoMfx;
  before.single[kMfx] = kVendorMfx;
  before.single[kEfx] = kApoEfx;
  before.legacy[0] = kLegacyLfx;

  const FxPlan plan = plan_suspend_apo(before);
  CHECK(plan.changed);

  FxValues expected = before;
  expected.single[kSfx].reset();
  expected.single[kEfx].reset();
  expect_values(plan.after, expected, "single values");
  // The vendor's own single, and its legacy value, exactly as found.
  CHECK(plan.after.single[kMfx].has_value());
  CHECK(plan.after.legacy[0].has_value());
}

/** Everything a machine's own audio vendor registered survives the removal. */
void suspend_never_drops_a_vendor_effect() {
  std::printf("suspend keeps every vendor effect\n");
  FxValues before;
  before.composite[kSfx] = list({kVendorSfx, kApoMfx, kLegacyLfx});
  before.composite[kMfx] = list({kApoEfx, kVendorMfx});
  before.composite[kEfx] = list({kVendorEfx, kOurs});
  before.modes[kSfx] = list({kVendorMode});

  const FxPlan plan = plan_suspend_apo(before);

  FxValues expected = before;
  expected.composite[kSfx] = list({kVendorSfx, kLegacyLfx});
  expected.composite[kMfx] = list({kVendorMfx});
  expect_values(plan.after, expected, "vendor effects");
}

/** An output Equalizer APO was never on is not touched at all. */
void suspend_leaves_an_output_without_apo_alone() {
  std::printf("suspend leaves other outputs alone\n");
  FxValues before;
  before.single[kEfx] = kVendorEfx;
  before.legacy[0] = kLegacyLfx;

  const FxPlan plan = plan_suspend_apo(before);
  CHECK(!plan.changed);
  expect_values(plan.after, before, "untouched");
}

/**
 * Switching back puts Equalizer APO exactly where it was, and leaves the
 * FluidEQ Engine registered — nobody asked for that to come off, and taking
 * it off would need another Windows prompt to put back.
 */
void restore_puts_apo_back_and_keeps_ours() {
  std::printf("restore puts Equalizer APO back\n");
  FxValues saved;
  saved.composite[kMfx] = list({kApoMfx, kVendorMfx});
  saved.composite[kEfx] = list({kVendorEfx});

  FxValues current;
  current.composite[kMfx] = list({kVendorMfx});
  current.composite[kEfx] = list({kVendorEfx, kOurs});
  current.modes[kEfx] = list({kDefaultProcessingMode});

  const FxPlan plan = plan_restore_apo(current, saved, kOurs);
  CHECK(plan.changed);

  FxValues expected = saved;
  expected.composite[kEfx] = list({kVendorEfx, kOurs});
  expected.modes[kEfx] = list({kDefaultProcessingMode});
  expect_values(plan.after, expected, "restore");
}

/** With our own effect gone from the machine, the saved state is the answer. */
void restore_without_our_effect_is_the_saved_state() {
  std::printf("restore without our effect\n");
  FxValues saved;
  saved.single[kMfx] = kApoMfx;

  FxValues current;
  current.composite[kMfx] = std::vector<std::wstring>();

  const FxPlan plan = plan_restore_apo(current, saved, kOurs);
  CHECK(plan.changed);
  expect_values(plan.after, saved, "restore to singles");
}

}  // namespace

int main() {
  std::printf("fx list: Equalizer APO\n\n");
  case_insensitive_match();
  json_round_trip();
  suspend_removes_apo_and_keeps_everyone_else();
  suspend_mirrors_singles_before_removing();
  suspend_takes_apo_out_of_the_old_single_values();
  suspend_never_drops_a_vendor_effect();
  suspend_leaves_an_output_without_apo_alone();
  restore_puts_apo_back_and_keeps_ours();
  restore_without_our_effect_is_the_saved_state();

  if (g_failures == 0) {
    std::printf("\nall checks passed\n");
    return 0;
  }
  std::printf("\n%d check(s) failed\n", g_failures);
  return 1;
}

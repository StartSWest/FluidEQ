/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * A microphone's own effects taken off and put back (`own_effects.h`),
 * against the shapes real mics have: a Razer Kraken's mic (THX beside the
 * FluidEQ Engine in the endpoint list, 2026-11-24), a laptop's Realtek array
 * (a mode effect and an endpoint effect), a mic registered in its single
 * values only, one with nothing but ours, and the engine moved since. In
 * every one the vendor's single and pre-8.1 values come out untouched —
 * `write_fx_values` refuses any change to them — and the restore gives back
 * exactly what was recorded, ours kept.
 */
#include "../setup/own_effects.h"

#include <cstdio>
#include <string>
#include <vector>

#include "fx_list_test_support.h"

using namespace feq_fx_list_test;
using fluideq_engine::setup::EffectKind;
using fluideq_engine::setup::RunningEffect;
using fluideq_engine::setup::effects_run;
using fluideq_engine::setup::effects_running;
using fluideq_engine::setup::equal_ci;
using fluideq_engine::setup::plan_restore_own;
using fluideq_engine::setup::plan_suspend_others;

namespace {

constexpr wchar_t kThx[] = L"{868989EE-5D2F-42AE-A7E4-EA830D24A684}";
constexpr wchar_t kRealtekMode[] = L"{0099058B-5D54-4EDF-944D-E8187363997A}";
constexpr wchar_t kRealtekEfx[] = L"{AB3B404A-B18F-4b4f-B91F-77F2DE95EB18}";

/** The singles and the pre-8.1 pair, which no plan here may rewrite. */
bool vendor_values_kept(const FxValues& before, const FxValues& after) {
  for (int at = 0; at < fluideq_engine::setup::kSlotCount; ++at) {
    if (before.single[at] != after.single[at]) return false;
  }
  for (int at = 0; at < fluideq_engine::setup::kLegacyCount; ++at) {
    if (before.legacy[at] != after.legacy[at]) return false;
  }
  return true;
}

void the_kraken_keeps_only_ours() {
  std::printf("a Kraken's mic: THX out of the list, ours kept, and back\n");
  FxValues before;
  before.composite[kEfx] = list({kThx, kOurs});
  before.modes[kEfx] = list({kDefaultProcessingMode});
  const FxPlan off = plan_suspend_others(before, kOurs);
  CHECK(off.changed);
  FxValues expected = before;
  expected.composite[kEfx] = list({kOurs});
  expect_values(off.after, expected, "kraken off");
  CHECK(vendor_values_kept(before, off.after));
  CHECK(effects_run(off.after) == list({kOurs}));
  // Control: before it, THX ran ahead of the engine.
  CHECK(effects_run(before) == list({kThx, kOurs}));
  const FxPlan back = plan_restore_own(off.after, before, kOurs);
  expect_values(back.after, before, "kraken back");
}

void a_laptop_array_loses_both_of_realteks() {
  std::printf("a laptop's array: Realtek's mode and endpoint effects out\n");
  FxValues before;
  before.composite[kMfx] = list({kRealtekMode});
  before.composite[kEfx] = list({kRealtekEfx, kOurs});
  before.modes[kMfx] = list({kDefaultProcessingMode});
  before.modes[kEfx] = list({kDefaultProcessingMode});
  const FxPlan off = plan_suspend_others(before, kOurs);
  CHECK(off.changed);
  CHECK(off.after.composite[kMfx].has_value() &&
        off.after.composite[kMfx]->empty());
  CHECK(off.after.composite[kEfx] == list({kOurs}));
  CHECK(vendor_values_kept(before, off.after));
  CHECK(effects_run(off.after) == list({kOurs}));
  expect_values(plan_restore_own(off.after, before, kOurs).after, before,
                "laptop back");
}

void singles_are_shadowed_never_rewritten() {
  std::printf("a mic in its single values: lists shadow the vendor's\n");
  FxValues before;
  before.single[kSfx] = kVendorSfx;
  before.single[kEfx] = kOurs;
  before.modes[kSfx] = list({kDefaultProcessingMode});
  before.modes[kEfx] = list({kDefaultProcessingMode});
  const FxPlan off = plan_suspend_others(before, kOurs);
  CHECK(off.changed);
  // The vendor's single value is still there, word for word; the list now
  // in front of it is what Windows reads, and it runs nothing.
  CHECK(vendor_values_kept(before, off.after));
  CHECK(off.after.composite[kSfx].has_value() &&
        off.after.composite[kSfx]->empty());
  CHECK(off.after.composite[kEfx] == list({kOurs}));
  CHECK(effects_run(off.after) == list({kOurs}));
  CHECK(effects_run(before) == list({kVendorSfx, kOurs}));
  expect_values(plan_restore_own(off.after, before, kOurs).after, before,
                "singles back");
}

void nothing_but_ours_is_left_alone() {
  std::printf("a mic with nothing but ours: nothing to write\n");
  FxValues before;
  before.composite[kEfx] = list({kOursLower});
  before.modes[kEfx] = list({kDefaultProcessingMode});
  const FxPlan off = plan_suspend_others(before, kOurs);
  CHECK(!off.changed);
  expect_values(off.after, before, "ours alone");
  // And a legacy-only mic whose one effect is ours: the mirroring alone is
  // not a change anybody asked for.
  FxValues legacy;
  legacy.legacy[kLfx] = kOurs;
  CHECK(!plan_suspend_others(legacy, kOurs).changed);
}

void ours_is_matched_whatever_its_case() {
  std::printf("ours is kept whatever case the stack wrote it in\n");
  FxValues before;
  before.composite[kEfx] = list({kThx, kOursLower});
  const FxPlan off = plan_suspend_others(before, kOurs);
  CHECK(off.after.composite[kEfx] == list({kOursLower}));
}

void a_moved_engine_is_kept_where_it_went() {
  std::printf("the engine moved since: the record back, ours where it is\n");
  FxValues before;
  before.composite[kEfx] = list({kThx, kOurs});
  before.modes[kEfx] = list({kDefaultProcessingMode});
  FxValues now = plan_suspend_others(before, kOurs).after;
  // Since then the slot ladder put the engine in the mode effect.
  now.composite[kEfx] = list({});
  now.composite[kMfx] = list({kOurs});
  now.modes[kMfx] = list({kDefaultProcessingMode});
  const FxPlan back = plan_restore_own(now, before, kOurs);
  CHECK(back.after.composite[kEfx].has_value());
  CHECK(back.after.composite[kEfx]->size() >= 1 &&
        equal_ci((*back.after.composite[kEfx])[0], kThx));
  CHECK(is_attached(back.after, kOurs));
}

void a_shadowed_single_does_not_run() {
  std::printf("a single value under a list does not run\n");
  FxValues values;
  values.single[kSfx] = kVendorSfx;
  values.composite[kSfx] = list({kOurs});
  CHECK(effects_run(values) == list({kOurs}));
  // The pre-8.1 pair runs only where nothing newer is registered.
  FxValues legacy;
  legacy.legacy[kLfx] = kLegacyLfx;
  CHECK(effects_run(legacy) == list({kLegacyLfx}));
  legacy.composite[kEfx] = list({kOurs});
  CHECK(effects_run(legacy) == list({kOurs}));
}

/** Each effect's kind follows the slot Windows reads it from. */
void each_effect_says_where_it_runs() {
  std::printf("stream, mode and endpoint effects, the old pair too\n");
  FxValues array;
  array.composite[kMfx] = list({kRealtekMode});
  array.single[kSfx] = kVendorSfx;
  array.composite[kEfx] = list({kRealtekEfx, kOurs});
  const std::vector<RunningEffect> run = effects_running(array);
  CHECK(run.size() == 4);
  CHECK(run.size() == 4 && run[0].clsid == kVendorSfx &&
        run[0].kind == EffectKind::Stream);
  CHECK(run.size() == 4 && run[1].clsid == kRealtekMode &&
        run[1].kind == EffectKind::Mode);
  CHECK(run.size() == 4 && run[2].clsid == kRealtekEfx &&
        run[2].kind == EffectKind::Endpoint);
  CHECK(run.size() == 4 && run[3].kind == EffectKind::Endpoint);
  // The pre-8.1 pair: LFX ran per stream, GFX on the whole endpoint.
  FxValues legacy;
  legacy.legacy[kLfx] = kLegacyLfx;
  legacy.legacy[kGfx] = kThx;
  const std::vector<RunningEffect> old = effects_running(legacy);
  CHECK(old.size() == 2 && old[0].kind == EffectKind::Stream &&
        old[1].kind == EffectKind::Endpoint && old[1].clsid == kThx);
  // The same effects as `effects_run`, in the same order.
  std::vector<std::wstring> ids;
  for (const RunningEffect& effect : run) ids.push_back(effect.clsid);
  CHECK(ids == effects_run(array));
}

}  // namespace

int main() {
  the_kraken_keeps_only_ours();
  a_laptop_array_loses_both_of_realteks();
  singles_are_shadowed_never_rewritten();
  nothing_but_ours_is_left_alone();
  ours_is_matched_whatever_its_case();
  a_moved_engine_is_kept_where_it_went();
  a_shadowed_single_does_not_run();
  each_effect_says_where_it_runs();
  if (g_failures == 0) {
    std::printf("\nall checks passed\n");
    return 0;
  }
  std::printf("\n%d check(s) failed\n", g_failures);
  return 1;
}

/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The processing modes beside an effect value. An effect in pids 5 to 7 with
 * no modes value for its slot is registered for discovery only and never
 * streamed, as one in a list is not, and every helper before this one wrote
 * pid 7 without it: a Sound BlasterX G6 — Creative's own effects in pids 5
 * and 6 with their modes, nothing in pid 7, no list anywhere — had the engine
 * there, attached on every reading and never once created. The attach writes
 * the value where the slot has none, leaves a vendor's alone, and the detach
 * takes back only what it wrote; an install writes it in place on every
 * output an older helper left without it.
 */

#include "../setup/fx_modes.h"
#include "fx_list_test_support.h"

#include <cstdio>
#include <string>
#include <vector>

using fluideq_engine::setup::kRawProcessingMode;
using fluideq_engine::setup::mode_missing;
using fluideq_engine::setup::modes_for_empty_slot;
using fluideq_engine::setup::plan_mode_in_place;
using namespace feq_fx_list_test;

namespace {

// Creative's effect containers: the MFX one as the report named it when the
// slot ladder was refused it, the other three stand-ins.
constexpr wchar_t kCreativeSfx[] = L"{12C5E6D5-0E83-4C0F-9B1E-6D0F4A2B1C01}";
constexpr wchar_t kCreativeMfx[] = L"{41528545-B167-495E-BB36-E11A17CF64B3}";
constexpr wchar_t kCreativeLfx[] = L"{12C5E6D5-0E83-4C0F-9B1E-6D0F4A2B1C04}";
constexpr wchar_t kCreativeGfx[] = L"{12C5E6D5-0E83-4C0F-9B1E-6D0F4A2B1C05}";

// Two of the render modes Windows defines (ksmedia.h), as a driver with modes
// of its own lists them beside its effects.
constexpr wchar_t kMediaMode[] = L"{4780004E-7133-41D8-8C74-660DADD2C0EE}";
constexpr wchar_t kMovieMode[] = L"{B26FEB0D-EC94-477C-9494-D1AB8E753F6E}";

/** The G6 as the report read it: four of Creative's, the EFX value free. */
FxValues sound_blaster_g6() {
  FxValues values;
  values.single[kSfx] = kCreativeSfx;
  values.single[kMfx] = kCreativeMfx;
  values.legacy[kLfx] = kCreativeLfx;
  values.legacy[kGfx] = kCreativeGfx;
  values.modes[kSfx] = list({kDefaultProcessingMode, kVendorMode});
  values.modes[kMfx] = list({kDefaultProcessingMode});
  return values;
}

void the_efx_value_gets_the_default_mode() {
  std::printf("the EFX value gets the default mode beside it\n");
  const FxValues backup = sound_blaster_g6();
  CHECK(is_single_only(backup));
  CHECK(default_slot_for(backup, false) == Slot::EfxSingle);

  FxValues expected = backup;
  expected.single[kEfx] = kOurs;
  expected.modes[kEfx] = list({kDefaultProcessingMode});
  const FxPlan plan = plan_attach(backup, kOurs, Slot::EfxSingle);
  CHECK(plan.refused.empty());
  CHECK(plan.changed);
  expect_values(plan.after, expected, "the_efx_value_gets_the_default_mode");
  // Still read from its single values: no list was made on the way.
  CHECK(is_single_only(plan.after));
  CHECK(!mode_missing(plan.after, kOurs));

  // Out again, exactly as found: the modes value it wrote goes with it.
  const FxPlan gone = plan_detach(plan.after, backup, kOurs);
  CHECK(gone.changed);
  expect_values(gone.after, backup,
                "the_efx_value_gets_the_default_mode/detach");
}

void a_vendors_modes_are_never_rewritten() {
  std::printf("a vendor's modes are never rewritten\n");
  // Windows' own effect in pid 6, with modes its driver chose — not DEFAULT.
  FxValues backup;
  backup.single[kMfx] = kWindowsGfx;
  backup.modes[kMfx] = list({kVendorMode});
  const FxPlan plan = plan_attach(backup, kOurs, Slot::MfxSingle);
  CHECK(plan.refused.empty());
  CHECK(plan.after.single[kMfx] == std::wstring(kOurs));
  CHECK(plan.after.modes[kMfx] == list({kVendorMode}));
  // And they stay when ours comes out, with Windows' effect put back.
  const FxPlan gone = plan_detach(plan.after, backup, kOurs);
  expect_values(gone.after, backup, "a_vendors_modes_are_never_rewritten");
}

void the_pre_8_1_pair_gets_no_mode() {
  std::printf("the pre-8.1 pair gets no mode\n");
  FxValues bare;
  const FxPlan plan = plan_attach(bare, kOurs, Slot::Gfx);
  CHECK(plan.refused.empty());
  for (int at = 0; at < fluideq_engine::setup::kSlotCount; ++at) {
    CHECK(!plan.after.modes[at].has_value());
  }
  CHECK(!mode_missing(plan.after, kOurs));
}

void an_engine_already_in_the_value_gets_its_mode_in_place() {
  std::printf("an engine already in the value gets its mode in place\n");
  // What every older helper left on the G6: ours in pid 7, no modes value.
  const FxValues backup = sound_blaster_g6();
  FxValues installed = backup;
  installed.single[kEfx] = kOurs;
  CHECK(mode_missing(installed, kOurs));

  // An attach into the slot it is already in — what the app asks for — adds
  // the value and moves nothing.
  FxValues expected = installed;
  expected.modes[kEfx] = list({kDefaultProcessingMode});
  const FxPlan plan = plan_move(installed, backup, kOurs, Slot::EfxSingle);
  CHECK(plan.refused.empty());
  CHECK(plan.changed);
  expect_values(plan.after, expected,
                "an_engine_already_in_the_value_gets_its_mode_in_place");
  CHECK(!mode_missing(plan.after, kOurs));
  // A second time writes nothing at all.
  CHECK(!plan_move(plan.after, backup, kOurs, Slot::EfxSingle).changed);
}

void mode_missing_says_when_windows_cannot_reach_it() {
  std::printf("mode_missing says when Windows cannot reach the engine\n");
  FxValues values;
  CHECK(!mode_missing(values, kOurs));  // not attached anywhere

  // In a list without the value — every list attach writes one, so this is
  // somebody's hand edit, and it is just as unreachable.
  values.composite[kMfx] = list({kOurs});
  CHECK(mode_missing(values, kOurs));
  values.modes[kMfx] = list({kDefaultProcessingMode});
  CHECK(!mode_missing(values, kOurs));

  // In pid 5, judged by the SFX slot's value and no other.
  FxValues single;
  single.single[kSfx] = kOurs;
  single.modes[kEfx] = list({kDefaultProcessingMode});
  CHECK(mode_missing(single, kOurs));
  single.modes[kSfx] = list({kVendorMode});
  CHECK(!mode_missing(single, kOurs));

  // The pre-8.1 values have no modes to lack.
  FxValues legacy;
  legacy.legacy[kLfx] = kOurs;
  CHECK(!mode_missing(legacy, kOurs));
}

void a_mode_effect_takes_the_modes_its_driver_streams_in() {
  std::printf("a mode effect takes the modes its driver streams in\n");
  // A driver with modes of its own: its stream effect runs in media, RAW,
  // DEFAULT and film. Windows sends a stream tagged as media or a film
  // through that mode and never through DEFAULT, so an engine in the free
  // mode effect listed for DEFAULT alone would leave those streams untouched.
  FxValues backup;
  backup.single[kSfx] = kCreativeSfx;
  backup.modes[kSfx] =
      list({kMediaMode, kRawProcessingMode, kDefaultProcessingMode,
            kMovieMode});
  FxValues expected = backup;
  expected.single[kMfx] = kOurs;
  // DEFAULT first, then the driver's own in the order found; RAW never.
  expected.modes[kMfx] =
      list({kDefaultProcessingMode, kMediaMode, kMovieMode});
  const FxPlan plan = plan_attach(backup, kOurs, Slot::MfxSingle);
  CHECK(plan.refused.empty());
  expect_values(plan.after, expected,
                "a_mode_effect_takes_the_modes_its_driver_streams_in");
  // Out again, the value it wrote goes with it and the vendor's stays.
  expect_values(plan_detach(plan.after, backup, kOurs).after, backup,
                "a_mode_effect_takes_the_modes_its_driver_streams_in/detach");

  // The same rule for a list, beside a vendor's in the other per-stream slot.
  FxValues lists;
  lists.composite[kSfx] = list({kVendorSfx});
  lists.modes[kSfx] = list({kVendorMode});
  const FxPlan in_list = plan_attach(lists, kOurs, Slot::Mfx);
  CHECK(in_list.after.modes[kMfx] ==
        list({kDefaultProcessingMode, kVendorMode}));
  CHECK(in_list.after.modes[kSfx] == list({kVendorMode}));
}

void the_endpoint_effect_takes_default_alone() {
  std::printf("the endpoint effect takes DEFAULT alone\n");
  // It runs after every mode is mixed, and Windows takes one mode there.
  FxValues values;
  values.modes[kSfx] = list({kDefaultProcessingMode, kMediaMode});
  values.modes[kMfx] = list({kMovieMode});
  CHECK(modes_for_empty_slot(values, kEfx) == list({kDefaultProcessingMode}));

  // A stream effect copies the mode effect's value, and nothing from the
  // endpoint effect's, which can hold no other mode than DEFAULT.
  FxValues efx_only;
  efx_only.modes[kEfx] = list({kMediaMode});
  CHECK(modes_for_empty_slot(efx_only, kSfx) ==
        list({kDefaultProcessingMode}));
  efx_only.modes[kMfx] = list({kMovieMode});
  CHECK(modes_for_empty_slot(efx_only, kSfx) ==
        list({kDefaultProcessingMode, kMovieMode}));
}

void a_copied_mode_is_listed_once() {
  std::printf("a copied mode is listed once\n");
  // The registry's spelling is the vendor's: any case, repeats, an empty
  // entry. DEFAULT and RAW are recognised however they are written.
  FxValues values;
  values.modes[kMfx] =
      list({L"{c18e2f7e-933d-4965-b7d1-1eef228d2af3}", kMediaMode, L"",
            L"{4780004e-7133-41d8-8c74-660dadd2c0ee}",
            L"{9e90ea20-b493-4fd1-a1a8-7e1361a956cf}"});
  CHECK(modes_for_empty_slot(values, kSfx) ==
        list({kDefaultProcessingMode, kMediaMode}));
}

void an_install_writes_the_missing_mode_and_nothing_else() {
  std::printf("an install writes the missing mode and nothing else\n");
  // What every older helper left on the G6: ours in pid 7, no value beside
  // it. The install gives it the value; nothing else on the output moves.
  const FxValues backup = sound_blaster_g6();
  FxValues installed = backup;
  installed.single[kEfx] = kOurs;
  FxValues expected = installed;
  expected.modes[kEfx] = list({kDefaultProcessingMode});
  const FxPlan plan = plan_mode_in_place(installed, kOurs);
  CHECK(plan.changed);
  expect_values(plan.after, expected,
                "an_install_writes_the_missing_mode_and_nothing_else");
  CHECK(!mode_missing(plan.after, kOurs));
  // A second install writes nothing at all.
  CHECK(!plan_mode_in_place(plan.after, kOurs).changed);

  // In a mode list, by the same rule as an attach: the driver's own modes
  // come with DEFAULT.
  FxValues in_list;
  in_list.composite[kSfx] = list({kVendorSfx});
  in_list.composite[kMfx] = list({kVendorMfx, kOurs});
  in_list.modes[kSfx] =
      list({kDefaultProcessingMode, kMediaMode, kRawProcessingMode});
  FxValues list_expected = in_list;
  list_expected.modes[kMfx] = list({kDefaultProcessingMode, kMediaMode});
  expect_values(plan_mode_in_place(in_list, kOurs).after, list_expected,
                "an_install_writes_the_missing_mode_and_nothing_else/list");
}

void an_install_leaves_every_other_output_alone() {
  std::printf("an install leaves every other output alone\n");
  // The engine not on it.
  CHECK(!plan_mode_in_place(sound_blaster_g6(), kOurs).changed);
  // In the pre-8.1 pair, which has no modes to lack.
  FxValues legacy;
  legacy.legacy[kGfx] = kOurs;
  CHECK(!plan_mode_in_place(legacy, kOurs).changed);
  // A slot whose value is already there is the vendor's account of where its
  // own effects run, and is never rewritten.
  FxValues vendor;
  vendor.composite[kMfx] = list({kVendorMfx, kOurs});
  vendor.modes[kMfx] = list({kVendorMode});
  CHECK(!plan_mode_in_place(vendor, kOurs).changed);
  // The positive control: the same output without its value is written.
  vendor.modes[kMfx].reset();
  CHECK(plan_mode_in_place(vendor, kOurs).changed);
}

}  // namespace

int main() {
  std::printf("fx list: processing modes beside an effect value\n");
  the_efx_value_gets_the_default_mode();
  a_vendors_modes_are_never_rewritten();
  the_pre_8_1_pair_gets_no_mode();
  an_engine_already_in_the_value_gets_its_mode_in_place();
  mode_missing_says_when_windows_cannot_reach_it();
  a_mode_effect_takes_the_modes_its_driver_streams_in();
  the_endpoint_effect_takes_default_alone();
  a_copied_mode_is_listed_once();
  an_install_writes_the_missing_mode_and_nothing_else();
  an_install_leaves_every_other_output_alone();
  if (g_failures == 0) {
    std::printf("\nall checks passed\n");
    return 0;
  }
  std::printf("\n%d check(s) failed\n", g_failures);
  return 1;
}

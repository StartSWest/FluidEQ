/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

// Where the engine goes on a microphone. Each case stands beside the output
// rule it departs from, so a capture rule that silently became the render
// one again fails here rather than on somebody's headset.

#include "../setup/capture_slots.h"
#include "fx_list_test_support.h"

namespace {

using namespace feq_fx_list_test;
using fluideq_engine::setup::default_capture_slot_for;
using fluideq_engine::setup::slot_exists_on_capture;

/** A mic has no post-mix effect: GFX is never created there. */
void gfx_is_not_a_capture_slot() {
  std::printf("gfx is not a capture slot\n");
  CHECK(!slot_exists_on_capture(Slot::Gfx));
  for (const Slot slot : {Slot::Efx, Slot::Mfx, Slot::Sfx, Slot::EfxSingle,
                          Slot::MfxSingle, Slot::SfxSingle, Slot::Lfx}) {
    CHECK(slot_exists_on_capture(slot));
  }
}

/**
 * The legacy-only mic goes to LFX, its one capture effect value. The output
 * rule for the same registration is GFX — the control that the two rules
 * really differ on this shape.
 */
void legacy_only_mic_goes_to_lfx() {
  std::printf("legacy-only mic goes to lfx\n");
  FxValues backup;
  backup.legacy[kLfx] = kWindowsLfx;
  backup.legacy[kGfx] = kWindowsGfx;
  CHECK(default_slot_for(backup, false) == Slot::Gfx);
  CHECK(default_capture_slot_for(backup, false) == Slot::Lfx);
  CHECK(default_capture_slot_for(backup, true) == Slot::Lfx);

  // Nothing at all in LFX takes it the same way.
  FxValues only_gfx;
  only_gfx.legacy[kGfx] = kWindowsGfx;
  CHECK(default_capture_slot_for(only_gfx, false) == Slot::Lfx);
}

/** A vendor's own LFX is never taken: the ladder starts from the top. */
void vendor_lfx_is_left_alone() {
  std::printf("vendor lfx is left alone\n");
  FxValues vendor;
  vendor.legacy[kLfx] = kLegacyLfx;
  CHECK(is_legacy_only(vendor));
  CHECK(default_capture_slot_for(vendor, false) == Slot::Efx);
  CHECK(default_capture_slot_for(vendor, true) == Slot::Mfx);
}

/** Pids 5 to 7 only: the newest single that is free or Windows' own. */
void single_only_mic_takes_the_newest_free_single() {
  std::printf("single-only mic takes the newest free single\n");
  FxValues windows;
  windows.single[kSfx] = kWindowsLfx;
  windows.single[kMfx] = kWindowsGfx;
  CHECK(is_single_only(windows));
  CHECK(default_capture_slot_for(windows, false) == Slot::EfxSingle);

  FxValues vendor_efx;
  vendor_efx.single[kEfx] = kVendorEfx;
  vendor_efx.single[kMfx] = kWindowsGfx;
  CHECK(default_capture_slot_for(vendor_efx, false) == Slot::MfxSingle);
}

/** Lists, or nothing: EFX, or MFX on a combined hands-free endpoint. */
void listed_mic_starts_at_efx() {
  std::printf("listed mic starts at efx\n");
  const FxValues bare;
  CHECK(default_capture_slot_for(bare, false) == Slot::Efx);
  CHECK(default_capture_slot_for(bare, true) == Slot::Mfx);

  FxValues listed;
  listed.composite[kSfx] = list({kVendorSfx});
  listed.composite[kMfx] = list({kVendorMfx});
  CHECK(default_capture_slot_for(listed, false) == Slot::Efx);
}

}  // namespace

int main() {
  std::printf("capture slots\n\n");
  gfx_is_not_a_capture_slot();
  legacy_only_mic_goes_to_lfx();
  vendor_lfx_is_left_alone();
  single_only_mic_takes_the_newest_free_single();
  listed_mic_starts_at_efx();
  if (g_failures == 0) {
    std::printf("\nall checks passed\n");
    return 0;
  }
  std::printf("\n%d check(s) failed\n", g_failures);
  return 1;
}

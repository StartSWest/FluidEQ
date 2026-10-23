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
#include "fx_list_test_support.h"

using namespace feq_fx_list_test;

namespace {

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

/**
 * An endpoint carrying pid 7 and nothing else in that slot.
 *
 * Ours goes on the end, behind the vendor's, because the list is an order the
 * audio engine runs in and an equaliser in front of a speaker-protection
 * effect is the wrong way round. The mode list is created only when there was
 * not one: the vendor decided which modes its own effect runs in.
 */
void modern_efx_single_is_mirrored_first() {
  std::printf("modern efx single is mirrored first\n");
  FxValues before;
  before.single[kEfx] = kVendorEfx;

  FxValues expected;
  expected.single[kEfx] = kVendorEfx;
  expected.composite[kEfx] = list({kVendorEfx, kOurs});
  expected.modes[kEfx] = list({kDefaultProcessingMode});

  const FxPlan plan = plan_attach(before, kOurs, Slot::Efx);
  CHECK(plan.changed);
  expect_values(plan.after, expected, "modern_efx_single_is_mirrored_first");

  // The same endpoint with the vendor's own mode list already beside it: the
  // list is left exactly as found, DEFAULT or not.
  FxValues with_modes = before;
  with_modes.modes[kEfx] = list({kVendorMode});
  FxValues expected_with_modes = expected;
  expected_with_modes.modes[kEfx] = list({kVendorMode});

  const FxPlan kept = plan_attach(with_modes, kOurs, Slot::Efx);
  CHECK(kept.changed);
  expect_values(kept.after, expected_with_modes,
                "modern_efx_single_is_mirrored_first modes kept");
}

/**
 * Both generations present at once: the singles win and the legacy pair is
 * ignored.
 *
 * Rule 2 exists for endpoints that have only pids 1 and 2. If its guard were
 * wrong it would run here too and overwrite the lists rule 1 has just
 * mirrored — pid 13 would name the LFX effect instead of the SFX one, which
 * is a driver's effect chain silently rewired rather than extended.
 */
void legacy_and_modern_prefer_singles() {
  std::printf("legacy and modern prefer singles\n");
  FxValues before;
  before.single[kSfx] = kVendorSfx;
  before.single[kMfx] = kVendorMfx;
  before.legacy[0] = kLegacyLfx;
  before.legacy[1] = kLegacyGfx;

  FxValues expected = before;
  expected.composite[kSfx] = list({kVendorSfx});
  expected.composite[kMfx] = list({kVendorMfx});
  expected.composite[kEfx] = list({kOurs});
  expected.modes[kEfx] = list({kDefaultProcessingMode});

  const FxPlan plan = plan_attach(before, kOurs, Slot::Efx);
  CHECK(plan.changed);
  expect_values(plan.after, expected, "legacy_and_modern_prefer_singles");
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
 * The move a driver that never creates an endpoint effect needs: ours out of
 * the EFX list and into the MFX one, with everything else — the vendor's own
 * entries, the EFX list that was there first, the mode list beside it — as
 * an attach into MFX on the original endpoint would have left it.
 */
void move_from_efx_to_mfx() {
  std::printf("move from efx to mfx\n");
  FxValues backup;
  backup.composite[kSfx] = list({kVendorSfx});
  backup.composite[kMfx] = list({kVendorMfx});
  backup.composite[kEfx] = list({kVendorEfx});
  backup.modes[kEfx] = list({kDefaultProcessingMode});
  const FxValues attached = plan_attach(backup, kOurs, Slot::Efx).after;
  CHECK(slot_of(attached, kOurs) == Slot::Efx);

  const FxPlan plan = plan_move(attached, backup, kOurs, Slot::Mfx);
  CHECK(plan.changed);
  expect_values(plan.after, plan_attach(backup, kOurs, Slot::Mfx).after,
                "move_from_efx_to_mfx");
  CHECK(slot_of(plan.after, kOurs) == Slot::Mfx);
  // Once, not beside itself: one registration of the engine per output.
  CHECK(plan.after.composite[kEfx] == list({kVendorEfx}));
}

/**
 * The same move on an output that had no lists at all: the EFX list and its
 * mode list were ours, so both go away, and only the MFX pair remains.
 */
void move_takes_created_keys_with_it() {
  std::printf("move takes created keys with it\n");
  const FxValues backup;
  const FxValues attached = plan_attach(backup, kOurs, Slot::Efx).after;

  FxValues expected;
  expected.composite[kMfx] = list({kOurs});
  expected.modes[kMfx] = list({kDefaultProcessingMode});

  const FxPlan plan = plan_move(attached, backup, kOurs, Slot::Mfx);
  CHECK(plan.changed);
  expect_values(plan.after, expected, "move_takes_created_keys_with_it");
}

/**
 * A move to the slot the effect is already in writes nothing — and in
 * particular does not take it out of the middle of a list and put it back
 * at the end, which a detach-then-attach would do on every attach.
 */
void move_to_the_same_slot_is_no_change() {
  std::printf("move to the same slot is no change\n");
  FxValues backup;
  backup.composite[kEfx] = list({kVendorEfx});
  FxValues before = plan_attach(backup, kOurs, Slot::Efx).after;
  // A vendor's driver update appended behind us since.
  before.composite[kEfx]->push_back(kVendorMfx);

  const FxPlan plan = plan_move(before, backup, kOurs, Slot::Efx);
  CHECK(!plan.changed);
  expect_values(plan.after, before, "move_to_the_same_slot_is_no_change");
}

/**
 * The oldest rung: a driver that reads only the pre-8.1 values, on an output
 * where nothing was registered at all. Ours goes into GFX, and the lists the
 * first attach created go away with it — a driver reading pids 1 and 2 may
 * only do so while no list exists.
 */
void move_to_gfx_on_a_bare_output() {
  std::printf("move to gfx on a bare output\n");
  const FxValues backup;
  const FxValues attached = plan_attach(backup, kOurs, Slot::Efx).after;

  FxValues expected;
  expected.legacy[kGfx] = kOurs;

  const FxPlan plan = plan_move(attached, backup, kOurs, Slot::Gfx);
  CHECK(plan.refused.empty());
  CHECK(plan.changed);
  expect_values(plan.after, expected, "move_to_gfx_on_a_bare_output");
  CHECK(slot_of(plan.after, kOurs) == Slot::Gfx);
  CHECK(is_attached(plan.after, kOurs));

  // And out again: exactly the bare output.
  const FxPlan gone = plan_detach(plan.after, backup, kOurs);
  CHECK(gone.changed);
  expect_values(gone.after, backup, "move_to_gfx_on_a_bare_output/detach");
  CHECK(!is_attached(gone.after, kOurs));
}

/**
 * A legacy value that already names somebody's effect is never replaced: the
 * plan is refused, nothing changes, and the engine stays where it was.
 */
void legacy_slot_is_never_taken_from_a_vendor() {
  std::printf("legacy slot is never taken from a vendor\n");
  FxValues backup;
  backup.legacy[kLfx] = kLegacyLfx;
  backup.legacy[kGfx] = kLegacyGfx;
  const FxValues attached = plan_attach(backup, kOurs, Slot::Efx).after;

  const FxPlan plan = plan_move(attached, backup, kOurs, Slot::Gfx);
  CHECK(!plan.refused.empty());
  CHECK(!plan.changed);
  expect_values(plan.after, attached,
                "legacy_slot_is_never_taken_from_a_vendor");
  CHECK(slot_of(plan.after, kOurs) == Slot::Efx);

  // An empty string a driver left there is not an effect, and is taken.
  FxValues emptied = backup;
  emptied.legacy[kGfx] = std::wstring();
  const FxPlan into_empty = plan_attach(emptied, kOurs, Slot::Gfx);
  CHECK(into_empty.refused.empty());
  CHECK(into_empty.after.legacy[kGfx] == std::wstring(kOurs));
  // And comes out as the empty string it was, not deleted.
  const FxPlan out = plan_detach(into_empty.after, emptied, kOurs);
  expect_values(out.after, emptied,
                "legacy_slot_is_never_taken_from_a_vendor/empty");
}

/**
 * A user's RME DAC: the driver registered only the pre-8.1 values, and they
 * hold Windows' own two default effects. Windows reads only those there,
 * whatever lists are added, so the engine goes into GFX over Windows' own
 * effect — and the detach puts Windows' effect back.
 */
void windows_default_gfx_is_taken_and_given_back() {
  std::printf("windows default gfx is taken and given back\n");
  FxValues backup;
  backup.legacy[kLfx] = kWindowsLfx;
  backup.legacy[kGfx] = kWindowsGfx;
  CHECK(is_legacy_only(backup));
  CHECK(default_slot_for(backup, false) == Slot::Gfx);
  CHECK(default_slot_for(backup, true) == Slot::Gfx);

  // The ladder had already put it in the lists, mirroring Windows' effects
  // forward: the move takes those lists away again.
  const FxValues attached = plan_attach(backup, kOurs, Slot::Sfx).after;
  CHECK(!is_legacy_only(attached));
  FxValues expected = backup;
  expected.legacy[kGfx] = kOurs;
  const FxPlan plan = plan_move(attached, backup, kOurs, Slot::Gfx);
  CHECK(plan.refused.empty());
  expect_values(plan.after, expected,
                "windows_default_gfx_is_taken_and_given_back");

  const FxPlan gone = plan_detach(plan.after, backup, kOurs);
  expect_values(gone.after, backup,
                "windows_default_gfx_is_taken_and_given_back/detach");
}

/**
 * Ivan's Razer Kaira Pro, over Bluetooth: Windows' own two default effects
 * in pids 5 and 6, no composite list anywhere on the endpoint, and pid 7
 * free. The ladder used to step from the lists straight to pids 1 and 2,
 * walking past the whole generation this endpoint's own defaults are
 * registered in — and the engine ended up in a value Windows never reads
 * there, reported attached, never once created.
 */
void windows_defaults_in_the_singles_are_the_ladder() {
  std::printf("windows defaults in the singles are the ladder\n");
  FxValues backup;
  backup.single[kSfx] = kWindowsLfx;
  backup.single[kMfx] = kWindowsGfx;

  CHECK(is_single_only(backup));
  // Not the pre-8.1 shape: that one is pids 1 and 2, and this endpoint has
  // nothing in them at all.
  CHECK(!is_legacy_only(backup));
  // The free one, newest first, whether or not Windows combined the output.
  CHECK(default_slot_for(backup, false) == Slot::EfxSingle);
  CHECK(default_slot_for(backup, true) == Slot::EfxSingle);

  // Straight in: one value written, with the processing mode its slot lacks
  // (`fx_list_mode_test.cpp`), and no list created — a list is the newer
  // generation, and creating one is what stops the endpoint being read from
  // the values being written.
  FxValues expected = backup;
  expected.single[kEfx] = kOurs;
  expected.modes[kEfx] = list({kDefaultProcessingMode});
  const FxPlan plan = plan_attach(backup, kOurs, Slot::EfxSingle);
  CHECK(plan.refused.empty());
  CHECK(plan.changed);
  expect_values(plan.after, expected,
                "windows_defaults_in_the_singles_are_the_ladder");
  CHECK(slot_of(plan.after, kOurs) == Slot::EfxSingle);
  CHECK(is_attached(plan.after, kOurs));
  CHECK(is_single_only(plan.after));

  const FxPlan gone = plan_detach(plan.after, backup, kOurs);
  CHECK(gone.changed);
  expect_values(gone.after, backup,
                "windows_defaults_in_the_singles_are_the_ladder/detach");
  CHECK(!is_attached(gone.after, kOurs));
}

/**
 * The step the machine actually takes: off the list the first attach made,
 * into pid 7. The lists go with it, the way they do on the way to pid 1 or
 * 2, because a driver that reads an older generation may only read it while
 * no newer one exists.
 */
void move_from_a_list_into_the_efx_single() {
  std::printf("move from a list into the efx single\n");
  FxValues backup;
  backup.single[kSfx] = kWindowsLfx;
  backup.single[kMfx] = kWindowsGfx;
  const FxValues attached = plan_attach(backup, kOurs, Slot::Efx).after;
  // The attach did make lists, carrying Windows' own effects forward.
  CHECK(attached.composite[kEfx].has_value());
  CHECK(!is_single_only(attached));

  FxValues expected = backup;
  expected.single[kEfx] = kOurs;
  expected.modes[kEfx] = list({kDefaultProcessingMode});
  const FxPlan plan = plan_move(attached, backup, kOurs, Slot::EfxSingle);
  CHECK(plan.refused.empty());
  CHECK(plan.changed);
  expect_values(plan.after, expected,
                "move_from_a_list_into_the_efx_single");
  CHECK(slot_of(plan.after, kOurs) == Slot::EfxSingle);

  const FxPlan gone = plan_detach(plan.after, backup, kOurs);
  expect_values(gone.after, backup,
                "move_from_a_list_into_the_efx_single/detach");
}

/**
 * And never over a vendor's. Pid 7 holding somebody's own effect is refused
 * exactly as pid 1 or 2 would be, and the engine stays where it was; an
 * endpoint whose three singles are all taken by vendors falls back to the
 * top of the ladder rather than to a value it may not write.
 */
void an_occupied_single_is_never_taken() {
  std::printf("an occupied single is never taken\n");
  FxValues backup;
  backup.single[kSfx] = kWindowsLfx;
  backup.single[kEfx] = kLegacyLfx;
  const FxValues attached = plan_attach(backup, kOurs, Slot::Efx).after;

  const FxPlan plan = plan_move(attached, backup, kOurs, Slot::EfxSingle);
  CHECK(!plan.refused.empty());
  CHECK(!plan.changed);
  expect_values(plan.after, attached, "an_occupied_single_is_never_taken");
  CHECK(slot_of(plan.after, kOurs) == Slot::Efx);

  // The free one below it is still the default, because pid 7 is a vendor's.
  CHECK(default_slot_for(backup, false) == Slot::MfxSingle);

  // Every single taken: nothing here may be written, so the ladder's own
  // top rung is where an attach with no slot named goes.
  FxValues full;
  full.single[kSfx] = kLegacyLfx;
  full.single[kMfx] = kLegacyGfx;
  full.single[kEfx] = kLegacyLfx;
  CHECK(is_single_only(full));
  CHECK(default_slot_for(full, false) == Slot::Efx);
}

/**
 * Read off a machine, after the ladder stopped one rung in: Windows' own two
 * effects in pids 5 and 6, and the engine refused the move because "the MFX
 * value already holds another effect" — naming a class id that is Windows'
 * own. Windows ships two pairs of them, this endpoint carried the second,
 * and only the first was written down here.
 */
void windows_second_pair_of_defaults_is_also_windows() {
  std::printf("windows second pair of defaults is also windows\n");
  // As the endpoint was first found: Windows' own two, and pid 7 free.
  FxValues backup;
  backup.single[kSfx] = kWindowsLfx2;
  backup.single[kMfx] = kWindowsGfx2;

  // Both one-value rungs Windows is sitting in are takeable, in either
  // spelling, and neither is read as a vendor's.
  for (const wchar_t* held : {kWindowsLfx, kWindowsGfx, kWindowsLfx2,
                              kWindowsGfx2}) {
    FxValues endpoint;
    endpoint.single[kMfx] = held;
    const FxPlan plan = plan_attach(endpoint, kOurs, Slot::MfxSingle);
    CHECK(plan.refused.empty());
    CHECK(plan.after.single[kMfx] == std::wstring(kOurs));
    // And Windows' own goes back exactly as it was.
    const FxPlan gone = plan_detach(plan.after, endpoint, kOurs);
    expect_values(gone.after, endpoint,
                  "windows_second_pair_of_defaults_is_also_windows/detach");
  }

  // The step the machine could not take: off pid 7, where the ladder had
  // put it, onto pid 6, over the second pair's GFX. Pid 7's processing mode
  // goes with it, and pid 6 gets the one it lacks.
  const FxValues attached = plan_attach(backup, kOurs, Slot::EfxSingle).after;
  CHECK(slot_of(attached, kOurs) == Slot::EfxSingle);
  FxValues expected = backup;
  expected.single[kMfx] = kOurs;
  expected.modes[kMfx] = list({kDefaultProcessingMode});
  const FxPlan moved = plan_move(attached, backup, kOurs, Slot::MfxSingle);
  CHECK(moved.refused.empty());
  expect_values(moved.after, expected,
                "windows_second_pair_of_defaults_is_also_windows/move");

  // The positive control: a vendor's own effect in the same value is still
  // refused, whichever generation it sits in.
  FxValues vendor;
  vendor.single[kMfx] = kLegacyGfx;
  CHECK(!plan_attach(vendor, kOurs, Slot::MfxSingle).refused.empty());
}

/** An endpoint with nothing at all still starts at the top of the ladder. */
void bare_endpoint_starts_at_efx() {
  std::printf("bare endpoint starts at efx\n");
  const FxValues bare;
  CHECK(!is_legacy_only(bare));
  CHECK(default_slot_for(bare, false) == Slot::Efx);
  CHECK(default_slot_for(bare, true) == Slot::Mfx);
  // A vendor's own legacy GFX: read the old way, but not ours to take, so
  // the ladder starts at the top and ends with a refusal.
  FxValues vendor;
  vendor.legacy[kGfx] = kLegacyGfx;
  CHECK(is_legacy_only(vendor));
  CHECK(default_slot_for(vendor, false) == Slot::Efx);
}

/**
 * A move into a legacy slot keeps the lists the vendor had: only the ones the
 * first attach created are taken away.
 */
void move_to_legacy_keeps_vendor_lists() {
  std::printf("move to legacy keeps vendor lists\n");
  FxValues backup;
  backup.composite[kSfx] = list({kVendorSfx});
  backup.modes[kSfx] = list({kVendorMode});
  const FxValues attached = plan_attach(backup, kOurs, Slot::Efx).after;
  CHECK(attached.composite[kEfx] == list({kOurs}));

  FxValues expected = backup;
  expected.legacy[kLfx] = kOurs;

  const FxPlan plan = plan_move(attached, backup, kOurs, Slot::Lfx);
  CHECK(plan.refused.empty());
  expect_values(plan.after, expected, "move_to_legacy_keeps_vendor_lists");
}

/** The third rung, SFX, is a list like the other two. */
void move_to_sfx() {
  std::printf("move to sfx\n");
  FxValues backup;
  backup.composite[kMfx] = list({kVendorMfx});
  const FxValues attached = plan_attach(backup, kOurs, Slot::Mfx).after;

  FxValues expected = backup;
  expected.composite[kSfx] = list({kOurs});
  expected.modes[kSfx] = list({kDefaultProcessingMode});

  const FxPlan plan = plan_move(attached, backup, kOurs, Slot::Sfx);
  CHECK(plan.changed);
  expect_values(plan.after, expected, "move_to_sfx");
  CHECK(slot_of(plan.after, kOurs) == Slot::Sfx);
}

/** Not attached anywhere: a move is a plain attach into the slot asked for. */
void move_of_an_unattached_effect_is_an_attach() {
  std::printf("move of an unattached effect is an attach\n");
  FxValues before;
  before.composite[kMfx] = list({kVendorMfx});
  CHECK(!slot_of(before, kOurs).has_value());

  const FxPlan plan = plan_move(before, before, kOurs, Slot::Mfx);
  expect_values(plan.after, plan_attach(before, kOurs, Slot::Mfx).after,
                "move_of_an_unattached_effect_is_an_attach");
  CHECK(plan.changed);
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
 * A vendor that wrote pid 15 as a single string gets a single string back.
 *
 * Reading it as a one-entry list is what keeps its effect alive through the
 * edit, and attaching beside it necessarily makes the value a list — nothing
 * else can hold two class ids. What must not happen is the value staying a
 * list afterwards: the type is the vendor's, its installer reads it back, and
 * a change this program made and never undid is a change no uninstall can.
 */
void detach_restores_sz_type() {
  std::printf("detach restores sz type\n");
  FxValues backup;
  backup.composite[kEfx] = list({kVendorEfx});
  backup.composite_was_sz[kEfx] = true;
  backup.modes[kEfx] = list({kDefaultProcessingMode});

  const FxValues attached = plan_attach(backup, kOurs, Slot::Efx).after;
  CHECK(attached.composite[kEfx] == list({kVendorEfx, kOurs}));
  // Two entries cannot be a single string, so the attach gives the type up.
  CHECK(!attached.composite_was_sz[kEfx]);

  const FxPlan plan = plan_detach(attached, backup, kOurs);
  CHECK(plan.changed);
  expect_values(plan.after, backup, "detach_restores_sz_type");
  CHECK(plan.after.composite_was_sz[kEfx]);

  // A slot that really was a list stays one: the type only goes back when the
  // backup says it was a single string to begin with.
  FxValues list_backup;
  list_backup.composite[kEfx] = list({kVendorEfx});
  list_backup.modes[kEfx] = list({kDefaultProcessingMode});
  const FxValues list_attached =
      plan_attach(list_backup, kOurs, Slot::Efx).after;
  const FxPlan kept = plan_detach(list_attached, list_backup, kOurs);
  expect_values(kept.after, list_backup, "detach_restores_sz_type list");
  CHECK(!kept.after.composite_was_sz[kEfx]);
}

}  // namespace

int main() {
  std::printf("fx list\n\n");
  modern_with_composites();
  modern_singles_only();
  modern_efx_single_is_mirrored_first();
  legacy_and_modern_prefer_singles();
  legacy_only();
  already_attached();
  mfx_slot();
  move_from_efx_to_mfx();
  move_takes_created_keys_with_it();
  move_to_the_same_slot_is_no_change();
  move_of_an_unattached_effect_is_an_attach();
  move_to_gfx_on_a_bare_output();
  legacy_slot_is_never_taken_from_a_vendor();
  move_to_legacy_keeps_vendor_lists();
  move_to_sfx();
  windows_default_gfx_is_taken_and_given_back();
  windows_defaults_in_the_singles_are_the_ladder();
  move_from_a_list_into_the_efx_single();
  an_occupied_single_is_never_taken();
  windows_second_pair_of_defaults_is_also_windows();
  bare_endpoint_starts_at_efx();
  detach_restores_created_keys();
  detach_keeps_others_in_list();
  detach_restores_sz_type();

  if (g_failures == 0) {
    std::printf("\nall checks passed\n");
    return 0;
  }
  std::printf("\n%d check(s) failed\n", g_failures);
  return 1;
}

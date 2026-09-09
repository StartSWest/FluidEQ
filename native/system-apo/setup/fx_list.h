/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The list edit: what an output's effect registration should become once
 * FluidEQ's effect is added to it, and what it should go back to.
 *
 * Pure on purpose. Every value here comes out of a registry key that belongs
 * to somebody else's audio driver, and getting the edit wrong does not throw
 * an error — it silently unregisters a vendor's effect for a machine whose
 * owner then has no bass, no microphone processing, or no sound at all. So
 * the decision is separated from the registry access entirely and is decided
 * by a function that can be run a hundred times against fixtures taken from
 * real machines.
 *
 * The shape being edited is `FxProperties` under a render endpoint. Windows
 * has three generations of it living side by side:
 *
 *   - pids 1 and 2 — LFX and GFX, the pre-Windows-8.1 pair.
 *   - pids 5, 6, 7 — SFX, MFX and EFX as a single class id each.
 *   - pids 13, 14, 15 — the same three as an ordered list, which is the only
 *     generation that can hold more than one effect per slot.
 *
 * Windows reads the newest generation that is present, so appending to the
 * lists means first copying forward whatever the vendor registered in the
 * older shapes. That mirroring is the part that has to be exactly right: a
 * composite list created without the vendor's own class id in it is how an
 * equaliser silently replaces a laptop's speaker protection.
 */
#ifndef FLUIDEQ_ENGINE_SETUP_FX_LIST_H
#define FLUIDEQ_ENGINE_SETUP_FX_LIST_H

#include <optional>
#include <string>
#include <string_view>
#include <vector>

namespace fluideq_engine::setup {

/** SFX, MFX and EFX — the index every array in `FxValues` is subscripted by. */
constexpr int kSfx = 0;
constexpr int kMfx = 1;
constexpr int kEfx = 2;
constexpr int kSlotCount = 3;

/** How many legacy values there are: pid 1 (LFX) and pid 2 (GFX). */
constexpr int kLegacyCount = 2;

/**
 * One endpoint's effect registration, with absence distinguished from empty.
 *
 * The difference matters on the way back out: an empty list we created has to
 * be deleted, an empty list the vendor left has to stay. `std::optional`
 * carries "the value name is not in the key at all", which is not the same as
 * a value holding an empty string.
 */
struct FxValues {
  /** pids 5, 6, 7 — one class id each, REG_SZ. */
  std::optional<std::wstring> single[kSlotCount];
  /** pids 13, 14, 15 — ordered lists, REG_MULTI_SZ. */
  std::optional<std::vector<std::wstring>> composite[kSlotCount];
  /** pids 1 and 2 — LFX and GFX, REG_SZ. */
  std::optional<std::wstring> legacy[kLegacyCount];
  /** `{d3993a3f-…},5/,6/,7` — the signal processing modes, REG_MULTI_SZ. */
  std::optional<std::vector<std::wstring>> modes[kSlotCount];
};

bool operator==(const FxValues& left, const FxValues& right);
inline bool operator!=(const FxValues& left, const FxValues& right) {
  return !(left == right);
}

/** Which slot the effect is attached to. EFX unless the gate asks otherwise. */
enum class Slot { Efx, Mfx };

struct FxPlan {
  FxValues after;
  /** False when `after` is byte-for-byte the input: nothing to write. */
  bool changed = false;
};

/**
 * `{C18E2F7E-933D-4965-B7D1-1EEF228D2AF3}` — the DEFAULT processing mode.
 *
 * An effect list with no mode list beside it is never reached: the audio
 * engine matches the stream's mode against that list, and an absent one
 * matches nothing. This is the mode ordinary playback runs in.
 */
extern const wchar_t kDefaultProcessingMode[];

/**
 * The values `before` should become once `clsid` is attached to `slot`.
 *
 * Four steps, in this order, and none of them ever writes pids 1, 2, 5, 6 or
 * 7: whatever the vendor registered in the older generations is left exactly
 * as found so that removing FluidEQ cannot leave the endpoint worse than a
 * clean uninstall would.
 */
FxPlan plan_attach(const FxValues& before, std::wstring_view clsid, Slot slot);

/**
 * The values `current` should become once `clsid` is removed again.
 *
 * `backup` is what the endpoint looked like before the first attach, and it
 * is the only thing that says which keys are ours to delete. A list that is
 * empty after the removal but existed in the backup stays, empty, because
 * that is how it was found.
 */
FxPlan plan_detach(const FxValues& current, const FxValues& backup,
                   std::wstring_view clsid);

/** Whether `clsid` appears in any of the three composite lists. */
bool is_attached(const FxValues& values, std::wstring_view clsid);

/** `values` as one line of JSON — what a backup file holds. */
std::wstring to_json(const FxValues& values);

/** `text` back into values, or nothing when it is not a backup we wrote. */
std::optional<FxValues> from_json(std::wstring_view text);

}  // namespace fluideq_engine::setup

#endif  // FLUIDEQ_ENGINE_SETUP_FX_LIST_H

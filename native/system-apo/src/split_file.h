/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Which outputs feed which, as the app tells the engine.
 *
 * `fluideq-split.txt`, beside the rack file, one line per second output the
 * engine plays:
 *
 *     # FluidEQ Engine second outputs v1
 *     # main {main output's GUID}
 *     {main output's GUID} {second output's GUID} 0.800
 *
 * The number is the second output's volume, 0 to 1. The app writes the file
 * when a second output starts or stops and when its volume moves, and deletes
 * it on quit (`engineQuitReset.ts`); src/main/outputSplit.ts writes the other
 * end of this, and `split_test.cpp` holds both to the same text.
 *
 * Read on every reload and never part of the chain's signature: a volume
 * drag is not a new chain.
 */
#ifndef FLUIDEQ_ENGINE_SPLIT_FILE_H
#define FLUIDEQ_ENGINE_SPLIT_FILE_H

#include <string>
#include <string_view>

namespace fluideq_engine {

inline constexpr const wchar_t* kSplitFileName = L"fluideq-split.txt";

/** What the file asks of one output. */
struct SplitRole {
  /** The explicit main marker protects it during a route handoff as well. */
  bool primary = false;
  /** Some line names this output first: its sound goes into its ring. */
  bool source = false;
  /** The output the first line naming this one second feeds it from. */
  std::wstring from;
  /** That line's volume. */
  float volume = 1.0f;

  bool target() const noexcept { return !from.empty(); }
};

/**
 * `endpoint`'s part in `text`. A line that is not two well-formed ids and a
 * volume from 0 to 1, or that names one output twice, is no line at all;
 * ids match whatever their case. The first valid line selects the single
 * source; lines from other sources are ignored. Main cannot be a receiver.
 */
SplitRole split_role_of(std::string_view text, const std::wstring& endpoint);

}  // namespace fluideq_engine

#endif  // FLUIDEQ_ENGINE_SPLIT_FILE_H

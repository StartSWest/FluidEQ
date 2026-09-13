/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Which song the machine is playing, as the app tells the engine.
 *
 * `fluideq-programme.txt`, beside the rack file, written by the app whenever
 * Windows' media session names a different song:
 *
 *     # FluidEQ Engine programme v1
 *     song=0123456789abcdef
 *     level=-11.84
 *     peak=-0.62
 *
 * `song` is a hash the app made of the player, title and artist — the title
 * itself never reaches a file audiodg.exe can read. `level` and `peak` are
 * present only for a song an earlier play measured.
 *
 * Read on every reload but never part of the chain's signature: a new song is
 * not a new chain, and rebuilding one per track would re-prime the whole rack
 * between every two songs.
 */
#ifndef FLUIDEQ_ENGINE_PROGRAMME_H
#define FLUIDEQ_ENGINE_PROGRAMME_H

#include <cstdint>
#include <string_view>

namespace fluideq_engine {

inline constexpr const wchar_t* kProgrammeFileName = L"fluideq-programme.txt";

struct Programme {
  /** 0 when nothing names what is playing, which is also a missing file. */
  uint64_t song_id = 0;
  /** Below -100 when the song has not been measured before. */
  double level_lufs = -120;
  double peak_db = -120;
};

/**
 * The file's text as a programme. Never throws, and a song line that is not
 * sixteen hex digits is no song at all rather than a guess: a wrong identity
 * would level one song at another's remembered loudness.
 */
Programme parse_programme(std::string_view text);

}  // namespace fluideq_engine

#endif  // FLUIDEQ_ENGINE_PROGRAMME_H

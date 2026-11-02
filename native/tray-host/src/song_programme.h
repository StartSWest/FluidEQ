/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#pragma once

#include <optional>
#include <string>
#include <string_view>

/*
 * The song the FluidEQ Engine's leveling is told is playing, named and
 * written as main names and writes it (`src/main/songProgramme.ts`), so the
 * tray can tell the engine while Electron is gone and main can take over
 * again with the same names. Held to the TypeScript by
 * `song_programme_test.cpp` (`songProgrammeFixture.ts`).
 */

namespace feq::tray {

/** What the engine learned about a song it levelled (`ISongLevel`). */
struct SongLevel {
  double level_lufs = 0.0;
  double peak_db = 0.0;
};

/**
 * `songIdentity`: sixteen hex digits of the SHA-1 of the player, the title
 * and the artist, each trimmed as JavaScript trims and lowered as V8 lowers
 * (through ICU, as V8 does), joined on a NUL. None when Windows' ICU or
 * hashing is not there to make it.
 */
std::optional<std::string> song_identity(std::string_view app,
                                         std::string_view title,
                                         std::string_view artist);

/**
 * `Number.prototype.toFixed(2)`: the exact value rounded at its third
 * decimal, an exact half going to the larger magnitude as the spec picks the
 * larger n; a negative zero written as zero.
 */
std::string js_to_fixed2(double value);

/** `formatSongProgramme`: the file the engine reads, CRLF, ending in one. */
std::string song_programme_text(const std::optional<std::string>& id,
                                const std::optional<SongLevel>& known);

}  // namespace feq::tray

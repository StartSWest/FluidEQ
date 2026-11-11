/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/*
 * Which session the transport bar shows, as a rule over plain facts.
 *
 * Apart from main.cpp and free of Windows, like media_line.h, so the rule is
 * held by a test that runs on every platform (tests/media_choice_test.cpp).
 * main.cpp gathers the facts from Windows' sessions for each look and asks
 * this which one to read.
 */

#pragma once

#include <cstddef>
#include <optional>
#include <vector>

namespace fluideq_media {

/** What one look knows of one watched session, for choosing. */
struct Candidate {
  /**
   * Its playback info came back this look. A session whose player is closing
   * answers with nothing or with an error until the manager's SessionsChanged
   * for its going arrives; it is never chosen, and nothing it says counts.
   */
  bool readable = false;
  bool playing = false;
  /** It is the very session Windows calls current. */
  bool current = false;
  /** Its player is the one Windows calls current, as another object. */
  bool current_app = false;
};

/**
 * Anything playing wins; failing that, what Windows calls the current session
 * (the app's own sessions are never candidates), by object and then by
 * player; failing that, the first one still answering. The same rule as
 * `SELF_SKIP` in src/main/systemMedia.ts, which the next, previous and seek
 * commands choose their session by — a button must act on the session the
 * card above it names, so change the two together.
 */
inline std::optional<std::size_t> choose(
    const std::vector<Candidate>& candidates) {
  const auto first =
      [&candidates](auto&& wanted) -> std::optional<std::size_t> {
    for (std::size_t at = 0; at < candidates.size(); ++at) {
      if (candidates[at].readable && wanted(candidates[at])) {
        return at;
      }
    }
    return std::nullopt;
  };
  const auto playing = first([](const Candidate& c) { return c.playing; });
  if (playing) {
    return playing;
  }
  const auto current = first([](const Candidate& c) { return c.current; });
  if (current) {
    return current;
  }
  const auto app = first([](const Candidate& c) { return c.current_app; });
  if (app) {
    return app;
  }
  return first([](const Candidate&) { return true; });
}

}  // namespace fluideq_media

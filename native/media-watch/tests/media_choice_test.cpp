/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/*
 * Which session the media helper puts on the bar (media_choice.h).
 *
 * The rule the next, previous and seek commands choose by too (`SELF_SKIP`
 * in src/main/systemMedia.ts), and the one place a session that is going is
 * kept off the bar. The helper died in a 2.4.0 report reading such a session:
 * Windows answered its playback info with nothing, and the next read went
 * through address zero. It is now left out of the look, and the choice is
 * made among the sessions still answering.
 */

#include "media_choice.h"

#include <cstdio>
#include <optional>
#include <vector>

namespace {

int failures = 0;

void check(bool condition, const char* description) {
  std::printf("  %s %s\n", condition ? "ok  " : "FAIL", description);
  if (!condition) {
    ++failures;
  }
}

using fluideq_media::Candidate;
using fluideq_media::choose;

Candidate answering() {
  Candidate candidate;
  candidate.readable = true;
  return candidate;
}

Candidate playing() {
  Candidate candidate = answering();
  candidate.playing = true;
  return candidate;
}

Candidate current() {
  Candidate candidate = answering();
  candidate.current = true;
  return candidate;
}

Candidate current_app() {
  Candidate candidate = answering();
  candidate.current_app = true;
  return candidate;
}

/** A session whose player is closing: no playback info this look. */
Candidate going(Candidate said) {
  said.readable = false;
  return said;
}

void anything_playing_wins() {
  std::printf("anything playing wins\n");
  check(choose({answering(), current(), playing()}) == std::size_t{2},
        "a playing session over the current one");
  check(choose({playing(), playing()}) == std::size_t{0},
        "the first of two playing");
}

void then_the_current_session_by_object_then_by_player() {
  std::printf("then the current session, by object, then by player\n");
  check(choose({answering(), current_app(), current()}) == std::size_t{2},
        "the current object over its player's other object");
  check(choose({answering(), current_app()}) == std::size_t{1},
        "the current player when its object is another");
  check(choose({answering(), answering()}) == std::size_t{0},
        "the first one when nothing is current");
  check(!choose({}).has_value(), "nothing watched, nothing chosen");
}

void a_session_that_is_going_is_never_chosen() {
  std::printf("a session that is going is never chosen\n");
  // Each beside its control: the same list with the session answering
  // chooses it, so the choice below is the going session left out and not
  // the rule picking something else anyway.
  check(choose({answering(), playing()}) == std::size_t{1},
        "control: a playing session that answers is chosen");
  check(choose({answering(), going(playing())}) == std::size_t{0},
        "a playing session that answered with nothing is left out");
  check(choose({answering(), current()}) == std::size_t{1},
        "control: the current session that answers is chosen");
  check(choose({answering(), going(current())}) == std::size_t{0},
        "the current session that answered with nothing is left out");
  check(choose({going(answering()), answering()}) == std::size_t{1},
        "the first one still answering, not the first one listed");
  check(!choose({going(playing()), going(current())}).has_value(),
        "every session going: nothing chosen, never a going one");
}

void a_session_that_fails_on_the_way_is_dropped_and_the_choice_made_again() {
  std::printf("a chosen session that fails is dropped, then chosen again\n");
  // As report() does it: the chosen one's timeline or controls fail, it is
  // marked as going, and the next choice is among the rest.
  std::vector<Candidate> look{answering(), current(), playing()};
  std::vector<std::size_t> tried;
  // Bounded, so a rule that chose a dropped session again fails here
  // instead of looping for ever.
  for (std::optional<std::size_t> chosen = choose(look);
       chosen && tried.size() <= look.size(); chosen = choose(look)) {
    tried.push_back(*chosen);
    look[*chosen] = Candidate{};
  }
  check(tried == std::vector<std::size_t>{2, 1, 0},
        "playing, then current, then the first, then nothing");
}

}  // namespace

int main() {
  anything_playing_wins();
  then_the_current_session_by_object_then_by_player();
  a_session_that_is_going_is_never_chosen();
  a_session_that_fails_on_the_way_is_dropped_and_the_choice_made_again();
  if (failures != 0) {
    std::printf("%d media choice check(s) failed\n", failures);
    return 1;
  }
  std::printf("media choice: all checks passed\n");
  return 0;
}

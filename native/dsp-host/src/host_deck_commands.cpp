/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The decks' commands: loading, emptying, seeking, the cut and the fade that
 * put a deck on the path, the fade's drawn shape, and a track's gains.
 */
#include "host.h"

#include <cmath>
#include <mutex>
#include <string>

namespace feq_host {

/** LOAD_DECK: a file onto a deck, the handoff deck, or the next free one. */
bool load_deck(HostState& state, const FeqWireCommandFrame& frame) {
  if (!payload_within(frame.parameter_id, kMaxPathBytes, "deck path")) {
    return false;
  }
  std::string path(frame.parameter_id, '\0');
  if (frame.parameter_id > 0 &&
      !read_exact(path.data(), path.size())) {
    return false;
  }
  const auto asked = static_cast<uint32_t>(frame.parameter_index);
  const double cue = frame.value > 0.0 ? frame.value : 0.0;
  uint32_t deck = asked;
  bool loaded = false;
  bool heard = false;
  {
    const std::lock_guard<std::mutex> held(state.decoder_mutex);
    if (state.player != nullptr && asked == FEQ_DECK_SPARE) {
      // Named, and readied as soon as a deck is free (`ready_spare`),
      // which may be now or at the end of the fade that is running.
      state.spare_path = path;
      state.spare_seconds = cue;
      state.spare_wanted = true;
      ready_spare(state);
      loaded = true;
      deck = FEQ_PLAYER_DECKS;
    } else if (state.player != nullptr && asked == FEQ_DECK_HANDOFF) {
      deck = feq_player_handoff_deck(state.player);
      HostState::DeckNote& note = state.deck_notes[deck];
      if (feq_player_fading(state.player) == 0 && note.fresh &&
          note.path == path) {
        // Readied as the next track: decoded and cued already, so the
        // fade or the cut starts on the cue instead of after a load.
        loaded = std::fabs(note.cue_seconds - cue) < 1e-3 ||
                 feq_player_seek(state.player, deck, cue) != 0;
      } else {
        loaded = feq_player_load(state.player, deck, path.c_str()) != 0;
        // Cued in the same command, before the deck can be heard: a
        // seek sent after it would land on a deck already fading in,
        // and empty its read-ahead as it did.
        if (loaded && cue > 0.0) {
          feq_player_seek(state.player, deck, cue);
        }
      }
      note.path = loaded ? path : std::string();
      note.cue_seconds = cue;
      note.fresh = false;
      state.reserved_deck = loaded ? deck : FEQ_PLAYER_DECKS;
      if (state.spare_wanted && state.spare_path == path) {
        state.spare_wanted = false;
      }
      // Never a chain reset here. The deck goes on the path through
      // the fade or the cut that follows, and the cut resets for
      // itself (SELECT_DECK); a fade is two tracks mixed on purpose,
      // and a reset would empty the delay lines under the one going.
    } else if (state.player != nullptr && asked < FEQ_PLAYER_DECKS) {
      heard = feq_player_deck_audible(state.player, deck) != 0;
      loaded = feq_player_load(state.player, deck, path.c_str()) != 0;
      HostState::DeckNote& note = state.deck_notes[deck];
      note.path = loaded ? path : std::string();
      note.cue_seconds = 0.0;
      note.fresh = false;
    }
  }
  // A file opened, or named for the next free deck: the decoder's work,
  // and nothing the audio thread has taken will say so.
  state.decoder_bell.ring();
  if (loaded && deck < FEQ_PLAYER_DECKS) {
    state.player_has_source.store(true, std::memory_order_release);
    // A new source on the deck being heard, not an A/B toggle: every
    // delayed sample belongs to the previous track and would play on
    // under this one's gain. The spare deck being readied while the
    // other plays is neither (`feq_player_deck_audible`): the song
    // playing keeps its tail and its dynamics.
    if (heard && state.chain != nullptr) {
      feq_chain_reset(state.chain, FEQ_CHAIN_RESET_SOURCE_CHANGE);
    }
  }
  // The deck it landed on, which the app has to address from here on;
  // no deck for the next track, whose deck is decided when it is free.
  send_ack(frame.request_id,
           loaded ? FEQ_WIRE_APPLIED : FEQ_WIRE_REJECTED,
           frame.settings_revision, 0,
           loaded && deck < FEQ_PLAYER_DECKS ? static_cast<double>(deck)
                                             : -1.0);
  return true;
}

/** UNLOAD_DECK: a deck emptied. */
void unload_deck(HostState& state, const FeqWireCommandFrame& frame) {
  const std::lock_guard<std::mutex> held(state.decoder_mutex);
  const auto deck = static_cast<uint32_t>(frame.parameter_index);
  if (state.player != nullptr && deck < FEQ_PLAYER_DECKS) {
    feq_player_unload(state.player, deck);
    state.deck_notes[deck] = HostState::DeckNote{};
    if (state.reserved_deck == deck) {
      state.reserved_deck = FEQ_PLAYER_DECKS;
    }
    // Emptying a deck is the app letting go — of a queue that ran out,
    // or of the engine altogether — and a next track readied after it
    // would be decoded for nobody.
    state.spare_wanted = false;
  }
  send_ack(frame.request_id, FEQ_WIRE_APPLIED, frame.settings_revision, 0,
           0.0);
}

/** SEEK_DECK: a deck moved to a position. */
void seek_deck(HostState& state, const FeqWireCommandFrame& frame) {
  const auto deck = static_cast<uint32_t>(frame.parameter_index);
  bool sought = false;
  bool heard = false;
  {
    const std::lock_guard<std::mutex> held(state.decoder_mutex);
    if (state.player != nullptr) {
      heard = feq_player_deck_audible(state.player, deck) != 0;
      sought = feq_player_seek(state.player, deck, frame.value) != 0;
    }
  }
  // The read-ahead for the old position is dropped; the new one's is
  // the decoder's to fill, now rather than when a block next plays.
  state.decoder_bell.ring();
  // Cueing the spare deck to its lead-in while the other plays is not
  // a jump in what is heard (see LOAD_DECK).
  if (sought && heard && state.chain != nullptr) {
    feq_chain_reset(state.chain, FEQ_CHAIN_RESET_SEEK);
  }
  send_ack(frame.request_id,
           sought ? FEQ_WIRE_APPLIED : FEQ_WIRE_REJECTED,
           frame.settings_revision, 0, frame.value);
}

/** SELECT_DECK: a deck made the one heard, by a cut. */
void select_deck(HostState& state, const FeqWireCommandFrame& frame) {
  if (state.player != nullptr) {
    const auto deck = static_cast<uint32_t>(frame.parameter_index);
    // A cut to a deck that was not being heard puts a new source on
    // the path with no fade — the primed next track on a press of
    // Next — and every delayed sample in the chain is the previous
    // one's. Selecting the deck already heard changes nothing.
    const bool cut = deck < FEQ_PLAYER_DECKS &&
                     feq_player_deck_audible(state.player, deck) == 0;
    feq_player_select(state.player, deck);
    if (cut && state.chain != nullptr) {
      feq_chain_reset(state.chain, FEQ_CHAIN_RESET_SOURCE_CHANGE);
    }
    took_the_path(state, deck);
    // Which may have readied the next track onto the deck this left.
    state.decoder_bell.ring();
  }
  send_ack(frame.request_id, FEQ_WIRE_APPLIED, frame.settings_revision, 0,
           0.0);
}

/** CROSSFADE: a fade to a deck, or at no length a cut. */
void crossfade(HostState& state, const FeqWireCommandFrame& frame) {
  if (state.player != nullptr) {
    const auto to_deck = static_cast<uint32_t>(frame.parameter_index);
    // A fade of no length is a cut (`feq_player_start_crossfade`), and
    // a cut to a deck not yet heard is a new source: as SELECT_DECK. A
    // fade of any length is not — the outgoing deck stays on the path
    // and the chain carries the two of them mixed, which is the fade.
    const bool cut = frame.value <= 0.0 && to_deck < FEQ_PLAYER_DECKS &&
                     feq_player_deck_audible(state.player, to_deck) == 0;
    // Checked before the cast rather than after it: a number past the last
    // curve is not a value of the enum, and converting one to it is
    // undefined. The player falls back to equal power for the same number.
    const FeqCrossfadeCurve curve =
        frame.parameter_id <= static_cast<uint32_t>(FEQ_CROSSFADE_CUSTOM)
            ? static_cast<FeqCrossfadeCurve>(frame.parameter_id)
            : FEQ_CROSSFADE_EQUAL_POWER;
    feq_player_start_crossfade(state.player, to_deck, frame.value, curve);
    if (cut && state.chain != nullptr) {
      feq_chain_reset(state.chain, FEQ_CHAIN_RESET_SOURCE_CHANGE);
    }
    took_the_path(state, to_deck);
    state.decoder_bell.ring();
  }
  send_ack(frame.request_id, FEQ_WIRE_APPLIED, frame.settings_revision, 0,
           frame.value);
}

/** SET_CROSSFADE_TABLE: the dragged fade shape, for the next fade. */
bool set_crossfade_table(HostState& state, const FeqWireCommandFrame& frame) {
  // Read before the player check so a refused table still drains its
  // payload: leaving 128 doubles in the pipe desynchronises every
  // command after it, which reads as the host ignoring the transport.
  double points[FEQ_CROSSFADE_TABLE_POINTS * 2] = {0.0};
  if (!read_exact(points, sizeof(points))) {
    return false;
  }
  if (state.player != nullptr) {
    FeqCrossfadeTable table;
    for (int at = 0; at < FEQ_CROSSFADE_TABLE_POINTS; ++at) {
      table.outgoing[at] = static_cast<float>(points[at]);
      table.incoming[at] =
          static_cast<float>(points[FEQ_CROSSFADE_TABLE_POINTS + at]);
    }
    feq_player_set_crossfade_table(state.player, &table);
  }
  send_ack(frame.request_id, FEQ_WIRE_APPLIED, frame.settings_revision, 0,
           0.0);
  return true;
}

/** SET_TRACK_GAINS: the Library's measured gains for the track, together. */
bool set_track_gains(HostState& state, const FeqWireCommandFrame& frame) {
  // Two doubles, because they always arrive together: split across two
  // commands a track would play for a block with one applied and not
  // the other, which is the level step the ramp exists to prevent.
  double gains[2] = {0.0, 0.0};
  if (!read_exact(gains, sizeof(gains))) {
    return false;
  }
  if (state.chain != nullptr) {
    feq_chain_set_track_level_gains(state.chain, gains[0], gains[1],
                                    frame.parameter_id != 0 ? 1 : 0);
  }
  send_ack(frame.request_id, FEQ_WIRE_APPLIED, frame.settings_revision, 0,
           gains[0]);
  return true;
}

}  // namespace feq_host

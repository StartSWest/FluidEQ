/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Every change to what is heard, carried out by the audio thread at the top
 * of a block: a deck given a new file, a cut, a fade — and a skip taken
 * inside a fade, which is a new file on a deck the fade is using.
 *
 * Nothing heard may stop or start on the spot. What leaves the path goes out
 * under its tail, what joins it comes in under an entry, and a fade pointed
 * somewhere new starts every deck from the level it was at.
 */

#include "player_internal.h"

using feq_player::Deck;
using feq_player::kNoBoundary;
using feq_player::role_level;
using feq_player::RoleRequest;

namespace {

/** A level below this is silence: -120 dB, far under any dither. */
constexpr double kInaudible = 1e-6;

/** The level a deck is actually heard at: its role, its entry, the output's. */
double heard_level(const FeqPlayer* player, uint32_t deck) {
  if (!player->was_playing) {
    return 0.0;
  }
  const Deck& state = player->decks[deck];
  return role_level(player, deck) *
         feq_player::ramp_level(state.entry_remaining,
                                player->soft_start_frames, state.entry_from) *
         feq_player::ramp_level(player->soft_start_remaining,
                                player->soft_start_frames, 0.0);
}

void arm_entry(FeqPlayer* player, Deck& deck, double from) {
  deck.entry_remaining = player->soft_start_frames;
  deck.entry_from = from;
}

/**
 * Copy what the deck would have played next into its tail, at `level`, up to
 * `limit` in its ring. A tail still playing is kept, with the ramp it had
 * reached baked in, so the two leave together.
 */
void snapshot_tail(FeqPlayer* player, Deck& deck, double level,
                   uint64_t limit) {
  const uint32_t capacity = player->soft_start_frames;
  if (capacity == 0) {
    return;
  }
  uint32_t kept = 0;
  if (deck.tail_at < deck.tail_length) {
    kept = deck.tail_length - deck.tail_at;
    const auto length = static_cast<double>(deck.tail_length);
    for (uint32_t at = 0; at < kept; ++at) {
      const auto ramp = static_cast<float>(
          1.0 - static_cast<double>(deck.tail_at + at) / length);
      for (uint32_t channel = 0; channel < player->channels; ++channel) {
        deck.tail_pointers[channel][at] =
            deck.tail_pointers[channel][deck.tail_at + at] * ramp;
      }
    }
  }
  for (uint32_t channel = 0; channel < player->channels; ++channel) {
    for (uint32_t at = kept; at < capacity; ++at) {
      deck.tail_pointers[channel][at] = 0.0f;
    }
  }

  const uint64_t at = deck.ring.read_cursor();
  const uint64_t before_limit = limit > at ? limit - at : 0;
  const uint32_t available = deck.ring.available();
  uint64_t wanted = before_limit < available ? before_limit : available;
  if (wanted > capacity) {
    wanted = capacity;
  }
  const auto take = static_cast<uint32_t>(wanted);
  const auto gain = static_cast<float>(level);
  uint32_t done = 0;
  while (done < take) {
    const uint32_t left = take - done;
    const uint32_t chunk = left < player->max_frames ? left : player->max_frames;
    deck.ring.read(player->mix_pointers[0].data(), chunk);
    for (uint32_t channel = 0; channel < player->channels; ++channel) {
      for (uint32_t index = 0; index < chunk; ++index) {
        deck.tail_pointers[channel][done + index] +=
            player->mix_pointers[0][channel][index] * gain;
      }
    }
    done += chunk;
  }
  deck.tail_length = kept > take ? kept : take;
  deck.tail_at = 0;
}

/** A seek still waiting on this deck cuts what would have been heard there. */
uint64_t heard_until(const Deck& deck, uint64_t limit) {
  if (deck.flush_request.load(std::memory_order_acquire) != deck.flush_seen) {
    const uint64_t flush_to = deck.flush_to.load(std::memory_order_acquire);
    return flush_to < limit ? flush_to : limit;
  }
  return limit;
}

/** A deck leaving the path with its content: it goes out under its tail. */
void leave_path(FeqPlayer* player, uint32_t deck) {
  const double heard = heard_level(player, deck);
  if (heard <= kInaudible) {
    return;
  }
  Deck& state = player->decks[deck];
  snapshot_tail(player, state, heard,
                heard_until(state, feq_player::switch_boundary(state)));
}

/**
 * Point the running fade at `deck`, whose content just changed, from its
 * first frame: the new track comes in from silence over the whole fade, and
 * the other deck goes out from the level it had reached.
 *
 * This is what a skip taken inside a fade is. Both decks are in use, so the
 * new track takes one of them (`feq_player_handoff_deck` picks the quieter)
 * and the other is what is left to fade out of — at its own level, never
 * stepped back up to full (Ivan, 2026-09-23: "clicking 3 needs to
 * immediately crossfade to 3").
 */
void retarget(FeqPlayer* player, uint32_t deck) {
  const uint32_t source = feq_player::other_deck(deck);
  const double level = role_level(player, source);
  player->active.store(source, std::memory_order_release);
  player->incoming.store(deck, std::memory_order_release);
  feq_crossfader_restart(&player->fader, player->fader.curve,
                         player->fader.duration_frames, level);
  player->holding = false;
}

void switch_content(FeqPlayer* player, uint32_t index, uint64_t to) {
  Deck& deck = player->decks[index];
  const double heard = heard_level(player, index);
  if (heard > kInaudible) {
    snapshot_tail(player, deck, heard, heard_until(deck, to));
  }
  deck.ring.discard_until(to);
  deck.entry_remaining = 0;
  const uint32_t active = player->active.load(std::memory_order_relaxed);
  const uint32_t incoming = player->incoming.load(std::memory_order_relaxed);
  if (feq_player::fading_now(player) &&
      (index == active || index == incoming)) {
    retarget(player, index);
    return;
  }
  if (index == active && player->was_playing) {
    // Replaced where it is heard alone: the new file comes in over the entry
    // while the old one leaves over its tail.
    arm_entry(player, deck, 0.0);
  }
}

/** Every change of content not yet taken, oldest first. */
void apply_switches(FeqPlayer* player) {
  for (;;) {
    uint32_t next = FEQ_PLAYER_DECKS;
    uint64_t oldest = kNoBoundary;
    for (uint32_t index = 0; index < FEQ_PLAYER_DECKS; ++index) {
      const Deck& deck = player->decks[index];
      const uint64_t stamp = deck.switch_stamp.load(std::memory_order_acquire);
      if (stamp != deck.switch_seen && stamp < oldest) {
        oldest = stamp;
        next = index;
      }
    }
    if (next == FEQ_PLAYER_DECKS) {
      return;
    }
    Deck& deck = player->decks[next];
    deck.switch_seen = oldest;
    switch_content(player, next,
                   deck.switch_to.load(std::memory_order_acquire));
  }
}

void cut_to(FeqPlayer* player, uint32_t target) {
  for (uint32_t deck = 0; deck < FEQ_PLAYER_DECKS; ++deck) {
    if (deck != target) {
      leave_path(player, deck);
    }
  }
  Deck& arriving = player->decks[target];
  const double from =
      role_level(player, target) *
      feq_player::ramp_level(arriving.entry_remaining,
                             player->soft_start_frames, arriving.entry_from);
  player->active.store(target, std::memory_order_release);
  player->incoming.store(target, std::memory_order_release);
  player->fader.active = 0;
  player->fader.outgoing_scale = 1.0;
  player->holding = false;
  // Rises from where it was — silence for a deck nobody heard, part way for
  // one a fade was bringing in. Stopped, the output's own entry covers it.
  if (player->was_playing && from < 1.0 - kInaudible) {
    arm_entry(player, arriving, from);
  }
}

void apply_request(FeqPlayer* player, const RoleRequest& request) {
  // The cut first: a fade asked for behind it goes out of what it brought in.
  if (request.cut && request.cut_deck < FEQ_PLAYER_DECKS) {
    cut_to(player, request.cut_deck);
  }
  if (!request.fade || request.duration == 0 ||
      request.deck >= FEQ_PLAYER_DECKS) {
    return;
  }
  const uint32_t active = player->active.load(std::memory_order_relaxed);
  const uint32_t incoming = player->incoming.load(std::memory_order_relaxed);
  if (!feq_player::fading_now(player)) {
    if (request.deck == active) {
      return;
    }
    /**
     * Nothing heard when the fade was asked for — the transport stopped, the
     * previous track paused — is nothing to fade out of: the fade is the new
     * track coming in and nothing else. Starting the paused one again only to
     * fade it away was a track the listener had stopped coming back (Ivan,
     * 2026-09-23: "if crossfade is on and we don't have a source ... we just
     * fade in the target").
     */
    if (!request.heard) {
      leave_path(player, active);
    }
    player->incoming.store(request.deck, std::memory_order_release);
    feq_crossfader_restart(&player->fader, request.curve, request.duration,
                           request.heard ? 1.0 : 0.0);
    player->holding = false;
    return;
  }
  if (request.deck == incoming) {
    // The fade already running, asked for again: it keeps its place on the
    // curve and the level its outgoing side started from.
    feq_crossfader_start(&player->fader, request.curve, request.duration);
    if (!request.heard) {
      leave_path(player, active);
      player->fader.outgoing_scale = 0.0;
    }
  }
  // A fade back to the deck being left, with nothing new on it, is not a
  // change the app asks for; a new track there arrives as a load
  // (`retarget`), which is the only way a skip reaches it.
}

}  // namespace

namespace feq_player {

void apply_changes(FeqPlayer* player, uint64_t request) {
  apply_switches(player);
  if ((request & kRequestPresent) != 0) {
    apply_request(player, unpack_request(request));
  }
}

}  // namespace feq_player

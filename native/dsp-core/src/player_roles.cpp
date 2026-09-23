/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * What any thread may ask of the player: a cut, a fade, and which deck is
 * heard. A cut or a fade is a request the audio thread carries out at the top
 * of its next block (`player_render.cpp`); every question is answered as if
 * the change asked for had already been made.
 */

#include "player_internal.h"

using feq_player::kRequestPresent;
using feq_player::RoleRequest;
using feq_player::Roles;

namespace feq_player {

Roles effective_roles(const FeqPlayer* player) {
  Roles roles;
  roles.active = player->active.load(std::memory_order_acquire);
  roles.incoming = player->incoming.load(std::memory_order_acquire);
  roles.fading = player->fading_published.load(std::memory_order_acquire) != 0 &&
                 roles.incoming != roles.active;
  const uint64_t word = player->request.load(std::memory_order_acquire);
  if ((word & kRequestPresent) == 0) {
    return roles;
  }
  const RoleRequest request = unpack_request(word);
  if (request.cut && request.cut_deck < FEQ_PLAYER_DECKS) {
    roles.active = request.cut_deck;
    roles.incoming = request.cut_deck;
    roles.fading = false;
  }
  if (request.fade && request.duration > 0 &&
      request.deck < FEQ_PLAYER_DECKS && !roles.fading &&
      request.deck != roles.active) {
    roles.incoming = request.deck;
    roles.fading = true;
  }
  return roles;
}

}  // namespace feq_player

namespace {

/** A cut, which replaces whatever was asked for and not yet made. */
void post_cut(FeqPlayer* player, uint32_t deck) {
  RoleRequest request;
  request.cut = true;
  request.cut_deck = deck;
  player->request.store(feq_player::pack_request(request),
                        std::memory_order_release);
}

}  // namespace

extern "C" {

void feq_player_set_playing(FeqPlayer* player, int playing) {
  if (player == nullptr) {
    return;
  }
  const int wanted = playing != 0 ? 1 : 0;
  const int before = player->playing.exchange(wanted, std::memory_order_acq_rel);
  if (wanted != 0 && before == 0) {
    // Entering playback, which is the other moment output arrives mid-waveform.
    // Only on the transition: a redundant "play" while already playing would
    // otherwise duck the sound for no reason a listener could name.
    player->soft_start_request.fetch_add(1, std::memory_order_acq_rel);
  }
}

int feq_player_is_playing(const FeqPlayer* player) {
  return player != nullptr ? player->playing.load(std::memory_order_acquire)
                           : 0;
}

void feq_player_select(FeqPlayer* player, uint32_t deck) {
  if (player == nullptr || deck >= FEQ_PLAYER_DECKS) {
    return;
  }
  post_cut(player, deck);
}

uint32_t feq_player_active_deck(const FeqPlayer* player) {
  return player != nullptr ? feq_player::effective_roles(player).active : 0;
}

uint32_t feq_player_reported_deck(const FeqPlayer* player) {
  if (player == nullptr) {
    return 0;
  }
  const Roles roles = feq_player::effective_roles(player);
  return roles.fading ? roles.incoming : roles.active;
}

int feq_player_deck_audible(const FeqPlayer* player, uint32_t deck) {
  if (player == nullptr || deck >= FEQ_PLAYER_DECKS) {
    return 0;
  }
  const Roles roles = feq_player::effective_roles(player);
  return deck == roles.active || (roles.fading && deck == roles.incoming) ? 1
                                                                          : 0;
}

int feq_player_fading(const FeqPlayer* player) {
  return player != nullptr && feq_player::effective_roles(player).fading ? 1
                                                                         : 0;
}

uint32_t feq_player_handoff_deck(const FeqPlayer* player) {
  if (player == nullptr) {
    return 0;
  }
  const Roles roles = feq_player::effective_roles(player);
  if (!roles.fading) {
    return feq_player::other_deck(roles.active);
  }
  // A fade asked for and not begun yet: its track has not been heard, and the
  // newest one takes its deck.
  const uint64_t word = player->request.load(std::memory_order_acquire);
  if ((word & kRequestPresent) != 0) {
    const RoleRequest request = feq_player::unpack_request(word);
    if (request.fade && request.deck < FEQ_PLAYER_DECKS) {
      return request.deck;
    }
  }
  const float leaving =
      player->level_published[roles.active].load(std::memory_order_acquire);
  const float arriving =
      player->level_published[roles.incoming].load(std::memory_order_acquire);
  return leaving < arriving ? roles.active : roles.incoming;
}

void feq_player_start_crossfade(FeqPlayer* player,
                                uint32_t to_deck,
                                double duration_ms,
                                FeqCrossfadeCurve curve) {
  if (player == nullptr || to_deck >= FEQ_PLAYER_DECKS) {
    return;
  }
  const double frames = (duration_ms / 1000.0) * player->output_rate;
  // Anything under a frame is a cut, and a NaN is too.
  if (!(frames >= 1.0)) {
    post_cut(player, to_deck);
    return;
  }
  RoleRequest request;
  request.fade = true;
  request.deck = to_deck;
  request.duration = static_cast<uint64_t>(frames);
  request.curve =
      curve >= FEQ_CROSSFADE_EQUAL_POWER && curve <= FEQ_CROSSFADE_CUSTOM
          ? curve
          : FEQ_CROSSFADE_EQUAL_POWER;
  request.heard = player->playing.load(std::memory_order_acquire) != 0;
  /**
   * A cut asked for and not yet made stays ahead of the fade: the fade goes
   * out of the track that cut brought in.
   *
   * Newest-wins alone dropped it. A track cut to and then faded away from
   * inside one block — two clicks a few milliseconds apart, or every command
   * of an offline render, where no block runs between them — lost its cut,
   * and the fade that followed was measured against the deck heard before:
   * a fade to the deck already playing, refused, and the track it was for
   * started at full level with no fade at all. The audio thread can take the
   * word between this read and the store; the cut is then made twice, and
   * a cut to the deck already heard alone changes nothing.
   */
  const uint64_t pending = player->request.load(std::memory_order_acquire);
  if ((pending & kRequestPresent) != 0) {
    const RoleRequest was = feq_player::unpack_request(pending);
    request.cut = was.cut;
    request.cut_deck = was.cut_deck;
  }
  player->request.store(feq_player::pack_request(request),
                        std::memory_order_release);
}

void feq_player_set_crossfade_table(FeqPlayer* player,
                                    const FeqCrossfadeTable* table) {
  if (player == nullptr || table == nullptr) {
    return;
  }
  // The pending copy only. The live one is the audio thread's, which
  // promotes this at the start of the next fade.
  player->fader.pending = *table;
}

double feq_player_crossfade_progress(const FeqPlayer* player) {
  return player != nullptr ? feq_crossfader_progress(&player->fader) : 1.0;
}

}  // extern "C"

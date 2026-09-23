/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The audio thread's part of the player: reading the decks and mixing what
 * is heard, after the changes asked for since the last block have been made
 * (`player_changes.cpp`).
 *
 * Nothing here allocates, locks or calls the system: the tails and the mix
 * buffers are sized when the player is made, and the other threads reach in
 * only through atomics (`player_internal.h`).
 */

#include "player_internal.h"

using feq_player::Deck;
using feq_player::kNoBoundary;

namespace {

/**
 * Ramp the block up from wherever the entry left off, if one is running.
 *
 * Linear over roughly eighty milliseconds, which is what the element path uses
 * and long enough that a step at any waveform position is inaudible. Nothing at
 * all when no entry is armed, which is every block but a handful per track.
 *
 * Applied to the finished output, so during a crossfade it attenuates the mix
 * rather than one deck of it — otherwise a fade that began at the same moment
 * as a seek would have the two curves multiplied on one side only.
 */
void apply_soft_start(FeqPlayer* player, float* const* channels,
                      uint32_t frames) {
  if (player->soft_start_remaining == 0 || player->soft_start_frames == 0) {
    return;
  }
  const auto total = static_cast<double>(player->soft_start_frames);
  const uint32_t span =
      frames < player->soft_start_remaining ? frames : player->soft_start_remaining;
  for (uint32_t at = 0; at < span; ++at) {
    // Where this sample sits in the ramp, counted from the end so that a block
    // boundary cannot restart it.
    const double done =
        total - static_cast<double>(player->soft_start_remaining - at);
    const auto gain = static_cast<float>(done / total);
    for (uint32_t channel = 0; channel < player->channels; ++channel) {
      channels[channel][at] *= gain;
    }
  }
  player->soft_start_remaining -= span;
}

/**
 * Frames the reader may take now: what is buffered, short of a change of
 * content made during this block, which waits for the top of the next one.
 */
uint32_t readable(const Deck& deck) {
  const uint32_t available = deck.ring.available();
  const uint64_t boundary = feq_player::switch_boundary(deck);
  if (boundary == kNoBoundary) {
    return available;
  }
  const uint64_t at = deck.ring.read_cursor();
  const uint64_t left = boundary > at ? boundary - at : 0;
  return left < available ? static_cast<uint32_t>(left) : available;
}

/** Consumer side. Applies any pending seek first. */
void read_deck(FeqPlayer* player, Deck& deck, float* const* output,
               uint32_t frames) {
  /**
   * A load that lands while this block is being made is carried out at the
   * top of the next one, where what was left of the old file can leave under
   * its tail and a fade can be pointed at the new one. Until then the reader
   * stays on the old side of the line: neither a read nor a seek's cut takes
   * it across. The old side holds the whole read-ahead, so in practice this
   * block is the old file's to the end.
   */
  const uint64_t boundary = feq_player::switch_boundary(deck);
  const uint64_t request = deck.flush_request.load(std::memory_order_acquire);
  if (request != deck.flush_seen) {
    const uint64_t flush_to = deck.flush_to.load(std::memory_order_acquire);
    if (flush_to <= boundary) {
      deck.ring.discard_until(flush_to);
      deck.flush_seen = request;
    }
  }
  const uint32_t ready = readable(deck);
  const uint32_t span = ready < frames ? ready : frames;
  deck.ring.read(output, span);
  for (uint32_t channel = 0; channel < player->channels; ++channel) {
    for (uint32_t at = span; at < frames; ++at) {
      output[channel][at] = 0.0f;
    }
  }
  if (deck.ring.available() == 0 &&
      deck.exhausted.load(std::memory_order_acquire) != 0 &&
      deck.state.load(std::memory_order_acquire) == FEQ_DECK_READY) {
    deck.state.store(FEQ_DECK_ENDED, std::memory_order_release);
  }

  // This deck's own entry (`Deck::entry_request`): the output's ramp,
  // restricted to one deck and starting where the deck's level was, counted
  // from its end so a block boundary cannot restart it.
  const uint64_t entry = deck.entry_request.load(std::memory_order_acquire);
  if (entry != deck.entry_seen) {
    deck.entry_seen = entry;
    deck.entry_remaining = player->soft_start_frames;
    deck.entry_from = 0.0;
  }
  if (deck.entry_remaining == 0 || player->soft_start_frames == 0) {
    return;
  }
  const auto total = static_cast<double>(player->soft_start_frames);
  const uint32_t ramped =
      frames < deck.entry_remaining ? frames : deck.entry_remaining;
  for (uint32_t at = 0; at < ramped; ++at) {
    const double done =
        (total - static_cast<double>(deck.entry_remaining - at)) / total;
    const auto gain =
        static_cast<float>(deck.entry_from + (1.0 - deck.entry_from) * done);
    for (uint32_t channel = 0; channel < player->channels; ++channel) {
      output[channel][at] *= gain;
    }
  }
  deck.entry_remaining -= ramped;
}

/** What left the path, going down its ramp (`Deck::tail_storage`). */
void mix_tails(FeqPlayer* player, float* const* channels, uint32_t frames) {
  for (auto& deck : player->decks) {
    if (deck.tail_at >= deck.tail_length) {
      continue;
    }
    const auto length = static_cast<double>(deck.tail_length);
    const uint32_t left = deck.tail_length - deck.tail_at;
    const uint32_t span = frames < left ? frames : left;
    for (uint32_t at = 0; at < span; ++at) {
      const auto ramp = static_cast<float>(
          1.0 - static_cast<double>(deck.tail_at + at) / length);
      for (uint32_t channel = 0; channel < player->channels; ++channel) {
        channels[channel][at] +=
            deck.tail_pointers[channel][deck.tail_at + at] * ramp;
      }
    }
    deck.tail_at += span;
  }
}

void publish(FeqPlayer* player) {
  player->fading_published.store(feq_player::fading_now(player) ? 1 : 0,
                                 std::memory_order_release);
  for (uint32_t deck = 0; deck < FEQ_PLAYER_DECKS; ++deck) {
    player->level_published[deck].store(
        static_cast<float>(feq_player::role_level(player, deck)),
        std::memory_order_release);
  }
}

}  // namespace

extern "C" {

void feq_player_render(FeqPlayer* player, float* const* channels,
                       uint32_t frames) {
  if (player == nullptr || channels == nullptr || frames == 0 ||
      frames > player->max_frames) {
    return;
  }

  /**
   * Changes first, content before roles, each in the order it was made.
   *
   * The request is taken before the loads are looked at: a load made before
   * a fade was asked for happened-before the request was posted, so taking
   * the request first is what guarantees the load is seen with it — and a
   * load onto a deck in a running fade points the fade at the new track
   * before the fade asked for next can find it.
   */
  feq_player::apply_changes(
      player, player->request.exchange(0, std::memory_order_acq_rel));

  if (player->playing.load(std::memory_order_acquire) == 0) {
    for (uint32_t channel = 0; channel < player->channels; ++channel) {
      for (uint32_t at = 0; at < frames; ++at) {
        channels[channel][at] = 0.0f;
      }
    }
    // Nothing is heard while stopped, so nothing is left to fade out: a tail
    // kept across a pause would come back on play as a fragment of a track
    // that had already gone.
    for (auto& deck : player->decks) {
      deck.tail_at = deck.tail_length;
    }
    player->was_playing = false;
    publish(player);
    return;
  }

  /**
   * The soft entry, armed by `set_playing` and by `seek`.
   *
   * Taken before the output is produced rather than after, so the countdown
   * below covers this block's own samples — and applied at the very end to
   * whatever was produced, mixed or not, because a fade running during a
   * crossfade must attenuate the RESULT rather than one side of it.
   */
  const uint64_t soft_request =
      player->soft_start_request.load(std::memory_order_acquire);
  if (soft_request != player->soft_start_seen) {
    player->soft_start_seen = soft_request;
    player->soft_start_remaining = player->soft_start_frames;
  }

  const uint32_t active = player->active.load(std::memory_order_relaxed);
  const uint32_t incoming = player->incoming.load(std::memory_order_relaxed);
  if (!feq_player::fading_now(player)) {
    read_deck(player, player->decks[active], channels, frames);
    player->holding = false;
  } else {
    /**
     * A fade does not begin until the deck it is fading INTO has audio.
     *
     * A deck's read-ahead ring is empty the instant it is loaded and the
     * decoder thread fills it in the background, so a caller that loads and
     * fades in the same breath is asking to mix toward a deck holding nothing.
     * Measured on a fresh deck, the first third of a two-second fade came out
     * silent — reported from the window as the crossfade not working, which
     * from a listener's seat it is not.
     *
     * Held here rather than waited out by the caller, because a caller cannot
     * know when a ring it does not own has filled. This is the knowledge: the
     * fade starts on the first block where there is something to fade to.
     *
     * Deliberately NOT applied when the deck has ended or was never loaded — a
     * deck that will never produce audio would hold the fade open forever, and
     * a transition that never completes is worse than one that starts dry.
     */
    Deck& arriving = player->decks[incoming];
    if (readable(arriving) < frames &&
        arriving.state.load(std::memory_order_acquire) == FEQ_DECK_READY &&
        arriving.exhausted.load(std::memory_order_acquire) == 0) {
      // The outgoing deck alone, at the level the fade has taken it to, and
      // the fader untouched, so no part of the curve is consumed while there
      // is nothing on the other side of it.
      read_deck(player, player->decks[active], channels, frames);
      const auto held =
          static_cast<float>(feq_crossfader_gain(&player->fader, 0));
      if (held != 1.0f) {
        for (uint32_t channel = 0; channel < player->channels; ++channel) {
          for (uint32_t at = 0; at < frames; ++at) {
            channels[channel][at] *= held;
          }
        }
      }
      player->holding = true;
    } else {
      /**
       * Both decks are pulled every block of a fade, and only during one.
       *
       * A deck that is not being read is a deck whose ring fills and stops,
       * so reading the incoming one only once the fade begins is what keeps
       * its read-ahead bounded rather than making it decode the whole track
       * while it waits its turn.
       */
      read_deck(player, player->decks[active], player->mix_pointers[0].data(),
                frames);
      read_deck(player, arriving, player->mix_pointers[1].data(), frames);
      const auto* const* outgoing =
          reinterpret_cast<const float* const*>(player->mix_pointers[0].data());
      const auto* const* arriving_mix =
          reinterpret_cast<const float* const*>(player->mix_pointers[1].data());
      feq_crossfader_mix(&player->fader, outgoing, arriving_mix, channels,
                         player->channels, frames);
      player->holding = false;
      if (player->fader.active == 0) {
        // Promoted here rather than by the caller. An index swap costs
        // nothing, and waiting for another thread to notice would put the
        // outgoing track back for however many blocks that took.
        player->active.store(incoming, std::memory_order_release);
      }
    }
  }

  apply_soft_start(player, channels, frames);
  // After the entry, which is the arriving sound's: what is leaving was
  // heard at its own level up to the last block and goes down from there.
  mix_tails(player, channels, frames);
  player->was_playing = true;
  publish(player);
}

}  // extern "C"

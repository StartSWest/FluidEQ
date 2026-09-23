/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The decoder thread's part of the player: files opened and closed, decks
 * seeked, rings filled, and what each deck holds — plus the player's making
 * and unmaking. What is heard is `player_render.cpp`'s, and what any thread
 * may ask is `player_roles.cpp`'s.
 */

#include "player_internal.h"

using feq_player::Deck;

namespace {

/** Decoded in one go, before resampling. A block, not a buffer. */
constexpr uint32_t kDecodeChunk = 4096;
/**
 * A deck is primed once it holds this much, or once its decoder is done.
 *
 * Quarter of a second: long enough that a first block cannot arrive before the
 * file is open, short enough that pressing play still feels immediate.
 */
constexpr double kPrimeSeconds = 0.25;

void plan_buffers(std::vector<float>& storage, std::vector<float*>& pointers,
                  uint32_t channels, uint32_t frames) {
  storage.assign(static_cast<size_t>(channels) * frames, 0.0f);
  pointers.assign(channels, nullptr);
  for (uint32_t channel = 0; channel < channels; ++channel) {
    pointers[channel] = storage.data() + static_cast<size_t>(channel) * frames;
  }
}

/** The file's decoder goes; the frames it already decoded stay in the ring. */
void release_decoder(FeqPlayer* player, Deck& deck) {
  if (deck.handle != nullptr && player->ops.close != nullptr) {
    player->ops.close(player->ops.user, deck.handle);
  }
  deck.handle = nullptr;
  feq_resampler_destroy(deck.resampler);
  deck.resampler = nullptr;
  deck.exhausted.store(0, std::memory_order_release);
  deck.decoded.store(0, std::memory_order_release);
  deck.origin.store(0, std::memory_order_release);
  deck.pending = 0;
  deck.pending_at = 0;
}

/** Everything written from here on is the new content (`Deck::switch_to`). */
void post_switch(FeqPlayer* player, Deck& deck) {
  deck.switch_to.store(deck.ring.write_cursor(), std::memory_order_release);
  const uint64_t stamp =
      player->switch_counter.fetch_add(1, std::memory_order_acq_rel) + 1;
  deck.switch_stamp.store(stamp, std::memory_order_release);
}

/**
 * Move one chunk from the decoder into the ring, converting on the way.
 *
 * Returns device-rate frames written. Zero means either the ring is full or
 * the file is finished, and the caller distinguishes them by `exhausted`.
 */
uint32_t fill_deck(FeqPlayer* player, Deck& deck) {
  if (deck.handle == nullptr || deck.resampler == nullptr) {
    return 0;
  }
  const uint32_t room = deck.ring.space();
  if (room == 0) {
    return 0;
  }

  if (deck.pending_at >= deck.pending) {
    if (deck.exhausted.load(std::memory_order_acquire) != 0) {
      // The file is done, but half the resampler's window is still inside it.
      // A fifth of a millisecond, which is inaudible alone and a click at the
      // end of every track on a gapless album.
      const uint32_t span = room < player->max_frames ? room : player->max_frames;
      const uint32_t flushed = feq_resampler_flush(
          deck.resampler, deck.converted_pointers.data(), span);
      if (flushed == 0) {
        return 0;
      }
      const auto* const* source =
          reinterpret_cast<const float* const*>(deck.converted_pointers.data());
      const uint32_t written = deck.ring.write(source, flushed);
      deck.decoded.fetch_add(written, std::memory_order_acq_rel);
      return written;
    }
    deck.pending = player->ops.read(player->ops.user, deck.handle,
                                    deck.decoded_pointers.data(), kDecodeChunk);
    deck.pending_at = 0;
    if (deck.pending < kDecodeChunk) {
      deck.exhausted.store(1, std::memory_order_release);
    }
    if (deck.pending == 0) {
      return 0;
    }
  }

  const uint32_t span = room < player->max_frames ? room : player->max_frames;
  // Held on the deck rather than built per call. This is not the audio thread,
  // but a decoder that allocates on every chunk allocates a few thousand times
  // a minute for a pointer array whose length never changes.
  for (uint32_t channel = 0; channel < player->channels; ++channel) {
    deck.source_pointers[channel] =
        deck.decoded_pointers[channel] + deck.pending_at;
  }
  uint32_t consumed = 0;
  const uint32_t produced = feq_resample(
      deck.resampler, deck.source_pointers.data(),
      deck.pending - deck.pending_at, deck.converted_pointers.data(), span,
      &consumed);
  deck.pending_at += consumed;
  if (produced == 0) {
    return 0;
  }
  const auto* const* converted =
      reinterpret_cast<const float* const*>(deck.converted_pointers.data());
  const uint32_t written = deck.ring.write(converted, produced);
  deck.decoded.fetch_add(written, std::memory_order_acq_rel);
  return written;
}

}  // namespace

extern "C" {

FeqPlayer* feq_player_create(double output_rate,
                             uint32_t channels,
                             uint32_t maximum_block_frames,
                             uint32_t read_ahead_frames,
                             const FeqDecoderOps* ops) {
  if (!(output_rate > 0.0) || channels == 0 || maximum_block_frames == 0 ||
      ops == nullptr || ops->open == nullptr || ops->read == nullptr ||
      ops->close == nullptr) {
    return nullptr;
  }
  auto* player = new FeqPlayer();
  player->output_rate = output_rate;
  player->channels = channels;
  player->max_frames = maximum_block_frames;
  player->read_ahead = read_ahead_frames < maximum_block_frames * 4
                           ? maximum_block_frames * 4
                           : read_ahead_frames;
  player->ops = *ops;
  /**
   * Eighty milliseconds, matching `TRACK_FADE_IN_MS` on the element path.
   *
   * The same number rather than a rounder one, because the two engines are
   * compared by ear and an entry that is visibly softer or sharper on one of
   * them is a difference a listener would attribute to the DSP.
   */
  player->soft_start_frames = static_cast<uint32_t>(output_rate * 0.08);
  feq_crossfader_init(&player->fader);

  for (uint32_t index = 0; index < FEQ_PLAYER_DECKS; ++index) {
    Deck& deck = player->decks[index];
    deck.ring.reset(channels, player->read_ahead);
    plan_buffers(deck.decoded_storage, deck.decoded_pointers, channels,
                 kDecodeChunk);
    // The converter can emit more frames than it consumes when upsampling, so
    // its output buffer is sized for the block rather than for the chunk.
    plan_buffers(deck.converted_storage, deck.converted_pointers, channels,
                 maximum_block_frames);
    deck.source_pointers.assign(channels, nullptr);
    // A tail is one entry's length, the most any change plays out.
    plan_buffers(deck.tail_storage, deck.tail_pointers, channels,
                 player->soft_start_frames);
    plan_buffers(player->mix_storage[index], player->mix_pointers[index],
                 channels, maximum_block_frames);
    player->level_published[index].store(index == 0 ? 1.0f : 0.0f,
                                         std::memory_order_release);
  }
  return player;
}

void feq_player_destroy(FeqPlayer* player) {
  if (player == nullptr) {
    return;
  }
  for (auto& deck : player->decks) {
    release_decoder(player, deck);
  }
  delete player;
}

int feq_player_load(FeqPlayer* player, uint32_t deck_index, const char* path) {
  if (player == nullptr || deck_index >= FEQ_PLAYER_DECKS || path == nullptr) {
    return 0;
  }
  Deck& deck = player->decks[deck_index];
  release_decoder(player, deck);

  FeqDecoderInfo info{};
  // Set before the call, not patched afterwards: the decoder needs to know
  // what to produce, and only it can see the file's own layout.
  info.channels = player->channels;
  void* handle = player->ops.open(player->ops.user, path, &info);
  if (handle == nullptr || info.sample_rate == 0 || info.channels == 0) {
    if (handle != nullptr) {
      player->ops.close(player->ops.user, handle);
    }
    // The old file's decoder is gone either way. What it had already decoded
    // leaves under its tail rather than playing on to the end of the
    // read-ahead and stopping there.
    deck.state.store(FEQ_DECK_EMPTY, std::memory_order_release);
    post_switch(player, deck);
    return 0;
  }
  deck.info = info;
  deck.handle = handle;
  deck.resampler = feq_resampler_create(
      static_cast<double>(info.sample_rate), player->output_rate,
      player->channels);
  if (deck.resampler == nullptr) {
    release_decoder(player, deck);
    deck.state.store(FEQ_DECK_EMPTY, std::memory_order_release);
    post_switch(player, deck);
    return 0;
  }
  // Before any frame of the new file is written: this thread is the ring's
  // only writer, so everything after this cursor is the new file's.
  post_switch(player, deck);
  deck.state.store(FEQ_DECK_READY, std::memory_order_release);
  return 1;
}

void feq_player_unload(FeqPlayer* player, uint32_t deck_index) {
  if (player == nullptr || deck_index >= FEQ_PLAYER_DECKS) {
    return;
  }
  Deck& deck = player->decks[deck_index];
  release_decoder(player, deck);
  deck.state.store(FEQ_DECK_EMPTY, std::memory_order_release);
  // The read-ahead used to play on after an unload, up to two seconds of a
  // track that was meant to be gone. It goes now, under its tail.
  post_switch(player, deck);
}

int feq_player_seek(FeqPlayer* player, uint32_t deck_index, double seconds) {
  if (player == nullptr || deck_index >= FEQ_PLAYER_DECKS) {
    return 0;
  }
  Deck& deck = player->decks[deck_index];
  if (deck.handle == nullptr || player->ops.seek == nullptr) {
    return 0;
  }
  const double clamped = seconds > 0.0 ? seconds : 0.0;
  const auto file_frame = static_cast<uint64_t>(
      clamped * static_cast<double>(deck.info.sample_rate));
  if (player->ops.seek(player->ops.user, deck.handle, file_frame) == 0) {
    return 0;
  }

  feq_resampler_reset(deck.resampler);
  deck.pending = 0;
  deck.pending_at = 0;
  deck.exhausted.store(0, std::memory_order_release);
  deck.state.store(FEQ_DECK_READY, std::memory_order_release);
  deck.origin.store(
      static_cast<uint64_t>(clamped * player->output_rate),
      std::memory_order_release);
  deck.decoded.store(0, std::memory_order_release);
  // Recorded BEFORE any post-seek frame is written, so the reader drops
  // exactly what was decoded for the old position and keeps what follows.
  deck.flush_to.store(deck.ring.write_cursor(), std::memory_order_release);
  deck.flush_request.fetch_add(1, std::memory_order_acq_rel);
  /**
   * The playhead has moved to a sample that is almost certainly not zero, and
   * the block after this one would step straight to it — on a deck that is
   * heard. Only there, and only as much of the output as moved.
   *
   * It used to arm the whole output's ramp for a seek on either deck, and the
   * spare deck is cued to its lead-in while the other track plays: every
   * track with leading silence dropped the song playing before it to nothing
   * for eighty milliseconds, part-way through, and the fade's own cue did the
   * same to the outgoing track a moment before the fade began. A deck nobody
   * hears has nothing to click; one half of a running fade ramps alone
   * (`Deck::entry_request`), so the other half keeps its level.
   */
  const feq_player::Roles roles = feq_player::effective_roles(player);
  if (roles.fading) {
    if (deck_index == roles.active || deck_index == roles.incoming) {
      deck.entry_request.fetch_add(1, std::memory_order_acq_rel);
    }
  } else if (roles.active == deck_index) {
    player->soft_start_request.fetch_add(1, std::memory_order_acq_rel);
  }
  return 1;
}

uint32_t feq_player_pump(FeqPlayer* player) {
  if (player == nullptr) {
    return 0;
  }
  uint32_t total = 0;
  for (auto& deck : player->decks) {
    for (;;) {
      const uint32_t written = fill_deck(player, deck);
      if (written == 0) {
        break;
      }
      total += written;
    }
  }
  return total;
}

double feq_player_position_seconds(const FeqPlayer* player, uint32_t deck) {
  if (player == nullptr || deck >= FEQ_PLAYER_DECKS) {
    return 0.0;
  }
  const Deck& state = player->decks[deck];
  // What has been decoded, less what is still waiting in the ring: the
  // playhead is where the audio thread has reached, not where the decoder has.
  const uint64_t decoded = state.decoded.load(std::memory_order_acquire);
  const uint64_t buffered = state.ring.available();
  const uint64_t played = decoded > buffered ? decoded - buffered : 0;
  return static_cast<double>(state.origin.load(std::memory_order_acquire) +
                             played) /
         player->output_rate;
}

double feq_player_duration_seconds(const FeqPlayer* player, uint32_t deck) {
  if (player == nullptr || deck >= FEQ_PLAYER_DECKS) {
    return 0.0;
  }
  const Deck& state = player->decks[deck];
  if (state.info.total_frames == 0 || state.info.sample_rate == 0) {
    return 0.0;
  }
  return static_cast<double>(state.info.total_frames) /
         static_cast<double>(state.info.sample_rate);
}

int feq_player_deck_state(const FeqPlayer* player, uint32_t deck) {
  if (player == nullptr || deck >= FEQ_PLAYER_DECKS) {
    return FEQ_DECK_EMPTY;
  }
  return player->decks[deck].state.load(std::memory_order_acquire);
}

int feq_player_deck_primed(const FeqPlayer* player, uint32_t deck) {
  if (player == nullptr || deck >= FEQ_PLAYER_DECKS) {
    return 0;
  }
  const Deck& state = player->decks[deck];
  if (state.state.load(std::memory_order_acquire) == FEQ_DECK_EMPTY) {
    return 0;
  }
  // A short file that is already fully decoded is primed even though it never
  // reaches the quarter-second mark.
  if (state.exhausted.load(std::memory_order_acquire) != 0) {
    return 1;
  }
  // The current file's frames only: the previous one's can still be in the
  // ring, ahead of `switch_to`, until the reader next takes a block.
  const uint64_t write = state.ring.write_cursor();
  uint64_t from = state.ring.read_cursor();
  const uint64_t boundary = state.switch_to.load(std::memory_order_acquire);
  if (boundary > from) {
    from = boundary;
  }
  const uint64_t fresh = write > from ? write - from : 0;
  const auto wanted =
      static_cast<uint64_t>(kPrimeSeconds * player->output_rate);
  return fresh >= wanted ? 1 : 0;
}

}  // extern "C"

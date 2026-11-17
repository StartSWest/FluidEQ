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

#include "player_decode.h"
#include "player_internal.h"

using feq_player::Deck;

namespace {

/**
 * A deck is primed once it holds this much, or once its decoder is done.
 *
 * Quarter of a second: long enough that a first block cannot arrive before the
 * file is open, short enough that pressing play still feels immediate.
 */
constexpr double kPrimeSeconds = 0.25;

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

/**
 * Everything written from here on is the new content (`Deck::switch_to`),
 * and the deck's layer comes off at the same cursor.
 */
void post_switch(FeqPlayer* player, uint32_t index) {
  Deck& deck = player->decks[index];
  const uint64_t anchor = deck.ring.write_cursor();
  const uint64_t stamp =
      player->switch_counter.fetch_add(1, std::memory_order_acq_rel) + 1;
  // Before the switch is posted, so a reader that takes it finds the layer
  // gone and both gains back at 1 and 0 for the new content — stamped with
  // it, so the old content's last block never glides toward them, and a
  // fader set after this is not undone (`pack_gain`).
  feq_player::reset_layer_gains(player->layers[index], stamp);
  feq_player::layer_follows_switch(player, index, anchor);
  deck.switch_to.store(anchor, std::memory_order_release);
  deck.switch_stamp.store(stamp, std::memory_order_release);
}

/**
 * Move one chunk from the decoder into the ring, converting on the way
 * (`decode_ahead`). Returns device-rate frames written; zero is a full ring
 * or a finished file, never room left with the file unread.
 */
uint32_t fill_deck(FeqPlayer* player, Deck& deck) {
  const uint32_t produced =
      feq_player::decode_ahead(player, deck, deck.ring.space());
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
  player->glide_frames = static_cast<uint32_t>(
      output_rate * feq_player::kLayerGlideSeconds);
  feq_crossfader_init(&player->fader);

  for (uint32_t index = 0; index < FEQ_PLAYER_DECKS; ++index) {
    Deck& deck = player->decks[index];
    deck.ring.reset(channels, player->read_ahead);
    feq_player::plan_planar(deck.decoded_storage, deck.decoded_pointers,
                            channels, FEQ_PLAYER_DECODE_CHUNK);
    // The converter can emit more frames than it consumes when upsampling, so
    // its output buffer is sized for the block rather than for the chunk.
    feq_player::plan_planar(deck.converted_storage, deck.converted_pointers,
                            channels, maximum_block_frames);
    deck.source_pointers.assign(channels, nullptr);
    // A tail is one entry's length, the most any change plays out.
    feq_player::plan_planar(deck.tail_storage, deck.tail_pointers, channels,
                            player->soft_start_frames);
    feq_player::plan_planar(player->mix_storage[index],
                            player->mix_pointers[index], channels,
                            maximum_block_frames);
    player->level_published[index].store(index == 0 ? 1.0f : 0.0f,
                                         std::memory_order_release);
    // The deck's own file at full level and no layer heard: what a load
    // resets them to, for content stamped 0, which is none yet.
    feq_player::reset_layer_gains(player->layers[index], 0);
    player->layers[index].own.snap(1.0f);
    player->layers[index].layer.snap(0.0f);
  }
  feq_player::plan_planar(player->layer_storage, player->layer_pointers,
                          channels, maximum_block_frames);
  player->layer_valid.assign(maximum_block_frames, 0);
  return player;
}

void feq_player_destroy(FeqPlayer* player) {
  if (player == nullptr) {
    return;
  }
  for (auto& deck : player->decks) {
    release_decoder(player, deck);
  }
  for (auto& layer : player->layers) {
    feq_player::release_layer(player, layer);
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
    post_switch(player, deck_index);
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
    post_switch(player, deck_index);
    return 0;
  }
  // Before any frame of the new file is written: this thread is the ring's
  // only writer, so everything after this cursor is the new file's.
  post_switch(player, deck_index);
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
  post_switch(player, deck_index);
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
  const uint64_t flush_to = deck.ring.write_cursor();
  // The layer moves first: a reader that takes the flush then hears the
  // generation decoded for the new place, never what the layer had already
  // decoded past `flush_to` for the old one (`layer_takes_seek`).
  feq_player::layer_follows_seek(player, deck_index, flush_to, clamped);
  deck.flush_to.store(flush_to, std::memory_order_release);
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
  for (uint32_t index = 0; index < FEQ_PLAYER_DECKS; ++index) {
    Deck& deck = player->decks[index];
    /**
     * The layer a block ahead of its deck at every step, never behind it.
     *
     * The audio thread reads a deck's frames the moment they are written, and
     * a layer filled after its deck — the whole two seconds of it, after a
     * seek — would be missing from the first frames played at the new place:
     * the voice coming in late, over its entry, on every scrub. A
     * `fill_deck` writes a block at most, so a layer filled to a block past
     * the deck before each one is there first.
     */
    for (;;) {
      total += feq_player::fill_layer(
          player, index, deck.ring.write_cursor() + player->max_frames);
      const uint32_t written = fill_deck(player, deck);
      if (written == 0) {
        break;
      }
      total += written;
    }
  }
  return total;
}

uint64_t feq_player_frames_taken(const FeqPlayer* player) {
  if (player == nullptr) {
    return 0;
  }
  // Read cursors only ever move forward, a seek's discard included, so the
  // sum changes exactly when the decks' read-ahead has room it did not have.
  uint64_t taken = 0;
  for (const auto& deck : player->decks) {
    taken += deck.ring.read_cursor();
  }
  return taken;
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

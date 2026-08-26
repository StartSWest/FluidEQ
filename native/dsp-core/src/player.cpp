/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#include "fluideq/player.h"

#include "fluideq/resampler.h"
#include "ring.h"

#include <atomic>
#include <cmath>
#include <vector>

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

struct Deck {
  void* handle = nullptr;
  FeqDecoderInfo info{};
  FeqResampler* resampler = nullptr;
  PlanarRing ring;
  std::atomic<int> state{FEQ_DECK_EMPTY};
  /** Set by the decoder thread when the file runs out. */
  std::atomic<int> exhausted{0};
  /** Device-rate frames handed to the ring since the last seek. */
  std::atomic<uint64_t> decoded{0};
  /** Where the last seek put the playhead, in device-rate frames. */
  std::atomic<uint64_t> origin{0};

  /* The seek handshake. The reader skips to `flush_to` and never waits. */
  std::atomic<uint64_t> flush_to{0};
  std::atomic<uint64_t> flush_request{0};
  uint64_t flush_seen = 0;

  /** Decoder-thread scratch: file-rate frames, then device-rate frames. */
  std::vector<float> decoded_storage;
  std::vector<float*> decoded_pointers;
  std::vector<float> converted_storage;
  std::vector<float*> converted_pointers;
  std::vector<const float*> source_pointers;
  /** Frames read from the decoder but not yet consumed by the resampler. */
  uint32_t pending = 0;
  uint32_t pending_at = 0;
};

}  // namespace

struct FeqPlayer {
  double output_rate = 48000.0;
  uint32_t channels = 2;
  uint32_t max_frames = 0;
  uint32_t read_ahead = 0;
  FeqDecoderOps ops{};

  Deck decks[FEQ_PLAYER_DECKS];
  std::atomic<uint32_t> active{0};
  std::atomic<int> playing{0};
  FeqCrossfader fader{};
  /** The deck the running fade is heading for. */
  std::atomic<uint32_t> incoming{0};

  /** Audio-thread scratch for the two decks, allocated once. */
  std::vector<float> mix_storage[FEQ_PLAYER_DECKS];
  std::vector<float*> mix_pointers[FEQ_PLAYER_DECKS];
};

namespace {

void plan_buffers(std::vector<float>& storage, std::vector<float*>& pointers,
                  uint32_t channels, uint32_t frames) {
  storage.assign(static_cast<size_t>(channels) * frames, 0.0f);
  pointers.assign(channels, nullptr);
  for (uint32_t channel = 0; channel < channels; ++channel) {
    pointers[channel] = storage.data() + static_cast<size_t>(channel) * frames;
  }
}

void close_deck(FeqPlayer* player, Deck& deck) {
  if (deck.handle != nullptr && player->ops.close != nullptr) {
    player->ops.close(player->ops.user, deck.handle);
  }
  deck.handle = nullptr;
  feq_resampler_destroy(deck.resampler);
  deck.resampler = nullptr;
  deck.state.store(FEQ_DECK_EMPTY, std::memory_order_release);
  deck.exhausted.store(0, std::memory_order_release);
  deck.decoded.store(0, std::memory_order_release);
  deck.origin.store(0, std::memory_order_release);
  deck.pending = 0;
  deck.pending_at = 0;
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

/** Consumer side, on the audio thread. Applies any pending seek first. */
void read_deck(Deck& deck, float* const* output, uint32_t frames) {
  const uint64_t request = deck.flush_request.load(std::memory_order_acquire);
  if (request != deck.flush_seen) {
    deck.ring.discard_until(deck.flush_to.load(std::memory_order_acquire));
    deck.flush_seen = request;
  }
  deck.ring.read(output, frames);
  if (deck.ring.available() == 0 &&
      deck.exhausted.load(std::memory_order_acquire) != 0 &&
      deck.state.load(std::memory_order_acquire) == FEQ_DECK_READY) {
    deck.state.store(FEQ_DECK_ENDED, std::memory_order_release);
  }
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
    plan_buffers(player->mix_storage[index], player->mix_pointers[index],
                 channels, maximum_block_frames);
  }
  return player;
}

void feq_player_destroy(FeqPlayer* player) {
  if (player == nullptr) {
    return;
  }
  for (auto& deck : player->decks) {
    close_deck(player, deck);
  }
  delete player;
}

int feq_player_load(FeqPlayer* player, uint32_t deck_index, const char* path) {
  if (player == nullptr || deck_index >= FEQ_PLAYER_DECKS || path == nullptr) {
    return 0;
  }
  Deck& deck = player->decks[deck_index];
  close_deck(player, deck);

  FeqDecoderInfo info{};
  void* handle = player->ops.open(player->ops.user, path, &info);
  if (handle == nullptr || info.sample_rate == 0 || info.channels == 0) {
    if (handle != nullptr) {
      player->ops.close(player->ops.user, handle);
    }
    return 0;
  }
  /**
   * The decoder is asked for the player's channel count, not the file's.
   *
   * Anything else pushes the fold-down into every decoder implementation, and
   * they would not agree: a mono file duplicated to both channels is +3 dB
   * against one that leaves the right silent, and both are defensible until
   * two files in one playlist do different things.
   */
  info.channels = player->channels;
  deck.info = info;
  deck.handle = handle;
  deck.resampler = feq_resampler_create(
      static_cast<double>(info.sample_rate), player->output_rate,
      player->channels);
  if (deck.resampler == nullptr) {
    close_deck(player, deck);
    return 0;
  }
  deck.ring.reset(player->channels, player->read_ahead);
  deck.flush_to.store(0, std::memory_order_release);
  deck.state.store(FEQ_DECK_READY, std::memory_order_release);
  return 1;
}

void feq_player_unload(FeqPlayer* player, uint32_t deck_index) {
  if (player == nullptr || deck_index >= FEQ_PLAYER_DECKS) {
    return;
  }
  close_deck(player, player->decks[deck_index]);
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

void feq_player_set_playing(FeqPlayer* player, int playing) {
  if (player != nullptr) {
    player->playing.store(playing != 0 ? 1 : 0, std::memory_order_release);
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
  player->active.store(deck, std::memory_order_release);
  player->incoming.store(deck, std::memory_order_release);
  feq_crossfader_init(&player->fader);
}

uint32_t feq_player_active_deck(const FeqPlayer* player) {
  return player != nullptr ? player->active.load(std::memory_order_acquire) : 0;
}

void feq_player_start_crossfade(FeqPlayer* player,
                                uint32_t to_deck,
                                double duration_ms,
                                FeqCrossfadeCurve curve) {
  if (player == nullptr || to_deck >= FEQ_PLAYER_DECKS) {
    return;
  }
  if (to_deck == player->active.load(std::memory_order_acquire)) {
    return;
  }
  const double frames = (duration_ms / 1000.0) * player->output_rate;
  const auto duration =
      frames > 0.0 ? static_cast<uint64_t>(frames) : static_cast<uint64_t>(0);
  player->incoming.store(to_deck, std::memory_order_release);
  if (duration == 0) {
    feq_player_select(player, to_deck);
    return;
  }
  feq_crossfader_start(&player->fader, curve, duration);
}

double feq_player_crossfade_progress(const FeqPlayer* player) {
  return player != nullptr ? feq_crossfader_progress(&player->fader) : 1.0;
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
  const auto wanted =
      static_cast<uint32_t>(kPrimeSeconds * player->output_rate);
  return state.ring.available() >= wanted ? 1 : 0;
}

void feq_player_render(FeqPlayer* player, float* const* channels,
                       uint32_t frames) {
  if (player == nullptr || channels == nullptr || frames == 0 ||
      frames > player->max_frames) {
    return;
  }
  const uint32_t active = player->active.load(std::memory_order_acquire);
  const uint32_t incoming = player->incoming.load(std::memory_order_acquire);
  const bool fading = player->fader.active != 0 && incoming != active;

  if (player->playing.load(std::memory_order_acquire) == 0) {
    for (uint32_t channel = 0; channel < player->channels; ++channel) {
      for (uint32_t at = 0; at < frames; ++at) {
        channels[channel][at] = 0.0f;
      }
    }
    return;
  }

  if (!fading) {
    read_deck(player->decks[active], channels, frames);
    return;
  }

  /**
   * Both decks are pulled every block of a fade, and only during one.
   *
   * A deck that is not being read is a deck whose ring fills and stops, so
   * reading the incoming one only once the fade begins is what keeps its
   * read-ahead bounded rather than making it decode the whole track while it
   * waits its turn.
   */
  read_deck(player->decks[active], player->mix_pointers[0].data(), frames);
  read_deck(player->decks[incoming], player->mix_pointers[1].data(), frames);
  const auto* const* outgoing =
      reinterpret_cast<const float* const*>(player->mix_pointers[0].data());
  const auto* const* arriving =
      reinterpret_cast<const float* const*>(player->mix_pointers[1].data());
  feq_crossfader_mix(&player->fader, outgoing, arriving, channels,
                     player->channels, frames);

  if (player->fader.active == 0) {
    // Promoted here rather than by the caller. An index swap costs nothing,
    // and waiting for another thread to notice would put the outgoing track
    // back for however many blocks that took.
    player->active.store(incoming, std::memory_order_release);
  }
}

}  // extern "C"

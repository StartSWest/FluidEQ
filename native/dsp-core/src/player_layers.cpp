/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The decoder thread's half of a deck's layer (`player_layer.h`): the file
 * opened, placed where the deck is, followed through every load and seek of
 * the deck, and decoded into slots stamped with the deck's own cursors. Plus
 * the two gains, which any thread may set.
 */

#include "player_decode.h"
#include "player_internal.h"

#include <memory>
#include <utility>

using feq_player::Deck;
using feq_player::DeckLayer;
using feq_player::LayerStore;

namespace {

/** The next generation, odd while a layer is on and even while none is. */
void publish_generation(DeckLayer& layer, bool on) {
  uint32_t next = layer.generation_written + 1;
  if (((next & 1u) != 0) != on) {
    ++next;
  }
  layer.generation_written = next;
  layer.generation.store(next, std::memory_order_release);
  layer.present.store(on ? 1 : 0, std::memory_order_release);
}

void close_decoder(FeqPlayer* player, DeckLayer& layer) {
  if (layer.handle != nullptr && player->ops.close != nullptr) {
    player->ops.close(player->ops.user, layer.handle);
  }
  layer.handle = nullptr;
  feq_resampler_destroy(layer.resampler);
  layer.resampler = nullptr;
  layer.exhausted.store(0, std::memory_order_release);
  layer.pending = 0;
  layer.pending_at = 0;
}

/**
 * The read-ahead and the scratch, the first time a layer is loaded on the
 * deck, and kept: the Library never layers, and a deck's worth of two seconds
 * is over a megabyte for nobody. Never freed before the player, because the
 * audio thread may be reading it.
 */
void plan_store(FeqPlayer* player, DeckLayer& layer) {
  if (layer.store_owner) {
    return;
  }
  auto store = std::make_unique<LayerStore>();
  store->channels = player->channels;
  store->capacity = player->read_ahead;
  // Value-initialised: every sample 0, every tag 0, which is "never written".
  store->samples = std::make_unique<std::atomic<float>[]>(
      static_cast<size_t>(store->channels) * store->capacity);
  store->tags = std::make_unique<std::atomic<uint64_t>[]>(store->capacity);
  feq_player::plan_planar(layer.decoded_storage, layer.decoded_pointers,
                          player->channels, FEQ_PLAYER_DECODE_CHUNK);
  feq_player::plan_planar(layer.converted_storage, layer.converted_pointers,
                          player->channels, player->max_frames);
  layer.source_pointers.assign(player->channels, nullptr);
  layer.store_owner = std::move(store);
  layer.store.store(layer.store_owner.get(), std::memory_order_release);
}

/**
 * The file frame a place in seconds is, converted exactly as the deck's own
 * seek converts it (`feq_player_seek`), so two files at one rate land on the
 * same frame.
 */
uint64_t file_frame_at(double seconds, uint32_t rate) {
  const double clamped = seconds > 0.0 ? seconds : 0.0;
  return static_cast<uint64_t>(clamped * static_cast<double>(rate));
}

uint64_t greatest_common_divisor(uint64_t a, uint64_t b) {
  while (b != 0) {
    const uint64_t rest = a % b;
    a = b;
    b = rest;
  }
  return a;
}

/**
 * Device frames between the cursors where the converter's phase comes back
 * to where it started: 160 from 44.1 to 48 kHz, 1 at equal rates. One when
 * the rates have no short common period (or the device rate is not a whole
 * number), which leaves a join within one file frame of exact.
 */
uint64_t phase_period(double output_rate, uint32_t file_rate) {
  // A tenth of a second: past that, the join waits longer than it gains.
  constexpr uint64_t kLongestPeriod = 4800;
  const auto output = static_cast<uint64_t>(output_rate);
  if (static_cast<double>(output) != output_rate || output == 0 ||
      file_rate == 0) {
    return 1;
  }
  const uint64_t period = output / greatest_common_divisor(output, file_rate);
  return period <= kLongestPeriod ? period : 1;
}

/**
 * Put the layer's decoder at `file_frame` with an empty converter. `fresh` is
 * a decoder just opened, which is at its start already. False when the
 * decoder could not get there.
 */
bool place_decoder(FeqPlayer* player, DeckLayer& layer, uint64_t file_frame,
                   bool fresh) {
  feq_resampler_reset(layer.resampler);
  layer.pending = 0;
  layer.pending_at = 0;
  layer.exhausted.store(0, std::memory_order_release);
  if (fresh && file_frame == 0) {
    return true;
  }
  return player->ops.seek != nullptr &&
         player->ops.seek(player->ops.user, layer.handle, file_frame) != 0;
}

/** `produced` converted frames into the slots from `next_cursor` on. */
void write_slots(DeckLayer& layer, LayerStore& store, uint32_t produced) {
  const uint32_t generation = layer.generation_written;
  for (uint32_t frame = 0; frame < produced; ++frame) {
    const uint64_t cursor = layer.next_cursor + frame;
    const auto slot = static_cast<size_t>(cursor % store.capacity);
    std::atomic<uint64_t>& tag = store.tags[slot];
    // A seqlock per slot: marked unwritten, the samples, then the new tag.
    // A reader that meets the slot mid-write sees a tag that is not the one
    // it wants on one side of its read or the other, and takes silence.
    tag.store(0, std::memory_order_relaxed);
    std::atomic_thread_fence(std::memory_order_release);
    for (uint32_t channel = 0; channel < store.channels; ++channel) {
      store.samples[static_cast<size_t>(channel) * store.capacity + slot]
          .store(layer.converted_pointers[channel][frame],
                 std::memory_order_relaxed);
    }
    tag.store(feq_player::slot_tag(generation, cursor),
              std::memory_order_release);
  }
}

}  // namespace

namespace feq_player {

void reset_layer_gains(DeckLayer& layer, uint64_t stamp) {
  layer.own_gain.store(pack_gain(stamp, 1.0f), std::memory_order_release);
  layer.layer_gain.store(pack_gain(stamp, 0.0f), std::memory_order_release);
}

void layer_follows_switch(FeqPlayer* player, uint32_t deck, uint64_t anchor) {
  DeckLayer& layer = player->layers[deck];
  close_decoder(player, layer);
  layer.anchor_cursor = anchor;
  layer.anchor_seconds = 0.0;
  layer.next_cursor = anchor;
  layer.written_until = anchor;
  publish_generation(layer, false);
}

void layer_follows_seek(FeqPlayer* player, uint32_t deck, uint64_t anchor,
                        double seconds) {
  DeckLayer& layer = player->layers[deck];
  layer.anchor_cursor = anchor;
  layer.anchor_seconds = seconds;
  layer.next_cursor = anchor;
  layer.written_until = anchor;
  if (layer.handle == nullptr) {
    return;
  }
  if (!place_decoder(player, layer,
                     file_frame_at(seconds, layer.info.sample_rate), false)) {
    // Past the layer's end, most likely: silence from here, and the decoder
    // kept, so a seek back inside the layer finds it again.
    layer.exhausted.store(1, std::memory_order_release);
  }
  // A new generation even for the same file. The pump writes a layer frame
  // before its deck's, so nothing decoded for the old place can sit in a
  // slot the deck has reached; the generation keeps that true whatever
  // order the slots are filled in.
  publish_generation(layer, true);
}

uint32_t fill_layer(FeqPlayer* player, uint32_t deck, uint64_t target) {
  DeckLayer& layer = player->layers[deck];
  LayerStore* store = layer.store_owner.get();
  if (layer.handle == nullptr || store == nullptr) {
    return 0;
  }
  const Deck& own = player->decks[deck];
  uint32_t total = 0;
  for (;;) {
    // A ring's length past what the reader has finished with, never more:
    // the slot for cursor C is the one cursor C - capacity was read from.
    const uint64_t bound = own.ring.read_cursor() + store->capacity;
    const uint64_t limit = target < bound ? target : bound;
    if (layer.next_cursor >= limit) {
      break;
    }
    const uint64_t left = limit - layer.next_cursor;
    const auto room = static_cast<uint32_t>(
        left < player->max_frames ? left : player->max_frames);
    const uint32_t produced = decode_ahead(player, layer, room);
    if (produced == 0) {
      break;
    }
    write_slots(layer, *store, produced);
    layer.next_cursor += produced;
    if (layer.next_cursor > layer.written_until) {
      layer.written_until = layer.next_cursor;
    }
    total += produced;
  }
  return total;
}

void release_layer(FeqPlayer* player, DeckLayer& layer) {
  close_decoder(player, layer);
}

}  // namespace feq_player

extern "C" {

int feq_player_load_layer(FeqPlayer* player, uint32_t deck_index,
                          const char* path) {
  if (player == nullptr || deck_index >= FEQ_PLAYER_DECKS) {
    return 0;
  }
  DeckLayer& layer = player->layers[deck_index];
  const Deck& deck = player->decks[deck_index];
  close_decoder(player, layer);
  if (path == nullptr || path[0] == '\0') {
    publish_generation(layer, false);
    return 1;
  }
  // Nothing to lock to: the layer is told where the deck's content is.
  if (deck.handle == nullptr) {
    publish_generation(layer, false);
    return 0;
  }
  plan_store(player, layer);

  FeqDecoderInfo info{};
  info.channels = player->channels;
  void* handle = player->ops.open(player->ops.user, path, &info);
  if (handle == nullptr || info.sample_rate == 0 || info.channels == 0) {
    if (handle != nullptr) {
      player->ops.close(player->ops.user, handle);
    }
    publish_generation(layer, false);
    return 0;
  }
  layer.info = info;
  layer.handle = handle;
  layer.resampler = feq_resampler_create(
      static_cast<double>(info.sample_rate), player->output_rate,
      player->channels);
  if (layer.resampler == nullptr) {
    close_decoder(player, layer);
    publish_generation(layer, false);
    return 0;
  }

  /**
   * Where it joins: the frame the reader has reached, or where the deck's
   * content begins when a load or a seek is still on its way to the reader —
   * then the layer is there from that content's first frame. Past the
   * reader, a layer being replaced may still be heard leaving over a glide
   * and a block or two, and this one starts after that exit, never inside it.
   */
  const uint64_t read = deck.ring.read_cursor();
  uint64_t join = read;
  if (read >= layer.anchor_cursor && layer.written_until > read) {
    join = read + player->glide_frames + 2u * player->max_frames;
  }
  if (join < layer.anchor_cursor) {
    join = layer.anchor_cursor;
  }
  /**
   * On a cursor where the deck's converter is back at the phase it began
   * the content with, so a converter starting there afresh on a whole file
   * frame is in step with it to the sample, not merely within one: the
   * deck's file frame there is its anchor's plus a whole number. A few
   * milliseconds later at most.
   */
  const uint64_t period = phase_period(player->output_rate, info.sample_rate);
  uint64_t offset = join - layer.anchor_cursor;
  offset = (offset + period - 1) / period * period;
  join = layer.anchor_cursor + offset;
  const uint64_t anchor_frame =
      file_frame_at(layer.anchor_seconds, info.sample_rate);
  const uint64_t frame =
      period > 1 || static_cast<double>(info.sample_rate) == player->output_rate
          ? anchor_frame + offset * info.sample_rate /
                               static_cast<uint64_t>(player->output_rate)
          : file_frame_at(layer.anchor_seconds +
                              static_cast<double>(offset) / player->output_rate,
                          info.sample_rate);
  if (!place_decoder(player, layer, frame, true)) {
    close_decoder(player, layer);
    publish_generation(layer, false);
    return 0;
  }
  layer.next_cursor = join;
  publish_generation(layer, true);
  return 1;
}

int feq_player_has_layer(const FeqPlayer* player, uint32_t deck) {
  if (player == nullptr || deck >= FEQ_PLAYER_DECKS) {
    return 0;
  }
  return player->layers[deck].present.load(std::memory_order_acquire);
}

}  // extern "C"

namespace {

/** 0 to 1; anything else, a NaN included, is the nearer end or silence. */
float clamp_gain(double gain) {
  if (!(gain >= 0.0)) {
    return 0.0f;
  }
  return gain > 1.0 ? 1.0f : static_cast<float>(gain);
}

}  // namespace

extern "C" {

void feq_player_set_deck_gain(FeqPlayer* player, uint32_t deck, double gain) {
  if (player == nullptr || deck >= FEQ_PLAYER_DECKS) {
    return;
  }
  // Stamped with the content the deck holds now: a gain set before a load
  // is for the track it replaces, and the load's reset wins over it.
  const uint64_t stamp =
      player->decks[deck].switch_stamp.load(std::memory_order_acquire);
  player->layers[deck].own_gain.store(
      feq_player::pack_gain(stamp, clamp_gain(gain)),
      std::memory_order_release);
}

void feq_player_set_layer_gain(FeqPlayer* player, uint32_t deck, double gain) {
  if (player == nullptr || deck >= FEQ_PLAYER_DECKS) {
    return;
  }
  const uint64_t stamp =
      player->decks[deck].switch_stamp.load(std::memory_order_acquire);
  player->layers[deck].layer_gain.store(
      feq_player::pack_gain(stamp, clamp_gain(gain)),
      std::memory_order_release);
}

}  // extern "C"

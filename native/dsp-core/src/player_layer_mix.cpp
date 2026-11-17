/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The audio thread's half of a deck's layer (`player_layer.h`): which
 * generation is heard, the two gains gliding to their faders, the layer's
 * entry after any frame it was missing from, and its exit when it is taken
 * off or replaced.
 *
 * Nothing here allocates, locks or waits. A layer frame that is not there —
 * not decoded that far yet, past the layer's end, rewritten for a generation
 * this one is not — is silence for that frame, and the deck plays on.
 */

#include "player_internal.h"

using feq_player::Deck;
using feq_player::DeckLayer;
using feq_player::LayerStore;

namespace {

bool generation_on(uint32_t generation) { return (generation & 1u) != 0; }

/** The faders as set for the content this deck is playing; none for another. */
void aim_gains(FeqPlayer* player, uint32_t deck) {
  DeckLayer& layer = player->layers[deck];
  const auto stamp = static_cast<uint32_t>(player->decks[deck].switch_seen);
  const uint64_t own = layer.own_gain.load(std::memory_order_acquire);
  if (feq_player::gain_stamp(own) == stamp) {
    layer.own.aim(feq_player::gain_value(own), player->glide_frames);
  }
  const uint64_t voice = layer.layer_gain.load(std::memory_order_acquire);
  if (feq_player::gain_stamp(voice) == stamp) {
    layer.layer.aim(feq_player::gain_value(voice), player->glide_frames);
  }
}

/**
 * The accepted generation's frames for the deck cursors [from, from + span)
 * into the player's layer scratch, each flagged in `layer_valid`. Three
 * passes — the tags, the samples, the tags again — so one fence covers the
 * block (the reader's side of `write_slots`' seqlock). False when no frame
 * of the block is the layer's.
 */
bool read_layer(FeqPlayer* player, const DeckLayer& layer, uint64_t from,
                uint32_t span) {
  const LayerStore* store = layer.store.load(std::memory_order_acquire);
  if (store == nullptr || !generation_on(layer.accepted) || span == 0) {
    return false;
  }
  const uint32_t capacity = store->capacity;
  uint8_t* valid = player->layer_valid.data();
  bool any = false;
  for (uint32_t at = 0; at < span; ++at) {
    const uint64_t cursor = from + at;
    const uint64_t wanted = feq_player::slot_tag(layer.accepted, cursor);
    valid[at] = store->tags[static_cast<size_t>(cursor % capacity)].load(
                    std::memory_order_acquire) == wanted
                    ? 1
                    : 0;
    any = any || valid[at] != 0;
  }
  if (!any) {
    return false;
  }
  for (uint32_t channel = 0; channel < player->channels; ++channel) {
    float* into = player->layer_pointers[channel];
    const std::atomic<float>* samples =
        store->samples.get() + static_cast<size_t>(channel) * capacity;
    for (uint32_t at = 0; at < span; ++at) {
      const auto slot = static_cast<size_t>((from + at) % capacity);
      into[at] = valid[at] != 0 ? samples[slot].load(std::memory_order_relaxed)
                                : 0.0f;
    }
  }
  std::atomic_thread_fence(std::memory_order_acquire);
  any = false;
  for (uint32_t at = 0; at < span; ++at) {
    if (valid[at] == 0) {
      continue;
    }
    const uint64_t cursor = from + at;
    // Rewritten while it was read: a frame missing, never a blend of two.
    if (store->tags[static_cast<size_t>(cursor % capacity)].load(
            std::memory_order_relaxed) !=
        feq_player::slot_tag(layer.accepted, cursor)) {
      valid[at] = 0;
    }
    any = any || valid[at] != 0;
  }
  return any;
}

/**
 * A new generation published since the last block, with no load or seek of
 * the deck to carry it: the layer was replaced or taken off. What was heard
 * of it leaves over a glide; what was not is let go at once.
 */
void notice_generation(FeqPlayer* player, DeckLayer& layer) {
  if (layer.exit_remaining != 0) {
    return;
  }
  const uint32_t generation = layer.generation.load(std::memory_order_acquire);
  if (generation == layer.accepted) {
    return;
  }
  if (!generation_on(layer.accepted) || layer.envelope == 0.0f ||
      layer.layer.resting_at(0.0f) || player->glide_frames == 0) {
    layer.accepted = generation;
    layer.envelope = 0.0f;
    return;
  }
  layer.exit_remaining = player->glide_frames;
}

}  // namespace

namespace feq_player {

void layer_takes_switch(FeqPlayer* player, uint32_t deck) {
  DeckLayer& layer = player->layers[deck];
  const auto stamp = static_cast<uint32_t>(player->decks[deck].switch_seen);
  // Snapped, not glided: the new content comes in under its own entry, and
  // a glide from the old track's levels would be heard on its first frames.
  const uint64_t own = layer.own_gain.load(std::memory_order_acquire);
  layer.own.snap(gain_stamp(own) == stamp ? gain_value(own) : 1.0f);
  const uint64_t voice = layer.layer_gain.load(std::memory_order_acquire);
  layer.layer.snap(gain_stamp(voice) == stamp ? gain_value(voice) : 0.0f);
  // Loaded after the switch was taken, so it is the switch's or newer.
  layer.accepted = layer.generation.load(std::memory_order_acquire);
  layer.envelope = 1.0f;
  layer.exit_remaining = 0;
}

void layer_takes_seek(FeqPlayer* player, uint32_t deck) {
  DeckLayer& layer = player->layers[deck];
  // Loaded after the flush was taken: the generation published with the seek
  // or a newer one. The deck's own entry covers the jump for both.
  layer.accepted = layer.generation.load(std::memory_order_acquire);
  layer.envelope = 1.0f;
  layer.exit_remaining = 0;
}

void layer_idle(FeqPlayer* player, uint32_t deck) {
  DeckLayer& layer = player->layers[deck];
  const uint32_t generation = layer.generation.load(std::memory_order_acquire);
  if (generation != layer.accepted) {
    layer.accepted = generation;
    layer.envelope = 0.0f;
    layer.exit_remaining = 0;
  }
  // Nothing is heard, so a fader moved now lands where it was put.
  aim_gains(player, deck);
  layer.own.snap(layer.own.toward);
  layer.layer.snap(layer.layer.toward);
}

void take_with_layer(FeqPlayer* player, uint32_t deck, float* const* output,
                     uint32_t span, uint32_t frames, bool moving) {
  DeckLayer& layer = player->layers[deck];
  Deck& own = player->decks[deck];
  if (moving) {
    notice_generation(player, layer);
    aim_gains(player, deck);
  }
  // The layer's frames before the ring's: the writer may reuse a slot once
  // the ring's read cursor has passed the frame decoded into it.
  const uint64_t from = own.ring.read_cursor();
  const bool layered = read_layer(player, layer, from, span);
  own.ring.read(output, span);
  for (uint32_t channel = 0; channel < player->channels; ++channel) {
    for (uint32_t at = span; at < frames; ++at) {
      output[channel][at] = 0.0f;
    }
  }

  const bool on = generation_on(layer.accepted) &&
                  layer.store.load(std::memory_order_relaxed) != nullptr;
  // The Library's every block: one file at full level, nothing to do.
  if (!on && layer.exit_remaining == 0 && layer.own.resting_at(1.0f) &&
      layer.layer.remaining == 0) {
    return;
  }

  const uint32_t glide = player->glide_frames;
  const float rise = glide > 0 ? 1.0f / static_cast<float>(glide) : 1.0f;
  const bool exiting = layer.exit_remaining != 0;
  for (uint32_t at = 0; at < frames; ++at) {
    const float own_gain = moving ? layer.own.step(glide) : layer.own.now;
    const float voice_gain = moving ? layer.layer.step(glide) : layer.layer.now;
    // Leaving: down to nothing over the exit, and nothing for the rest of a
    // block the exit ended in — the generation that replaces it is heard
    // from the next one.
    float leaving = 1.0f;
    if (exiting) {
      leaving = static_cast<float>(layer.exit_remaining) /
                static_cast<float>(glide);
      if (moving && layer.exit_remaining != 0) {
        --layer.exit_remaining;
      }
    }
    if (at >= span) {
      continue;
    }
    float voice = 0.0f;
    if (on) {
      if (layered && player->layer_valid[at] != 0) {
        if (moving && layer.envelope < 1.0f) {
          layer.envelope =
              layer.envelope + rise < 1.0f ? layer.envelope + rise : 1.0f;
        }
        voice = voice_gain * layer.envelope * leaving;
      } else if (moving) {
        // Missing: whatever comes back comes in over a glide.
        layer.envelope = 0.0f;
      }
    }
    for (uint32_t channel = 0; channel < player->channels; ++channel) {
      float sample = output[channel][at] * own_gain;
      if (voice != 0.0f) {
        sample += player->layer_pointers[channel][at] * voice;
      }
      output[channel][at] = sample;
    }
  }
  if (moving && exiting && layer.exit_remaining == 0) {
    // Gone: the generation that replaced it is heard from the next frame,
    // coming in over its own entry.
    layer.accepted = layer.generation.load(std::memory_order_acquire);
    layer.envelope = 0.0f;
  }
}

}  // namespace feq_player

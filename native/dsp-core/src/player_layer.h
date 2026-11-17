/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * A deck's layer and its two gains (`feq_player_load_layer` in player.h).
 *
 * The layer has no read cursor of its own. Its read-ahead is indexed by the
 * DECK's ring cursors: the layer frame decoded for deck cursor C lives in
 * slot C % capacity, stamped with C and the layer generation it belongs to,
 * and the audio thread mixes it into whatever it reads at C. Whatever the
 * deck does — a seek's discard, a load's switch, a pause, a fade, an
 * underrun — the two cannot part, because there is only one position.
 *
 * A GENERATION is one stretch of one layer decoded from one place: every
 * load, removal and seek of the layer, and every load or seek of its deck,
 * starts a new one. The audio thread mixes the generation it has accepted
 * and no other, so frames decoded for a place the deck has left — the layer
 * runs ahead of the deck, so there are always some — are never heard, and a
 * slot being rewritten for a new generation reads as missing, never as a
 * blend of two (`Slot` below: each slot is its own seqlock).
 *
 * The writer stays a ring's length past the deck's READ cursor, and the
 * audio thread reads a block's layer frames before it reads the block's own
 * from the deck's ring: a slot is never rewritten while the frame that was
 * decoded into it can still be read.
 *
 * Decoder thread: the decoding and the generation. Audio thread: the glides,
 * the envelope and which generation is heard. Any thread: the two gains.
 */
#ifndef FLUIDEQ_PLAYER_LAYER_H
#define FLUIDEQ_PLAYER_LAYER_H

#include "fluideq/player.h"
#include "fluideq/resampler.h"

#include <atomic>
#include <cstdint>
#include <cstring>
#include <memory>
#include <vector>

struct FeqPlayer;

namespace feq_player {

/**
 * Twenty milliseconds: the glide of either gain, the layer's entry when it
 * joins mid-song, and its exit when taken off or replaced — the length the
 * wire promises for SET_DECK_GAIN and SET_LAYER_GAIN (`setDeckGain` in main's
 * `wire.ts`). Long enough that a fader dragged across its whole range is a
 * slope with no zipper (one step of a full-scale glide at 48 kHz is 0.001,
 * -60 dB), short enough to feel like the fader.
 */
constexpr double kLayerGlideSeconds = 0.020;

/** A gain that moves to each new target in a straight line. Audio thread. */
struct Glide {
  float now = 1.0f;
  float from = 1.0f;
  float toward = 1.0f;
  uint32_t remaining = 0;

  void snap(float value) {
    now = value;
    from = value;
    toward = value;
    remaining = 0;
  }

  /** A target other than the one being glided to restarts from `now`. */
  void aim(float target, uint32_t length) {
    if (target == toward) {
      return;
    }
    from = now;
    toward = target;
    remaining = length;
    if (length == 0) {
      now = target;
    }
  }

  /** The gain for the next frame. */
  float step(uint32_t length) {
    if (remaining == 0) {
      return now;
    }
    --remaining;
    now = toward + (from - toward) * (static_cast<float>(remaining) /
                                      static_cast<float>(length));
    return now;
  }

  bool resting_at(float value) const { return remaining == 0 && now == value; }
};

/**
 * A gain and the deck content it was set for, in one word: the deck's
 * switch stamp in the high half, the float's bits in the low.
 *
 * One word because the two must cross together. A load resets both gains
 * for the content it brings, at the frame that content begins; a fader moved
 * a moment later must not be undone by that reset, and the reset must not
 * reach the old content's last block. Stamped, the audio thread takes a gain
 * only for the content it is playing.
 */
inline uint64_t pack_gain(uint64_t stamp, float gain) {
  uint32_t bits = 0;
  std::memcpy(&bits, &gain, sizeof(bits));
  return (stamp << 32) | bits;
}

inline uint32_t gain_stamp(uint64_t word) {
  return static_cast<uint32_t>(word >> 32);
}

inline float gain_value(uint64_t word) {
  const auto bits = static_cast<uint32_t>(word & 0xffffffffu);
  float gain = 0.0f;
  std::memcpy(&gain, &bits, sizeof(gain));
  return gain;
}

/**
 * A slot's tag: the generation in the top 16 bits, the deck cursor plus one
 * in the low 48 (zero is a slot never written). 2^48 frames is 23 years at
 * 384 kHz; a generation repeats only after 32768 changes, and then only
 * matters for a slot holding exactly the same cursor, which a free-running
 * cursor never revisits.
 */
constexpr uint64_t kCursorMask = (uint64_t{1} << 48) - 1;

inline uint64_t slot_tag(uint32_t generation, uint64_t cursor) {
  return (static_cast<uint64_t>(generation & 0xffffu) << 48) |
         ((cursor + 1) & kCursorMask);
}

/**
 * The layer's read-ahead: `capacity` slots of `channels` samples, and a tag
 * per slot. Atomics, relaxed, so a slot read while it is rewritten is a
 * defined race the tag check rejects rather than undefined behaviour; on
 * every target this builds for, a relaxed float load is a plain load.
 */
struct LayerStore {
  uint32_t channels = 0;
  uint32_t capacity = 0;
  std::unique_ptr<std::atomic<float>[]> samples;
  std::unique_ptr<std::atomic<uint64_t>[]> tags;
};

struct DeckLayer {
  /* ------------------------------------------------- decoder thread -- */
  /* Named as `Deck`'s are, so one decode routine serves both. */
  void* handle = nullptr;
  FeqDecoderInfo info{};
  FeqResampler* resampler = nullptr;
  std::atomic<int> exhausted{0};
  std::vector<float> decoded_storage;
  std::vector<float*> decoded_pointers;
  std::vector<float> converted_storage;
  std::vector<float*> converted_pointers;
  std::vector<const float*> source_pointers;
  uint32_t pending = 0;
  uint32_t pending_at = 0;

  /**
   * Where the deck's own content stands: the cursor it starts at (a load's
   * switch or a seek's flush) and the place in the file, in seconds, that
   * cursor holds. Kept whether or not a layer is on, so one loaded later
   * knows where to join.
   */
  uint64_t anchor_cursor = 0;
  double anchor_seconds = 0.0;
  /** The deck cursor the next decoded layer frame belongs to. */
  uint64_t next_cursor = 0;
  /**
   * The highest cursor written since the anchor, plus one. Past the reader,
   * a generation being replaced may still be heard leaving
   * (`kLayerGlideSeconds`), so its replacement starts beyond that exit.
   */
  uint64_t written_until = 0;
  /** The generation as last published. Odd while a layer is on. */
  uint32_t generation_written = 0;
  /** Owned here, never freed before the player: the audio thread reads it. */
  std::unique_ptr<LayerStore> store_owner;

  /* ------------------------------------------------------ crossing -- */
  std::atomic<LayerStore*> store{nullptr};
  /** The generation to hear. Even: no layer. */
  std::atomic<uint32_t> generation{0};
  /** `pack_gain` words for the deck's own file and for the layer. */
  std::atomic<uint64_t> own_gain{0};
  std::atomic<uint64_t> layer_gain{0};
  std::atomic<int> present{0};

  /* --------------------------------------------------- audio thread -- */
  uint32_t accepted = 0;
  Glide own;
  Glide layer;
  /** The layer's entry, 0 to 1: up over a glide after any frame without it. */
  float envelope = 1.0f;
  /** Frames left of the accepted generation's exit; zero when not leaving. */
  uint32_t exit_remaining = 0;
};

/* ----------------------------------------------------- decoder thread -- */

/** Both gains at their defaults for content stamped `stamp` (1 and 0). */
void reset_layer_gains(DeckLayer& layer, uint64_t stamp);

/**
 * The deck's content was replaced or emptied at `anchor`: the layer comes off
 * with it. Called before the switch is posted, so a reader that sees the
 * switch sees the layer gone.
 */
void layer_follows_switch(FeqPlayer* player, uint32_t deck, uint64_t anchor);

/**
 * The deck was sought to `seconds`, which its content now holds from
 * `anchor`. The layer is sought to the same place. Called before the flush
 * is posted, for the same reason.
 */
void layer_follows_seek(FeqPlayer* player, uint32_t deck, uint64_t anchor,
                        double seconds);

/** Decode the layer up to deck cursor `target`, as the ring allows. */
uint32_t fill_layer(FeqPlayer* player, uint32_t deck, uint64_t target);

/** The layer's decoder goes. */
void release_layer(FeqPlayer* player, DeckLayer& layer);

/* ------------------------------------------------------- audio thread -- */

/** New content on the deck: the gains land on it, its generation is heard. */
void layer_takes_switch(FeqPlayer* player, uint32_t deck);

/** The deck's seek was taken: the generation that followed it is heard. */
void layer_takes_seek(FeqPlayer* player, uint32_t deck);

/** A block with nothing heard: a layer change needs no exit. */
void layer_idle(FeqPlayer* player, uint32_t deck);

/**
 * Take `span` frames from the deck's ring into `output` with its layer mixed
 * in at the two gains, and zeros up to `frames`. `moving` carries the glides,
 * the envelope and an exit through the block; a tail is taken still, at the
 * levels already reached. The layer's frames are read before the ring's, as
 * the writer's bound requires.
 */
void take_with_layer(FeqPlayer* player, uint32_t deck, float* const* output,
                     uint32_t span, uint32_t frames, bool moving);

}  // namespace feq_player

#endif /* FLUIDEQ_PLAYER_LAYER_H */

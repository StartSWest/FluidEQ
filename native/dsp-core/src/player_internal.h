/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The player's insides, shared by the three files that each hold one
 * thread's part of it — the split `player.h` already draws:
 *
 *  - `player.cpp`, the decoder thread: opening files, seeking, filling rings;
 *  - `player_roles.cpp`, what any thread may ask: a cut, a fade, which deck
 *    is heard, answered as if every change asked for were already made;
 *  - `player_render.cpp`, the audio thread, which alone decides what is
 *    heard and carries out every change at the top of a block.
 */
#ifndef FLUIDEQ_PLAYER_INTERNAL_H
#define FLUIDEQ_PLAYER_INTERNAL_H

#include "fluideq/player.h"

#include "fluideq/resampler.h"
#include "ring.h"

#include <atomic>
#include <cstdint>
#include <limits>
#include <vector>

static_assert(FEQ_PLAYER_DECKS == 2,
              "a fade runs between two decks; a third needs a mixer that "
              "fades more than one track out at once");

namespace feq_player {

constexpr uint64_t kNoBoundary = std::numeric_limits<uint64_t>::max();

/*
 * A change of roles, as one word the audio thread takes whole: a cut, a fade,
 * or a cut and then a fade. Bit 0 says a request is there; bit 7 that it
 * cuts, to the deck in bits 8-9; bit 1 that it fades, to the deck in bits 2-3,
 * on the curve in bits 4-5, over the frames from bit 16 up, bit 6 saying
 * whether anything was being heard when it was asked for.
 */
constexpr uint64_t kRequestPresent = 1u;
constexpr uint64_t kMaxFadeFrames = (uint64_t{1} << 48) - 1;

struct RoleRequest {
  bool cut = false;
  uint32_t cut_deck = 0;
  bool fade = false;
  uint32_t deck = 0;
  FeqCrossfadeCurve curve = FEQ_CROSSFADE_EQUAL_POWER;
  bool heard = true;
  uint64_t duration = 0;
};

inline uint64_t pack_request(const RoleRequest& request) {
  const uint64_t duration =
      request.duration < kMaxFadeFrames ? request.duration : kMaxFadeFrames;
  uint64_t word = kRequestPresent;
  word |= request.fade ? uint64_t{1} << 1 : uint64_t{0};
  word |= static_cast<uint64_t>(request.deck & 3u) << 2;
  word |= static_cast<uint64_t>(static_cast<uint32_t>(request.curve) & 3u) << 4;
  word |= request.heard ? uint64_t{1} << 6 : uint64_t{0};
  word |= request.cut ? uint64_t{1} << 7 : uint64_t{0};
  word |= static_cast<uint64_t>(request.cut_deck & 3u) << 8;
  word |= duration << 16;
  return word;
}

inline RoleRequest unpack_request(uint64_t word) {
  RoleRequest request;
  request.fade = ((word >> 1) & 1u) != 0;
  request.deck = static_cast<uint32_t>((word >> 2) & 3u);
  request.curve = static_cast<FeqCrossfadeCurve>((word >> 4) & 3u);
  request.heard = ((word >> 6) & 1u) != 0;
  request.cut = ((word >> 7) & 1u) != 0;
  request.cut_deck = static_cast<uint32_t>((word >> 8) & 3u);
  request.duration = word >> 16;
  return request;
}

inline uint32_t other_deck(uint32_t deck) { return deck == 0 ? 1u : 0u; }

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

  /**
   * A change of content — a load or an unload — handed to the audio thread.
   *
   * `load` used to reset the ring in place, from the control thread, while
   * the audio thread could be halfway through reading it: both cursors back
   * to zero under a reader about to store its own. Nothing is reset now. The
   * new file is decoded after `switch_to`, where the old one's frames end,
   * and the reader crosses that line only at the top of a block — after
   * taking what was still to be heard of the old file into `tail_*`. The
   * stamp orders changes across decks, so two made inside one block are
   * carried out in the order they were made and the last one stays.
   */
  std::atomic<uint64_t> switch_to{0};
  std::atomic<uint64_t> switch_stamp{0};
  uint64_t switch_seen = 0;

  /**
   * An entry ramp for this deck alone, from `entry_from` of its level.
   *
   * The player's soft entry ramps the whole output, which is right when the
   * deck that jumped is the only one heard. Inside a fade the other deck is
   * heard too, and ramping the mix would dip it — the track fading out
   * dropping to silence because the one fading in was cued. So a deck whose
   * content jumps while it is one half of a fade ramps itself, and a deck
   * cut to from part way up a fade rises from where it was. The seek arms it
   * through the counters, the audio thread by setting it directly.
   */
  std::atomic<uint64_t> entry_request{0};
  uint64_t entry_seen = 0;
  uint32_t entry_remaining = 0;
  double entry_from = 0.0;

  /**
   * What left the path, played out under a ramp to silence. Audio thread.
   *
   * A track taken off a deck while it was heard — replaced, unloaded, or cut
   * away from — used to stop on the sample it had reached, which is a click
   * at whatever level it was playing, up to full. Its next frames are copied
   * here at the level they were heard at, and fade out over the same eighty
   * milliseconds an entry takes while whatever replaced it comes in.
   */
  std::vector<float> tail_storage;
  std::vector<float*> tail_pointers;
  uint32_t tail_length = 0;
  uint32_t tail_at = 0;

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

/** Which deck is heard, and whether a fade is taking it somewhere else. */
struct Roles {
  uint32_t active = 0;
  uint32_t incoming = 0;
  bool fading = false;
};

/**
 * The roles once the change asked for and not yet taken has been made.
 *
 * Every thread but the audio one answers from this: a load that follows a
 * fade asked for a moment ago has to see the fade, not the block before it.
 */
Roles effective_roles(const FeqPlayer* player);

/**
 * Carry out every change asked for since the last block: the content changes
 * first, oldest first, and then `request`, the newest change of roles.
 * Audio thread, at the top of a block (`player_changes.cpp`).
 */
void apply_changes(FeqPlayer* player, uint64_t request);

}  // namespace feq_player

struct FeqPlayer {
  double output_rate = 48000.0;
  uint32_t channels = 2;
  uint32_t max_frames = 0;
  uint32_t read_ahead = 0;
  FeqDecoderOps ops{};

  feq_player::Deck decks[FEQ_PLAYER_DECKS];
  /**
   * The deck heard, and the one a running fade is heading for.
   *
   * Written by the audio thread alone — at the top of a block, or when a fade
   * ends — and asked of it by every other thread through `request`. The
   * control thread used to write them itself, beside a crossfader the audio
   * thread was halfway through mixing with, and a skip taken inside a fade
   * could land between the two.
   */
  std::atomic<uint32_t> active{0};
  std::atomic<uint32_t> incoming{0};
  std::atomic<int> playing{0};
  /** Audio thread only, since the roles moved there. */
  FeqCrossfader fader{};
  /**
   * The newest change of roles not yet made, which the audio thread takes
   * whole at the top of a block (`pack_request`). Newest wins: a request not
   * yet taken is replaced, never queued behind, so a burst of skips ends on
   * the last one asked for.
   */
  std::atomic<uint64_t> request{0};
  /** Stamps content changes in the order they are made (`Deck::switch_to`). */
  std::atomic<uint64_t> switch_counter{0};

  /* What the audio thread last left, for the other threads' questions. */
  std::atomic<int> fading_published{0};
  std::atomic<float> level_published[FEQ_PLAYER_DECKS];

  /* Audio thread only. */
  /** The last block made sound, so what changes now is heard changing. */
  bool was_playing = false;
  /** The last block held its fade, the incoming deck having nothing yet. */
  bool holding = false;

  /**
   * A soft entry when playback begins somewhere other than silence.
   *
   * A decoder handed a file starts at whatever sample the playhead landed on,
   * and that sample is almost never zero — so the output steps from silence to
   * mid-waveform in one frame, which is a click. The element path has always
   * covered this by ramping `element.volume` over 70-80 ms on start and after a
   * seek; on the native engine the element is muted and that ramp reached
   * nothing, so the click was audible on every track change and every scrub.
   *
   * Armed by the control thread on play and on seek, and counted down by the
   * audio thread. Request-and-seen counters rather than a flag, which is the
   * idiom the deck flush already uses here: a flag can be set and cleared
   * between two blocks and the ramp would simply never happen.
   */
  std::atomic<uint64_t> soft_start_request{0};
  uint64_t soft_start_seen = 0;
  uint32_t soft_start_remaining = 0;
  uint32_t soft_start_frames = 0;

  /** Audio-thread scratch for the two decks, allocated once. */
  std::vector<float> mix_storage[FEQ_PLAYER_DECKS];
  std::vector<float*> mix_pointers[FEQ_PLAYER_DECKS];
};

/* What the audio thread's two files both ask of a deck. Audio thread only. */
namespace feq_player {

/** Where a ramp of `total` frames with `remaining` left stands, from `from`. */
inline double ramp_level(uint32_t remaining, uint32_t total, double from) {
  if (remaining == 0 || total == 0) {
    return 1.0;
  }
  const double done =
      static_cast<double>(total - remaining) / static_cast<double>(total);
  return from + (1.0 - from) * done;
}

/** A change of content this deck's reader has not taken yet, or none. */
inline uint64_t switch_boundary(const Deck& deck) {
  return deck.switch_stamp.load(std::memory_order_acquire) != deck.switch_seen
             ? deck.switch_to.load(std::memory_order_acquire)
             : kNoBoundary;
}

inline bool fading_now(const FeqPlayer* player) {
  return player->fader.active != 0 &&
         player->incoming.load(std::memory_order_relaxed) !=
             player->active.load(std::memory_order_relaxed);
}

/** The level a deck's content is mixed at by its role alone. */
inline double role_level(const FeqPlayer* player, uint32_t deck) {
  const uint32_t active = player->active.load(std::memory_order_relaxed);
  if (!fading_now(player)) {
    return deck == active ? 1.0 : 0.0;
  }
  if (deck == active) {
    return feq_crossfader_gain(&player->fader, 0);
  }
  // Not mixed at all while the fade is held for its first frames.
  return player->holding ? 0.0 : feq_crossfader_gain(&player->fader, 1);
}

}  // namespace feq_player

#endif /* FLUIDEQ_PLAYER_INTERNAL_H */

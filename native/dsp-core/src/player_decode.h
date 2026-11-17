/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * One chunk from a file to the device rate, for a deck's own file and for
 * its layer alike. Decoder thread only.
 *
 * A template over the source rather than a struct the two share, because a
 * deck's members are read by name across the player's files and a layer
 * only has to carry the same names to be decoded the same way.
 */
#ifndef FLUIDEQ_PLAYER_DECODE_H
#define FLUIDEQ_PLAYER_DECODE_H

#include "player_internal.h"

namespace feq_player {

/**
 * Up to `room` device-rate frames into `source.converted_pointers`, at most a
 * block's worth. Returns the frames produced.
 *
 * Zero means either no room or the file is finished — flushed to its last
 * frame — and the caller tells them apart by `exhausted`. Never zero with
 * room left and more of the file to go: the decoder thread sleeps on a zero
 * until the audio thread takes frames. Recurses at most twice to keep that
 * promise (a converter window filled without output, then a file that ended
 * on a chunk boundary).
 */
template <typename Source>
uint32_t decode_ahead(FeqPlayer* player, Source& source, uint32_t room) {
  if (source.handle == nullptr || source.resampler == nullptr || room == 0) {
    return 0;
  }
  const uint32_t span = room < player->max_frames ? room : player->max_frames;

  if (source.pending_at >= source.pending) {
    if (source.exhausted.load(std::memory_order_acquire) != 0) {
      // The file is done, but half the resampler's window is still inside it.
      // A fifth of a millisecond, which is inaudible alone and a click at the
      // end of every track on a gapless album.
      return feq_resampler_flush(source.resampler,
                                 source.converted_pointers.data(), span);
    }
    source.pending = player->ops.read(player->ops.user, source.handle,
                                      source.decoded_pointers.data(),
                                      FEQ_PLAYER_DECODE_CHUNK);
    source.pending_at = 0;
    if (source.pending < FEQ_PLAYER_DECODE_CHUNK) {
      source.exhausted.store(1, std::memory_order_release);
    }
    if (source.pending == 0) {
      // The file ended on a chunk boundary: straight on to the converter's
      // flush above, rather than zero and a sleep with the tail still inside.
      return decode_ahead(player, source, room);
    }
  }

  // Held on the source rather than built per call. This is not the audio
  // thread, but a decoder that allocates on every chunk allocates a few
  // thousand times a minute for a pointer array whose length never changes.
  for (uint32_t channel = 0; channel < player->channels; ++channel) {
    source.source_pointers[channel] =
        source.decoded_pointers[channel] + source.pending_at;
  }
  uint32_t consumed = 0;
  const uint32_t produced = feq_resample(
      source.resampler, source.source_pointers.data(),
      source.pending - source.pending_at, source.converted_pointers.data(),
      span, &consumed);
  source.pending_at += consumed;
  if (produced == 0) {
    /**
     * Frames taken into the converter's window without one coming out: the
     * tail of a chunk too short to centre the next output on, or the first
     * half-window of a file. The next chunk finishes the job, so this is not
     * "nothing to do" — and zero is what tells the decoder thread to sleep
     * until the audio thread takes frames, with room in the ring and the
     * file unfinished. It used to be rescued by the next 5 ms poll.
     */
    return consumed > 0 ? decode_ahead(player, source, room) : 0;
  }
  return produced;
}

}  // namespace feq_player

#endif /* FLUIDEQ_PLAYER_DECODE_H */

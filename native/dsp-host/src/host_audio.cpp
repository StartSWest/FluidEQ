/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The audio thread's block and what it wakes after it, and the decks: the
 * decoder's pump, the next track readied onto a free deck, and a deck taking
 * the path.
 */
#include "host.h"

#include <cmath>
#include <mutex>
#include <string>

namespace feq_host {

/**
 * The real-time entry point, called by the backend once per device period.
 *
 * Generate, then process in place. Both halves obey the callback rules in
 * dsp.h; the stack array below is the only storage either of them needs.
 */
void render_bridge(void* context, float* const* planar, uint32_t frames) {
  auto* state = static_cast<HostState*>(context);
  if (state == nullptr || state->engine == nullptr) {
    return;
  }

  /**
   * The player first, the generator only when there is nothing to play.
   *
   * Not "either/or by a mode flag": a deck with audio in it always wins, and
   * the generator fills the silence so that the output path can be proved
   * alive with no file loaded. Both write into `planar`, which the backend
   * pre-zeroes, so a source that writes nothing produces silence rather than
   * the previous period again.
   */
  if (state->player != nullptr &&
      state->player_has_source.load(std::memory_order_acquire)) {
    feq_player_render(state->player, planar, frames);
    /**
     * Room in the read-ahead is the decoder's work, and a decode chunk of it
     * is worth a wake: about twelve a second of playback, each one a whole
     * read, with the two seconds ahead never lower than that chunk short.
     * Armed at every block instead, the device thread paid a wake per period
     * for a decoder with a few hundred frames to write. A total that went
     * backwards is a new player. Armed, not rung: the ring is
     * `ring_what_the_block_armed`, after the period.
     */
    const uint64_t taken = feq_player_frames_taken(state->player);
    if (taken < state->frames_taken_armed ||
        taken - state->frames_taken_armed >= FEQ_PLAYER_DECODE_CHUNK) {
      state->frames_taken_armed = taken;
      state->decoder_bell.arm();
    }
  } else {
    state->source.render(planar, state->channels, frames);
  }

  /**
   * The listener's volume, applied here — before the chain, on purpose.
   *
   * On the element path the volume lives on the `<audio>` element, and an
   * element routed through `createMediaElementSource` applies it to what
   * reaches the graph. So the chain has always seen post-volume audio, and the
   * limiter and the leveler have always responded to it. Applying it after the
   * chain instead would be a defensible design and a different one, and the two
   * engines would stop matching the moment a dynamics stage was armed.
   *
   * Mirrored at all because the elements are MUTED while the native engine is
   * audible: without this the fader moved and nothing happened, which is the
   * whole feature missing rather than a subtlety.
   *
   * Ramped across the block rather than stepped. A fader dragged across its
   * range sends a change every few milliseconds and a step per block is a click
   * per block — audible as a zip up the side of the sound. This is the
   * animation's own duration, not a timer standing in for a race.
   */
  const float target = state->volume.load(std::memory_order_relaxed);
  const float from = state->volume_now;
  if (from != target || target != 1.0f) {
    const float step =
        frames > 0 ? (target - from) / static_cast<float>(frames) : 0.0f;
    for (uint32_t channel = 0; channel < state->channels; ++channel) {
      float running = from;
      float* samples = planar[channel];
      for (uint32_t at = 0; at < frames; ++at) {
        running += step;
        samples[at] *= running;
      }
    }
    state->volume_now = target;
  }

  /**
   * A guard at the chain's input, which is a different job from the one below.
   *
   * The engine at the end repairs and COUNTS, and its count is what telemetry
   * reports. This one repairs and says nothing, because it is protecting the
   * filters rather than reporting on them: one non-finite sample entering a
   * biquad makes every subsequent sample non-finite, so a single bad frame
   * from a decoder silences the rest of the track and looks like the engine
   * died. Catching it after the chain would be catching it too late.
   */
  for (uint32_t channel = 0; channel < state->channels; ++channel) {
    for (uint32_t at = 0; at < frames; ++at) {
      if (!std::isfinite(planar[channel][at])) {
        planar[channel][at] = 0.0f;
      }
    }
  }

  const bool raw = state->raw_sharing.load(std::memory_order_acquire);
  state->chain_route.process(state->chain, state->meters, raw, planar, frames,
                             state->processing_latency);

  // On the stack, so nothing is allocated: adding const to a pointer array is
  // not an implicit conversion in C++, and the alternative is a cast that
  // hides what it is doing.
  const float* inputs[2] = {planar[0], state->channels > 1 ? planar[1]
                                                           : planar[0]};
  feq_engine_process_planar(state->engine, inputs, planar, frames);

  // A report published is telemetry's work, and the pace it has always had.
  const uint64_t reports = feq_engine_reports_published(state->engine);
  if (reports != state->reports_seen) {
    state->reports_seen = reports;
    state->telemetry_bell.arm();
  }
}

/**
 * Ring what the block just rendered armed: the decoder, telemetry, and the
 * chain's voice worker.
 *
 * The backend calls this on the device thread once the period is the
 * device's (`FeqPeriodDoneFn`), and the offline loops after each block. The
 * callback above makes no system call, so this is the first point at which
 * the threads it gave work to can be woken — microseconds after the block,
 * where a fixed sleep had them up to 25 ms late or two hundred times a second
 * early.
 */
void ring_what_the_block_armed(void* context) {
  auto* state = static_cast<HostState*>(context);
  state->decoder_bell.ring_if_armed();
  state->telemetry_bell.ring_if_armed();
  feq_chain_wake_workers(state->chain);
}

/** The backend's `reopen_wanted`: the telemetry thread is the one that acts. */
void wake_telemetry(void* context) {
  static_cast<HostState*>(context)->telemetry_bell.ring();
}

/**
 * Decode ahead of the block an offline render is about to produce.
 *
 * An offline render is not paced by a device: it calls `render_bridge` as fast
 * as the CPU allows, while the decks are refilled by the decoder thread in its
 * own time. Nothing connected those two, so the loop read a ring that was dry
 * for much of the run. Measured here, a five-second export of the same passage
 * came back 53% silent for m4a, 22% for wma and 15% for flac; with this pump it
 * is 0.4%, 0.2% and none. So it was a WAV export full of holes, and a decoder
 * smoke test whose peak was whichever of the two states its telemetry window
 * happened to land on.
 *
 * AAC loses that race hardest because Media Foundation returns 1024 frames per
 * `ReadSample` where the vendored decoders return thousands, which is why the
 * check that failed was always `m4a` — the decode itself is correct, and reads
 * the same file at full level when nothing is outrunning it.
 *
 * The mutex is the one the decoder thread holds around its own pump, so a deck
 * still has exactly one producer writing to it at a time.
 */
void pump_decks(HostState& state) {
  const std::lock_guard<std::mutex> held(state.decoder_mutex);
  if (state.player != nullptr) {
    feq_player_pump(state.player);
  }
}

/**
 * The next track onto the free deck, once there is one. `decoder_mutex` held.
 *
 * Never while a fade runs — both decks are heard then — and never onto a deck
 * a handoff has loaded and not yet given its fade or cut. Tried once per
 * naming: a file that will not open is not asked for again every pass.
 */
void ready_spare(HostState& state) {
  if (!state.spare_wanted || state.player == nullptr ||
      feq_player_fading(state.player) != 0 ||
      state.reserved_deck < FEQ_PLAYER_DECKS) {
    return;
  }
  state.spare_wanted = false;
  const uint32_t deck = feq_player_handoff_deck(state.player);
  HostState::DeckNote& note = state.deck_notes[deck];
  if (note.fresh && note.path == state.spare_path &&
      std::fabs(note.cue_seconds - state.spare_seconds) < 1e-3) {
    return;
  }
  const bool loaded =
      feq_player_load(state.player, deck, state.spare_path.c_str()) != 0;
  if (loaded && state.spare_seconds > 0.0) {
    feq_player_seek(state.player, deck, state.spare_seconds);
  }
  note.path = loaded ? state.spare_path : std::string();
  note.cue_seconds = state.spare_seconds;
  note.fresh = loaded;
  if (loaded) {
    state.player_has_source.store(true, std::memory_order_release);
  }
}

/**
 * A deck asked to be heard, by a cut or a fade: whatever a handoff reserved
 * it for has arrived, and it is no longer a next track waiting to be used.
 * A cut leaves the other deck free, so the next track can go there now.
 */
void took_the_path(HostState& state, uint32_t deck) {
  const std::lock_guard<std::mutex> held(state.decoder_mutex);
  state.reserved_deck = FEQ_PLAYER_DECKS;
  if (deck < FEQ_PLAYER_DECKS) {
    state.deck_notes[deck].fresh = false;
  }
  ready_spare(state);
}

}  // namespace feq_host

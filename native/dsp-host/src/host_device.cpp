/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The engine, the chain and the player, rebuilt around what a device agreed
 * to, and the device followed when Windows moves the output.
 */
#include "host.h"
#include "room_head.h"

#include <cstdio>
#include <fstream>
#include <iterator>
#include <mutex>
#include <string>
#include <vector>

namespace feq_host {

/** Rebuild the engine around a device that has told us what it wants. */
bool rebuild_engine(HostState& state,
                    const std::vector<double>& snapshot,
                    uint32_t revision) {
  FeqEngine* replacement = feq_engine_create(state.sample_rate, state.channels,
                                             state.block_frames);
  if (replacement == nullptr) {
    return false;
  }
  // Re-applied rather than lost. The device deciding it wants 44.1 kHz is not
  // the user asking for their settings back at defaults, and a rebuild that
  // silently flattened the chain would look exactly like the engine ignoring
  // the panel.
  FeqConfigV1 config{};
  config.abi_version = FEQ_ABI_VERSION;
  config.settings_revision = revision;
  config.parameter_count = static_cast<uint32_t>(snapshot.size());
  config.parameter_values = snapshot.data();
  if (feq_engine_prepare_config(replacement, &config) == FEQ_OK) {
    feq_engine_commit_prepared_config(replacement);
  }
  FeqEngine* previous = state.engine;
  state.engine = replacement;
  feq_engine_destroy(previous);
  state.source.set_sample_rate(state.sample_rate);
  return true;
}

/**
 * The room's head and layout for the Library player's chain.
 *
 * The player is stereo, so the two channels are the front pair of the ring
 * and the room is the front stage; the head comes from the shipped set the
 * app names in `--room-heads`, the same files it writes beside the engine's
 * rack. Read once per chain per head: the chain keeps it across reconfigures.
 */
void apply_room_head(HostState& state, FeqChain* chain) {
  static const int kFrontPair[FEQ_CHAIN_MAX_CHANNELS] = {0,  1,  -1, -1,
                                                          -1, -1, -1, -1};
  static const char* const kNames[] = {"small", "medium", "large"};
  feq_chain_set_room_layout(chain, kFrontPair);
  const int head = state.chain_settings.room.head;
  if (state.room_heads_dir.empty() || state.chain_settings.room.enabled == 0 ||
      head < 0 || head > 2 || head == state.room_head_loaded) {
    return;
  }
  const std::string path = state.room_heads_dir + "/" + kNames[head] + ".txt";
  std::ifstream file(path, std::ios::binary);
  if (!file) {
    std::fprintf(stderr, "FluidEQ-DSP: no room head at %s\n", path.c_str());
    return;
  }
  std::string text((std::istreambuf_iterator<char>(file)),
                   std::istreambuf_iterator<char>());
  const auto parsed = fluideq_engine::parse_room_head(
      text, static_cast<double>(state.sample_rate));
  if (!parsed) {
    std::fprintf(stderr, "FluidEQ-DSP: room head %s has no %u Hz block\n",
                 kNames[head], state.sample_rate);
    return;
  }
  feq_chain_set_room_head(chain, parsed->left.data(), parsed->right.data(),
                          parsed->directions, parsed->taps,
                          parsed->needs_doubling ? 1 : 0);
  state.room_head_loaded = head;
  std::fprintf(stderr, "FluidEQ-DSP: room head %s loaded (%u directions)\n",
               kNames[head], parsed->directions);
}

/**
 * Rebuild the chain and the player around the rate the device agreed to.
 *
 * Both are torn down and remade rather than retuned, because both size every
 * buffer they own from the rate and the block: a look-ahead in samples, a
 * resampler's phase table, sixty-four sets of coefficients. Retuning them in
 * place would be the same allocations with more ways to get half of it done.
 *
 * The device is not running while this happens — `open` negotiates, this
 * rebuilds, and only then does `start` let a callback in. That ordering is the
 * whole reason `open` and `start` are separate calls.
 */
bool rebuild_chain_and_player(HostState& state, const FeqDecoderOps& ops) {
  FeqChain* chain = feq_chain_create(static_cast<double>(state.sample_rate),
                                     state.channels, state.block_frames);
  if (chain == nullptr) {
    return false;
  }
  feq_chain_configure(chain, &state.chain_settings);
  state.room_head_loaded = -1;
  apply_room_head(state, chain);
  if (!state.voice_model_path.empty() &&
      feq_chain_load_voice_model(chain, state.voice_model_path.c_str(),
                                 state.voice_runtime_path.c_str()) == 0) {
    std::fprintf(stderr,
                 "FluidEQ-DSP: voice model failed to survive chain rebuild\n");
    // Voice is optional. A missing runtime must not turn a healthy output
    // device into silence; the meter reports the module unavailable and the
    // next rebuild can retry the retained, previously valid pair.
  }
  // Re-attached rather than recreated, so the panel's displays carry across a
  // rebuild instead of blanking every time a band moves.
  feq_chain_set_meters(chain, state.meters);
  // Told the rate here, because this is the one place it is known to have
  // changed: a device that renegotiated to 44.1 kHz publishes windows more
  // slowly, and the spectrum's decay is derived from that rate.
  feq_meters_set_sample_rate(state.meters,
                             static_cast<double>(state.sample_rate));

  // Two seconds of read-ahead per deck. Long enough that a decoder thread
  // descheduled for a moment cannot starve the callback, short enough that a
  // seek throws away almost nothing.
  const uint32_t read_ahead = state.sample_rate * 2;
  FeqPlayer* player = feq_player_create(
      static_cast<double>(state.sample_rate), state.channels,
      state.block_frames, read_ahead, &ops);
  if (player == nullptr) {
    feq_chain_destroy(chain);
    return false;
  }

  FeqChain* old_chain = state.chain;
  FeqPlayer* old_player = state.player;
  state.chain = chain;
  {
    // The decoder thread pumps whatever player is here, and readies the next
    // track onto it; neither may see the old one halfway through going.
    const std::lock_guard<std::mutex> held(state.decoder_mutex);
    state.player = player;
    for (auto& note : state.deck_notes) {
      note = HostState::DeckNote{};
    }
    state.spare_wanted = false;
    state.reserved_deck = FEQ_PLAYER_DECKS;
    feq_player_destroy(old_player);
  }
  // Anything a deck held is gone with the old player, so the generator takes
  // over again until something is loaded into the new one.
  state.player_has_source.store(false, std::memory_order_release);
  feq_chain_destroy(old_chain);
  return true;
}

/**
 * Follow the output the listener is actually using.
 *
 * Windows moves the default render endpoint whenever somebody switches from
 * speakers to headphones, or unplugs a monitor. The old endpoint stays
 * perfectly valid, so WASAPI reports nothing at all and the stream goes on
 * playing to a device nobody is listening to. The element path follows the
 * default on its own, which is why only the native engine went quiet —
 * reported as changing the output and getting no sound.
 *
 * Done here rather than on the notification thread, which is a callback about
 * the very device this tears down, and rather than on the control thread, which
 * spends its life blocked reading stdin and would not act until the next
 * command happened to arrive.
 *
 * The sequence is close, open, rebuild, start — the ordering the rebuild has
 * always required — under the same lock START and STOP take, so a reopen and a
 * command can never be inside the device path together.
 */
void reopen_if_device_changed(HostState& state, IAudioOutputBackend& backend,
                              const FeqDecoderOps& decoder_ops) {
  if (!backend.needs_reopen()) {
    return;
  }
  const std::lock_guard<std::mutex> held(state.device_mutex);
  backend.clear_reopen();
  if (!state.device_wanted.load(std::memory_order_acquire)) {
    // Nobody wants a device right now; the flag was about one being taken away.
    return;
  }

  backend.close();
  // Before the attempt, so a device that arrives while it fails still counts.
  backend.await_endpoint();
  std::string error;
  FeqBackendFormat negotiated{};
  if (!backend.open(negotiated, error)) {
    /**
     * The device is not there YET, which is not the same as not coming back.
     *
     * A headset powering off and on, or Windows re-enumerating after one is
     * plugged in, leaves a window of a second or so with no default endpoint
     * at all — Chromium logs "invalid output parameters" against the same
     * moment. Opening during that window fails, and giving up here left the
     * host closed and silent with nothing scheduled to try again: the process
     * alive, no device, no error anybody could see, and only a restart to fix
     * it. That is the "no sound after changing output" this mechanism was
     * supposed to prevent.
     *
     * The next attempt is Windows' to call, through `await_endpoint` above: a
     * device arriving or changing state, the default moving, or Windows audio
     * running again wakes this thread with the request raised. It was the
     * telemetry thread's 25 ms tick, forty attempts a second for as long as
     * the outage lasted, each one a COM activation. Reported once per outage,
     * because a change reported while it lasts is an attempt, and a line per
     * attempt would bury the one that matters.
     */
    if (!state.reopen_failure_reported) {
      state.reopen_failure_reported = true;
      std::fprintf(stderr,
                   "FluidEQ-DSP: reopen failed: %s; retrying until an "
                   "endpoint is available\n",
                   error.c_str());
    }
    return;
  }
  state.reopen_failure_reported = false;

  const uint32_t channels = negotiated.channels < kEngineChannels
                                ? negotiated.channels
                                : kEngineChannels;
  /**
   * Rebuilt only if the new endpoint is actually shaped differently.
   *
   * Everything the chain and the player own is sized by rate, channel count and
   * block length, so a change in any of those needs a rebuild. Nothing else
   * does — and rebuilding anyway is destructive in a way that is easy to miss:
   * the player goes with it, and a new player has no decks, so the track that
   * was playing is gone.
   *
   * That is what a device change felt like. Speakers to headphones is the same
   * 48 kHz stereo endpoint by another name, so the rebuild was pure loss: the
   * output moved correctly and the music stopped, three times in a row on one
   * machine. Keeping the player when its shape has not changed means the track
   * simply carries on out of the new device, which is what somebody plugging in
   * headphones expects to happen.
   */
  const bool shape_changed = negotiated.sample_rate != state.sample_rate ||
                             channels != state.channels ||
                             negotiated.max_block_frames != state.block_frames;
  state.sample_rate = negotiated.sample_rate;
  state.channels = channels;
  state.block_frames = negotiated.max_block_frames;

  if (shape_changed && !rebuild_chain_and_player(state, decoder_ops)) {
    std::fprintf(stderr, "FluidEQ-DSP: reopen failed to rebuild the chain\n");
    backend.close();
    return;
  }
  if (!backend.start(error)) {
    // Opened and then refused to run, which is the same outage a moment later.
    // Closed, and awaiting the next change, rather than left as a silent open
    // handle.
    std::fprintf(stderr, "FluidEQ-DSP: reopen failed to start: %s\n",
                 error.c_str());
    backend.close();
    backend.await_endpoint();
    return;
  }

  if (!shape_changed) {
    // The decks survived, so there is nothing for the renderer to put back and
    // no reason to make it reload a track that never stopped playing.
    std::fprintf(stderr,
                 "FluidEQ-DSP: output device changed; same format, kept "
                 "playing at %u Hz\n",
                 state.sample_rate);
    return;
  }

  /**
   * Announced last, once there is something to come back to.
   *
   * The rebuild above destroyed the player, so every deck is empty and
   * `player_has_source` is false — the endpoint is correct and the music has
   * stopped. Bumping this is what tells the renderer to cue what it was playing
   * again, and it is bumped only on the path where the device really did come
   * back, so a failed reopen does not ask for a reload into nothing.
   */
  state.device_generation.fetch_add(1, std::memory_order_acq_rel);
  std::fprintf(stderr,
               "FluidEQ-DSP: output device changed; reopened at %u Hz\n",
               state.sample_rate);
}

}  // namespace feq_host

/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The supervised host process: device, engine, control, telemetry.
 *
 * It owns the output endpoint and the real-time thread. What it deliberately
 * does NOT own is any decision: the renderer resolves presets, clamps every
 * value and sends one already-valid snapshot. This process validates the frame
 * it was handed and nothing else, because a second opinion about what a gain
 * may be is a second answer.
 *
 * Three threads, and which one may do what is the whole design:
 *
 *   control    reads stdin, validates, prepares snapshots, opens the device
 *   real-time  owned by the backend; generates, processes, writes to the device
 *   telemetry  drains the engine's ring and writes frames to stdout
 *
 * The real-time thread never writes to stdout, never allocates and never takes
 * a lock. The other two share stdout under a mutex, because two writers
 * interleaving inside one binary frame is a desynchronised stream that looks
 * like corruption rather than like a race.
 *
 * The parts: host.h (the state, and the calls between parts), host_wire.cpp
 * (the pipe), host_telemetry.cpp, host_audio.cpp (the callback and the
 * decks), host_device.cpp (rebuilds and reopens), host_commands.cpp and
 * host_deck_commands.cpp (one function per command). This file starts the
 * threads and runs the control loop.
 */

#include "host.h"
#include "decoders/pcm_decoder.h"
#include "parent_watch.h"

#include <atomic>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <memory>
#include <string>
#include <thread>

#ifdef _WIN32
#include <fcntl.h>
#include <io.h>
#endif

namespace feq_host {

namespace {

/**
 * Twenty engine reports, so half a second of audio between process samples
 * while something plays.
 *
 * Counted in the reports telemetry already drains — the engine publishes one
 * per fortieth of a second of audio — rather than given a clock of its own.
 * The number is chosen from what reads well rather than from what is cheap:
 * memory and CPU are figures somebody watches climb, and a row that changes
 * forty times a second cannot be read at all. With nothing playing a sample
 * follows whatever work the host did instead (`stats_wanted`).
 */
constexpr uint32_t kStatsIntervalReports = 20;

/**
 * The backend, reachable from the parent watch without carrying a context.
 *
 * A raw pointer to something `run` owns and outlives: the watch thread only
 * ever calls `close()` on it, and only while `run` is still blocked in its
 * read loop. A second `unique_ptr` here would be a second owner.
 */
IAudioOutputBackend* g_backend_for_exit = nullptr;

/** Runs on the watch thread when the parent dies. Releases the endpoint. */
void release_device_on_parent_exit() {
  if (g_backend_for_exit != nullptr) {
    g_backend_for_exit->close();
  }
}

/** `--room-heads <dir>`, or empty when nobody said: then there is no room. */
std::string room_heads_from(int argc, char** argv) {
  for (int index = 1; index + 1 < argc; ++index) {
    if (std::strcmp(argv[index], "--room-heads") == 0) {
      return argv[index + 1];
    }
  }
  return std::string();
}

/** `--parent-pid <n>`, or zero when nobody said. */
uint32_t parent_pid_from(int argc, char** argv) {
  for (int index = 1; index + 1 < argc; ++index) {
    if (std::strcmp(argv[index], "--parent-pid") == 0) {
      return static_cast<uint32_t>(std::strtoul(argv[index + 1], nullptr, 10));
    }
  }
  return 0;
}

/**
 * The host's whole life: the threads started, commands read until the pipe
 * closes or says stop, and everything taken down in the order it is read.
 */
int run(int argc, char** argv) {
#ifdef _WIN32
  // Without this the CRT rewrites 0x0A as 0x0D 0x0A on the way out and eats
  // the 0x0D on the way in, which corrupts any frame whose bytes happen to
  // include a newline — that is, most of them, silently and intermittently.
  _setmode(_fileno(stdin), _O_BINARY);
  _setmode(_fileno(stdout), _O_BINARY);
#endif

  HostState state;
  state.engine = feq_engine_create(state.sample_rate, state.channels,
                                   state.block_frames);
  if (state.engine == nullptr) {
    std::fprintf(stderr, "FluidEQ-DSP: engine could not be created\n");
    return 1;
  }

  /**
   * Allocated once for the life of the process, and switched off.
   *
   * Off because the DSP tab is one of several and is usually closed; the
   * renderer turns it on when the panel mounts. Allocated up front because the
   * alternative is allocating buffers on the first block after a command,
   * which is the audio thread's problem and not the control thread's.
   *
   * A null result is not fatal. The meters are a display; an engine that
   * refused to start over a spectrum would be a worse trade than a panel with
   * still graphs, and `capture` already treats null as "nobody is looking".
   */
  state.meters = feq_meters_create(state.channels);

  FeqBackendHooks hooks;
  hooks.render = &render_bridge;
  hooks.period_done = &ring_what_the_block_armed;
  hooks.reopen_wanted = &wake_telemetry;
  hooks.context = &state;
  std::unique_ptr<IAudioOutputBackend> backend = create_audio_backend(hooks);
  /**
   * Started before the handshake, so a parent that dies during start-up still
   * takes this process with it.
   *
   * The supervisor's `stop` and the stdin EOF both handle an orderly exit.
   * This handles the one that strands a process: Electron force-killed, no
   * shutdown sent, no `kill` called, and this process potentially blocked
   * inside `fwrite` on a pipe nobody is draining any more.
   */
  g_backend_for_exit = backend.get();
  const uint32_t parent_pid = parent_pid_from(argc, argv);
  feq_watch_parent(parent_pid, &release_device_on_parent_exit);
  send_handshake(backend->name());
  std::fprintf(stderr,
               "FluidEQ-DSP: host ready backend=%s parentPid=%u fallbackRate=%u "
               "channels=%u blockFrames=%u\n",
               backend->name(), parent_pid, state.sample_rate, state.channels,
               state.block_frames);

  // Built once and handed to every player: the decoder is stateless and the
  // per-file state lives behind the handle it returns.
  const FeqDecoderOps decoder_ops = feq_decoder_ops();
  feq_chain_settings_defaults(&state.chain_settings);
  state.room_heads_dir = room_heads_from(argc, argv);
  /**
   * Built before any device exists, at the fallback rate.
   *
   * `START` rebuilds both around whatever the endpoint actually agreed to, so
   * this pair is not the one that plays. It is what makes the host usable with
   * no device at all: an offline render is a real capability the parity harness
   * and any future export both need, and until it works end to end there is
   * nothing worth attaching a device to.
   */
  rebuild_chain_and_player(state, decoder_ops);

  std::atomic<bool> publishing{true};
  /**
   * The telemetry thread: reports, the panel's pictures, the device's upkeep.
   *
   * Asleep until rung (`telemetry_bell`): by a report the engine published,
   * by Windows saying the device wants reopening, by a command that left the
   * process changed with no device running, or to stop. Everything it does is
   * one of those — a report to send, a window to transform, an endpoint to
   * reopen, a sample to take — so with the device closed it does not run at
   * all, where the 25 ms sleep it replaces went on ticking for the life of
   * the host.
   *
   * The count is read before the work is looked for, so a ring that lands
   * while this pass runs returns the wait at once.
   */
  std::thread telemetry([&] {
    uint32_t reports_since_stats = 0;
    for (;;) {
      const uint32_t seen = state.telemetry_bell.rung();
      if (!publishing.load(std::memory_order_acquire)) {
        break;
      }
      reopen_if_device_changed(state, *backend, decoder_ops);
      reports_since_stats += drain_telemetry(state, *backend);
      // Same thread as telemetry, deliberately: this is where the transforms
      // are allowed to happen, and giving them a thread of their own would add
      // a second writer to stdout for no gain.
      drain_analysis(state);
      if (reports_since_stats >= kStatsIntervalReports ||
          state.stats_wanted.exchange(false, std::memory_order_acq_rel)) {
        reports_since_stats = 0;
        publish_process_stats();
      }
      state.telemetry_bell.wait(seen);
    }
    drain_telemetry(state, *backend);
  });

  /**
   * The decoder thread: the only one that may touch a file.
   *
   * It fills whatever room the decks have and then sleeps until there is more
   * (`decoder_bell`): the audio thread took frames out of the read-ahead, or
   * the control thread changed what a deck holds. It used to sleep 5 ms and
   * look again — two hundred times a second, with two seconds buffered, and
   * whether or not anything was playing — because there was no signal to
   * block on that would not cost a lock the callback might contend for. The
   * callback now only arms the doorbell, one atomic store, once the decks
   * have played a decode chunk (`FEQ_PLAYER_DECODE_CHUNK`), and the ring
   * comes after the period is handed to the device: about twelve times a
   * second of playback, and not at all when nothing plays. The decoding
   * itself is the same work either way.
   *
   * `load` and `seek` are handled on the control thread, which is a second
   * writer to the same decoder. That is safe only because the control thread
   * takes `decoder_mutex` and this thread does too — a mutex the AUDIO thread
   * never touches, which is the rule that matters.
   */
  std::atomic<bool> decoding{true};
  std::thread decoder([&] {
    for (;;) {
      const uint32_t seen = state.decoder_bell.rung();
      if (!decoding.load(std::memory_order_acquire)) {
        return;
      }
      uint32_t produced = 0;
      {
        const std::lock_guard<std::mutex> held(state.decoder_mutex);
        if (state.player != nullptr) {
          // A fade ending is what frees a deck for the next track, and this
          // pass is the first to see it.
          ready_spare(state);
          produced = feq_player_pump(state.player);
        }
      }
      if (produced == 0) {
        state.decoder_bell.wait(seen);
      }
    }
  });

  bool running = true;
  while (running) {
    FeqWireCommandFrame frame{};
    if (!read_exact(&frame, sizeof(frame))) {
      // The parent closed the pipe. An ordinary shutdown, not a fault:
      // Electron exiting takes its children with it, and there is nothing to
      // report to a process that has already gone.
      std::fprintf(stderr,
                   "FluidEQ-DSP: control pipe closed; orderly shutdown\n");
      break;
    }
    if (frame.magic != FEQ_MAGIC_COMMAND ||
        frame.protocol_version != FEQ_WIRE_PROTOCOL_VERSION) {
      send_ack(frame.request_id, FEQ_WIRE_UNSUPPORTED, 0, 0, 0.0);
      continue;
    }

    running = dispatch_command(state, *backend, decoder_ops, frame);

    /**
     * Work done with no device running is work no engine report will count:
     * a voice model loaded, a deck decoded, a device closed. The process
     * sample that says what it cost is taken on the telemetry thread, its
     * only caller, and follows the command rather than a clock.
     */
    if (!backend->is_running()) {
      state.stats_wanted.store(true, std::memory_order_release);
      state.telemetry_bell.ring();
    }
  }

  // Device first: the real-time thread reads the engine, so the engine must
  // outlive it by the whole of this shutdown.
  backend->close();
  decoding.store(false, std::memory_order_release);
  state.decoder_bell.ring();
  decoder.join();
  publishing.store(false, std::memory_order_release);
  state.telemetry_bell.ring();
  telemetry.join();
  // The player before the chain before the engine, which is the reverse of the
  // order they are read in: nothing may be destroyed while a thread above it
  // could still be holding a pointer into it.
  feq_player_destroy(state.player);
  feq_chain_destroy(state.chain);
  // After the chain, which holds a borrowed pointer to it.
  feq_meters_destroy(state.meters);
  feq_engine_destroy(state.engine);
  std::fprintf(stderr, "FluidEQ-DSP: host stopped cleanly\n");
  return 0;
}

}  // namespace

}  // namespace feq_host

int main(int argc, char** argv) { return feq_host::run(argc, argv); }

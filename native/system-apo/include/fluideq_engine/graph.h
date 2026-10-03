/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Everything one output endpoint's resolved `Chain` actually does to audio.
 *
 * The effect Windows loads into audiodg.exe gets a buffer and a frame count
 * and nothing else: no thread of its own, no allocator it may call, and no
 * way to report a failure that is not a glitch the user hears. So the split
 * here is absolute — the constructor does every expensive thing (reads the
 * impulse response off disk, resamples it, designs the graphic-EQ FIR,
 * allocates every convolver and every filter history), and `process` is
 * arithmetic over memory that already exists.
 *
 * A `Chain` that changes while audio is running is applied by building a
 * second `Graph` off the audio thread and handing it over; `adopt_state`
 * carries every band's history across and fades from the old sound to the
 * new (`IirCascade`), so no edit restarts a filter from silence in the middle
 * of a waveform, which is heard as a click.
 */
#ifndef FLUIDEQ_ENGINE_GRAPH_H
#define FLUIDEQ_ENGINE_GRAPH_H

#include <atomic>
#include <cstdint>
#include <memory>
#include <string>
#include <utility>
#include <vector>

#include "fluideq/biquad.h"
#include "fluideq/chain.h"
#include "fluideq/convolver.h"
#include "fluideq/primitives.h"
#include "fluideq_engine/config.h"

namespace fluideq_engine {
class InputHistory;
class LevelMailbox;
class OutputGuard;
struct RoomHead;

namespace detail {

// Stateless deleters so `std::unique_ptr` calls the matching `feq_*_destroy`
// instead of `delete` on an opaque C handle. Both destroy functions already
// treat a null pointer as a no-op, same as `delete`, so no extra guard here.
struct ConvolverKernelDeleter {
  void operator()(FeqConvolverKernel* kernel) const noexcept {
    feq_convolver_kernel_destroy(kernel);
  }
};
struct ConvolverDeleter {
  void operator()(FeqConvolver* state) const noexcept {
    feq_convolver_destroy(state);
  }
};
struct ChainDeleter {
  void operator()(FeqChain* chain) const noexcept { feq_chain_destroy(chain); }
};

}  // namespace detail

class CurveStage;
class EqPhaseStage;
class IirCascade;
struct SourceAnalysis;

class Graph {
 public:
  /**
   * Builds the whole graph. Never on the audio thread: this opens a file,
   * allocates, and can take milliseconds designing a FIR.
   *
   * `max_frames` is the largest block `process` will accept. A larger one is
   * refused rather than handled, because handling it would mean either
   * allocating or writing past something the caller owns.
   *
   * `leveling` is the output's leveling memory (`leveling_board.h`), handed
   * to the rack's live leveling so what it learned outlives this graph. Null
   * runs leveling that forgets with the chain, which is what a test wants.
   *
   * `channel_mask` is the stream's (`describe_format`; 0 for a plain
   * format): the rack reads the subwoofer feed and the room's speakers from
   * it. `room_head` is the head the app wrote for the room, or null for
   * none, which leaves the room inactive whatever the rack asks.
   *
   * `follows_processing` says the graph it replaces was changing the sound.
   * A chain with nothing for this output then still builds empty stages and
   * the output guard, so switching FluidEQ off fades the EQ out and keeps the
   * guard's two milliseconds of delay: the music neither jumps nor skips.
   * Switching it off used to swap straight to a graph with no delay at all,
   * dropping 55 ms of music at the switch.
   *
   * `rack_from` is the graph published before this one, handed in only when
   * the room's head has not changed since that graph was built. Where
   * everything else the rack is built from is the same too — the rack's
   * values, game mode as the EQ side asks for it, the rate, the channels,
   * the block size, the channel mask and the leveling memory — this graph
   * runs that graph's chain instead of building one (`rack_reused_`).
   */
  Graph(const Chain& chain, uint32_t sample_rate, uint32_t channels,
        uint32_t max_frames,
        std::shared_ptr<FeqLevelingMemory> leveling = nullptr,
        unsigned long channel_mask = 0, const RoomHead* room_head = nullptr,
        bool follows_processing = false, const Graph* rack_from = nullptr,
        const SourceAnalysis* source_analysis = nullptr);
  ~Graph();
  Graph(const Graph&) = delete;
  Graph& operator=(const Graph&) = delete;

  /**
   * In place, over `channels` planar buffers of `frames` samples each.
   *
   * Real-time safe by construction: no allocation, no free, no lock, no OS
   * call, no throw. `frames` above `max_frames` and a null buffer are both
   * left untouched rather than clamped — a short block of the caller's audio
   * is a glitch, a partially processed one is a glitch plus a discontinuity.
   */
  void process(float* const* planar, uint32_t frames) noexcept;

  /** After rendering: bounded armed worker notifications, never inference. */
  void wake_workers() noexcept;

  struct SourceReport {
    bool library = false;
    bool engine_owner = true;
    uint64_t source = 0;
    uint64_t epoch = 0;
    uint64_t revision = 0;
    bool ready = true;
    bool voice_ready = false;
    bool warm_handover = false;
  };
  const SourceReport& source_report() const noexcept { return source_report_; }

  // Before publication; the endpoint owns the meters across graph rebuilds.
  // A reused chain already has them, and may be running on the audio thread:
  // the chain's pointer to them is a plain one, never written under it.
  void set_meters(FeqMeters* meters, std::atomic<bool>* activity) noexcept {
    if (rack_ && !rack_reused_) feq_chain_set_meters(rack_.get(), meters);
    meter_activity_ = activity;
  }
  void report_meter_activity(bool active) noexcept {
    if (output_active_) output_active_->store(active, std::memory_order_relaxed);
    if (meter_activity_ != nullptr)
      meter_activity_->store(active && rack_ != nullptr, std::memory_order_release);
  }
  void report_input_silence(uint32_t frames) noexcept {
    feq_chain_notify_input_silence(rack_.get(), frames);
  }

  /** Watcher thread, before publication. Reset graphs leave this disabled. */
  void request_state_transfer() noexcept { transfer_state_ = true; }

  /**
   * Watcher thread, before publication: where `process` records the music as
   * it leaves the rack, for Auto normalize to replay (`input_history.h`).
   * The history outlives every graph; null records nothing.
   */
  void set_history(InputHistory* history) noexcept { history_ = history; }
  /** Watcher thread: old graphs keep their source's history alive until retired. */
  void own_history(std::shared_ptr<InputHistory> history) noexcept {
    history_owner_ = std::move(history);
    history_ = history_owner_.get();
  }

  /**
   * Watcher thread, before publication: this graph's level will arrive
   * through `mailbox` under `generation` (`level_mailbox.h`) while the graph
   * already plays, held until then (`OutputGuard::hold`). Without it the
   * handover finds the level the old way.
   */
  void expect_level(const LevelMailbox* mailbox, uint32_t generation) noexcept {
    level_mailbox_ = mailbox;
    level_generation_ = generation;
  }

  /**
   * Audio thread, between blocks, while the previous histories are idle.
   *
   * Every band still here keeps its history and the old bands fade out over
   * `IirCascade::kFadeSeconds`; the preamp ramps over the same time; the FIR
   * stages, the rack and the output guard carry their own state across.
   */
  void adopt_state(Graph* previous) noexcept;

  /** Whether both graphs are running the very same rack chain object. */
  bool rack_is_shared_with(const Graph& other) const noexcept;

  /**
   * True when this graph is guaranteed to leave audio exactly as it found it
   * — either the config never named this endpoint, or it named it and asked
   * for nothing. The caller uses it to skip the effect entirely.
   */
  bool is_passthrough() const noexcept;

  /**
   * Frames of delay this graph adds, for the host to report to Windows.
   *
   * Every convolution stage's block-pipeline latency, plus the graphic-EQ
   * FIR's own group delay when it has one. With every curve in minimum phase
   * (the default, and game mode) the FIR is minimum-phase and adds none; with
   * a layer in linear phase it is designed linear-phase, its energy at the
   * centre tap, and an n-tap kernel puts the signal out n/2 frames later. A
   * `Convolution:` impulse response contributes no such term: it is causal,
   * and its delay is part of the sound it reproduces.
   *
   * So this is 0, one convolver's latency, one plus the FIR's half-length,
   * or several stages together — never a fixed constant.
   *
   * Plus the rack's own (`feq_chain_latency_frames`), which linear-phase EQ
   * dominates at 8192 frames — 171 ms at 48 kHz. That is why the constructor
   * primes the rack rather than leaving its kernel to be adopted by the first
   * audio block: this number is read once, at publish time, and cached for
   * `GetLatency`.
   */
  uint32_t latency_frames() const noexcept;
  double auto_preamp_gain_db() const noexcept;
  void set_output_meters(std::atomic<float>* gain, std::atomic<bool>* enabled,
                         std::atomic<bool>* active) noexcept {
    output_gain_ = gain;
    output_enabled_ = enabled;
    output_active_ = active;
  }

  /**
   * What went wrong that was survivable, in English, for the log.
   *
   * A missing impulse response, one at the wrong sample rate, or a kernel
   * longer than this engine will run are all handled rather than refused: a
   * config with one bad line still has to produce audio. The log line is the
   * only place that difference is visible, so it has to say which.
   */
  const std::vector<std::string>& warnings() const noexcept;

  /**
   * What the configuration asked for that this graph is not running, one
   * short stable code each: "convolution", "graphic-eq", "dsp-rack".
   *
   * Beside `warnings`, not instead of them. A warning is a sentence for the
   * log and says which of several things went wrong; this says only what
   * the user is not hearing, in a form the app can translate — it is what
   * the status file hands to `engineHealth.ts`. A resampled or truncated
   * impulse response is a warning and not a problem: it is still running.
   */
  const std::vector<std::string>& problems() const noexcept;

  /**
   * One line about the room for the log — what it folds, through which
   * head, at what cost — or empty when the rack has no room to speak of.
   */
  const std::string& room_note() const noexcept;

  /** `EngineStatus::room`'s words for this graph's rack. */
  const std::string& room_state() const noexcept;

  /**
   * What each stage adds to `latency_frames()`, which is their sum — for the
   * status, and from there the DSP page, which shows a listener their lag
   * stage by stage rather than as one number nobody can act on.
   */
  struct LatencyParts {
    /** The rack's own stages, as `feq_chain_latency_parts` reports them. */
    FeqChainLatencyParts rack{};
    /**
     * The EQ page's graphic curves: one partition, plus the FIR's half when
     * a layer asks for linear phase.
     */
    uint32_t curves = 0;
    /**
     * The one FIR every layer in linear phase shares (`linear_phase_`),
     * counted once: here while Your EQ is in it, under `curve_phase` while
     * only the curves are.
     */
    uint32_t eq_phase = 0;
    uint32_t curve_phase = 0;
    /** An impulse response the configuration convolves with. */
    uint32_t convolution = 0;
    /** The EQ's output guard, which keeps a boost from clipping. */
    uint32_t guard = 0;
  };
  const LatencyParts& latency_parts() const noexcept { return parts_; }
  // Immutable control-thread plan for this graph, including Room's intended
  // Dimension protection. Never reads audio-owned Room state during handover.
  const std::vector<std::string>& active_stages() const noexcept { return active_stages_; }

  /** Game mode: the Gaming preset on the rack, or the Games voicing. */
  bool low_latency() const noexcept { return low_latency_; }

  /**
   * Blocks this graph had to silence because they came out with a sample
   * that was not a real number — see the end of `process`. Any thread; the
   * watcher reads it once the graph is being replaced, for the log.
   */
  uint32_t silenced_blocks() const noexcept {
    return silenced_blocks_.load(std::memory_order_relaxed);
  }

  /**
   * Any thread: the graph this one is still playing while it crosses over
   * from it (`adopt_state`), or null once it has crossed. The watcher keeps
   * alive whatever a graph it keeps names here (`Watcher::reclaim`).
   */
  const Graph* crossing_from() const noexcept {
    return crossing_hold_.load(std::memory_order_acquire);
  }

 private:
  /**
   * THE CROSSOVER, for a handover that moves the sound in time.
   *
   * A graph that delays the sound by a different amount than the one before
   * it cannot take that graph's place sample for sample: its first sample out
   * is some other moment of the music, and every preset switch that changed
   * the Maximizer's look-ahead, the curves stage, Game mode or the rack's
   * presence jumped that far — -24 to -30 dBFS above 5 kHz under a low tone
   * programme on 534 of the 636 switches measured (2026-09-25). Such a graph
   * takes nothing from the one before: that one goes on playing, fed the
   * same input, while this one fills its own lines from silence, and once
   * this one's whole delay and `kCrossingSettleSeconds` have passed the sound
   * crosses to it over `kCrossingFadeSeconds`. Two versions of the music a
   * few milliseconds apart then overlap for 30 ms — heard as nothing much —
   * where they used to meet in one sample. A handover that keeps the delay
   * carries state across as it always did.
   *
   * `source_` is the audio thread's; `crossing_hold_` is what the watcher
   * reads, cleared with release only after the last block that touched it.
   */
  Graph* source_ = nullptr;
  bool source_shares_rack_ = false;
  std::atomic<const Graph*> crossing_hold_{nullptr};
  uint64_t crossing_elapsed_ = 0;
  uint64_t crossing_prime_ = 0;
  uint32_t crossing_fade_ = 0;
  /** The input as it arrived, for the graph still playing; `max_frames_` each. */
  std::vector<std::vector<float>> source_buffers_;
  std::vector<float*> source_planes_;

  /** Whether the crossover can start from `previous`; starts it if so. */
  bool start_crossing(Graph* previous) noexcept;
  /** The rack and the channels it holds back; then everything after it. */
  void run_rack(float* const* planar, uint32_t frames) noexcept;
  void run_tail(float* const* planar, uint32_t frames) noexcept;
  /** The two graphs' outputs, from the one still playing to this one. */
  void mix_crossing(float* const* planar, uint32_t frames) noexcept;

  std::atomic<bool>* meter_activity_ = nullptr;
  std::atomic<uint32_t> silenced_blocks_{0};
  bool transfer_state_ = false;
  InputHistory* history_ = nullptr;
  std::shared_ptr<InputHistory> history_owner_;
  // Where this graph's level arrives (`expect_level`); whether it has yet.
  const LevelMailbox* level_mailbox_ = nullptr;
  uint32_t level_generation_ = 0;
  bool level_pending_ = false;
  /** Either handover's level: held for one on its way, or found the old way. */
  void hand_level_over(bool sound_changed, uint32_t settling) noexcept;
  /** Audio thread: this graph's level, once it has arrived. */
  void take_arrived_level() noexcept;
  bool auto_preamp_ = false;
  std::unique_ptr<OutputGuard> output_guard_;
  std::atomic<float>* output_gain_ = nullptr;
  std::atomic<bool>* output_enabled_ = nullptr;
  std::atomic<bool>* output_active_ = nullptr;
  uint32_t sample_rate_;
  uint32_t channels_;
  uint32_t max_frames_;
  bool passthrough_;
  double preamp_linear_;
  /**
   * The preamp an edit left behind, ramped to `preamp_linear_` over the same
   * fade as the bands: a step in gain is a step in the waveform.
   */
  double preamp_from_ = 1.0;
  uint32_t preamp_fade_total_ = 0;
  uint32_t preamp_fade_left_ = 0;
  /** Where Auto normalize starts on this curve (`Chain::auto_preamp_start_db`). */
  double curve_level_db_ = 0.0;
  uint32_t latency_frames_;
  LatencyParts parts_{};
  std::vector<std::string> active_stages_;
  bool low_latency_ = false;

  /** The preamp at the current point of its ramp. */
  double current_preamp() const noexcept;
  /** The curves stage's kernel; null for none, or for the delay. */
  const std::vector<float>* curve_identity() const noexcept;

  // Bands no layer claims — a hand-written config's plain `Filter:` lines.
  // Always built, even empty, like the two phase stages: an empty stage is a
  // straight copy, and it is what lets bands that appear or disappear in an
  // edit fade in or out.
  std::unique_ptr<IirCascade> plain_;
  // Every band of a layer in linear phase, Your EQ's and the curves' alike,
  // as one FIR with one delay; then each layer in minimum phase as biquads.
  std::unique_ptr<EqPhaseStage> linear_phase_;
  std::unique_ptr<EqPhaseStage> eq_phase_;
  std::unique_ptr<EqPhaseStage> curve_phase_;

  // The kernels outlive every convolver built from them, and each is shared
  // by all channels; only the per-channel `FeqConvolver` carries history.
  //
  // Owned through `unique_ptr` so a throw anywhere after one of these is
  // created — `warnings_.push_back`, the FIR design's allocations, the next
  // `feq_convolver_kernel_create` — still runs its destructor rather than
  // leaking the handle. Declared AFTER the kernels on purpose: members are
  // destroyed in reverse declaration order, and each convolver holds a
  // pointer into the kernel it was built from, so the convolvers must go
  // first.
  std::unique_ptr<FeqConvolverKernel, detail::ConvolverKernelDeleter>
      impulse_kernel_;
  std::shared_ptr<const std::vector<float>> impulse_identity_;
  std::vector<std::unique_ptr<FeqConvolver, detail::ConvolverDeleter>>
      impulse_;
  // The EQ page's graphic curves, or the delay they amount to with none.
  std::unique_ptr<CurveStage> curves_;

  /**
   * The DSP rack, when `Chain::dsp_values` decoded into one.
   *
   * The same `fluideq-dsp-core` chain the Library player runs, with the
   * stages that cannot live inside audiodg.exe taken out by
   * `decode_dsp_chain`. Null whenever the app has not written a rack file,
   * the file was unreadable, or the array was not a snapshot this build's
   * decoder recognises — all of which leave the EQ below running.
   *
   * `shared_ptr` so an edit that leaves everything the rack is built from
   * alone runs the chain already running (`rack_from`) rather than building
   * another. Every edit publishes a graph as it arrives, and a Room rack
   * takes 13 to 43 ms to build (the room's kernels; every other preset 1 to
   * 3 ms): a band dragged on a Room preset was heard only every 100 to
   * 135 ms inside audiodg (engine.log, 2026-09-26). The running chain also
   * needs nothing handed over, where a new one costs the audio thread up to
   * 0.4 ms of `feq_chain_transfer_state`.
   *
   * Sharing is safe for two reasons. Processing: `feq_chain_process` runs on
   * the one audio thread, and the handover (`GraphSlot::adopt`) happens at a
   * block boundary on it, so two graphs are never inside the chain at once.
   * Destruction: graphs are destroyed only by the watcher thread, two blocks
   * past the publish that superseded them, so the last release — the one
   * that calls `feq_chain_destroy` — happens after the audio thread has left
   * both; `shared_ptr`'s count is atomic. Moving the chain out of the graph
   * before would be wrong: that graph may be the one the audio thread is in.
   */
  // Declared before `rack_` so it is destroyed after it: the rack's leveling
  // holds a borrowed pointer into this memory.
  std::shared_ptr<FeqLevelingMemory> leveling_;
  std::shared_ptr<FeqChain> rack_;
  /** Whether `rack_` came from `rack_from` rather than being built here. */
  bool rack_reused_ = false;
  /**
   * What the rack was built from and what its build reported, for a later
   * graph to tell "the same rack" from "a rack" and take this one's whole.
   * The values are compared by value: the file is rewritten on every rack
   * change, so a stamp would say "changed" for a rewrite of the same numbers.
   */
  std::vector<double> dsp_values_;
  std::string source_identity_;
  SourceReport source_report_;
  bool rack_low_latency_asked_ = false;
  unsigned long channel_mask_ = 0;
  // Compared, never followed: the head it points at may be gone.
  const RoomHead* rack_head_ = nullptr;
  uint32_t rack_latency_ = 0;
  uint32_t rack_active_ = 0;
  bool rack_failed_ = false;
  bool rack_without_head_ = false;
  /** The rack from `rack_from`, if it is the same rack; false otherwise. */
  bool reuse_rack(const Graph* rack_from, const Chain& chain,
                  const RoomHead* room_head);
  // How many of `channels_` the rack actually runs on: every channel up to
  // the chain's own eight with the rack set to all channels, the front pair
  // otherwise. A stream with more carries the rest past it, held back by
  // `bypass_align_`.
  uint32_t rack_channels_ = 0;
  // `rack_channels_` pointers, filled in `process`. A member because the
  // audio thread may not allocate one per block.
  std::vector<float*> rack_planes_;
  /**
   * THE CHANNELS THE RACK DOES NOT RUN ON, HELD BACK BY WHAT IT DELAYS THE
   * ONES IT DOES.
   *
   * Untouched means EARLY. The rack's latency applies to the channels it
   * processes — Bass Punch's FIR whenever there are two of them, the
   * restoration's modules, the live leveller, the room, and 8704 frames of a
   * linear-phase EQ, which is 181 ms. Measured at 645 frames, 13 ms at
   * 48 kHz, on a rack with nothing but the exciter switched on
   * (`dsp_chain_test.cpp` prints it). So in front-pair mode a 5.1 stream's
   * centre reached the speakers ahead of the music the rack had just worked
   * on, by 13 ms at the very least and by a fifth of a second under linear
   * phase: dialogue before the scene, and every phantom image between the
   * front pair and anything else torn apart.
   *
   * The chain does exactly this inside itself for the surround channels its
   * stereo-only stages skip (`denoise_align` in `chain_internal.h`); this is
   * the same alignment one level up, for the channels the chain never sees.
   * It adds nothing to what the graph reports: the stream was already this
   * late, on the channels that matter.
   */
  std::vector<FeqDelayLine> bypass_align_;
  std::vector<std::vector<float>> bypass_align_lines_;

  std::vector<std::string> warnings_;
  std::vector<std::string> problems_;
  std::string room_note_;
  std::string room_state_ = "off";
};

}  // namespace fluideq_engine

#endif  // FLUIDEQ_ENGINE_GRAPH_H

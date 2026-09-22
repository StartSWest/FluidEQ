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
#include <vector>

#include "fluideq/biquad.h"
#include "fluideq/chain.h"
#include "fluideq/convolver.h"
#include "fluideq/primitives.h"
#include "fluideq_engine/config.h"

namespace fluideq_engine {
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

class EqPhaseStage;
class IirCascade;

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
   */
  Graph(const Chain& chain, uint32_t sample_rate, uint32_t channels,
        uint32_t max_frames,
        std::shared_ptr<FeqLevelingMemory> leveling = nullptr,
        unsigned long channel_mask = 0, const RoomHead* room_head = nullptr,
        bool follows_processing = false);
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

  // Before publication; the endpoint owns the meters across graph rebuilds.
  void set_meters(FeqMeters* meters, std::atomic<bool>* activity) noexcept {
    if (rack_) feq_chain_set_meters(rack_.get(), meters);
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
   * Audio thread, between blocks, while the previous histories are idle.
   *
   * Every band still here keeps its history and the old bands fade out over
   * `IirCascade::kFadeSeconds`; the preamp ramps over the same time; the FIR
   * stages, the rack and the output guard carry their own state across.
   * When the rack has not changed at all, `inherit_rack` takes the whole
   * handle.
   */
  void adopt_state(Graph* previous) noexcept;

  /**
   * Keep running `previous`'s rack instead of this graph's own.
   *
   * Only when the two racks are the same rack: identical `dsp_values`, the
   * same sample rate, the same channel count, the same `max_frames` and the
   * same rack width. `max_frames` matters because it is what sizes the
   * chain's internal buffers at build time — a chain built for one block
   * size shared into a graph that accepts a larger one would have
   * `feq_chain_process` write past buffers it was never sized for. Under
   * anything else this does nothing and the new graph keeps the chain it
   * built.
   *
   * WHY IT EXISTS. A rack chain is built fresh with every graph, and a fresh
   * chain under linear-phase EQ re-converges over 8192 frames — 171 ms at
   * 48 kHz. But a graph is rebuilt on every configuration change, and an
   * EQ-only edit (a band dragged) changes the configuration without touching
   * the rack at all. So dragging one band muted and re-primed the maximizer,
   * the bass engine and the delay on every frame of the drag, for a rack that
   * had not changed by a single value.
   *
   * WHY SHARING IS SAFE, which is the part that is not obvious. The chain is
   * held in a `shared_ptr` and both graphs hold it at once, so this is two
   * threads' worth of reasoning:
   *
   * - Processing. `feq_chain_process` runs on the audio thread and there is
   *   exactly one — the graph handover (`GraphSlot::adopt`) happens at a
   *   block boundary on that same thread, so two graphs can never be inside
   *   `process` at the same instant. A shared chain is therefore touched by
   *   one caller at a time even though two objects point at it.
   * - Destruction. Graphs are destroyed only by the watcher thread, through
   *   `Watcher::owned_`/`reclaim`, and only once the audio thread has
   *   completed two blocks past the publish that superseded them. So the last
   *   `shared_ptr` release — the one that calls `feq_chain_destroy` — happens
   *   on the watcher thread, after the audio thread has provably left both
   *   graphs. `shared_ptr`'s own count is atomic, which covers the copy made
   *   here against a release happening on the same thread later.
   *
   * MOVING the chain out of the previous graph would be wrong for the first
   * of those reasons in reverse: the previous graph is still the active one
   * at the moment this is called, and the audio thread can be inside its
   * `process`.
   */
  void inherit_rack(const Graph& previous) noexcept;

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
    /** The EQ's bands under linear phase. */
    uint32_t eq_phase = 0;
    /** The curve layer's bands under linear phase. */
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

 private:
  std::atomic<bool>* meter_activity_ = nullptr;
  std::atomic<uint32_t> silenced_blocks_{0};
  bool transfer_state_ = false;
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

  // Bands no layer claims — a hand-written config's plain `Filter:` lines.
  // Always built, even empty, like the two phase stages: an empty stage is a
  // straight copy, and it is what lets bands that appear or disappear in an
  // edit fade in or out.
  std::unique_ptr<IirCascade> plain_;
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
  std::unique_ptr<FeqConvolverKernel, detail::ConvolverKernelDeleter>
      graphic_kernel_;
  std::shared_ptr<const std::vector<float>> impulse_identity_;
  std::shared_ptr<const std::vector<float>> graphic_identity_;
  std::vector<std::unique_ptr<FeqConvolver, detail::ConvolverDeleter>>
      impulse_;
  std::vector<std::unique_ptr<FeqConvolver, detail::ConvolverDeleter>>
      graphic_;

  /**
   * The DSP rack, when `Chain::dsp_values` decoded into one.
   *
   * The same `fluideq-dsp-core` chain the Library player runs, with the
   * stages that cannot live inside audiodg.exe taken out by
   * `decode_dsp_chain`. Null whenever the app has not written a rack file,
   * the file was unreadable, or the array was not a snapshot this build's
   * decoder recognises — all of which leave the EQ below running.
   *
   * `shared_ptr` rather than `unique_ptr` so consecutive graphs with an
   * identical rack can go on running the same chain rather than re-priming a
   * new one — see `inherit_rack` for why that is safe, and for the 171 ms it
   * saves on every band drag.
   */
  // Declared before `rack_` so it is destroyed after it: the rack's leveling
  // holds a borrowed pointer into this memory.
  std::shared_ptr<FeqLevelingMemory> leveling_;
  std::shared_ptr<FeqChain> rack_;
  /**
   * The array the rack was built from, kept so `inherit_rack` can tell "the
   * same rack" from "a rack". Compared by value: the file is rewritten on
   * every rack change, so a stamp or a pointer would say "changed" for a
   * rewrite of identical numbers, which is exactly the case that matters.
   */
  std::vector<double> dsp_values_;
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

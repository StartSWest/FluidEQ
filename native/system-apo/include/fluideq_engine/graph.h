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
 * second `Graph` off the audio thread and handing it over; `inherit_state`
 * carries the filter histories across so a gain nudge does not restart every
 * biquad from silence, which is heard as a click.
 */
#ifndef FLUIDEQ_ENGINE_GRAPH_H
#define FLUIDEQ_ENGINE_GRAPH_H

#include <cstdint>
#include <memory>
#include <string>
#include <vector>

#include "fluideq/biquad.h"
#include "fluideq/chain.h"
#include "fluideq/convolver.h"
#include "fluideq_engine/config.h"

namespace fluideq_engine {

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

class Graph {
 public:
  /**
   * Builds the whole graph. Never on the audio thread: this opens a file,
   * allocates, and can take milliseconds designing a FIR.
   *
   * `max_frames` is the largest block `process` will accept. A larger one is
   * refused rather than handled, because handling it would mean either
   * allocating or writing past something the caller owns.
   */
  Graph(const Chain& chain, uint32_t sample_rate, uint32_t channels,
        uint32_t max_frames);
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

  /**
   * Copy `previous`'s biquad histories into this graph.
   *
   * Only when the two agree on band layout and channel count; anything else
   * would feed a filter the tail of a differently shaped one, which rings.
   * The convolvers are deliberately NOT carried: their history is a spectrum
   * partitioned against one specific kernel and means nothing to another.
   *
   * Neither is the DSP rack, and for a harder reason: its state lives behind
   * an opaque handle with no way to copy it, and the handle itself belongs to
   * a graph the audio thread may still be inside. So a rack edit restarts the
   * rack's delay lines — inaudible at the default minimum phase, and the
   * length of the kernel under linear phase.
   */
  void inherit_state(const Graph& previous) noexcept;

  /** Same band count and the same types in the same order. */
  bool has_same_band_layout(const Graph& other) const noexcept;

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
   * FIR's own group delay — it is designed linear-phase, so its energy sits
   * at the centre tap and an n-tap kernel puts the signal out n/2 frames
   * later. A `Convolution:` impulse response contributes no such term: it is
   * causal, and its delay is part of the sound it reproduces.
   *
   * So this is 0, one convolver's latency, one plus the FIR's half-length,
   * or both stages together — never a fixed constant.
   *
   * Plus the rack's own (`feq_chain_latency_frames`), which linear-phase EQ
   * dominates at 8192 frames — 171 ms at 48 kHz. That is why the constructor
   * primes the rack rather than leaving its kernel to be adopted by the first
   * audio block: this number is read once, at publish time, and cached for
   * `GetLatency`.
   */
  uint32_t latency_frames() const noexcept;

  /**
   * What went wrong that was survivable, in English, for the log.
   *
   * A missing impulse response, one at the wrong sample rate, or a kernel
   * longer than this engine will run are all handled rather than refused: a
   * config with one bad line still has to produce audio. The log line is the
   * only place that difference is visible, so it has to say which.
   */
  const std::vector<std::string>& warnings() const noexcept;

 private:
  uint32_t sample_rate_;
  uint32_t channels_;
  uint32_t max_frames_;
  bool passthrough_;
  double preamp_linear_;
  uint32_t latency_frames_;

  // Band types in file order, kept apart from the coefficients so a layout
  // comparison does not have to compare floating-point coefficients that two
  // equivalent layouts can differ in.
  std::vector<FilterType> layout_;
  // One entry per band, shared by every channel: the coefficients depend on
  // the band and the sample rate, never on which channel is being filtered.
  std::vector<FeqBiquadCoefficients> coefficients_;
  // `channels_ * coefficients_.size()`, channel-major.
  std::vector<FeqBiquadState> states_;

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
   */
  std::unique_ptr<FeqChain, detail::ChainDeleter> rack_;
  // How many of `channels_` the rack actually runs on: 1 or 2, never more.
  // A stream with more carries the rest past it untouched, because the rack
  // is a stereo processor (`FEQ_CHAIN_CHANNELS`) and there is no sensible
  // answer for a centre channel or an LFE.
  uint32_t rack_channels_ = 0;
  // `rack_channels_` pointers, filled in `process`. A member because the
  // audio thread may not allocate one per block.
  std::vector<float*> rack_planes_;

  std::vector<std::string> warnings_;
};

}  // namespace fluideq_engine

#endif  // FLUIDEQ_ENGINE_GRAPH_H

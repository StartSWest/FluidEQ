/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The chain's own state, shared between its three translation units.
 *
 * Private to `chain*.cpp`: nothing outside dsp-core sees a `FeqChain`'s
 * insides, which is what lets the layout change without an ABI bump.
 *
 * Every buffer here is allocated once by `feq_chain_create` and every stage is
 * handed a pointer into it. That is not tidiness — the block loop may not
 * allocate, and a stage that grew its own scratch on first use would allocate
 * inside the first callback that used it, which is the one callback that must
 * not be late.
 */
#ifndef FLUIDEQ_CHAIN_INTERNAL_H
#define FLUIDEQ_CHAIN_INTERNAL_H

#include "fluideq/chain.h"

#include "fluideq/compressor.h"
#include "fluideq/convolver.h"
#include "fluideq/dynamics.h"
#include "fluideq/exciter.h"
#include "fluideq/limiter.h"
#include "fluideq/linear_phase.h"
#include "fluideq/organic_stage.h"
#include "fluideq/output_safety.h"
#include "fluideq/oversample.h"
#include "fluideq/phase_align.h"
#include "fluideq/post_filter_normalizer.h"
#include "fluideq/primitives.h"
#include "fluideq/saturate.h"

#include <atomic>
#include <vector>

/** L, R, Mid and Side each need their own histories. */
constexpr uint32_t kExciterPaths = 4;
constexpr double kExciterSmoothingMs = 18.0;
constexpr double kEqIsolateSmoothingMs = 18.0;
/** Background analysis settles Normalizer and Master LUFS together over 2 s. */
constexpr double kTrackLevelTransitionMs = 2000.0;
constexpr double kMaximizerReleaseHoldMs = 10.0;
constexpr double kMaximizerSoftKneeDb = 1.5;
/** Completes even the slowest 1 s release inside four seconds. */
constexpr double kMaximizerReleaseSnapRatio = 0.02;
constexpr double kOutputSafetyCeilingDb = -0.1;
constexpr double kOutputSafetyExtremeDbtp = 10.0;

/** Per-domain buffers and single-channel filter state. */
struct ChainEqSlot {
  FeqBiquadState subsonic{};
  FeqOversampler eq_oversampler{};
  FeqOversampler isolate_oversampler{};
  FeqOversampler isolate_colour_oversampler{};
  FeqSaturator fuzz{};
  FeqDelayLine bypass_delay{};
  FeqDelayLine isolate_delay{};
  std::vector<float> bypass_line;
  std::vector<float> isolate_line;
  std::vector<float> input;
  std::vector<float> delayed_input;
  std::vector<float> isolate_oversampled;
  double dry_mix = 1.0;
};

struct ChainExciterPath {
  FeqExciterChannel exciter{};
  FeqPhaseAlign aligner{};
  FeqOrganicPath organic{};
  double organic_mix = 0.0;
  /** Every buffer the three stages above were handed. */
  std::vector<float> bands[FEQ_CHAIN_EXCITER_BANDS];
  std::vector<float> wet_return;
  std::vector<float> wide;
  std::vector<float> wide_dry;
  std::vector<float> middle;
  std::vector<float> dry;
  std::vector<float> guard_scratch;
  std::vector<float> align_low;
  std::vector<float> align_mid;
  std::vector<float> align_high;
  std::vector<float> align_low_line;
  std::vector<float> align_mid_line;
  std::vector<float> organic_band;
  std::vector<float> organic_foundation;
  std::vector<float> organic_wide;
  std::vector<float> organic_wide_dry;
  std::vector<float> organic_guard;
};

struct FeqChain {
  double sample_rate = 48000.0;
  uint32_t channels = 2;
  uint32_t max_frames = 0;
  FeqChainSettings settings{};

  /**
   * Where the panel's displays are read from, or null when nobody is looking.
   *
   * Borrowed. The host owns it and keeps it across a chain rebuild, so adding a
   * band does not blank every graph for a frame. Null is the ordinary state and
   * costs one predictable branch per tap.
   */
  FeqMeters* meters = nullptr;

  ChainEqSlot slots[FEQ_CHAIN_CHANNELS];
  ChainExciterPath paths[kExciterPaths];

  /* -------------------------------------------------------------- EQ -- */
  /**
   * One built rack, and there are two of them for a reason.
   *
   * `chain_refresh_eq` runs on the CONTROL thread and the callback reads these
   * on the audio thread. Building in place meant `clear()` and `push_back()`
   * on a vector another thread was reading — garbage coefficients for a block
   * on a good day, a read of freed memory when the band count grew past the
   * capacity. That is a click on every knob turn, and it was audible.
   *
   * So the control thread fills whichever set is NOT published and then
   * publishes it with one atomic store. The audio thread reads the index once
   * per block. Nothing is ever written to the set the callback is using.
   */
  struct ChainCoefficients {
    std::vector<FeqBiquadCoefficients> bands;
    std::vector<FeqBiquadCoefficients> dynamic;
    /** Positions within the live-band arrays of the bands marked dynamic. */
    std::vector<uint32_t> dynamic_slots;
    FeqBiquadCoefficients subsonic{};
    int has_subsonic = 0;
    FeqBiquadCoefficients mono_below{};
    int has_mono_below = 0;
  };
  ChainCoefficients coefficient_sets[2];
  std::atomic<uint32_t> published_coefficients{0};
  /**
   * Read once at the top of a block and used for the whole of it.
   *
   * A set published mid-block would otherwise be adopted by the EQ and not by
   * the isolate subtraction below it, which is two different racks inside one
   * buffer.
   */
  const ChainCoefficients* active = nullptr;
  /**
   * Flat, `[channel * band_count + band]`, and deliberately one array.
   *
   * The per-channel and the stereo-linked paths are the same filters — the
   * reference indexes one `eqStates[channel][band]` for both — so separate
   * storage would mean a history per topology and a click every time the
   * stereo selector moved.
   */
  std::vector<FeqBiquadState> band_states;
  std::vector<FeqBandDynamics> band_dynamics;
  /**
   * Where band activity is gathered before publishing. Allocated with the rack.
   *
   * Scratch rather than a local, because this is filled on the audio thread
   * once a block and a local would be a stack array sized by a runtime band
   * count — which is either a variable-length array or an allocation, and the
   * callback may have neither.
   */
  std::vector<double> band_amount_scratch;
  std::vector<double> band_level_scratch;

  /**
   * What the exciter's three bands and its organic stage actually contributed.
   *
   * Written by path zero on the audio thread and read by the control thread
   * alongside the band activity. Measured rather than derived because the
   * nonlinear stage has no fixed transfer curve — the settings cannot say what
   * it did to this particular material, which is exactly why the display exists.
   */
  double exciter_band_report[FEQ_CHAIN_EXCITER_BANDS] = {0.0, 0.0, 0.0};
  double exciter_organic_report = 0.0;
  /**
   * Fixed, so the state arrays are allocated once and never resized.
   *
   * Striding by the LIVE count meant enabling a band moved every other band's
   * filter history to a different slot — and, worse, resized a vector the
   * audio thread was reading. A fixed stride costs four kilobytes and removes
   * both: a band's history stays with that band whatever its neighbours do.
   */
  static constexpr uint32_t kBandStride = FEQ_CHAIN_MAX_EQ_BANDS;
  /**
   * The dynamic bands gathered contiguously, for the path after a convolution.
   *
   * The reference builds this as an array of references into the arrays above,
   * so the state is genuinely shared; C++ has no such thing across a scattered
   * subset, hence a gather before the call and a scatter after. It is a few
   * doubles per dynamic band per block, and the alternative is two envelopes
   * for one band that diverge the moment the phase mode changes.
   */
  std::vector<FeqBiquadState> dynamic_states;
  std::vector<FeqBandDynamics> dynamic_dynamics;

  FeqBiquadState side_highpass{};

  std::vector<float> eq_dry;
  std::vector<float> eq_wet;
  std::vector<float> eq_doubled;
  std::vector<float> eq_dry_doubled;
  std::vector<float> eq_wet_doubled;
  std::vector<float> eq_middle;
  std::vector<float> linked_dry[FEQ_CHAIN_CHANNELS];
  std::vector<float> linked_wet[FEQ_CHAIN_CHANNELS];
  std::vector<float> linked_doubled[FEQ_CHAIN_CHANNELS];
  std::vector<float> linked_dry_doubled[FEQ_CHAIN_CHANNELS];
  std::vector<float> linked_wet_doubled[FEQ_CHAIN_CHANNELS];
  std::vector<float> linked_middle[FEQ_CHAIN_CHANNELS];
  std::vector<float> fuzz_oversampled;
  std::vector<float> fuzz_middle;

  /* ------------------------------------------------------ linear phase -- */
  FeqConvolverKernel* kernel = nullptr;
  FeqConvolverKernel* kernel_next = nullptr;
  FeqConvolver* convolvers[FEQ_CHAIN_CHANNELS] = {nullptr, nullptr};
  FeqConvolver* convolvers_next[FEQ_CHAIN_CHANNELS] = {nullptr, nullptr};
  std::vector<float> convolver_scratch;
  double convolver_blend[FEQ_CHAIN_CHANNELS] = {0.0, 0.0};
  int64_t convolver_warmup = 0;
  int64_t convolver_priming = 0;

  /**
   * A prepared kernel and its convolvers, in transit from control to audio.
   *
   * Everything above is owned by the AUDIO thread once published, and this slot
   * is the only way anything reaches it. The control thread builds a complete
   * replacement, hands it over with a single atomic exchange, and never touches
   * the fields above — which is the same discipline the coefficients got, and
   * for the same reason: `feq_chain_configure` runs on the command thread with
   * no lock, so a control thread that freed `convolvers_next` would be freeing
   * a pointer `chain_process_eq_convolver_channel` is dereferencing.
   *
   * The exchange is what makes the ownership unambiguous. Whoever the exchange
   * hands the pointer to owns it: if the control thread gets a stale one back
   * it frees it, knowing the audio thread never saw it; if the audio thread
   * takes one, the control thread can no longer reach it.
   *
   * A null `kernel` inside a published handoff means tear the convolvers down —
   * the request still travels this way rather than being acted on directly,
   * because "stop convolving" frees exactly the same pointers that starting
   * does.
   */
  struct KernelHandoff {
    FeqConvolverKernel* kernel = nullptr;
    FeqConvolver* convolvers[FEQ_CHAIN_CHANNELS] = {nullptr, nullptr};
  };
  std::atomic<KernelHandoff*> kernel_handoff{nullptr};

  /**
   * What the last published handoff was built from. Control thread only.
   *
   * Without it every settings message rebuilds a 16k kernel: two transforms and
   * half a megabyte of partitions for a curve that did not move. The renderer's
   * `kernelKeyOf` in `graph.ts` is the same guard against the same waste, and
   * carries the same fields — which is not a coincidence to be tidied away, the
   * two have to agree about what a kernel depends on.
   */
  int kernel_wanted = 0;
  uint32_t kernel_band_count = 0;
  FeqEqEngine kernel_engine = FEQ_EQ_SERIAL;
  FeqEqModel kernel_model = FEQ_EQ_MODEL_CLEAN;
  double kernel_model_amount = 0.0;
  double kernel_subsonic_hz = 0.0;
  FeqLinearPhaseBand kernel_bands[FEQ_CHAIN_MAX_EQ_BANDS] = {};

  /* -------------------------------------------------------- compressor -- */
  FeqCrossover crossovers[FEQ_CHAIN_CHANNELS];
  FeqCompressor compressors[FEQ_CHAIN_COMPRESSOR_BANDS];
  std::vector<float> compressor_bands[FEQ_CHAIN_CHANNELS]
                                     [FEQ_CHAIN_COMPRESSOR_BANDS];

  /* --------------------------------------------------------- maximizer -- */
  FeqLinkedLimiter maximizer{};
  std::vector<FeqTruePeak> maximizer_detectors;
  std::vector<float> maximizer_delay[FEQ_CHAIN_CHANNELS];
  std::vector<float*> maximizer_delay_pointers;
  std::vector<float> maximizer_reduction;
  uint32_t maximizer_look_ahead = 0;
  /**
   * The deepest reduction over the last block, in dB, for the meter.
   *
   * A maximizer cannot be set without seeing this. Drive, ceiling and release
   * only make sense against how hard the limiter is actually working, and this
   * stage has been shipping all three with no way to see any of it.
   */
  double maximizer_reduction_db = 0.0;

  /* ------------------------------------------------------ auto headroom -- */
  FeqPostFilterNormalizer post_normalizer{};
  std::vector<FeqTruePeak> post_detectors;
  std::vector<float> post_delay[FEQ_CHAIN_CHANNELS];
  std::vector<float*> post_delay_pointers;
  std::vector<float> post_reduction;

  /* ------------------------------------------------------------ safety -- */
  FeqOutputSafety safety{};
  std::vector<FeqDcBlock> safety_dc;
  std::vector<FeqTruePeak> safety_detectors;
  std::vector<float> safety_delay[FEQ_CHAIN_CHANNELS];
  std::vector<float*> safety_delay_pointers;
  std::vector<float> safety_reduction;

  /* ------------------------------------------------------- track level -- */
  double input_gain_now = 1.0;
  double input_gain_target_db = 0.0;
  double input_gain_start_db = 0.0;
  double master_loudness_now_db = 0.0;
  double master_loudness_target_db = 0.0;
  double master_loudness_start_db = 0.0;
  int64_t transition_frames = 0;
  int64_t transition_elapsed = 0;
  double master_gain_now = 1.0;

  /** Scratch for the block's pointer arrays, so the loop allocates none. */
  float* pointers_a[FEQ_CHAIN_CHANNELS] = {nullptr, nullptr};
  float* pointers_b[FEQ_CHAIN_CHANNELS] = {nullptr, nullptr};
  float* pointers_c[FEQ_CHAIN_CHANNELS] = {nullptr, nullptr};
  float* pointers_d[FEQ_CHAIN_CHANNELS] = {nullptr, nullptr};
};

/** The four stages that are one loop each, from `chain_stages.cpp`. */
void chain_process_input_gain(FeqChain* chain, float* const* channels,
                              uint32_t frames);
void chain_process_compressor(FeqChain* chain, float* const* channels,
                              uint32_t frames);
void chain_process_maximizer(FeqChain* chain, float* const* channels,
                             uint32_t frames);
void chain_process_master_output(FeqChain* chain, float* const* channels,
                                 uint32_t frames);

void chain_encode_mid_side(float* const* channels, uint32_t frames);

void chain_decode_mid_side(float* const* channels, uint32_t frames);

/* --- chain_linear.cpp: the convolver, its handover and its kernel --------- */

/** One already-prepared channel through the convolver that is running now. */
void chain_process_eq_convolver_channel(FeqChain* chain, float* target,
                                        uint32_t frames, uint32_t slot_index);

/** Advance the replacement's warm-up and retire the old one, as a pair. */
void chain_settle_convolvers(FeqChain* chain, uint32_t frames);

/**
 * Take delivery of a handed-over kernel, if one is waiting. AUDIO thread.
 *
 * Called at the top of a block rather than anywhere inside it: adopting a new
 * convolver halfway down would put the first half of the buffer through one
 * filter and the second half through another, which is two filters inside one
 * block rather than a settings change.
 */
void chain_adopt_kernel_handoff(FeqChain* chain);

/**
 * Build the linear-phase kernel the settings ask for and hand it over.
 *
 * CONTROL thread, and not real-time safe on purpose: it runs two 16k
 * transforms and allocates the partitions. Guarded, so it does that only when
 * something the kernel is actually made of has moved.
 */
void chain_refresh_eq_kernel(FeqChain* chain);

/** Free anything still in transit, once no thread can be looking. */
void chain_release_kernel_handoff(FeqChain* chain);

/** Whether a convolver is actually in the path, which is what needs matching. */

int chain_linear_running(const FeqChain* chain);

/** Rebuild the EQ's coefficients and dynamics from the current settings. */
void chain_refresh_eq(FeqChain* chain);

/** The EQ stage, mid/side wrapping included. */
void chain_process_eq(FeqChain* chain, float* const* channels,
                      uint32_t frames);

/** The exciter stage, mid/side wrapping included. */
void chain_process_exciter(FeqChain* chain, float* const* channels,
                           uint32_t frames);

/** Allocate one path's buffers and point its stages at them. */
void chain_prepare_exciter_path(FeqChain* chain, uint32_t path);

#endif /* FLUIDEQ_CHAIN_INTERNAL_H */

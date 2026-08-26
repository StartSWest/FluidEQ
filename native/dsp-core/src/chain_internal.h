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

  ChainEqSlot slots[FEQ_CHAIN_CHANNELS];
  ChainExciterPath paths[kExciterPaths];

  /* -------------------------------------------------------------- EQ -- */
  std::vector<FeqBiquadCoefficients> coefficients;
  std::vector<FeqBiquadCoefficients> dynamic_coefficients;
  /** Positions within the live-band arrays of the bands marked dynamic. */
  std::vector<uint32_t> dynamic_slots;
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

  FeqBiquadCoefficients subsonic_coefficients{};
  int has_subsonic = 0;
  FeqBiquadCoefficients mono_below_coefficients{};
  int has_mono_below = 0;
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

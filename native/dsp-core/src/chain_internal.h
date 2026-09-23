/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The chain's own state, shared between its translation units and private to
 * `chain*.cpp`: nothing outside dsp-core sees a `FeqChain`'s insides, which
 * is what lets the layout change without an ABI bump.
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

#include "fluideq/bass_forge.h"
#include "fluideq/bass_punch.h"
#include "fluideq/convolver.h"
#include "fluideq/dimension.h"
#include "fluideq/dynamics.h"
#include "fluideq/exciter.h"
#include "fluideq/leveling_memory.h"
#include "fluideq/limiter.h"
#include "fluideq/linear_phase.h"
#include "fluideq/loudness_meter.h"
#include "fluideq/organic_stage.h"
#include "fluideq/oversample.h"
#include "fluideq/phase_align.h"
#include "fluideq/post_filter_normalizer.h"
#include "fluideq/primitives.h"
#include "fluideq/saturate.h"

#include <algorithm>
#include <atomic>
#include <iterator>
#include <vector>

/** One exciter path per channel (own histories each), plus Mid and Side. */
constexpr uint32_t kExciterPaths = FEQ_CHAIN_MAX_CHANNELS + 2;
/** Where the front pair's Mid and Side paths live, after the channels'. */
constexpr uint32_t kExciterMidPath = FEQ_CHAIN_MAX_CHANNELS;
constexpr double kExciterSmoothingMs = 18.0;
constexpr double kEqIsolateSmoothingMs = 18.0;
/**
 * How far a linear-phase handover moves towards the new kernel per sample.
 *
 * One constant because two things walk it: the kernel's own output, and each
 * dynamic band's change riding on it. Walked at different rates, the two
 * would disagree mid-handover about which kernel is playing.
 */
constexpr double kConvolverBlendStep = 1.0 / 1024.0;
/** Background analysis settles Normalizer and Master LUFS together over 2 s. */
constexpr double kTrackLevelTransitionMs = 2000.0;
constexpr double kMaximizerReleaseHoldMs = 10.0;
constexpr double kMaximizerSoftKneeDb = 1.5;
/**
 * The delay line is built for this much look-ahead whatever the dial says.
 *
 * It matches the dial's own maximum in `chain.ts`, and the ring being sized
 * from the maximum rather than from the current setting is what allows the
 * look-ahead to move while audio runs. `feq_chain_configure` is on the command
 * thread with no lock, so a resize there frees the ring the audio thread is
 * reading — heard as a click on every step of the dial and as silence while it
 * is dragged, because each new ring arrives full of zeros.
 */
constexpr double kMaximizerMaxLookAheadMs = 20.0;
/** Completes even the slowest 1 s release inside four seconds. */
constexpr double kMaximizerReleaseSnapRatio = 0.02;
/**
 * How fast the Maximizer's platform deepens and rises (`limiter.h`).
 *
 * Ivan, 2026-09-22: "the rack maximiser sucks, too much pumping". Its gain
 * released towards unity between every two beats and was pulled down again
 * by the next, so on a dense record the level swung at the tempo. Measured
 * on a dance record, 60 s from its densest part, as the RMS of the applied
 * gain between 0.5 and 10 Hz: Default 0.83 dB, Streaming 1.08, Loud 1.23,
 * Club 1.56. The platform takes those to 0.55, 0.66, 0.77 and 0.90, and at
 * the same loudness it pumps a fifth to two fifths less than simply less
 * drive would. Why these two: a platform that rises nearly as fast as it
 * deepens sits too shallow to hold anything (500/800 and 1200/3000 pumped
 * more), and one that rises slower still keeps the level down for seconds
 * after a dense passage, which is breathing of its own.
 */
constexpr double kMaximizerPlatformAttackMs = 500.0;
constexpr double kMaximizerPlatformReleaseMs = 1500.0;

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

/** One band that was dynamic when a linear-phase kernel was built. */
struct ChainKernelBand {
  /** Its place in the settings, which is how the rack finds it again. */
  uint32_t band = 0;
  /** Its filter at the base rate and its detector's settings, as they were. */
  FeqBiquadCoefficients filter{};
  FeqBandDynamics detector{};
  /** Its change on the convolution, or -1: a kernel for listening has none. */
  int change = -1;
};

/**
 * A linear-phase kernel, and the dynamic bands it was built around.
 *
 * A kernel bakes in every static band and leaves the dynamic ones to run
 * after it, so which bands are dynamic is part of what the kernel IS. It was
 * kept only in the coefficient set, which switches at once, while the kernel
 * behind it hands over only after a warm-up of its own: toggling a band's
 * Dynamic doubled it for a third of a second (baked into the old kernel and
 * running after it) or dropped it (in neither). Carried here, each kernel's
 * share of the output runs the dynamic bands that kernel was made for.
 */
struct ChainEqKernel {
  FeqConvolverKernel* convolution = nullptr;
  uint32_t dynamic_count = 0;
  ChainKernelBand dynamic[FEQ_CHAIN_MAX_EQ_BANDS];
  /** Per band of the settings, its place in `dynamic`, or -1. */
  int32_t dynamic_of[FEQ_CHAIN_MAX_EQ_BANDS];

  ChainEqKernel() {
    std::fill(std::begin(dynamic_of), std::end(dynamic_of), -1);
  }
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

  /**
   * Restoration, owned rather than borrowed because its state is per-chain.
   *
   * Created with the chain and destroyed with it. Null only if allocation
   * failed, in which case the stage is skipped and everything downstream still
   * runs — a rack that refuses to make any sound because one processor could
   * not allocate is worse than a rack missing one processor.
   */
  FeqDenoise* denoise = nullptr;

  ChainEqSlot slots[FEQ_CHAIN_MAX_CHANNELS];
  ChainExciterPath paths[kExciterPaths];

  /* ------------------------------------------------- surround alignment -- */
  /**
   * The channels beyond the front pair, held back by what the pair's own
   * stages delay it — the restoration's modules and Bass Punch's FIR — or a
   * centre would run ahead of the front. One line at each of the two points,
   * so every level stage between them sees channels in step. Empty on a
   * mono or stereo chain.
   */
  FeqDelayLine denoise_align[FEQ_CHAIN_MAX_CHANNELS];
  std::vector<float> denoise_align_line[FEQ_CHAIN_MAX_CHANNELS];
  FeqDelayLine punch_align[FEQ_CHAIN_MAX_CHANNELS];
  std::vector<float> punch_align_line[FEQ_CHAIN_MAX_CHANNELS];
  /**
   * Bass Punch was skipped outright on the last block — game mode, Punch
   * off — so its histories are from before the skip. Read when it runs
   * again, to start it from silence rather than from a moment long gone.
   */
  bool bass_punch_skipped = false;
  /** Which channel feeds the subwoofer, or -1: `feq_chain_set_lfe_channel`. */
  int lfe_channel = -1;
  /* ------------------------------------------------------------- room -- */
  /** Owned; created with the chain. Its head and layout come from the host. */
  FeqRoom* room = nullptr;
  int room_speakers[FEQ_CHAIN_MAX_CHANNELS] = {-1, -1, -1, -1, -1, -1, -1, -1};

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
    /** The dynamic bands' filters at the base rate, in settings order. */
    std::vector<FeqBiquadCoefficients> dynamic;
    /**
     * Per band of the settings: its place among the live bands, and its place
     * in `dynamic`, or -1. A linear-phase kernel names its bands by their
     * place in the settings, because it may still be the previous rack's
     * while this one's warms.
     */
    int32_t live_of[FEQ_CHAIN_MAX_EQ_BANDS];
    int32_t dynamic_of[FEQ_CHAIN_MAX_EQ_BANDS];
    FeqBiquadCoefficients subsonic{};
    int has_subsonic = 0;
    FeqBiquadCoefficients mono_below{};
    int has_mono_below = 0;

    /** No band live and none dynamic, until `chain_refresh_eq` says so. */
    ChainCoefficients() {
      std::fill(std::begin(live_of), std::end(live_of), -1);
      std::fill(std::begin(dynamic_of), std::end(dynamic_of), -1);
    }
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
   * One dynamic band's linear-phase change, per channel, from the kernel
   * playing now and from the one fading in, while the EQ runs through its
   * kernel under Isolate. A partition long, because the convolver hands back
   * no more than that of a change at a time.
   */
  std::vector<float> change_active[FEQ_CHAIN_MAX_CHANNELS];
  std::vector<float> change_next[FEQ_CHAIN_MAX_CHANNELS];
  /**
   * While one kernel fades into another: the incoming kernel's output less
   * the outgoing one's, per slot, and what a band that only one of the two
   * leaves out is given to filter — that kernel's own output, with the
   * earlier bands' steps on it, rather than the blend of both, which carries
   * the band baked in by the other. A partition long, like the pieces.
   */
  std::vector<float> kernel_difference[FEQ_CHAIN_MAX_CHANNELS];
  std::vector<float> share_input[FEQ_CHAIN_MAX_CHANNELS];

  FeqBiquadState side_highpass{};

  std::vector<float> eq_dry;
  std::vector<float> eq_wet;
  std::vector<float> eq_doubled;
  std::vector<float> eq_dry_doubled;
  std::vector<float> eq_wet_doubled;
  std::vector<float> eq_middle;
  std::vector<float> linked_dry[FEQ_CHAIN_MAX_CHANNELS];
  std::vector<float> linked_wet[FEQ_CHAIN_MAX_CHANNELS];
  std::vector<float> linked_doubled[FEQ_CHAIN_MAX_CHANNELS];
  std::vector<float> linked_dry_doubled[FEQ_CHAIN_MAX_CHANNELS];
  std::vector<float> linked_wet_doubled[FEQ_CHAIN_MAX_CHANNELS];
  std::vector<float> linked_middle[FEQ_CHAIN_MAX_CHANNELS];
  std::vector<float> fuzz_oversampled;
  std::vector<float> fuzz_middle;

  /* ------------------------------------------------------ linear phase -- */
  ChainEqKernel* kernel = nullptr;
  ChainEqKernel* kernel_next = nullptr;
  FeqConvolver* convolvers[FEQ_CHAIN_MAX_CHANNELS] = {};
  FeqConvolver* convolvers_next[FEQ_CHAIN_MAX_CHANNELS] = {};
  std::vector<float> convolver_scratch;
  double convolver_blend[FEQ_CHAIN_MAX_CHANNELS] = {};
  int64_t convolver_warmup = 0;
  int64_t convolver_priming = 0;
  bool defer_convolver_retirement = false;
  ChainEqKernel* queued_kernel = nullptr;
  FeqConvolver* queued_convolvers[FEQ_CHAIN_MAX_CHANNELS] = {};
  ChainEqKernel* retired_kernels[2] = {nullptr, nullptr};
  FeqConvolver* retired_convolvers[2][FEQ_CHAIN_MAX_CHANNELS] = {};
  uint32_t retired_count = 0;

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
    ChainEqKernel* kernel = nullptr;
    FeqConvolver* convolvers[FEQ_CHAIN_MAX_CHANNELS] = {};
  };
  std::atomic<KernelHandoff*> kernel_handoff{nullptr};

  /**
   * What the last published handoff was built from. Control thread only.
   *
   * Without it every settings message rebuilds a 16k kernel: two transforms and
   * half a megabyte of partitions for a curve that did not move. A threshold
   * is not among them: it moves no filter, and a kernel's own record of its
   * dynamic bands' detectors is read only for a band the current rack no
   * longer runs as dynamic, on its way out.
   */
  int kernel_wanted = 0;
  /** Whether it carries its dynamic bands' changes: `kernel_changes_wanted_by`. */
  int kernel_changes = 0;
  uint32_t kernel_band_count = 0;
  FeqEqEngine kernel_engine = FEQ_EQ_SERIAL;
  FeqEqModel kernel_model = FEQ_EQ_MODEL_CLEAN;
  double kernel_model_amount = 0.0;
  double kernel_subsonic_hz = 0.0;
  FeqLinearPhaseBand kernel_bands[FEQ_CHAIN_MAX_EQ_BANDS] = {};

  /* --------------------------------------------------------- maximizer -- */
  FeqLinkedLimiter maximizer{};
  std::vector<FeqTruePeak> maximizer_detectors;
  std::vector<float> maximizer_delay[FEQ_CHAIN_MAX_CHANNELS];
  std::vector<float*> maximizer_delay_pointers;
  /* --------------------------------------------------------- bass forge -- */
  FeqBassForge bass_forge{};
  /** Both at two channels of the largest block: the stage never allocates. */
  std::vector<float> bass_forge_low;
  std::vector<float> bass_forge_scratch;

  /* --------------------------------------------------------- bass punch -- */
  FeqBassPunch bass_punch{};
  std::vector<float> bass_punch_low;
  /**
   * Four lines, not three: `FEQ_BASS_PUNCH_BLOOM_LINES` is the three combs
   * plus the all-pass behind them, and `feq_bass_punch_init` reads
   * `bloom_buffers[FEQ_BASS_PUNCH_COMBS]` for that last one.
   *
   * Every line is sized at the LONGEST delay any rate needs, once, and never
   * resized — `feq_chain_configure` runs on the command thread with no lock,
   * so a line replaced while the decay dial is dragged is freed under the
   * audio thread and comes back full of zeros. That is the lesson the
   * Maximizer's look-ahead ring paid for.
   */
  std::vector<float> bass_punch_bloom[FEQ_BASS_PUNCH_BLOOM_LINES];
  std::vector<float*> bass_punch_bloom_pointers;

  /* ---------------------------------------------------------- dimension -- */
  FeqDimension dimension{};
  std::vector<float> dimension_side;
  /** The mid, which the split’s own phase is run over. */
  std::vector<float> dimension_centre;
  std::vector<float> dimension_low;
  std::vector<float> dimension_mid;
  std::vector<float> dimension_high;
  std::vector<float> dimension_allpass[FEQ_DIMENSION_ALLPASSES];
  std::vector<float*> dimension_allpass_pointers;

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
  std::vector<float> post_delay[FEQ_CHAIN_MAX_CHANNELS];
  std::vector<float*> post_delay_pointers;
  std::vector<float> post_reduction;

  /* ---------------------------------------------------------- loudness -- */
  /**
   * How loud what leaves is, which nothing in this engine could say.
   *
   * Owned here rather than by `FeqMeters` because it has to run whether or not
   * the panel is open: integrated loudness is a measurement over the whole
   * programme, and one that only accumulated while somebody was watching would
   * read differently depending on when the tab was opened. The publish is
   * gated by the meters; the measurement is not.
   */
  FeqLoudnessMeter* loudness_meter = nullptr;

  /* ------------------------------------------------------- track level -- */
  double input_gain_now = 1.0;
  FeqLiveNormalizer* live_normalizer = nullptr;
  double input_gain_target_db = 0.0;
  double input_gain_start_db = 0.0;
  double master_loudness_now_db = 0.0;
  double master_loudness_target_db = 0.0;
  double master_loudness_start_db = 0.0;
  int64_t transition_frames = 0;
  int64_t transition_elapsed = 0;
  double master_gain_now = 1.0;

  /* ------------------------------------------- the Master, self-measured -- */
  /**
   * What the Master does where nobody has measured the track for it.
   *
   * The Library hands the chain a makeup computed from a cached whole-file
   * analysis (`feq_chain_set_track_level_gains`). Outside it — every stream
   * Windows plays through the system engine — there is no analysis, so that
   * makeup was zero for ever: the loudness target could be dragged from one
   * end of the dial to the other and nothing changed, which is what a
   * listener reported after living with it.
   *
   * So the chain measures the programme itself, on the signal entering the
   * master gain: gated integrated loudness exactly as the app's analyzer
   * defines it, and the true peak the Auto Headroom limiter is already
   * computing one stage earlier. The makeup follows the same arithmetic the
   * app uses, and glides rather than steps — `kLiveMasterSeconds`.
   *
   * Per song, because integrated loudness describes one piece of music: the
   * leveler's memory says when the song changed (the app names it in
   * `fluideq-programme.txt`), and everything here starts again.
   */
  FeqLoudnessMeter* programme_meter = nullptr;
  FeqLevelingMemory* leveling = nullptr;
  uint64_t live_master_song = 0;
  double live_master_peak_db = -120.0;
  double live_master_target_db = 0.0;
  double live_master_now_db = 0.0;
  int64_t live_master_frames = 0;
  /** The Library measured the track, so the chain must not measure it again. */
  int host_track_gains = 0;

  /** Scratch for the block's pointer arrays, so the loop allocates none. */
  float* pointers_a[FEQ_CHAIN_MAX_CHANNELS] = {};
  float* pointers_b[FEQ_CHAIN_MAX_CHANNELS] = {};
  float* pointers_c[FEQ_CHAIN_MAX_CHANNELS] = {};
  float* pointers_d[FEQ_CHAIN_MAX_CHANNELS] = {};
};

/** The stages that are one call each, from `chain_stages.cpp`. */
void chain_process_input_gain(FeqChain* chain, float* const* channels,
                              uint32_t frames);
void chain_process_dimension(FeqChain* chain, float* const* channels,
                             uint32_t frames);
void chain_process_bass_forge(FeqChain* chain, float* const* channels,
                              uint32_t frames);
void chain_process_bass_punch(FeqChain* chain, float* const* channels,
                              uint32_t frames);
void chain_process_maximizer(FeqChain* chain, float* const* channels,
                             uint32_t frames);
void chain_process_master_output(FeqChain* chain, float* const* channels,
                                 uint32_t frames);

/* --- the surround channels kept in step with the front pair ------------ */

/** Hold the channels beyond the pair back by what the restoration delays it. */
void chain_process_denoise_align(FeqChain* chain, float* const* channels,
                                 uint32_t frames);

/** The same, by Bass Punch's FIR — called by the punch stage itself. */
void chain_process_punch_align(FeqChain* chain, float* const* channels,
                               uint32_t frames);

/** Point the alignment lines at the restoration's current latency. CONTROL
    thread, after `feq_denoise_configure`; the lines themselves never move. */
void chain_apply_denoise_alignment(FeqChain* chain);

void chain_encode_mid_side(float* const* channels, uint32_t frames);

void chain_decode_mid_side(float* const* channels, uint32_t frames);

/* --- chain_linear.cpp: the convolver, its handover and its kernel --------- */

/**
 * One already-prepared channel through the convolver that is running now, at
 * most a partition of it: while a replacement fades in, the two kernels'
 * difference is kept in `kernel_difference`, which holds that much.
 */
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

/** Free a kernel with its convolution. Null is allowed. */
void chain_kernel_destroy(ChainEqKernel* kernel);

/** Whether a convolver is actually in the path, which is what needs matching. */

int chain_linear_running(const FeqChain* chain);

/** Rebuild the EQ's coefficients and dynamics from the current settings. */
void chain_refresh_eq(FeqChain* chain);

/** The EQ stage, mid/side wrapping included. */
void chain_process_eq(FeqChain* chain, float* const* channels,
                      uint32_t frames);

/**
 * The EQ through its linear-phase kernel, dynamic bands included, over
 * `count` channels in place (`chain_eq_linear.cpp`). `linked` gives every
 * channel the first slot's detector, as the cascade's linked path does.
 */
void chain_process_eq_linear(FeqChain* chain, float* const* targets,
                             const uint32_t* slots, uint32_t count,
                             uint32_t frames, bool linked);

/** The exciter stage, mid/side wrapping included. */
void chain_process_exciter(FeqChain* chain, float* const* channels,
                           uint32_t frames);

/** Allocate one path's buffers and point its stages at them. */
void chain_prepare_exciter_path(FeqChain* chain, uint32_t path);

/**
 * Game mode with Bass Punch off: the stage runs nothing and delays nothing.
 * One test, read by the stage that skips and by the latency that leaves the
 * delay out, so the two can never disagree about which audio is where.
 */
inline bool chain_bass_punch_idle(const FeqChain* chain) {
  return chain->settings.low_latency != 0 &&
         chain->settings.bass_punch.enabled == 0;
}

/**
 * The Master's auto headroom runs its look-ahead whether or not it is on, so
 * that switching it on never steps the level; game mode takes it away while
 * it has nothing to do, as it does the Maximizer's.
 *
 * Applied at configure AND after a handover: `feq_chain_transfer_state`
 * swaps in the limiter the previous chain was running, look-ahead and all,
 * so a chain switched into game mode went on holding the sound back by the
 * previous chain's 2 ms while reporting none.
 */
inline uint32_t chain_headroom_look_ahead(const FeqChain* chain) {
  const bool idle = chain->settings.low_latency != 0 &&
                    !(chain->settings.master.enabled != 0 &&
                      chain->settings.master.loudness_maximize != 0);
  return idle ? 0u : feq_post_filter_normalizer_look_ahead(chain->sample_rate);
}

/**
 * Game mode with the Normalizer off: its peak guard, which keeps its
 * look-ahead under bypass so that switching it on never shifts the audio,
 * gives it up. Applied wherever the leveler arrives in a chain — made for it,
 * or taken over from the previous one at a handover.
 */
inline bool chain_leveler_idle(const FeqChain* chain) {
  return chain->settings.low_latency != 0 &&
         chain->settings.normalizer.mode == 0;
}

#endif /* FLUIDEQ_CHAIN_INTERNAL_H */

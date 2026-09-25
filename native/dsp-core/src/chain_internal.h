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
#include "fluideq/bass_limiter.h"
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
#include <array>
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
/**
 * The Maximizer's low band (`bass_limiter.h`).
 *
 * Measured 2026-09-22 on five loud masters through every chain, as the
 * 0.5-10 Hz movement of the mid's 300 Hz - 5 kHz level: Punch 0.57 dB to
 * 0.23 and a decibel louder, Metal 0.48 to 0.22, EDM and House 0.42 and 0.40
 * to 0.24 and 0.23, with the platform under the Normalizer's peak protection
 * beside it (`live_normalizer.cpp`).
 *
 * 250 Hz because a kick's peak after Bass Punch reaches that far: at 150 Hz a
 * third of it was left to the limiter, and Punch still pumped 0.36. A
 * first-order split is that gentle on purpose — it adds back to exactly the
 * input, where a steeper one turns the phase of what it leaves above. 30 ms
 * lets a bass note back up within two of its cycles; 50 and 80 moved the bass
 * further for nothing heard above it. −12 dB is as deep as a kick's peak asks
 * (−18 changed nothing). 3 ms of look-ahead is a quarter of a 60 Hz cycle,
 * and the limiter's own where that is shorter: the Punch profile's 1.5 ms
 * stays 1.5 in both.
 */
constexpr double kMaximizerLowLookAheadMs = 3.0;
constexpr double kMaximizerLowSplitHz = 250.0;
constexpr double kMaximizerLowFloorDb = -12.0;
constexpr double kMaximizerLowReleaseMs = 30.0;
/**
 * How long a peak's reduction stays what the low band recovers toward: half a
 * cycle of a 25 Hz note, the lowest an 808 or a five-string bass plays. The
 * low band's own reduction is still held only 10 ms and let go over 30, but
 * toward the deepest reduction of the last 20 to 40 ms rather than toward
 * the sample in hand, which between two peaks of a note asks for none.
 * Recovering there moved the gain inside every cycle: a held 60 Hz note at
 * -1 dBFS through Pop's rack came out with 0.6% of harmonics once it wavered
 * by a tenth of a percent (120 Hz at -47 dB, 180 at -48), and a note under
 * 50 Hz sawed on every cycle, its half cycle longer than the hold.
 */
constexpr double kMaximizerLowWindowMs = 20.0;
/** Where a Bass Forge fading out is taken as silent and cleared: -80 dB. */
constexpr double kBassForgeSilentMix = 1e-4;
/**
 * How the Maximizer changes without a step (`chain_process_maximizer`).
 *
 * Drive follows what is asked with a 5 ms time constant, within a thousandth
 * of it in 35 ms. Switched off, the reduction in force lets go over 50 ms
 * and the stage is cleared once it is back within a ten-thousandth of a
 * decibel of unity, where clearing it is a step of nothing. Before, a preset
 * switch applied a new drive to every sample at once and a stage switched
 * off dropped its reduction in one sample: -47 dBFS above 5 kHz under a low
 * tone programme for a 1 dB drive change (2026-09-25).
 */
constexpr double kMaximizerDriveGlideMs = 5.0;
constexpr double kMaximizerOffReleaseMs = 50.0;
constexpr double kMaximizerOffSettledGain = 0.99999;
constexpr double kMaximizerOffSettledDb = -0.0001;

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

/** How long the EQ takes to cross from one rack to the next, in seconds. */
constexpr double kEqFadeSeconds = 0.02;

/** A live EQ band as the audio thread finds its history again after an edit. */
struct ChainBandIdentity {
  FeqFilterType type = FEQ_FILTER_PK;
  double frequency = 0.0;
  double quality = 0.0;
  int dynamic = 0;
};

/**
 * The EQ as the cascade played it last, copied by the audio thread when it
 * took the set up (`chain_eq_fade.cpp`).
 *
 * A copy rather than a pointer to the set: the control thread builds the next
 * rack into whichever set is not published, which is the one this would be
 * pointing at.
 */
struct ChainEqPlaying {
  /** The set's `eq_generation`; 0 for nothing of this chain's yet. */
  uint64_t generation = 0;
  /** The EQ switched on. */
  int enabled = 0;
  /** Switched on and on its cascade, rather than in its kernel. */
  int running = 0;
  FeqEqEngine engine = FEQ_EQ_SERIAL;
  uint32_t oversample = 1;
  FeqStereoMode stereo = FEQ_STEREO_STEREO;
  int has_subsonic = 0;
  FeqBiquadCoefficients subsonic{};
  uint32_t count = 0;
  FeqBiquadCoefficients bands[FEQ_CHAIN_MAX_EQ_BANDS] = {};
  ChainBandIdentity identity[FEQ_CHAIN_MAX_EQ_BANDS] = {};
};

/**
 * The rack the EQ is crossing from, kept playing beside the new one.
 *
 * Its static bands only: a dynamic band at rest is flat, and running its
 * detector a second time would move the envelope twice a block. Everything
 * is sized at create, so starting a fade on the audio thread only copies.
 */
struct ChainEqFade {
  uint32_t total = 0;
  /** Frames still to cross; 0 when no fade is running. */
  uint32_t left = 0;
  FeqEqEngine engine = FEQ_EQ_SERIAL;
  uint32_t oversample = 1;
  int has_subsonic = 0;
  FeqBiquadCoefficients subsonic{};
  uint32_t count = 0;
  FeqBiquadCoefficients bands[FEQ_CHAIN_MAX_EQ_BANDS] = {};
  /** `[slot * kBandStride + band]`, like the live histories. */
  std::vector<FeqBiquadState> states;
  FeqBiquadState subsonic_states[FEQ_CHAIN_MAX_CHANNELS] = {};
  FeqOversampler oversamplers[FEQ_CHAIN_MAX_CHANNELS] = {};
  /** Each slot's outgoing sound for the block, `max_frames` long. */
  std::vector<float> outgoing[FEQ_CHAIN_MAX_CHANNELS];
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
    /**
     * The curve the Maximizer limits through (`FeqChainToneSettings`), as a
     * target: the curve playing glides to it on the audio thread
     * (`chain_tone.cpp`), so a new one is never a step in the sound.
     * Published with the EQ's set, so it never changes halfway through a
     * block, and numbered so the audio thread knows a new one has come.
     */
    FeqChainToneSettings tone{};
    uint64_t tone_generation = 0;
    /**
     * What the audio thread needs to cross from the rack before to this one
     * (`chain_eq_fade.cpp`): each live band's identity, in `bands` order, to
     * find its history by, and how the cascade was set to run. Numbered, from
     * 1, so a new set is known when it comes.
     */
    std::vector<ChainBandIdentity> identity;
    int eq_enabled = 0;
    /** Switched on and on the cascade: minimum phase, no Isolate kernel. */
    int eq_running = 0;
    FeqEqEngine engine = FEQ_EQ_SERIAL;
    uint32_t oversample = 1;
    FeqStereoMode stereo = FEQ_STEREO_STEREO;
    uint64_t eq_generation = 0;

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
  /** Numbers the EQ sets `chain_refresh_eq` builds; the control thread's. */
  uint64_t eq_built = 0;
  /** The rack the cascade last played, and the one it is crossing from. */
  ChainEqPlaying eq_playing{};
  ChainEqFade eq_fade{};
  /* ------------------------------------------------------------- tone -- */
  /** A gain on its way somewhere, a fixed amount a frame. */
  struct ToneGlide {
    double db = 0.0;
    double target = 0.0;
    double step = 0.0;
  };
  /**
   * One band of the curve the Maximizer limits through, as it plays now
   * (`chain_tone.cpp`): played in front of the limiters at `forward` and
   * taken off behind them at `inverse`, which follows the same way once the
   * audio the limiters hold has caught up.
   */
  struct ToneBand {
    FeqFilterType type = FEQ_FILTER_PK;
    double frequency = 1000.0;
    double quality = 0.707;
    int matched = 0;
    ToneGlide forward;
    ToneGlide inverse;
    /** Where the inverse goes once `inverse_wait` frames have passed. */
    double inverse_pending = 0.0;
    uint32_t inverse_wait = 0;
    int has_pending = 0;
    /** No longer in the target: glides to 0 dB, is held there, then goes. */
    int outgoing = 0;
    uint32_t settle = 0;
    /**
     * Just arrived, histories empty: each side plays one step flat first, so
     * its histories agree with its input before it moves.
     */
    int forward_fresh = 0;
    int inverse_fresh = 0;
    FeqBiquadCoefficients forward_coefficients{};
    FeqBiquadCoefficients inverse_coefficients{};
  };
  /** Room for a whole curve arriving while another leaves. */
  static constexpr uint32_t kToneSlots = 2 * FEQ_CHAIN_MAX_TONE_BANDS;
  std::array<ToneBand, kToneSlots> tone_bands{};
  uint32_t tone_count = 0;
  /** The set's number the playing curve last took its target from. */
  uint64_t tone_adopted = 0;
  /** Numbers the sets `chain_refresh_eq` builds; the control thread's. */
  uint64_t tone_built = 0;
  /**
   * Whether audio has passed since the chain was made or its programme
   * changed: until then a curve is taken as it is, with nothing to glide from.
   */
  int tone_primed = 0;
  /**
   * The tone's histories, `[channel * kToneSlots + slot]`, the curve's own
   * and then its inverse's, sized once at create, like the EQ's.
   */
  std::vector<FeqBiquadState> tone_states;
  std::vector<FeqBiquadState> tone_inverse_states;
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

  /**
   * The mono maker (`eq.mono_below_hz`): the side high-passed after the EQ,
   * crossing from what played to what is asked over `kEqFadeSeconds`
   * (`chain_mono_maker.cpp`). It used to sit inside the EQ's mid/side
   * domain, so switching it on or off moved every EQ band from left and
   * right onto mid and side with their histories still left and right —
   * -42 dBFS above 5 kHz on a preset switch, measured 2026-09-25.
   */
  struct MonoMaker {
    FeqBiquadCoefficients playing{};
    FeqBiquadState state{};
    int playing_on = 0;
    FeqBiquadCoefficients outgoing{};
    FeqBiquadState outgoing_state{};
    int outgoing_on = 0;
    uint32_t left = 0;
    uint32_t total = 0;
    /** Played a block since its stream started: a fresh chain crosses from nothing. */
    int played = 0;
    std::vector<float> side;
    std::vector<float> side_outgoing;
  } mono_maker;

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
  int kernel_matched = 0;
  double kernel_subsonic_hz = 0.0;
  FeqLinearPhaseBand kernel_bands[FEQ_CHAIN_MAX_EQ_BANDS] = {};

  /* --------------------------------------------------------- maximizer -- */
  FeqLinkedLimiter maximizer{};
  std::vector<FeqTruePeak> maximizer_detectors;
  std::vector<float> maximizer_delay[FEQ_CHAIN_MAX_CHANNELS];
  std::vector<float*> maximizer_delay_pointers;
  /**
   * Its low band (`bass_limiter.h`), ahead of the limiter: the input and its
   * low band delayed per channel, and the low band's gain. Sized once at
   * `kMaximizerLowLookAheadMs`, like the limiter's ring at its largest.
   */
  FeqBassLimiter maximizer_low{};
  std::vector<float> maximizer_low_input[FEQ_CHAIN_MAX_CHANNELS];
  std::vector<float> maximizer_low_band[FEQ_CHAIN_MAX_CHANNELS];
  std::vector<float*> maximizer_low_input_pointers;
  std::vector<float*> maximizer_low_band_pointers;
  std::vector<float> maximizer_low_gain;
  uint32_t maximizer_low_look_ahead = 0;
  /* --------------------------------------------------------- bass forge -- */
  FeqBassForge bass_forge{};
  /**
   * Whether it is adding, whether the stream has played a block, and what it
   * was last told: switched off, it fades out on those settings
   * (). Carried across a handover with the stage.
   */
  struct BassForgeRun {
    int playing = 0;
    int played = 0;
    FeqBassForgeSettings last{};
  } bass_forge_run;
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
  std::vector<float> dimension_allpass[FEQ_DIMENSION_LINES];
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
  /**
   * The drive being applied, gliding to the one asked for over
   * `kEqFadeSeconds`. Applied as a step, a preset switch moved every sample
   * by the difference between two drives in one sample: -47 dBFS above
   * 5 kHz from 1 dB (2026-09-25). Carried across a handover.
   */
  double maximizer_drive_now = 1.0;

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

/* --- the curve the Maximizer limits through, from `chain_tone.cpp` ------ */

/** The curve on, in front of the limiters, gliding to a new one if it came. */
void chain_tone_forward(FeqChain* chain, float* const* channels,
                        uint32_t frames);
/** The curve off again, behind them, the limiters' delay behind the front. */
void chain_tone_inverse(FeqChain* chain, float* const* channels,
                        uint32_t frames);
/** A new programme: nothing left to glide from, the rings are emptied too. */
void chain_tone_restart(FeqChain* chain);
/** A handover: the playing curve and its histories go to the chain taking over. */
void chain_tone_transfer(FeqChain& prepared, FeqChain& previous);

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

/** The mono maker after the EQ, and its return to a stream's start. */
void chain_process_mono_maker(FeqChain* chain, float* const* channels,
                              uint32_t frames);
void chain_mono_maker_reset(FeqChain* chain);

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

/**
 * AUDIO thread, at the top of a block: take up a newly published EQ set,
 * every band's history following the band and a fade started from the rack
 * that was playing (`chain_eq_fade.cpp`).
 */
void chain_eq_adopt(FeqChain* chain);

/**
 * While the EQ crosses from one rack to the next: run the rack it is leaving
 * over `target` into the slot's outgoing buffer. Before the new rack runs.
 */
void chain_eq_fade_capture(FeqChain* chain, uint32_t slot_index,
                           const float* target, uint32_t frames);

/** Then slide `target` from that outgoing sound to what the new rack made. */
void chain_eq_fade_mix(FeqChain* chain, uint32_t slot_index, float* target,
                       uint32_t frames);

/** Once a block, after every slot has been mixed. */
void chain_eq_fade_advance(FeqChain* chain, uint32_t frames);

/** Whether a fade is crossing, for the stage's bypassed paths. */
int chain_eq_fading(const FeqChain* chain);

/** Size the fade's storage; at create, never again. */
void chain_eq_fade_allocate(FeqChain* chain);

/** No fade after a seek or a new programme; what played stays known. */
void chain_eq_fade_stop(FeqChain* chain);

/** At a handover: what played and any fade crossing go to the new chain. */
void chain_eq_fade_transfer(FeqChain& prepared, FeqChain& previous);

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

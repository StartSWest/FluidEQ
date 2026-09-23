/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

// The EQ while it runs through its linear-phase kernel: the kernel, a
// partition at a time, and then the dynamic bands it left out, each in the
// share of the output that belongs to the kernel that left it out. The
// cascade, the oversampling and the isolate monitor around both stay in
// `chain_eq.cpp`.

#include "chain_internal.h"

#include <algorithm>
#include <cmath>

namespace {

/**
 * One dynamic band as the kernel path runs it for a block: where its filter,
 * its history and its detector come from, and which of the kernels in play
 * leave it out to be run after them.
 */
struct LinearBand {
  /** Its place among the live bands: its filter history and its detector. */
  uint32_t live = 0;
  const FeqBiquadCoefficients* filter = nullptr;
  /**
   * The detector's settings while the current rack no longer marks the band
   * dynamic but a kernel still playing left it out: that kernel's record is
   * all that knows how the band was set. Null when the rack's own detector
   * decides.
   */
  const FeqBandDynamics* leaving = nullptr;
  /** Its entry in the kernel playing now and in the one fading in, or null
      where that kernel baked the band in. */
  const ChainKernelBand* now = nullptr;
  const ChainKernelBand* coming = nullptr;
};

/**
 * The bands to run after the kernels this block, in settings order.
 *
 * A band is run when the kernel playing now left it out, or the one fading in
 * did, or the current rack marks it dynamic and a kernel built for that is on
 * its way. Each kernel's share of the output then carries only the bands IT
 * left out — `process_linear_dynamics`. A band no longer live has no history
 * to run from and goes at once, as switching a band off always has.
 */
uint32_t linear_bands(const FeqChain* chain, LinearBand* out) {
  const FeqChain::ChainCoefficients& set = *chain->active;
  const ChainEqKernel* now = chain->kernel;
  const ChainEqKernel* coming = chain->kernel_next;
  uint32_t count = 0;
  for (uint32_t band = 0; band < FEQ_CHAIN_MAX_EQ_BANDS; ++band) {
    const int32_t current = set.dynamic_of[band];
    const int32_t in_now = now != nullptr ? now->dynamic_of[band] : -1;
    const int32_t in_coming = coming != nullptr ? coming->dynamic_of[band] : -1;
    if ((current < 0 && in_now < 0 && in_coming < 0) ||
        set.live_of[band] < 0) {
      continue;
    }
    LinearBand& entry = out[count];
    count += 1;
    entry.live = static_cast<uint32_t>(set.live_of[band]);
    entry.now = in_now >= 0 ? &now->dynamic[in_now] : nullptr;
    entry.coming = in_coming >= 0 ? &coming->dynamic[in_coming] : nullptr;
    if (current >= 0) {
      entry.filter = &set.dynamic[static_cast<size_t>(current)];
      entry.leaving = nullptr;
    } else {
      const ChainKernelBand& record =
          entry.now != nullptr ? *entry.now : *entry.coming;
      entry.filter = &record.filter;
      entry.leaving = &record.detector;
    }
  }
  return count;
}

/** How one channel hears one band for the piece in hand. */
struct BandShare {
  /** A replacement kernel is fading in, and its share is being walked. */
  bool blending = false;
  /** The kernel playing now left the band out, and so did the one coming. */
  bool in_now = false;
  bool in_coming = false;
  /** Each kernel's change for the band, or null where it carries none. */
  const float* now_change = nullptr;
  const float* coming_change = nullptr;
  /**
   * Every kernel heard baked the band in: it adds nothing, and what the
   * detectors after it hear is unchanged.
   */
  bool baked() const { return !in_now && (!blending || !in_coming); }
  /**
   * Every kernel heard left it out and carries no change for it: it is the
   * cascade's own step, exactly as the cascade has always run it.
   */
  bool cascade() const {
    return in_now && now_change == nullptr &&
           (!blending || (in_coming && coming_change == nullptr));
  }
  /**
   * Only one of the two kernels being blended left the band out — its
   * Dynamic switch was just moved. What it filters must then be that
   * kernel's output alone: the blend also carries the other kernel, which
   * has the band baked in, and filtering that too applied the band twice
   * over the fade — 8 dB on the floor of an 18 dB cut at its middle.
   */
  bool one_share() const { return blending && in_now != in_coming; }
};

BandShare band_share(FeqChain* chain,
                     const LinearBand& band,
                     uint32_t index,
                     uint32_t slot,
                     uint32_t frames) {
  BandShare share;
  // The same test `chain_process_eq_convolver_channel` made for this piece:
  // a replacement still warming runs, but is not yet heard.
  share.blending =
      chain->convolvers_next[slot] != nullptr && chain->convolver_warmup <= 0;
  share.in_now = band.now != nullptr;
  share.in_coming = share.blending && band.coming != nullptr;
  if (share.in_now && band.now->change >= 0) {
    feq_convolver_read_change(chain->convolvers[slot],
                              static_cast<uint32_t>(band.now->change),
                              chain->change_active[index].data(), frames);
    share.now_change = chain->change_active[index].data();
  }
  if (share.in_coming && band.coming->change >= 0) {
    feq_convolver_read_change(chain->convolvers_next[slot],
                              static_cast<uint32_t>(band.coming->change),
                              chain->change_next[index].data(), frames);
    share.coming_change = chain->change_next[index].data();
  }
  return share;
}

/**
 * The dynamic bands, while the EQ runs through its kernel.
 *
 * Each band's detector is exactly the cascade's — the band's own biquad on
 * what reaches it, the loudest channel when they are linked — so a band opens
 * at the same moment in either phase mode, and under Isolate as while
 * listening. What each band ADDS belongs to the kernel whose share it is: a
 * kernel that baked the band in gets nothing more of it, and one that left it
 * out gets its step after it. Listening, that step is the biquad's own
 * change, sample for sample the arithmetic `feq_eq_process_bands` does. Under
 * Isolate the kernel carries the band's change in linear phase, scaled by the
 * same amount: the biquad's change is level AND phase, and the monitor
 * subtracts the dry signal, so the phase played as everything between the
 * band and the rest of the record — see
 * `feq_build_linear_phase_change_kernel`.
 *
 * Overlapping dynamic bands are monitored as the sum of their changes, where
 * the serial cascade multiplies them: the same wherever they do not overlap,
 * and off by the product of the two changes where they do, while both are
 * open.
 *
 * `hears` is, per channel, what each detector is given: the kernel's output,
 * and in the serial engine every earlier dynamic band's own step on top, in
 * the share the kernels heard give it, as the cascade passes each band's
 * output to the next. In the parallel engine every band hears the kernel's
 * output alone.
 */
void process_linear_dynamics(FeqChain* chain,
                             float* const* targets,
                             const uint32_t* slots,
                             uint32_t count,
                             uint32_t frames,
                             const double* mix_start,
                             bool linked,
                             const LinearBand* bands,
                             uint32_t band_count,
                             double* peaks) {
  if (band_count == 0) {
    return;
  }
  const bool serial = chain->settings.eq.engine == FEQ_EQ_SERIAL;
  float* hears[FEQ_CHAIN_MAX_CHANNELS] = {};
  float* wet[FEQ_CHAIN_MAX_CHANNELS] = {};
  /**
   * Every band so far added exactly its cascade step or nothing at all: the
   * output is still the cascade's, sample for sample, and in the serial engine
   * it IS `hears`. Kept so listening is not merely close to what it was but
   * the same numbers — the rounding included.
   */
  bool cascade[FEQ_CHAIN_MAX_CHANNELS] = {};
  for (uint32_t index = 0; index < count; ++index) {
    hears[index] = chain->linked_dry[index].data();
    wet[index] = chain->linked_wet[index].data();
    std::copy(targets[index], targets[index] + frames, hears[index]);
    cascade[index] = true;
  }
  // Linked, the first slot's detector decides for every channel, as the
  // cascade's linked path does; the others mirror it after the stage.
  const size_t detector_base =
      static_cast<size_t>(linked ? 0u : slots[0]) * FeqChain::kBandStride;

  for (uint32_t which = 0; which < band_count; ++which) {
    const LinearBand& band = bands[which];
    FeqBandDynamics& state = chain->band_dynamics[detector_base + band.live];
    // A band on its way out keeps the detector it was set with, on the
    // envelope it had: the rack has already stood that one down.
    FeqBandDynamics leaving{};
    if (band.leaving != nullptr) {
      leaving = *band.leaving;
      leaving.envelope = state.envelope;
    }
    FeqBandDynamics& detector = band.leaving != nullptr ? leaving : state;
    BandShare shares[FEQ_CHAIN_MAX_CHANNELS];
    double mix[FEQ_CHAIN_MAX_CHANNELS] = {};
    /** What the band filters, per channel: `hears`, or one kernel's share. */
    const float* input[FEQ_CHAIN_MAX_CHANNELS] = {};
    for (uint32_t index = 0; index < count; ++index) {
      shares[index] = band_share(chain, band, index, slots[index], frames);
      mix[index] = mix_start[index];
      input[index] = hears[index];
      if (shares[index].one_share()) {
        // The blend is the outgoing share plus `mix` of the difference; take
        // back what is not this band's kernel's, on the fade's own walk.
        const float* apart = chain->kernel_difference[slots[index]].data();
        float* own_share = chain->share_input[index].data();
        const bool outgoing = shares[index].in_now;
        double walk = mix_start[index];
        for (uint32_t at = 0; at < frames; ++at) {
          walk = walk + kConvolverBlendStep < 1.0 ? walk + kConvolverBlendStep
                                                  : 1.0;
          const double away = outgoing ? -walk : 1.0 - walk;
          own_share[at] = static_cast<float>(
              static_cast<double>(hears[index][at]) +
              static_cast<double>(apart[at]) * away);
        }
        input[index] = own_share;
      }
      std::copy(input[index], input[index] + frames, wet[index]);
      feq_biquad_process(
          &chain->band_states[static_cast<size_t>(slots[index]) *
                                  FeqChain::kBandStride +
                              band.live],
          wet[index], frames, band.filter);
      if (!shares[index].baked() && !shares[index].cascade()) {
        cascade[index] = false;
      }
    }
    // A band whose detector can never open — no gain to swing — is applied
    // in full, as the cascade applies an inactive dynamic band: in place, so
    // what it passes on is the filter's output exactly.
    const bool in_full = detector.active == 0;
    double& peak = peaks[which];
    for (uint32_t at = 0; at < frames; ++at) {
      double amount = 1.0;
      if (!in_full) {
        double loudest = 0.0;
        for (uint32_t index = 0; index < count; ++index) {
          const double difference = static_cast<double>(wet[index][at]) -
                                    static_cast<double>(input[index][at]);
          if (std::fabs(difference) > std::fabs(loudest)) {
            loudest = difference;
          }
        }
        amount = feq_band_dynamic_amount(&detector, loudest);
        peak = amount > peak ? amount : peak;
      }
      for (uint32_t index = 0; index < count; ++index) {
        const BandShare& share = shares[index];
        if (share.baked()) {
          continue;
        }
        const double reaching = static_cast<double>(hears[index][at]);
        // The cascade's own step for this band: its filter's change, as
        // much of it as the detector allows — on what it filtered, which is
        // `hears` itself unless one kernel's share was taken back out.
        const double own = (static_cast<double>(wet[index][at]) -
                            static_cast<double>(input[index][at])) *
                           amount;
        if (share.cascade()) {
          if (serial) {
            hears[index][at] =
                in_full ? wet[index][at] : static_cast<float>(reaching + own);
          }
          if (cascade[index]) {
            targets[index][at] =
                serial ? hears[index][at]
                       : static_cast<float>(
                             static_cast<double>(targets[index][at]) + own);
          } else {
            targets[index][at] = static_cast<float>(
                static_cast<double>(targets[index][at]) + own);
          }
          continue;
        }
        // A kernel's share: its change if it carries one, the band's own step
        // if it left the band out without one, nothing if it baked it in.
        double added = 0.0;
        double weight = 0.0;
        if (share.in_now) {
          added = share.now_change != nullptr
                      ? static_cast<double>(share.now_change[at]) * amount
                      : own;
          weight = 1.0;
        }
        if (share.blending) {
          mix[index] = mix[index] + kConvolverBlendStep < 1.0
                           ? mix[index] + kConvolverBlendStep
                           : 1.0;
          double coming = 0.0;
          double coming_weight = 0.0;
          if (share.in_coming) {
            coming = share.coming_change != nullptr
                         ? static_cast<double>(share.coming_change[at]) * amount
                         : own;
            coming_weight = 1.0;
          }
          added += (coming - added) * mix[index];
          weight += (coming_weight - weight) * mix[index];
        }
        targets[index][at] = static_cast<float>(
            static_cast<double>(targets[index][at]) + added);
        if (serial) {
          hears[index][at] = static_cast<float>(reaching + own * weight);
        }
      }
    }
    if (band.leaving != nullptr) {
      state.envelope = leaving.envelope;
    } else if (!in_full) {
      // The most the band opened over the whole block so far, which is what
      // the meter reads once the block is done — as the cascade reports it.
      detector.amount = peak;
    }
  }
}

}  // namespace

/**
 * The EQ through its kernel, a partition at a time.
 *
 * A partition because that is the most of a change the convolver hands back
 * at once, and the host's block can be any length. Every channel's kernel
 * output comes before any detector runs, because a linked detector listens
 * to all of them.
 */
void chain_process_eq_linear(FeqChain* chain,
                             float* const* targets,
                             const uint32_t* slots,
                             uint32_t count,
                             uint32_t frames,
                             bool linked) {
  const uint32_t partition = feq_convolver_latency();
  LinearBand bands[FEQ_CHAIN_MAX_EQ_BANDS];
  const uint32_t band_count = linear_bands(chain, bands);
  float* pieces[FEQ_CHAIN_MAX_CHANNELS] = {};
  double mix[FEQ_CHAIN_MAX_CHANNELS] = {};
  double peaks[FEQ_CHAIN_MAX_EQ_BANDS] = {};
  for (uint32_t offset = 0; offset < frames; offset += partition) {
    const uint32_t length =
        frames - offset < partition ? frames - offset : partition;
    for (uint32_t index = 0; index < count; ++index) {
      pieces[index] = targets[index] + offset;
      mix[index] = chain->convolver_blend[slots[index]];
      chain_process_eq_convolver_channel(chain, pieces[index], length,
                                         slots[index]);
    }
    process_linear_dynamics(chain, pieces, slots, count, length, mix, linked,
                            bands, band_count, peaks);
  }
}

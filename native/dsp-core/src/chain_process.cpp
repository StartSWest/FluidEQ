/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * One block through the rack: every stage in its order, on the channels it
 * applies to, with the surround channels held back where the front pair's
 * own stages delay it, and the meters published after.
 */
#include "chain_internal.h"

#include <algorithm>
#include <cmath>
#include <cstring>

extern "C" {

void feq_chain_process(FeqChain* chain, float* const* channels,
                       uint32_t frames) {
  if (chain == nullptr || channels == nullptr || frames == 0 ||
      frames > chain->max_frames) {
    return;
  }
  if (chain->settings.enabled == 0) {
    FeqRoomReport inactive{FEQ_ROOM_REPORT_TAG, 0};
    feq_meters_publish_room(chain->meters, &inactive);
    return;
  }

  /**
   * The rack for this block, chosen once and used throughout.
   *
   * Adopting a newly published set halfway down would put the EQ on one rack
   * and the isolate subtraction beneath it on another, which is two different
   * filters inside one buffer rather than a settings change.
   */
  chain->active =
      &chain->coefficient_sets[chain->published_coefficients.load(
          std::memory_order_acquire)];
  // A new EQ rack is crossed to rather than jumped to, with every band's
  // history following the band (`chain_eq_fade.cpp`); here, before any of
  // the block has run, for the reason the set is chosen here.
  chain_eq_adopt(chain);

  // The kernel arrives the same way and for the same reason, and is taken at
  // the same point: this is the one moment in a block where swapping a filter
  // costs nothing, because none of it has been used yet.
  chain_adopt_kernel_handoff(chain);

  chain_process_input_gain(chain, channels, frames);

  /*
   * Restoration, before anything creative touches the block.
   *
   * Below the input gain because that gain was chosen from a cached whole-file
   * true peak: altering the waveform above it makes the measurement describe a
   * signal that no longer exists, and the ceiling stops holding with nothing
   * reporting it. Above the exciter because the alternative is generating
   * harmonics from hiss and then trying to remove the result.
   */
  feq_denoise_process(chain->denoise, channels, frames);
  // The restoration works on the front pair and delays it by its modules;
  // the channels beyond the pair are held back by the same amount here, so
  // the exciter and everything after it see all of them in step.
  chain_process_denoise_align(chain, channels, frames);
  if (chain->meters != nullptr) {
    FeqDenoiseReport report{};
    // Read on the producer thread: the estimator's arrays are mutable audio
    // state, so the pipe worker must consume a published copy instead.
    feq_denoise_report(chain->denoise, &report);
    feq_meters_publish_denoise(chain->meters, &report);
  }
  feq_meters_capture(chain->meters, FEQ_METER_STAGE_DENOISE, channels, frames);

  chain_process_exciter(chain, channels, frames);
  /**
   * Tapped where the visible chain draws its boundary, not where it is
   * convenient: the exciter graph is showing what the exciter did, so it has
   * to be read before anything else has had a turn at the same buffer.
   *
   * This sat four lines lower for as long as Bass Forge has been in the
   * chain, which put a second generator between the stage and its own meter:
   * with Forge switched on the Exciter graph was drawing Forge's output, and
   * the two stages are hard to tell apart on a spectrum precisely because
   * both of them add harmonics to material that did not have them. Forge has
   * its own eight-band meter below and does not need a spectrum tap.
   */
  feq_meters_capture(chain->meters, FEQ_METER_STAGE_EXCITER, channels, frames);
  // And what its three bands and the organic stage contributed, which the
  // spectrum cannot show: a nonlinear stage has no transfer curve to draw.
  feq_meters_publish_exciter(chain->meters, chain->exciter_band_report,
                             chain->exciter_organic_report);

  /**
   * Forge after the Exciter because both of them generate.
   *
   * They are the chain's two synthesis stages and they sit together, ahead of
   * the EQ, so the EQ is shaping everything that will be heard rather than
   * everything except what the two of them just made.
   */
  chain_process_bass_forge(chain, channels, frames);
  /**
   * The dry low band against the forged one, which no spectrum can separate.
   *
   * Both runs come off band-pass followers the stage already ran during the
   * block, so this is a copy of sixteen doubles rather than a measurement.
   * Published unconditionally: `chain_process_bass_forge` resets the stage on
   * every block it is switched off for, which drives both runs to the -120
   * floor — an honest "not running" rather than a minute-old reading held on
   * screen.
   */
  if (chain->meters != nullptr) {
    double forge_input_db[FEQ_BASS_FORGE_BANDS];
    double forge_output_db[FEQ_BASS_FORGE_BANDS];
    feq_bass_forge_bands(&chain->bass_forge, forge_input_db, forge_output_db);
    feq_meters_publish_bass_forge(chain->meters, forge_input_db,
                                  forge_output_db);
  }

  chain_process_eq(chain, channels, frames);
  feq_meters_capture(chain->meters, FEQ_METER_STAGE_EQ, channels, frames);

  /**
   * What each band did with this block, for the panel to draw.
   *
   * Taken here because the dynamics have just run and their envelopes describe
   * this block rather than the previous one. A dynamic band's effect is the one
   * thing in the rack that cannot be drawn from its settings — the curve is
   * drawn at full strength and its at-rest twin at zero, and neither moves when
   * the threshold does — so without this the threshold dial looks broken while
   * working perfectly.
   */
  if (chain->meters != nullptr) {
    const size_t bands = chain->band_dynamics.size();
    for (size_t band = 0; band < bands && band < FEQ_METER_MAX_BANDS;
         band += 1) {
      // A static band is always fully applied, which is what makes it static.
      chain->band_amount_scratch[band] =
          chain->band_dynamics[band].active != 0
              ? chain->band_dynamics[band].amount
              : 1.0;
      // In dB, because that is the scale the line is plotted on. See
      // `feq_meters_publish_bands`: the raw envelope read as a level just
      // under 0 dB whatever the band was hearing.
      const double envelope = chain->band_dynamics[band].envelope;
      chain->band_level_scratch[band] =
          envelope > 1e-6 ? 20.0 * std::log10(envelope) : -120.0;
    }
    feq_meters_publish_bands(
        chain->meters, chain->band_amount_scratch.data(),
        chain->band_level_scratch.data(),
        static_cast<uint32_t>(bands < FEQ_METER_MAX_BANDS
                                  ? bands
                                  : FEQ_METER_MAX_BANDS));
  }

  /**
   * Punch after the EQ and before the level stages: shaped, then controlled.
   *
   * A transient this stage has sharpened is something the Maximizer then gets
   * to decide about. The other order hands Punch an envelope that has already
   * been held down, and it spends its range rebuilding an attack that was
   * just taken away.
   */
  chain_process_bass_punch(chain, channels, frames);
  /**
   * Three gains, which are the only evidence the stage is doing what it says.
   *
   * Its claim is that the leading edge and the tail are shaped independently
   * and that over a complete note the two followers converge, so the gain
   * averages to unity. A dial position cannot show either. Published every
   * block for the same reason Forge's bands are. Bypass zeros the controls
   * while keeping the dry alignment and finite contribution history current.
   */
  feq_meters_publish_bass_punch(chain->meters,
                                feq_bass_punch_transient_db(&chain->bass_punch),
                                feq_bass_punch_sustain_db(&chain->bass_punch),
                                feq_bass_punch_duck_db(&chain->bass_punch));

  /**
   * The room, after everything that is per channel and before everything
   * that is about the pair: from here on the front pair carries the two
   * ears and the stages below run on that, as they run on any stereo mix.
   */
  feq_room_process(chain->room, channels, frames);
  FeqRoomReport room_report{};
  feq_room_report(chain->room, &room_report);
  feq_meters_publish_room(chain->meters, &room_report);

  /**
   * Width before the dynamics, and that position is forced rather than chosen.
   *
   * Anything that changes level has to happen before the ceiling holds it, or
   * the widening pushes peaks back over a limit the Maximizer has already
   * enforced.
   */
  chain_process_dimension(chain, channels, frames);
  feq_meters_publish_dimension(chain->meters,
                               feq_dimension_guard(&chain->dimension));
  chain_process_maximizer(chain, channels, frames);
  // What it is holding down, which the spectrum cannot show either: a limiter
  // that is working looks exactly like one that is not until you see the
  // reduction.
  feq_meters_publish_maximizer(chain->meters, chain->maximizer_reduction_db);

  const bool uses_selected_headroom =
      chain->settings.master.enabled != 0 &&
      chain->settings.master.loudness_maximize != 0;
  FeqPostFilterNormalizerOptions headroom{};
  headroom.enabled = uses_selected_headroom ? 1 : 0;
  headroom.output_ceiling_db = chain->settings.master.ceiling_db;
  // Reserve only gain actually present in this quantum. Reserving the future
  // target made Auto Headroom latch attenuation while the LUFS makeup was
  // still ramping, so uncached and cached playback disagreed.
  headroom.following_gain_db = chain->settings.master.output_trim_db +
                               chain->master_loudness_now_db +
                               chain->live_master_now_db;
  headroom.release_ms = chain->settings.master.release_ms;
  headroom.sample_rate = chain->sample_rate;
  feq_post_filter_normalizer_process(&chain->post_normalizer, channels, frames,
                                     &headroom);

  chain_process_master_output(chain, channels, frames);
  // The preset's curve comes off here, after the Master as well as the
  // Maximizer: a chain that ends in the Master's Auto Headroom (Default, the
  // voices) held its peaks to the ceiling BEFORE the curve and went over once
  // it had played, as the Maximizer's did before it was told the curve.
  chain_tone_inverse(chain, channels, frames);

  /**
   * There is nothing after the Master's gain: no final limiter, no DC filter.
   *
   * A guard used to sit here — a -0.1 dBTP true-peak limiter and a 3 Hz
   * high-pass, always on, whatever the cards said. It held every record
   * mastered above its ceiling, which is most of them, so a rack with every
   * card off still changed the sound and the window read it as clipping. It
   * was removed on 2026-09-22 at Ivan's call: the rack with nothing on is a
   * delay and nothing else (`chain_transparency_test.cpp`), and a stage that
   * raises the level carries its own ceiling — the Maximizer, the Master's
   * Auto Headroom, the Normalizer's peak guard. Nothing is put back here that
   * touches a sample the listener did not ask to be touched.
   *
   * The one thing that does leave here is a sample that is not a number: a
   * NaN or an infinity plays as silence or a full-scale burst and, inside a
   * biquad's history, never ends. It is replaced by silence without a meter,
   * because a finite sample is never changed by this.
   */
  for (uint32_t channel = 0; channel < chain->channels; ++channel) {
    float* samples = channels[channel];
    for (uint32_t at = 0; at < frames; ++at) {
      if (!std::isfinite(samples[at])) {
        samples[at] = 0.0f;
      }
    }
  }

  /**
   * What the Master's Auto Headroom just did, for the card that shows it.
   *
   * Taken unconditionally, including while the panel is closed. The stage
   * holds its reading until something takes it, so skipping the take would
   * let a reduction from minutes ago be the first thing displayed when the
   * tab is opened — a meter reporting a peak event that is over.
   */
  const FeqPostFilterNormalizerTelemetry headroom_report =
      feq_post_filter_normalizer_take_telemetry(&chain->post_normalizer);
  FeqMasterTelemetry master_report{};
  master_report.auto_headroom_reduction_db = headroom_report.gain_reduction_db;
  master_report.auto_headroom_true_peak_db =
      headroom_report.input_true_peak_db;
  /**
   * The same true peak, kept as the programme's loudest so far.
   *
   * This is the peak of the signal entering the master gain, measured with
   * the oversampling detector Auto Headroom already runs — so the chain's own
   * loudness makeup can be capped by the room the programme has left without
   * a second true-peak detector anywhere.
   */
  if (headroom_report.input_true_peak_db > chain->live_master_peak_db) {
    chain->live_master_peak_db = headroom_report.input_true_peak_db;
  }
  feq_meters_publish_master(chain->meters, &master_report);

  // Last, because this is the one tap that has to be what leaves for the
  // device: what the master meter draws is what the listener hears.
  feq_meters_capture(chain->meters, FEQ_METER_STAGE_MASTER, channels, frames);

  /**
   * The loudness of that same tap, and it runs whether or not anyone is
   * watching.
   *
   * Gating the measurement on the panel being open would make the integrated
   * reading depend on when the tab was opened, which is not a property of the
   * music. Only the publish is gated, inside the meters, and the measurement
   * costs two biquads per channel per sample.
   */
  feq_loudness_meter_process(chain->loudness_meter, channels, frames);
  FeqLoudnessReading loudness{};
  feq_loudness_meter_read(chain->loudness_meter, &loudness);
  feq_meters_publish_loudness(chain->meters, &loudness);
}

}  // extern "C"

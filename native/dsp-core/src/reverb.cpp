/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The plate of `reverb.h`. Lengths are Dattorro's, in samples at 29761 Hz,
 * scaled by the stream's rate and by the type's size; every line is sized
 * at create for the largest type, so a type change never allocates and the
 * tank survives a handover whatever the type.
 */

#include "fluideq/reverb.h"

#include <algorithm>
#include <array>
#include <cmath>
#include <cstdint>
#include <new>
#include <utility>
#include <vector>

#include "reverb_internal.h"

// The parts are this file's own; the namespace only keeps them out of
// every other translation unit.
using namespace feq_reverb_detail;

namespace {

Line& tap_line(FeqReverb& r, Tap tap) {
  switch (tap) {
    case kL1:
      return r.left_d1;
    case kLAp2:
      return r.left_ap2;
    case kL2:
      return r.left_d2;
    case kR1:
      return r.right_d1;
    case kRAp2:
      return r.right_ap2;
    default:
      return r.right_d2;
  }
}

/** One sample of the tank, fed `x`; the two output sides. */
void tank(FeqReverb& r, float x, float& out_left, float& out_right) {
  const double k = r.scale;
  // The two halves feed each other from where each ended last sample. A
  // ±1e-18 offset, alternating, rides along: a tail decaying in silence
  // otherwise reaches denormal values, which cost a hundred times the work
  // anywhere they are not flushed (the Library's host, a test), and a
  // minute-long test ran for over twelve CPU minutes before it was there.
  // It is 360 dB under full scale.
  r.denormal_guard = -r.denormal_guard;
  const float from_right =
      r.right_d2.at_fraction(kRightD2 * k) * r.decay + r.denormal_guard;
  const float from_left =
      r.left_d2.at_fraction(kLeftD2 * k) * r.decay - r.denormal_guard;

  const double mod_left =
      r.excursion * std::sin(2.0 * kPi * r.mod_phase_left);
  const double mod_right =
      r.excursion * std::sin(2.0 * kPi * r.mod_phase_right);
  r.mod_phase_left += kModLeftHz / r.rate;
  r.mod_phase_right += kModRightHz / r.rate;
  if (r.mod_phase_left >= 1.0) r.mod_phase_left -= 1.0;
  if (r.mod_phase_right >= 1.0) r.mod_phase_right -= 1.0;

  float left = allpass(r.left_ap1, kLeftAp1 * k + mod_left, -r.decay_g1,
                       x + from_right);
  r.left_d1.push(left);
  left = r.left_d1.at_fraction(kLeftD1 * k);
  r.damp_left = left * (1.0f - r.damping) + r.damp_left * r.damping;
  left = allpass(r.left_ap2, kLeftAp2 * k, r.decay_g2, r.damp_left * r.decay);
  r.left_d2.push(left);

  float right = allpass(r.right_ap1, kRightAp1 * k + mod_right, -r.decay_g1,
                        x + from_left);
  r.right_d1.push(right);
  right = r.right_d1.at_fraction(kRightD1 * k);
  r.damp_right = right * (1.0f - r.damping) + r.damp_right * r.damping;
  right =
      allpass(r.right_ap2, kRightAp2 * k, r.decay_g2, r.damp_right * r.decay);
  r.right_d2.push(right);

  const auto taps = [&r](const TapPoint (&points)[7], double scale) {
    float sum = 0.0f;
    for (const TapPoint& tap : points) {
      sum += static_cast<float>(tap.sign) *
             tap_line(r, tap.line).at_fraction(tap.at * scale + 1.0);
    }
    return sum;
  };
  float sum_left = taps(kLeftTaps, k);
  float sum_right = taps(kRightTaps, k);
  if (r.tap_cross < 1.0f) {
    // A new type reads its taps at new places: crossed from the old ones,
    // where the tail is continuous with what was just heard.
    const float x_new = r.tap_cross;
    sum_left = taps(kLeftTaps, r.tap_scale_from) * (1.0f - x_new) +
               sum_left * x_new;
    sum_right = taps(kRightTaps, r.tap_scale_from) * (1.0f - x_new) +
                sum_right * x_new;
    r.tap_cross = std::min(1.0f, r.tap_cross + r.fade_step);
  }
  out_left = 0.6f * sum_left;
  out_right = 0.6f * sum_right;
}

void clear_tank(FeqReverb& r) {
  r.predelay.clear();
  for (Line& line : r.input) line.clear();
  for (Line* line : {&r.left_ap1, &r.left_d1, &r.left_ap2, &r.left_d2,
                     &r.right_ap1, &r.right_d1, &r.right_ap2, &r.right_d2}) {
    line->clear();
  }
  r.bandwidth_state = 0.0f;
  r.damp_left = r.damp_right = 0.0f;
  r.low_cut.z1 = r.low_cut.z2 = 0.0;
  r.duck_env = 0.0f;
  r.duck_gain = 1.0f;
  r.running = 0;
}

}  // namespace

extern "C" {

void feq_reverb_settings_defaults(FeqReverbSettings* settings) {
  if (settings == nullptr) return;
  settings->enabled = 0;
  settings->type = FEQ_REVERB_PLATE;
  settings->mix_db = -16.0;
  settings->decay_s = 1.8;
  settings->predelay_ms = 30.0;
  settings->tone_hz = 8000.0;
  settings->low_cut_hz = 200.0;
  settings->width = 1.0;
  settings->duck = 0;
  settings->duck_db = 8.0;
}

FeqReverb* feq_reverb_create(double sample_rate, uint32_t channels) {
  if (!(sample_rate > 0.0) || channels == 0) return nullptr;
  auto* r = new (std::nothrow) FeqReverb();
  if (r == nullptr) return nullptr;
  r->rate = sample_rate;
  r->channels = std::min<uint32_t>(channels, FEQ_REVERB_MAX_CHANNELS);
  const double most = sample_rate / kPaperRate * kMaxSize;
  const double swing = kExcursion * sample_rate / kPaperRate;
  try {
    r->predelay.allocate(FEQ_REVERB_PREDELAY_MAX_MS * 0.001 * sample_rate + 2);
    for (int i = 0; i < kDiffusers; ++i) {
      r->input[i].allocate(kInput[i] * most + 2);
    }
    r->left_ap1.allocate(kLeftAp1 * most + swing + 2);
    r->left_d1.allocate(kLeftD1 * most + 2);
    r->left_ap2.allocate(kLeftAp2 * most + 2);
    r->left_d2.allocate(kLeftD2 * most + 2);
    r->right_ap1.allocate(kRightAp1 * most + swing + 2);
    r->right_d1.allocate(kRightD1 * most + 2);
    r->right_ap2.allocate(kRightAp2 * most + 2);
    r->right_d2.allocate(kRightD2 * most + 2);
  } catch (const std::bad_alloc&) {
    delete r;
    return nullptr;
  }
  const double fade_samples = kFadeSeconds * sample_rate;
  r->fade_step = static_cast<float>(1.0 / fade_samples);
  r->wet_coefficient = static_cast<float>(std::exp(-1.0 / fade_samples));
  r->duck_attack = static_cast<float>(
      std::exp(-1.0 / (kDuckAttackSeconds * sample_rate)));
  r->duck_release = static_cast<float>(
      std::exp(-1.0 / (kDuckReleaseSeconds * sample_rate)));
  r->duck_env_release = static_cast<float>(
      std::exp(-1.0 / (kDuckEnvelopeSeconds * sample_rate)));
  feq_reverb_settings_defaults(&r->settings);
  return r;
}

void feq_reverb_destroy(FeqReverb* reverb) { delete reverb; }

void feq_reverb_configure(FeqReverb* r, const FeqReverbSettings* in) {
  if (r == nullptr || in == nullptr) return;
  FeqReverbSettings s = *in;
  s.type = std::min(std::max(s.type, 0), FEQ_REVERB_TYPES - 1);
  s.mix_db = clamp(s.mix_db, FEQ_REVERB_MIX_MIN_DB, FEQ_REVERB_MIX_MAX_DB);
  s.decay_s = clamp(s.decay_s, FEQ_REVERB_DECAY_MIN_S, FEQ_REVERB_DECAY_MAX_S);
  s.predelay_ms = clamp(s.predelay_ms, 0.0, FEQ_REVERB_PREDELAY_MAX_MS);
  s.tone_hz = clamp(s.tone_hz, FEQ_REVERB_TONE_MIN_HZ, FEQ_REVERB_TONE_MAX_HZ);
  s.low_cut_hz =
      clamp(s.low_cut_hz, FEQ_REVERB_LOW_CUT_MIN_HZ, FEQ_REVERB_LOW_CUT_MAX_HZ);
  s.width = clamp(s.width, 0.0, 1.0);
  s.duck_db = clamp(s.duck_db, 0.0, FEQ_REVERB_DUCK_MAX_DB);
  r->settings = s;

  const Voicing& voicing = kVoicings[static_cast<size_t>(s.type)];
  r->scale = r->rate / kPaperRate * voicing.size;
  r->excursion = kExcursion * r->rate / kPaperRate;
  // The bandwidth is a per-sample coefficient at the paper's rate; the same
  // corner at this rate.
  r->bandwidth = static_cast<float>(
      1.0 - std::pow(1.0 - voicing.bandwidth, kPaperRate / r->rate));
  r->input_g1 = static_cast<float>(voicing.input_diffusion_1);
  r->input_g2 = static_cast<float>(voicing.input_diffusion_2);
  r->decay_g1 = static_cast<float>(voicing.decay_diffusion_1);
  // One trip round a half of the tank meets the decay twice: after that
  // many samples the tail is 60 dB down at RT60.
  const double half =
      (kLeftAp1 + kLeftD1 + kLeftAp2 + kLeftD2 + kRightAp1 + kRightD1 +
       kRightAp2 + kRightD2) *
      0.5 * r->scale;
  const double decay =
      std::pow(10.0, -3.0 * half / (2.0 * s.decay_s * r->rate));
  r->decay = static_cast<float>(decay);
  r->decay_g2 = static_cast<float>(clamp(decay + 0.15, 0.25, 0.5));
  r->damping = static_cast<float>(std::exp(-2.0 * kPi * s.tone_hz / r->rate));
  r->predelay_samples = s.predelay_ms * 0.001 * r->rate;
  r->target_wet = static_cast<float>(std::pow(10.0, s.mix_db / 20.0));
  r->width_same = static_cast<float>((1.0 + s.width) * 0.5);
  r->width_cross = static_cast<float>((1.0 - s.width) * 0.5);
  r->duck_floor =
      s.duck != 0 ? static_cast<float>(std::pow(10.0, -s.duck_db / 20.0))
                  : 1.0f;
  high_pass(r->low_cut, s.low_cut_hz, r->rate);
}

void feq_reverb_process(FeqReverb* r, float* const* channels,
                        uint32_t frames) {
  if (r == nullptr || channels == nullptr) return;
  const bool on = r->settings.enabled != 0;
  // Off and with nothing left to play out: the input exactly.
  if (!on && r->running == 0) return;
  const uint32_t count = r->channels;
  const bool stereo = count >= 2;
  const float wet_c = r->wet_coefficient;
  for (uint32_t i = 0; i < frames; ++i) {
    const float dry = stereo ? 0.5f * (channels[0][i] + channels[1][i])
                             : channels[0][i];
    // What feeds the tail: the voice while on, nothing while it plays out.
    const float feed = on ? r->low_cut.run(dry) : 0.0f;
    r->predelay.push(feed);
    float delayed = r->predelay.at_fraction(r->predelay_samples + 1.0);
    if (r->predelay_cross < 1.0f) {
      const float old = r->predelay.at_fraction(r->predelay_from + 1.0);
      delayed = old + (delayed - old) * r->predelay_cross;
      r->predelay_cross = std::min(1.0f, r->predelay_cross + r->fade_step);
    }
    // The diffusers recirculate as well: the same guard keeps them out of
    // denormals in a silence.
    r->bandwidth_state = r->bandwidth * (delayed + r->denormal_guard) +
                         (1.0f - r->bandwidth) * r->bandwidth_state;
    float diffused = r->bandwidth_state;
    diffused = allpass(r->input[0], kInput[0] * r->scale, r->input_g1, diffused);
    diffused = allpass(r->input[1], kInput[1] * r->scale, r->input_g1, diffused);
    diffused = allpass(r->input[2], kInput[2] * r->scale, r->input_g2, diffused);
    diffused = allpass(r->input[3], kInput[3] * r->scale, r->input_g2, diffused);
    for (int d = 4; d < kDiffusers; ++d) {
      diffused = allpass(r->input[d], kInput[d] * r->scale,
                         static_cast<float>(kExtraDiffusion), diffused);
    }
    float left = 0.0f;
    float right = 0.0f;
    tank(*r, diffused, left, right);

    // The dry voice's envelope says when it is talking.
    if (r->settings.duck != 0) {
      const float level = std::fabs(dry);
      r->duck_env = level > r->duck_env
                        ? level
                        : r->duck_env * r->duck_env_release;
      const double env_db =
          20.0 * std::log10(std::max(1e-9, static_cast<double>(r->duck_env)));
      const float presence = static_cast<float>(
          clamp((env_db - kDuckThresholdDb) / 6.0, 0.0, 1.0));
      const float target = 1.0f - presence * (1.0f - r->duck_floor);
      const float c = target < r->duck_gain ? r->duck_attack : r->duck_release;
      r->duck_gain = target + (r->duck_gain - target) * c;
    } else {
      r->duck_gain = 1.0f + (r->duck_gain - 1.0f) * r->duck_release;
    }
    r->wet = r->target_wet + (r->wet - r->target_wet) * wet_c;
    if (on) {
      r->fade = std::min(1.0f, r->fade + r->fade_step);
    } else {
      r->fade = std::max(0.0f, r->fade - r->fade_step);
    }
    const float gain = r->wet * r->duck_gain * r->fade;
    if (stereo) {
      channels[0][i] += gain * (r->width_same * left + r->width_cross * right);
      channels[1][i] += gain * (r->width_same * right + r->width_cross * left);
    } else {
      channels[0][i] += gain * 0.5f * (left + right);
    }
  }
  if (on) {
    r->running = 1;
  } else if (r->fade <= 0.0f) {
    // Played out: the tank is let go, and the next block is the input.
    clear_tank(*r);
  }
}

void feq_reverb_reset(FeqReverb* r) {
  if (r == nullptr) return;
  clear_tank(*r);
  r->wet = r->target_wet;
  r->fade = 1.0f;
  r->predelay_cross = 1.0f;
  r->tap_cross = 1.0f;
}

void feq_reverb_transfer(FeqReverb* prepared, FeqReverb* previous) {
  if (prepared == nullptr || previous == nullptr ||
      prepared->rate != previous->rate ||
      prepared->left_d1.data.size() != previous->left_d1.data.size()) {
    return;
  }
  if (previous->running == 0) {
    // Nothing playing: the prepared stage starts as it is, its wet at its
    // own level rather than gliding up from nothing.
    prepared->wet = prepared->target_wet;
    return;
  }
  FeqReverb& p = *prepared;
  FeqReverb& q = *previous;
  std::swap(p.predelay, q.predelay);
  for (size_t i = 0; i < p.input.size(); ++i) std::swap(p.input[i], q.input[i]);
  std::swap(p.left_ap1, q.left_ap1);
  std::swap(p.left_d1, q.left_d1);
  std::swap(p.left_ap2, q.left_ap2);
  std::swap(p.left_d2, q.left_d2);
  std::swap(p.right_ap1, q.right_ap1);
  std::swap(p.right_d1, q.right_d1);
  std::swap(p.right_ap2, q.right_ap2);
  std::swap(p.right_d2, q.right_d2);
  p.bandwidth_state = q.bandwidth_state;
  p.damp_left = q.damp_left;
  p.damp_right = q.damp_right;
  p.mod_phase_left = q.mod_phase_left;
  p.mod_phase_right = q.mod_phase_right;
  p.low_cut.z1 = q.low_cut.z1;
  p.low_cut.z2 = q.low_cut.z2;
  p.duck_env = q.duck_env;
  p.duck_gain = q.duck_gain;
  p.wet = q.wet;
  p.running = 1;
  p.fade = q.fade;
  if (p.scale != q.scale) {
    // Every length moved: the tail read at its new places would jump, so
    // the output crosses from the old places over 20 ms. Fading the level
    // instead dropped the old tail to nothing at the seam, a step of its
    // own at 352.8 and 384 kHz.
    p.tap_scale_from = q.scale;
    p.tap_cross = 0.0f;
  }
  if (p.predelay_samples != q.predelay_samples) {
    p.predelay_from = q.predelay_samples;
    p.predelay_cross = 0.0f;
  }
}

}  // extern "C"

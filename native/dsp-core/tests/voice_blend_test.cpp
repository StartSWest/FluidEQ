/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * What the voice cleaner plays when its worker is late, and how a stream
 * starts (`denoise_voice_blend.h`), at all eight shared-mode rates.
 *
 * Each claim stands beside the control that the old code was: a late block
 * used to be the delayed input untouched, so a late block in the room's
 * silence came out as loud as the room the cleaner had been taking away, and
 * met its neighbours with a step. A blend that only passed the first check
 * by muting everything would fail the speech check beside it.
 */

#include <algorithm>
#include <cmath>
#include <cstddef>
#include <cstdio>
#include <vector>

#include "../src/denoise_voice_blend.h"
#include "dsp_test_support.h"

namespace {

using feq_test::check;
constexpr double kPi = 3.14159265358979323846;

uint32_t block_frames(double rate) {
  return static_cast<uint32_t>(std::lround(rate * 0.01));
}

double rms(const std::vector<float>& samples) {
  double sum = 0.0;
  for (const float sample : samples) sum += static_cast<double>(sample) * sample;
  return samples.empty() ? 0.0 : std::sqrt(sum / static_cast<double>(samples.size()));
}

double db(double ratio) { return 20.0 * std::log10(std::max(ratio, 1e-12)); }

/**
 * The level past a block's first millisecond. The seam leans the start of a
 * late block toward the sample before it, which is its job; the level a late
 * block plays at is what follows.
 */
double rms_past_seam(const std::vector<float>& samples, double rate) {
  const size_t skip = static_cast<size_t>(rate * kVoiceSeamMs / 1000.0) + 1;
  return rms(std::vector<float>(samples.begin() + static_cast<std::ptrdiff_t>(skip),
                                samples.end()));
}

/** A deterministic room: white-ish noise at `level`. */
std::vector<float> room(uint32_t frames, double level, uint32_t seed) {
  std::vector<float> out(frames);
  uint32_t state = seed * 2654435761u + 1u;
  for (uint32_t i = 0; i < frames; ++i) {
    state = state * 1664525u + 1013904223u;
    out[i] = static_cast<float>(
        level * (static_cast<double>(state >> 8) / 8388608.0 - 1.0));
  }
  return out;
}

/** A stream past its fade-in, so only what a block does is measured. */
VoiceBlend settled(double rate) {
  VoiceBlend blend;
  voice_blend_reset(blend, rate, 0);
  const uint32_t frames = block_frames(rate);
  std::vector<float> zero(frames, 0.0f);
  std::vector<float> out(frames);
  for (int warm = 0; warm < 4; ++warm) {
    voice_blend_block(blend, out.data(), zero.data(), zero.data(), frames, 1.0);
  }
  return blend;
}

/**
 * In the room's silence the cleaner takes 26 dB; a late block keeps that.
 * Control: the old late block, the room untouched, 26 dB louder.
 */
void late_block_in_the_room_keeps_the_cleaners_level(double rate) {
  const uint32_t frames = block_frames(rate);
  VoiceBlend blend = settled(rate);
  std::vector<float> out(frames);
  std::vector<float> cleaned(frames);
  for (uint32_t block = 0; block < 6; ++block) {
    const std::vector<float> dry = room(frames, 0.1, block + 1);
    for (uint32_t i = 0; i < frames; ++i) cleaned[i] = dry[i] * 0.05f;
    voice_blend_block(blend, out.data(), dry.data(), cleaned.data(), frames, 1.0);
  }
  const std::vector<float> dry = room(frames, 0.1, 99);
  voice_blend_block(blend, out.data(), dry.data(), nullptr, frames, 1.0);
  const double heard = db(rms_past_seam(out, rate) / rms_past_seam(dry, rate));
  check(std::fabs(heard - db(0.05)) < 0.5,
        "late block in the room plays at the cleaner's own -26 dB");
  // Control: the old code played `dry` itself, 0 dB.
  check(db(rms(dry) / rms(dry)) - heard > 25.0,
        "control: the old late block was the room 26 dB louder");
}

/** While a voice speaks the cleaner takes nothing, and a late block neither. */
void late_block_in_a_word_keeps_the_word(double rate) {
  const uint32_t frames = block_frames(rate);
  VoiceBlend blend = settled(rate);
  std::vector<float> out(frames);
  std::vector<float> word(frames);
  // One continuous word across five blocks, the last of them late.
  for (uint32_t block = 0; block < 5; ++block) {
    for (uint32_t i = 0; i < frames; ++i) {
      word[i] = static_cast<float>(
          0.4 * std::sin(2.0 * kPi * 220.0 * (block * frames + i) / rate));
    }
    voice_blend_block(blend, out.data(), word.data(),
                      block < 4 ? word.data() : nullptr, frames, 1.0);
  }
  check(std::fabs(db(rms(out) / rms(word))) < 0.2,
        "late block in a word keeps the word at its level");
}

/** The network returning a hair more never lifts a late block. */
void late_block_is_never_lifted(double rate) {
  const uint32_t frames = block_frames(rate);
  VoiceBlend blend = settled(rate);
  std::vector<float> out(frames);
  std::vector<float> cleaned(frames);
  const std::vector<float> dry = room(frames, 0.1, 7);
  for (uint32_t i = 0; i < frames; ++i) cleaned[i] = dry[i] * 1.3f;
  voice_blend_block(blend, out.data(), dry.data(), cleaned.data(), frames, 1.0);
  const std::vector<float> next = room(frames, 0.1, 8);
  voice_blend_block(blend, out.data(), next.data(), nullptr, frames, 1.0);
  check(rms_past_seam(out, rate) <= rms_past_seam(next, rate) * 1.0001,
        "a late block is never louder than its input");
}

/**
 * Cleaned and late blocks meet without a step, both ways. The cleaned signal
 * here is the input a quarter turn later, so the two disagree at every seam.
 * Control: the same blocks spliced as they come.
 */
void seams_have_no_step(double rate) {
  const uint32_t frames = block_frames(rate);
  VoiceBlend blend = settled(rate);
  const double hz = 300.0;
  // The largest step a 300 Hz tone at 0.5 takes between two samples, and a
  // little room for the lean itself.
  const double natural = 0.5 * 2.0 * kPi * hz / rate;
  std::vector<float> dry(frames);
  std::vector<float> cleaned(frames);
  std::vector<float> out(frames);
  std::vector<float> stream;
  std::vector<float> spliced;
  for (uint32_t block = 0; block < 6; ++block) {
    for (uint32_t i = 0; i < frames; ++i) {
      const double t = static_cast<double>(block * frames + i) / rate;
      dry[i] = static_cast<float>(0.5 * std::sin(2.0 * kPi * hz * t));
      cleaned[i] = static_cast<float>(0.5 * std::cos(2.0 * kPi * hz * t));
    }
    const bool late = block == 2 || block == 3;
    voice_blend_block(blend, out.data(), dry.data(), late ? nullptr : cleaned.data(),
                      frames, 1.0);
    stream.insert(stream.end(), out.begin(), out.end());
    // The old late block: the input itself, with a held gain of 1 here.
    const std::vector<float>& old = late ? dry : cleaned;
    spliced.insert(spliced.end(), old.begin(), old.end());
  }
  auto worst_step_at_seams = [&](const std::vector<float>& signal) {
    double worst = 0.0;
    for (const uint32_t seam : {2u, 4u}) {
      const size_t at = static_cast<size_t>(seam) * frames;
      for (size_t i = at; i < at + 4 && i < signal.size(); ++i) {
        worst = std::max(worst, std::fabs(static_cast<double>(signal[i]) - signal[i - 1]));
      }
    }
    return worst;
  };
  const double seam_step = (0.5 * std::sqrt(2.0)) / std::max(1.0, rate * 0.001);
  check(worst_step_at_seams(stream) <= natural + seam_step + 1e-4,
        "cleaned and late blocks meet without a step");
  check(worst_step_at_seams(spliced) > 0.2,
        "control: spliced as they come, they meet with a step");
}

/**
 * A new stream is silent for its latency, then comes in on 20 ms. Control:
 * the same signal unfaded steps from nothing to its full level at once.
 */
void stream_fades_in_after_its_delay(double rate) {
  const uint32_t frames = block_frames(rate);
  const uint32_t latency = frames * 2;
  VoiceBlend blend;
  voice_blend_reset(blend, rate, latency);
  std::vector<float> out(frames);
  std::vector<float> stream;
  std::vector<float> full;
  for (uint32_t block = 0; block < 6; ++block) {
    std::vector<float> delayed(frames, 0.0f);
    for (uint32_t i = 0; i < frames; ++i) {
      const uint64_t position = static_cast<uint64_t>(block) * frames + i;
      if (position >= latency) delayed[i] = 0.5f;
    }
    voice_blend_block(blend, out.data(), delayed.data(), delayed.data(), frames, 1.0);
    stream.insert(stream.end(), out.begin(), out.end());
    full.insert(full.end(), delayed.begin(), delayed.end());
  }
  double worst = 0.0;
  for (size_t i = 1; i < stream.size(); ++i) {
    worst = std::max(worst, std::fabs(static_cast<double>(stream[i]) - stream[i - 1]));
  }
  const double fade = rate * 0.02;
  check(worst <= 0.5 * kPi / (2.0 * fade) + 1e-6,
        "a new stream comes in on a raised cosine, no step");
  check(std::fabs(stream.back() - 0.5f) < 1e-6, "and reaches its full level");
  check(std::fabs(full[latency] - full[latency - 1]) > 0.49,
        "control: unfaded, it steps from nothing to its level at once");
}

/** Amount 0 is the delayed input to the bit, late or not. */
void amount_zero_is_the_input(double rate) {
  const uint32_t frames = block_frames(rate);
  VoiceBlend blend = settled(rate);
  const std::vector<float> dry = room(frames, 0.2, 3);
  const std::vector<float> cleaned(frames, 0.0f);
  std::vector<float> out(frames);
  voice_blend_block(blend, out.data(), dry.data(), cleaned.data(), frames, 0.0);
  bool same = true;
  voice_blend_block(blend, out.data(), dry.data(), nullptr, frames, 0.0);
  for (uint32_t i = 0; i < frames; ++i) same = same && out[i] == dry[i];
  check(same, "amount 0 passes the delayed input untouched");
}

}  // namespace

int main() {
  for (const double rate : {44100.0, 48000.0, 88200.0, 96000.0, 176400.0,
                            192000.0, 352800.0, 384000.0}) {
    std::printf("rate %.1f kHz\n", rate / 1000.0);
    late_block_in_the_room_keeps_the_cleaners_level(rate);
    late_block_in_a_word_keeps_the_word(rate);
    late_block_is_never_lifted(rate);
    seams_have_no_step(rate);
    stream_fades_in_after_its_delay(rate);
    amount_zero_is_the_input(rate);
  }
  return feq_test::finish();
}

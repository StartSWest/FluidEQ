/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * A rack band kept to one ear plays on that ear alone (Ivan, 2026-10-13,
 * "EQ per ear"; `FeqChainEqBand::ear`).
 *
 * Measured as the level of a 1 kHz tone on each channel after a +12 dB bell
 * there, in every way the rack's EQ runs: the serial and parallel cascades,
 * oversampled, through the linear-phase kernel, and as a dynamic band. Each
 * case stands beside the same band on both ears as its positive control, so
 * an untouched right ear is the ear and not a band that did nothing. Mid and
 * Sides have no left or right, and there the ear is ignored: the output is
 * the both-ear band's sample for sample.
 *
 * A band moved from one ear to the other fades like any other edit: on a
 * 55 Hz + 700 Hz programme, whatever the move leaves above 8 kHz is held to
 * the steady floor on both channels, in the cascade and through the kernel,
 * as the engine hands a rack over and as the Library's host configures one.
 *
 * And the wire: the band's switch word carries the ear — 2 left, 3 right —
 * on a line the TypeScript encoder wrote, while 1 is on, on both.
 */

#include <algorithm>
#include <cmath>
#include <cstdio>
#include <functional>
#include <iterator>
#include <memory>
#include <vector>

#include "dsp_test_support.h"
#include "fluideq/chain.h"
#include "fluideq/primitives.h"
#include "room_contract_fixture.h"

using feq_test::check;
using feq_test::kPi;
using feq_test::kRate;

namespace {

constexpr uint32_t kBlock = 256;
using Rack = std::unique_ptr<FeqChain, decltype(&feq_chain_destroy)>;
using Edit = std::function<void(FeqChainSettings&)>;

double to_db(double level) { return 20.0 * std::log10(std::max(level, 1e-12)); }

/** One +12 dB bell at 1 kHz, on `ear` (0 both, 1 left, 2 right). */
FeqChainSettings bell_on(int ear, const Edit& edit) {
  FeqChainSettings settings{};
  feq_chain_settings_defaults(&settings);
  settings.eq.enabled = 1;
  settings.eq.band_count = 1;
  FeqChainEqBand& band = settings.eq.bands[0];
  band.enabled = 1;
  band.type = FEQ_FILTER_PK;
  band.frequency = 1000.0;
  band.gain_db = 12.0;
  band.quality = 1.0;
  band.ear = ear;
  edit(settings);
  return settings;
}

struct Pair {
  std::vector<float> left;
  std::vector<float> right;
};

/** A tone on both channels through one rack, configured once. */
Pair tone_through(const FeqChainSettings& settings, double frequency,
                  double level, size_t frames) {
  Pair out{std::vector<float>(frames), {}};
  for (size_t at = 0; at < frames; ++at) {
    out.left[at] = static_cast<float>(
        level * std::sin(2 * kPi * frequency * static_cast<double>(at) / kRate));
  }
  out.right = out.left;
  Rack rack(feq_chain_create(kRate, 2, kBlock), &feq_chain_destroy);
  feq_chain_configure(rack.get(), &settings);
  for (size_t at = 0; at + kBlock <= frames; at += kBlock) {
    float* planes[2] = {out.left.data() + at, out.right.data() + at};
    feq_chain_process(rack.get(), planes, kBlock);
  }
  return out;
}

/** The level of the last half against the tone that went in, in dB. */
double gain_of(const std::vector<float>& samples, double level) {
  double energy = 0.0;
  const size_t from = samples.size() / 2;
  for (size_t at = from; at < samples.size(); ++at) {
    energy += static_cast<double>(samples[at]) * static_cast<double>(samples[at]);
  }
  const double rms =
      std::sqrt(energy / static_cast<double>(samples.size() - from));
  return to_db(rms / (level / std::sqrt(2.0)));
}

void keeps_its_ear(const Edit& edit, const char* how) {
  constexpr double kLevel = 0.05;
  const size_t frames = static_cast<size_t>(kRate * 2);
  const Pair left = tone_through(bell_on(1, edit), 1000.0, kLevel, frames);
  const Pair right = tone_through(bell_on(2, edit), 1000.0, kLevel, frames);
  const Pair both = tone_through(bell_on(0, edit), 1000.0, kLevel, frames);
  const double l_l = gain_of(left.left, kLevel);
  const double l_r = gain_of(left.right, kLevel);
  const double r_l = gain_of(right.left, kLevel);
  const double r_r = gain_of(right.right, kLevel);
  const double b_l = gain_of(both.left, kLevel);
  const double b_r = gain_of(both.right, kLevel);
  char line[200];
  std::snprintf(line, sizeof line,
                "%s: left band %+.2f / %+.2f dB, right band %+.2f / %+.2f, "
                "both %+.2f / %+.2f",
                how, l_l, l_r, r_l, r_r, b_l, b_r);
  // The control: the same band on both ears lifts both by its 12 dB.
  check(std::fabs(b_l - 12.0) < 0.5 && std::fabs(b_r - 12.0) < 0.5, line);
  // Kept to one ear: that ear as the control's, the other untouched.
  check(std::fabs(l_l - b_l) < 0.05 && std::fabs(l_r) < 0.05, line);
  check(std::fabs(r_r - b_r) < 0.05 && std::fabs(r_l) < 0.05, line);
}

/** Mid or Sides: no ear to keep a band to, so it is the both-ear band. */
void ignored_without_a_stereo_image(FeqStereoMode stereo, const char* how) {
  const Edit edit = [stereo](FeqChainSettings& s) { s.eq.stereo = stereo; };
  const size_t frames = static_cast<size_t>(kRate);
  const Pair kept = tone_through(bell_on(1, edit), 1000.0, 0.05, frames);
  const Pair both = tone_through(bell_on(0, edit), 1000.0, 0.05, frames);
  const bool same =
      std::equal(kept.left.begin(), kept.left.end(), both.left.begin()) &&
      std::equal(kept.right.begin(), kept.right.end(), both.right.begin());
  // The control: under Mid the band does move this centred tone.
  const double moved = gain_of(both.left, 0.05);
  char line[160];
  std::snprintf(line, sizeof line,
                "%s: a left band plays as on both ears (%s), %+.2f dB", how,
                same ? "the same samples" : "different samples", moved);
  check(same, line);
  if (stereo == FEQ_STEREO_MID) {
    check(moved > 6.0, line);
  }
}

/* --------------------------------------------- moving between the ears -- */

std::vector<float> programme(size_t frames) {
  std::vector<float> samples(frames);
  for (size_t at = 0; at < frames; ++at) {
    const double t = static_cast<double>(at) / kRate;
    samples[at] = static_cast<float>(
        0.3 * (0.7 * std::sin(2 * kPi * 55 * t) +
               0.3 * std::sin(2 * kPi * 700 * t + 0.4)));
  }
  return samples;
}

/** The loudest sample above 8 kHz before, around and after `change`. */
struct Residue {
  double before;
  double around;
  double after;
};

Residue residue(std::vector<float> samples, size_t change) {
  const FeqBiquadCoefficients high =
      feq_biquad_coefficients(FEQ_FILTER_HPQ, 8000.0, 0.0, 0.707, kRate);
  FeqBiquadState first{};
  FeqBiquadState second{};
  const auto frames = static_cast<uint32_t>(samples.size());
  feq_biquad_process(&first, samples.data(), frames, &high);
  feq_biquad_process(&second, samples.data(), frames, &high);
  const auto peak = [&](size_t from, size_t to) {
    double loudest = 0.0;
    for (size_t at = from; at < to; ++at) {
      loudest = std::max(loudest, std::fabs(static_cast<double>(samples[at])));
    }
    return to_db(loudest);
  };
  return {peak(change - 24000, change - 4800), peak(change - 2400, change + 9600),
          peak(change + 24000, change + 43200)};
}

enum class Swap { kHandover, kConfigure };

/** The programme through `from`, changed to `to` at `change`. */
Pair changing(const FeqChainSettings& from, const FeqChainSettings& to,
              size_t change, size_t frames, Swap swap) {
  Pair out{programme(frames), {}};
  out.right = out.left;
  std::vector<Rack> chains;
  chains.emplace_back(feq_chain_create(kRate, 2, kBlock), &feq_chain_destroy);
  feq_chain_configure(chains.back().get(), &from);
  for (size_t at = 0; at + kBlock <= frames; at += kBlock) {
    if (at == change) {
      if (swap == Swap::kHandover) {
        Rack incoming(feq_chain_create(kRate, 2, kBlock), &feq_chain_destroy);
        feq_chain_configure(incoming.get(), &to);
        std::vector<float> silence(kBlock * 2, 0.0f);
        float* quiet[2] = {silence.data(), silence.data() + kBlock};
        feq_chain_process(incoming.get(), quiet, kBlock);
        feq_chain_reset(incoming.get(), FEQ_CHAIN_RESET_STREAM_START);
        feq_chain_transfer_state(incoming.get(), chains.back().get());
        chains.push_back(std::move(incoming));
      } else {
        feq_chain_configure(chains.back().get(), &to);
      }
    }
    float* planes[2] = {out.left.data() + at, out.right.data() + at};
    feq_chain_process(chains.back().get(), planes, kBlock);
  }
  return out;
}

/** The 700 Hz bell +6 dB, moved from the left ear to the right. */
FeqChainSettings move_rack(int ear, const Edit& edit) {
  FeqChainSettings settings = bell_on(ear, edit);
  settings.eq.bands[0].frequency = 700.0;
  settings.eq.bands[0].gain_db = 6.0;
  return settings;
}

void moving_ears_is_silent(const Edit& edit, const char* how) {
  const size_t frames = static_cast<size_t>(kRate * 2);
  const size_t change = static_cast<size_t>(kRate) / kBlock * kBlock;
  for (const Swap swap : {Swap::kHandover, Swap::kConfigure}) {
    const Pair out = changing(move_rack(1, edit), move_rack(2, edit), change,
                              frames, swap);
    const char* way = swap == Swap::kHandover ? "engine handover" : "host configure";
    for (int channel = 0; channel < 2; ++channel) {
      const Residue found = residue(channel == 0 ? out.left : out.right, change);
      char line[200];
      std::snprintf(line, sizeof line,
                    "%s, %s, %s ear: %.1f dBFS around, %.1f / %.1f steady", how,
                    way, channel == 0 ? "left" : "right", found.around,
                    found.before, found.after);
      check(found.around <= std::max(found.before, found.after) + 3.0, line);
    }
    // And the move happened: the right ear now carries the band, the left
    // does not — against one rack of each all along.
    const Pair settled_right =
        changing(move_rack(2, edit), move_rack(2, edit), change, frames, swap);
    double worst = 0.0;
    for (size_t at = frames - static_cast<size_t>(kRate / 2); at < frames - kBlock;
         ++at) {
      worst = std::max(worst, std::fabs(static_cast<double>(out.left[at]) -
                                        static_cast<double>(settled_right.left[at])));
      worst = std::max(worst, std::fabs(static_cast<double>(out.right[at]) -
                                        static_cast<double>(settled_right.right[at])));
    }
    char line[160];
    std::snprintf(line, sizeof line, "%s, %s: moved, %.1f dB from the right-ear rack",
                  how, way, to_db(worst));
    check(to_db(worst) < -45.0, line);
  }
}

/* -------------------------------------------------------------- the wire -- */

void reads_the_ear_off_the_wire() {
  std::vector<double> wire(std::begin(kRoomContractFixture),
                           std::end(kRoomContractFixture));
  const auto bands = static_cast<uint32_t>(wire[FEQ_CHAIN_PARAM_LEAD - 1]);
  check(bands > 0, "the encoder's line carries a band to keep to an ear");
  const double words[4] = {1.0, 2.0, 3.0, 0.0};
  const int ears[4] = {0, 1, 2, 0};
  const int enabled[4] = {1, 1, 1, 0};
  for (int which = 0; which < 4; ++which) {
    wire[FEQ_CHAIN_PARAM_LEAD] = words[which];
    FeqChainSettings settings{};
    const bool read = feq_chain_settings_decode(
                          wire.data(), static_cast<uint32_t>(wire.size()),
                          &settings) != 0;
    char line[120];
    std::snprintf(line, sizeof line,
                  "switch word %.0f: read %d, on %d, ear %d", words[which],
                  read ? 1 : 0, settings.eq.bands[0].enabled,
                  settings.eq.bands[0].ear);
    check(read && settings.eq.bands[0].enabled == enabled[which] &&
              settings.eq.bands[0].ear == ears[which],
          line);
  }
}

}  // namespace

int main() {
  std::printf("a rack band kept to one ear plays on that ear alone\n");
  const Edit serial = [](FeqChainSettings&) {};
  keeps_its_ear(serial, "serial cascade");
  keeps_its_ear([](FeqChainSettings& s) { s.eq.engine = FEQ_EQ_PARALLEL; },
                "parallel cascade");
  keeps_its_ear([](FeqChainSettings& s) { s.eq.oversample = 2; },
                "oversampled 2x");
  keeps_its_ear([](FeqChainSettings& s) { s.eq.phase = FEQ_PHASE_LINEAR; },
                "linear phase");
  // A dynamic band with its threshold far under the tone: open all the way.
  keeps_its_ear(
      [](FeqChainSettings& s) {
        s.eq.bands[0].dynamic = 1;
        s.eq.bands[0].threshold_db = -80.0;
      },
      "dynamic");
  keeps_its_ear(
      [](FeqChainSettings& s) {
        s.eq.bands[0].dynamic = 1;
        s.eq.bands[0].threshold_db = -80.0;
        s.eq.phase = FEQ_PHASE_LINEAR;
      },
      "dynamic, linear phase");
  ignored_without_a_stereo_image(FEQ_STEREO_MID, "Mid");
  ignored_without_a_stereo_image(FEQ_STEREO_SIDE, "Sides");

  std::printf("a band moved to the other ear fades\n");
  moving_ears_is_silent(serial, "cascade");
  moving_ears_is_silent([](FeqChainSettings& s) { s.eq.phase = FEQ_PHASE_LINEAR; },
                        "linear phase");

  std::printf("the switch word carries the ear\n");
  reads_the_ear_off_the_wire();
  return feq_test::finish();
}

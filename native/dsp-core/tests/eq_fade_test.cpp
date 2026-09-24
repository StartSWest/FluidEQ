/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Every change to the rack's EQ fades, every band keeps its history, and the
 * Treble choice reaches the sound (`chain_eq_fade.cpp`, `eq.matched`).
 *
 * The programme is 55 Hz and 700 Hz and nothing above either, so whatever a
 * change leaves above 8 kHz is the change itself. Before the fade, switching
 * a band on under it left -37 dBFS there where the steady sound has -106;
 * every case below is held to within 3 dB of the steady residue on either
 * side of the change, both as the engine hands a rack to a new chain and as
 * the Library's host configures one in place — a second change arriving
 * while the first is still crossing among them.
 *
 * Two positive controls stand beside that null result: the detector finds a
 * click as small as -70 dBFS put into the same programme, and 50 ms after
 * each change the rack is the new rack — equal to one built with the new
 * settings from the start, and audibly not the old one.
 */

#include <algorithm>
#include <cmath>
#include <cstdio>
#include <functional>
#include <memory>
#include <optional>
#include <vector>

#include "dsp_test_support.h"
#include "fluideq/chain.h"
#include "fluideq/primitives.h"

using feq_test::check;
using feq_test::kPi;
using feq_test::kRate;

namespace {

constexpr uint32_t kBlock = 256;
using Rack = std::unique_ptr<FeqChain, decltype(&feq_chain_destroy)>;
using Edit = std::function<void(FeqChainSettings&)>;

/** Three bands, as a rack being worked on: bass, the middle, treble. */
FeqChainSettings rack_of(const Edit& edit) {
  FeqChainSettings settings{};
  feq_chain_settings_defaults(&settings);
  settings.eq.enabled = 1;
  settings.eq.matched = 1;
  settings.eq.band_count = 3;
  const double frequency[3] = {60.0, 700.0, 12000.0};
  for (uint32_t band = 0; band < 3; ++band) {
    settings.eq.bands[band].enabled = 1;
    settings.eq.bands[band].type = FEQ_FILTER_PK;
    settings.eq.bands[band].frequency = frequency[band];
    settings.eq.bands[band].gain_db = 3.0;
    settings.eq.bands[band].quality = 1.0;
  }
  edit(settings);
  return settings;
}

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

double to_db(double level) { return 20.0 * std::log10(std::max(level, 1e-12)); }

struct Residue {
  double before;
  double around;
  double after;
};

/** The loudest sample above 8 kHz before, around and after `change`. */
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
  return {peak(change - 24000, change - 4800), peak(change - 2400, change + 4800),
          peak(change + 4800, change + 24000)};
}

/** The programme through one rack, configured once. */
std::vector<float> through(const FeqChainSettings& settings, size_t frames) {
  std::vector<float> left = programme(frames);
  std::vector<float> right = left;
  Rack rack(feq_chain_create(kRate, 2, kBlock), &feq_chain_destroy);
  feq_chain_configure(rack.get(), &settings);
  for (size_t at = 0; at + kBlock <= frames; at += kBlock) {
    float* planes[2] = {left.data() + at, right.data() + at};
    feq_chain_process(rack.get(), planes, kBlock);
  }
  return left;
}

/** How a new rack reaches the sound: the engine builds a chain for it and
 * hands the playing one's state over; the Library's host configures its one
 * chain in place. */
enum class Swap { kHandover, kConfigure };

/** The programme through `racks[0]`, changed to each next rack at the
 * matching entry of `changes`. */
std::vector<float> changing(const std::vector<FeqChainSettings>& racks,
                            const std::vector<size_t>& changes, size_t frames,
                            Swap swap) {
  std::vector<float> left = programme(frames);
  std::vector<float> right = left;
  std::vector<Rack> chains;
  chains.emplace_back(feq_chain_create(kRate, 2, kBlock), &feq_chain_destroy);
  feq_chain_configure(chains.back().get(), &racks[0]);
  size_t next = 0;
  for (size_t at = 0; at + kBlock <= frames; at += kBlock) {
    if (next < changes.size() && at == changes[next]) {
      ++next;
      if (swap == Swap::kHandover) {
        Rack incoming(feq_chain_create(kRate, 2, kBlock), &feq_chain_destroy);
        feq_chain_configure(incoming.get(), &racks[next]);
        // Warmed as the engine warms a chain it is about to swap in.
        std::vector<float> silence(kBlock * 2, 0.0f);
        float* quiet[2] = {silence.data(), silence.data() + kBlock};
        feq_chain_process(incoming.get(), quiet, kBlock);
        feq_chain_reset(incoming.get(), FEQ_CHAIN_RESET_STREAM_START);
        feq_chain_transfer_state(incoming.get(), chains.back().get());
        chains.push_back(std::move(incoming));
      } else {
        feq_chain_configure(chains.back().get(), &racks[next]);
      }
    }
    float* planes[2] = {left.data() + at, right.data() + at};
    feq_chain_process(chains.back().get(), planes, kBlock);
  }
  return left;
}

double largest_difference(const std::vector<float>& left,
                          const std::vector<float>& right, size_t from) {
  double largest = 0.0;
  for (size_t at = from; at + kBlock < left.size(); ++at) {
    largest = std::max(largest, std::fabs(static_cast<double>(left[at]) -
                                          static_cast<double>(right[at])));
  }
  return to_db(largest);
}

void change_is_silent(const Edit& from, const Edit& to, const char* what) {
  const size_t frames = static_cast<size_t>(kRate * 2);
  const size_t change = static_cast<size_t>(kRate) / kBlock * kBlock;
  const FeqChainSettings old_rack = rack_of(from);
  const FeqChainSettings new_rack = rack_of(to);
  char line[160];

  const Residue engine = residue(
      changing({old_rack, new_rack}, {change}, frames, Swap::kHandover), change);
  std::snprintf(line, sizeof line,
                "%s, engine handover: %.1f dBFS around, %.1f / %.1f steady", what,
                engine.around, engine.before, engine.after);
  check(engine.around <= std::max(engine.before, engine.after) + 3.0, line);

  const std::vector<float> host =
      changing({old_rack, new_rack}, {change}, frames, Swap::kConfigure);
  const Residue configured = residue(host, change);
  std::snprintf(line, sizeof line,
                "%s, host configure: %.1f dBFS around, %.1f / %.1f steady", what,
                configured.around, configured.before, configured.after);
  check(configured.around <= std::max(configured.before, configured.after) + 3.0,
        line);

  // 50 ms on, the rack is the new one, and not the old one.
  const double to_new =
      largest_difference(host, through(new_rack, frames), change + 2400);
  const double to_old =
      largest_difference(host, through(old_rack, frames), change + 2400);
  std::snprintf(line, sizeof line,
                "%s: 50 ms on, %.1f dB from the new rack, %.1f from the old", what,
                to_new, to_old);
  check(to_new < -45.0 && to_old > to_new + 20.0, line);
}

/**
 * A second change while the first is still crossing, 11 ms into its 20 — the
 * next step of a drag, or Windows relocking the output mid-fade, which is a
 * new chain for the rack already playing and inherits the fade in flight. The
 * 700 Hz band goes to `gains[1]` and then to `gains[2]`.
 *
 * A fade already crossing carries on, so the second change reaches the
 * incoming side at once, and what it leaves grows with its size: a drag's
 * 0.5 dB step about -104 dBFS where this programme's floor is -109, a 6 dB
 * jump no hand makes inside 20 ms -88. `under` bounds those; a relock
 * changes nothing and is held to the floor. A band's old state spilled into
 * one sample, which a band landing on 0 dB did, measured -57 and -37.
 */
void change_during_fade(const double (&gains)[3], std::optional<double> under,
                        const char* what) {
  const size_t frames = static_cast<size_t>(kRate * 2);
  const size_t change = static_cast<size_t>(kRate) / kBlock * kBlock;
  const size_t first = change - 2 * kBlock;
  std::vector<FeqChainSettings> racks;
  for (const double gain : gains) {
    racks.push_back(
        rack_of([gain](FeqChainSettings& s) { s.eq.bands[1].gain_db = gain; }));
  }
  const std::vector<float> settled = through(racks.back(), frames);
  char line[160];
  for (const Swap swap : {Swap::kHandover, Swap::kConfigure}) {
    const char* how = swap == Swap::kHandover ? "engine handover" : "host configure";
    const std::vector<float> out = changing(racks, {first, change}, frames, swap);
    const Residue found = residue(out, change);
    std::snprintf(line, sizeof line,
                  "%s, %s: %.1f dBFS around, %.1f / %.1f steady", what, how,
                  found.around, found.before, found.after);
    check(under.has_value()
              ? found.around < *under
              : found.around <= std::max(found.before, found.after) + 3.0,
          line);
    const double to_last = largest_difference(out, settled, change + 2400);
    std::snprintf(line, sizeof line, "%s, %s: 50 ms on, %.1f dB from the last rack",
                  what, how, to_last);
    check(to_last < -45.0, line);
  }
}

double gain_at(const FeqChainSettings& settings, double frequency) {
  const size_t frames = static_cast<size_t>(kRate / 2);
  std::vector<float> left(frames);
  for (size_t at = 0; at < frames; ++at) {
    left[at] = static_cast<float>(
        0.1 * std::sin(2 * kPi * frequency * static_cast<double>(at) / kRate));
  }
  std::vector<float> right = left;
  Rack rack(feq_chain_create(kRate, 2, kBlock), &feq_chain_destroy);
  feq_chain_configure(rack.get(), &settings);
  for (size_t at = 0; at + kBlock <= frames; at += kBlock) {
    float* planes[2] = {left.data() + at, right.data() + at};
    feq_chain_process(rack.get(), planes, kBlock);
  }
  double energy = 0.0;
  const size_t from = frames / 2;
  for (size_t at = from; at < frames; ++at) {
    energy += static_cast<double>(left[at]) * static_cast<double>(left[at]);
  }
  const double rms = std::sqrt(energy / static_cast<double>(frames - from));
  return to_db(rms / (0.1 / std::sqrt(2.0)));
}

}  // namespace

int main() {
  std::printf("every change to the rack's EQ fades\n");
  const Edit same = [](FeqChainSettings&) {};
  change_is_silent([](FeqChainSettings& s) { s.eq.bands[0].gain_db = 6; },
                   [](FeqChainSettings& s) { s.eq.bands[0].gain_db = -6; },
                   "60 Hz bell +6 to -6");
  change_is_silent([](FeqChainSettings& s) { s.eq.bands[1].gain_db = 6; },
                   [](FeqChainSettings& s) { s.eq.bands[1].gain_db = -6; },
                   "700 Hz bell +6 to -6");
  const Edit shelf = [](FeqChainSettings& s) {
    s.eq.bands[0].type = FEQ_FILTER_LSC;
    s.eq.bands[0].frequency = 100;
    s.eq.bands[0].quality = 0.7071;
  };
  change_is_silent(
      [&](FeqChainSettings& s) {
        shelf(s);
        s.eq.bands[0].gain_db = 6;
      },
      [&](FeqChainSettings& s) {
        shelf(s);
        s.eq.bands[0].gain_db = -6;
      },
      "100 Hz shelf +6 to -6");
  change_is_silent([](FeqChainSettings& s) { s.eq.bands[1].enabled = 0; }, same,
                   "a band switched on");
  change_is_silent(same, [](FeqChainSettings& s) { s.eq.bands[1].enabled = 0; },
                   "a band switched off");
  change_is_silent(
      [](FeqChainSettings& s) {
        s.eq.band_count = 2;
        s.eq.bands[1] = s.eq.bands[2];
      },
      same, "a band added between two");
  change_is_silent(
      [](FeqChainSettings& s) {
        s.eq.bands[2].gain_db = 6;
        s.eq.matched = 0;
      },
      [](FeqChainSettings& s) { s.eq.bands[2].gain_db = 6; },
      "Treble Classic to Precise");
  const Edit loud = [](FeqChainSettings& s) {
    s.eq.bands[0].gain_db = 6;
    s.eq.bands[1].gain_db = 9;
  };
  change_is_silent(
      [&](FeqChainSettings& s) {
        loud(s);
        s.eq.enabled = 0;
      },
      loud, "the whole EQ switched on");
  change_is_silent(loud,
                   [&](FeqChainSettings& s) {
                     loud(s);
                     s.eq.enabled = 0;
                   },
                   "the whole EQ switched off");
  change_is_silent(
      [](FeqChainSettings& s) {
        s.eq.oversample = 2;
        s.eq.bands[1].gain_db = 6;
      },
      [](FeqChainSettings& s) {
        s.eq.oversample = 2;
        s.eq.bands[1].gain_db = -6;
      },
      "oversampled, 700 Hz +6 to -6");
  change_is_silent(
      [](FeqChainSettings& s) {
        s.eq.stereo = FEQ_STEREO_MID;
        s.eq.bands[1].gain_db = 6;
      },
      [](FeqChainSettings& s) {
        s.eq.stereo = FEQ_STEREO_MID;
        s.eq.bands[1].gain_db = -6;
      },
      "mid only, 700 Hz +6 to -6");
  change_is_silent([](FeqChainSettings& s) { s.eq.bands[1].gain_db = 6; },
                   [](FeqChainSettings& s) {
                     s.eq.engine = FEQ_EQ_PARALLEL;
                     s.eq.bands[1].gain_db = 6;
                   },
                   "serial to parallel");

  std::printf("\na change while the last one is still crossing\n");
  change_during_fade({6, -6, -5.5}, -100.0, "the next step of a drag");
  // The gain dial's zero holds, so a drag through it stops there.
  change_during_fade({-1, -0.5, 0}, -100.0, "a drag onto the dial's zero");
  change_during_fade({0, -0.5, -1}, -100.0, "a drag off the dial's zero");
  change_during_fade({6, -6, -6}, std::nullopt, "the output relocked mid-fade");
  change_during_fade({6, -6, 0}, -80.0, "a 6 dB jump inside 20 ms");

  std::printf("\npositive control: the detector hears a small click\n");
  {
    const size_t frames = static_cast<size_t>(kRate * 2);
    const size_t change = static_cast<size_t>(kRate) / kBlock * kBlock;
    std::vector<float> clicked = through(rack_of(same), frames);
    // A step of -70 dBFS into the steady programme.
    for (size_t at = change; at < frames; ++at) {
      clicked[at] += static_cast<float>(std::pow(10.0, -70.0 / 20.0));
    }
    const Residue found = residue(clicked, change);
    char line[120];
    std::snprintf(line, sizeof line,
                  "a -70 dBFS step reads %.1f dBFS around, %.1f steady",
                  found.around, found.before);
    check(found.around > found.before + 10.0, line);
  }

  std::printf("\nthe Treble choice reaches the sound\n");
  {
    // A +6 dB, Q 2 bell at 16 kHz on a 48 kHz output: level at the centre
    // either way, fuller above it where the cookbook narrows the band.
    const auto bell = [](int matched) {
      FeqChainSettings settings = rack_of([](FeqChainSettings& s) {
        s.eq.band_count = 1;
        s.eq.bands[0].frequency = 16000;
        s.eq.bands[0].gain_db = 6;
        s.eq.bands[0].quality = 2;
      });
      settings.eq.matched = matched;
      return settings;
    };
    const double above = 16000.0 * std::pow(2.0, 1.0 / 6.0);
    const double precise_centre = gain_at(bell(1), 16000);
    const double classic_centre = gain_at(bell(0), 16000);
    const double precise_above = gain_at(bell(1), above);
    const double classic_above = gain_at(bell(0), above);
    char line[160];
    std::snprintf(line, sizeof line,
                  "at 16 kHz Precise %.2f dB and Classic %.2f dB", precise_centre,
                  classic_centre);
    check(std::fabs(precise_centre - 6.0) < 0.15 &&
              std::fabs(classic_centre - 6.0) < 0.15,
          line);
    std::snprintf(line, sizeof line,
                  "a sixth of an octave above, Precise %.2f dB over Classic %.2f",
                  precise_above, classic_above);
    check(precise_above > classic_above + 0.5, line);
  }

  return feq_test::finish();
}

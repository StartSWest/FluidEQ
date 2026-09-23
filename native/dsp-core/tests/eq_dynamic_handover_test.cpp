/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * A band's Dynamic switch, moved while the EQ runs through its linear-phase
 * kernel: Linear phase, or Isolate in either mode.
 *
 * A kernel bakes in the static bands and leaves the dynamic ones to run after
 * it, and a new kernel takes a warm-up of a third of a second before it is
 * heard. The bands that ran after it followed the new settings at once, so
 * for that third of a second a band switched to dynamic was baked into the
 * old kernel AND ran after it (+5.4 dB on a +5.4 dB band), and one switched
 * back was in neither (-5.4 dB; an -18 dB cut swung the full 18 dB either
 * way, and under Isolate the band vanished from the monitor). Measured on
 * 2026-09-22 before the kernels carried their own dynamic bands.
 *
 * The measure is a sine at the band's centre with the band held fully open,
 * where static and dynamic are the same gain: a correct toggle changes
 * nothing, so any movement of the level is the fault. Each run is checked
 * against a positive control on the same measure — the band's gain moved
 * instead, which must show — so "nothing moved" cannot mean "nothing was
 * measured".
 */

#include "fluideq/chain.h"

#include "dsp_test_support.h"

#include <cmath>
#include <cstdio>
#include <vector>

namespace {

using feq_test::check;
using feq_test::kPi;
using feq_test::kRate;

constexpr uint32_t kBlock = 480;
constexpr double kTone = 4269.0;
constexpr double kSeconds = 4.5;
/** Dynamic off here, and back on here: each after the kernel has settled. */
constexpr double kOffAt = 1.5;
constexpr double kOnAt = 3.0;

struct Band {
  FeqPhaseMode phase = FEQ_PHASE_LINEAR;
  int isolate = 0;
  double gain_db = 5.4;
};

FeqChainSettings rack_of(const Band& band, int dynamic, double gain_db) {
  FeqChainSettings settings{};
  feq_chain_settings_defaults(&settings);
  settings.enabled = 1;
  settings.eq.enabled = 1;
  settings.eq.isolate = band.isolate;
  settings.eq.phase = band.phase;
  settings.eq.engine = FEQ_EQ_SERIAL;
  settings.eq.stereo = FEQ_STEREO_STEREO;
  settings.eq.oversample = 1;
  settings.eq.band_count = 3;
  const double freqs[3] = {300.0, kTone, 9000.0};
  const double gains[3] = {-2.0, gain_db, -3.0};
  const double widths[3] = {1.4, 9.1, 2.0};
  for (uint32_t index = 0; index < 3; ++index) {
    settings.eq.bands[index].enabled = 1;
    settings.eq.bands[index].type = FEQ_FILTER_PK;
    settings.eq.bands[index].frequency = freqs[index];
    settings.eq.bands[index].gain_db = gains[index];
    settings.eq.bands[index].quality = widths[index];
    // Far under the tone: the band is fully open whenever it is dynamic.
    settings.eq.bands[index].threshold_db = -140.0;
  }
  settings.eq.bands[1].dynamic = dynamic;
  return settings;
}

/** What the rack is asked to be at each moment. */
using Plan = FeqChainSettings (*)(const Band&, double seconds);

FeqChainSettings toggled(const Band& band, double seconds) {
  const bool off = seconds >= kOffAt && seconds < kOnAt;
  return rack_of(band, off ? 0 : 1, band.gain_db);
}

/** The positive control: the gain goes to nothing and back, same moments. */
FeqChainSettings muted(const Band& band, double seconds) {
  const bool off = seconds >= kOffAt && seconds < kOnAt;
  return rack_of(band, 1, off ? 0.0 : band.gain_db);
}

/** A chain the way the system engine makes one: configured, primed, reset. */
FeqChain* prepared(const FeqChainSettings& settings) {
  FeqChain* chain = feq_chain_create(kRate, 2, kBlock);
  feq_chain_configure(chain, &settings);
  std::vector<float> left(kBlock, 0.0f);
  std::vector<float> right(kBlock, 0.0f);
  float* planes[2] = {left.data(), right.data()};
  feq_chain_process(chain, planes, kBlock);
  feq_chain_reset(chain, FEQ_CHAIN_RESET_STREAM_START);
  return chain;
}

/**
 * The tone through the rack as the plan changes it. `rebuilt` delivers each
 * change the way the system engine does — a new chain handed the old one's
 * state — rather than reconfiguring one chain, as the Library's host does.
 * `refused` counts the handovers the engine's way would not take.
 */
std::vector<float> render(const Band& band, Plan plan, bool rebuilt,
                          int& refused) {
  FeqChainSettings settings = plan(band, 0.0);
  FeqChain* chain = prepared(settings);
  const size_t total = static_cast<size_t>(kRate * kSeconds) / kBlock * kBlock;
  std::vector<float> left(kBlock);
  std::vector<float> right(kBlock);
  std::vector<float> out;
  out.reserve(total);
  const double step = (2.0 * kPi * kTone) / kRate;
  double phase = 0.0;
  for (size_t at = 0; at < total; at += kBlock) {
    const FeqChainSettings wanted =
        plan(band, static_cast<double>(at) / kRate);
    if (wanted.eq.bands[1].dynamic != settings.eq.bands[1].dynamic ||
        wanted.eq.bands[1].gain_db != settings.eq.bands[1].gain_db) {
      settings = wanted;
      if (rebuilt) {
        FeqChain* next = prepared(settings);
        if (feq_chain_transfer_state(next, chain) == 0) {
          refused += 1;
        }
        feq_chain_destroy(chain);
        chain = next;
      } else {
        feq_chain_configure(chain, &settings);
      }
    }
    for (uint32_t index = 0; index < kBlock; ++index) {
      left[index] = static_cast<float>(0.1 * std::sin(phase));
      right[index] = left[index];
      phase += step;
    }
    float* planes[2] = {left.data(), right.data()};
    feq_chain_process(chain, planes, kBlock);
    out.insert(out.end(), left.begin(), left.end());
  }
  feq_chain_destroy(chain);
  return out;
}

struct Movement {
  /** The furthest any 10 ms of the tone strays from its level before. */
  double level_db = 0.0;
  /**
   * y[n] - 2cos(w)y[n-1] + y[n-2] is zero for a steady sine, so a click is a
   * spike in it; the worst, against the tone's RMS.
   */
  double click_db = -300.0;
};

Movement movement_of(const std::vector<float>& out) {
  const auto window = static_cast<size_t>(kRate * 0.01);
  const auto from = static_cast<size_t>(kRate * 1.0);
  auto level = [&](size_t start) {
    double sum = 0.0;
    for (size_t at = start; at < start + window; ++at) {
      sum += static_cast<double>(out[at]) * static_cast<double>(out[at]);
    }
    return 10.0 * std::log10(sum / static_cast<double>(window) + 1e-30);
  };
  double before = 0.0;
  int windows = 0;
  for (size_t start = from; start + window <= static_cast<size_t>(kRate * kOffAt);
       start += window) {
    before += level(start);
    windows += 1;
  }
  before /= windows;
  Movement moved;
  for (size_t start = from; start + window <= out.size(); start += window) {
    moved.level_db = std::fmax(moved.level_db, std::fabs(level(start) - before));
  }
  const double c = 2.0 * std::cos((2.0 * kPi * kTone) / kRate);
  double worst = 0.0;
  double power = 0.0;
  for (size_t at = from; at < out.size(); ++at) {
    const double residual = static_cast<double>(out[at]) -
                            c * static_cast<double>(out[at - 1]) +
                            static_cast<double>(out[at - 2]);
    worst = std::fmax(worst, std::fabs(residual));
    power += static_cast<double>(out[at]) * static_cast<double>(out[at]);
  }
  const double tone = std::sqrt(power / static_cast<double>(out.size() - from));
  moved.click_db = 20.0 * std::log10(worst / tone + 1e-30);
  return moved;
}

void toggle_changes_nothing(const char* label, const Band& band,
                            bool rebuilt) {
  int refused = 0;
  const Movement toggle = movement_of(render(band, toggled, rebuilt, refused));
  const Movement control = movement_of(render(band, muted, rebuilt, refused));
  std::printf("%s: toggle moves the tone %.3f dB (click %.1f dB), the gain "
              "moved instead %.2f dB\n",
              label, toggle.level_db, toggle.click_db, control.level_db);
  // The control first: the same measure has to see a band that went away.
  check(control.level_db > std::fabs(band.gain_db) * 0.8,
        "positive control: the measure sees the band's gain move");
  check(refused == 0, "every handover took the previous chain's state");
  check(toggle.level_db < 0.1, "toggling Dynamic moves no level");
  check(toggle.click_db < -35.0, "toggling Dynamic makes no click");
}

}  // namespace

int main() {
  const Band boost{FEQ_PHASE_LINEAR, 0, 5.4};
  const Band cut{FEQ_PHASE_LINEAR, 0, -18.0};
  const Band isolated{FEQ_PHASE_LINEAR, 1, 5.4};
  const Band isolated_cut{FEQ_PHASE_LINEAR, 1, -18.0};
  const Band isolated_minimum{FEQ_PHASE_MINIMUM, 1, 5.4};

  toggle_changes_nothing("linear, +5.4 dB", boost, false);
  toggle_changes_nothing("linear, -18 dB", cut, false);
  toggle_changes_nothing("isolate, +5.4 dB", isolated, false);
  toggle_changes_nothing("isolate, -18 dB", isolated_cut, false);
  toggle_changes_nothing("minimum isolate, +5.4 dB", isolated_minimum, false);
  // The system engine rebuilds the chain on every change and hands the old
  // one's kernels over, so the same toggle arrives a different way there.
  toggle_changes_nothing("engine: linear, +5.4 dB", boost, true);
  toggle_changes_nothing("engine: linear, -18 dB", cut, true);
  toggle_changes_nothing("engine: isolate, +5.4 dB", isolated, true);
  return feq_test::finish();
}

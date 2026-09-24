/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Auto normalize's level for an edit, worked out before the edit is heard
 * (`level_prediction.h`): the music the audio thread keeps, the level it
 * predicts against a direct measurement of the same music, the cases with
 * nothing to go on, a drag's steps adding up, and the handover taking the
 * level at once where it used to drop by the curve's worst case and climb.
 */

#include <algorithm>
#include <cmath>
#include <cstddef>
#include <functional>
#include <memory>
#include <string>
#include <vector>

#include "../src/input_history.h"
#include "../src/level_prediction.h"
#include "fluideq/primitives.h"
#include "graph_test_support.h"

using namespace fluideq_engine_test;
using fluideq_engine::Chain;
using fluideq_engine::Graph;
using fluideq_engine::InputHistory;
using fluideq_engine::LevelPredictor;

namespace {

const std::function<bool()> kNeverStop = [] { return false; };

/**
 * Something with a level worth judging: a kick every half second, a pad and
 * a hat, repeating exactly, so the loudest peak of any stretch longer than a
 * second is the same peak whichever stretch is taken.
 */
std::vector<float> music(uint32_t frames, double scale = 1.0) {
  std::vector<float> out(frames);
  uint32_t noise = 12345u;
  for (uint32_t at = 0; at < frames; ++at) {
    const double t = static_cast<double>(at) / kRate;
    const double beat = std::fmod(t, 0.5);
    const double kick = 0.3 * std::exp(-beat * 18.0) *
                        std::sin(2.0 * kPi * 58.0 * beat);
    const double pad = 0.15 * (std::sin(2.0 * kPi * 440.0 * t) +
                               0.6 * std::sin(2.0 * kPi * 660.0 * t));
    noise = noise * 1664525u + 1013904223u;
    const double hat_env = std::exp(-std::fmod(t, 0.25) * 60.0);
    const double hat = 0.06 * hat_env *
                       (static_cast<double>(noise >> 8) / 8388608.0 - 1.0);
    out[at] = static_cast<float>(scale * (kick + pad + hat));
  }
  return out;
}

/** `samples` into `history` in blocks of 480, the same on both channels. */
void record(InputHistory& history, const std::vector<float>& samples,
            uint32_t block = 480) {
  for (uint32_t at = 0; at < samples.size(); at += block) {
    const float* planes[2] = {samples.data() + at, samples.data() + at};
    history.record(planes,
                   std::min<uint32_t>(block, static_cast<uint32_t>(samples.size()) - at));
  }
}

Chain auto_chain(const std::string& filters, double preamp) {
  return chain_from(filters + "Preamp: " + std::to_string(preamp) +
                    " dB\n# FluidEQAutoPreamp: ON\n# FluidEQCurveStage: ON\n");
}

const char* kBass6 = "Filter: ON LSC Fc 100 Hz Gain 6 dB Q 0.71\n";

/**
 * The loudest true peak `chain` makes of `samples` past the replay's own
 * warm-up, in dBFS: what the prediction should agree with.
 */
double measured_peak_db(const Chain& chain, const std::vector<float>& samples) {
  Graph graph(fluideq_engine::replay_chain_of(chain), kRate, 2, 4096);
  std::vector<float> left = samples;
  std::vector<float> right = samples;
  for (uint32_t at = 0; at < left.size(); at += 4096) {
    float* planes[2] = {left.data() + at, right.data() + at};
    graph.process(planes, std::min<uint32_t>(4096, static_cast<uint32_t>(left.size()) - at));
  }
  const uint32_t skip = kRate / 2 + graph.latency_frames() + FEQ_TRUE_PEAK_LATENCY;
  FeqTruePeak detector{};
  feq_true_peak_init(&detector, 4);
  const double peak = feq_true_peak_block(
      &detector, left.data() + skip, static_cast<uint32_t>(left.size()) - skip);
  return 20.0 * std::log10(std::max(peak, 1e-12));
}

void history_keeps_the_window_and_what_it_was_given() {
  std::printf("the history keeps the last window as it was given\n");
  // One second of window, one of slack: two seconds kept.
  InputHistory history(kRate, 2, 1.0);
  CHECK(history.window_frames() == kRate);
  std::vector<float> ramp(kRate * 3);
  for (size_t at = 0; at < ramp.size(); ++at) {
    ramp[at] = static_cast<float>(at) / 1e6f;
  }
  record(history, ramp);
  CHECK(history.written() == ramp.size());
  std::vector<std::vector<float>> out;
  // Asked for everything, it hands back only what it still keeps.
  InputHistory::Stretch got = history.copy(0, history.written(), out);
  CHECK(got.to == ramp.size());
  CHECK(got.from == ramp.size() - 2 * kRate);
  CHECK(out.size() == 2 && out[0].size() == got.to - got.from);
  CHECK(out[0].front() == ramp[got.from] && out[1].back() == ramp.back());
  // The window itself, exactly.
  got = history.copy(ramp.size() - kRate, ramp.size() + 999, out);
  CHECK(got.from == ramp.size() - kRate && got.to == ramp.size());
  CHECK(out[0][123] == ramp[got.from + 123]);
  // Nothing recorded there yet.
  got = history.copy(ramp.size() + 10, ramp.size() + 20, out);
  CHECK(got.from == got.to && out[0].empty());
  // A missing plane is silence, not whatever the slot held.
  const float* silent[2] = {nullptr, ramp.data()};
  history.record(silent, 480);
  got = history.copy(ramp.size(), ramp.size() + 480, out);
  CHECK(got.to - got.from == 480);
  CHECK(*std::max_element(out[0].begin(), out[0].end()) == 0.0f);
  CHECK(out[1][5] == ramp[5]);
}

void a_graph_records_the_music_as_it_reaches_the_eq() {
  std::printf("a graph records the music as it reaches the EQ\n");
  InputHistory history(kRate, 2, 1.0);
  Graph graph(auto_chain(kBass6, -6.2), kRate, 2, 480);
  graph.set_history(&history);
  std::vector<float> left = music(480), right = left;
  const std::vector<float> before = left;
  float* planes[2] = {left.data(), right.data()};
  graph.process(planes, 480);
  std::vector<std::vector<float>> out;
  history.copy(0, 480, out);
  // What went in, not what the EQ made of it.
  CHECK(out[0] == before);
  CHECK(left != before);
}

void the_level_moves_by_what_the_new_eq_does_to_this_music() {
  std::printf("the level moves by what the new EQ does to this music\n");
  const std::vector<float> heard = music(kRate * 12);
  InputHistory history(kRate, 2, fluideq_engine::kLevelHistorySeconds);
  record(history, heard);
  LevelPredictor predictor(kRate, 2, history.window_frames());
  const Chain flat = auto_chain("", -0.2);
  const Chain bass = auto_chain(kBass6, -6.2);
  predictor.accept(flat, history.written());
  const auto level = predictor.predict(bass, history, kNeverStop);
  CHECK(level.has_value());
  if (!level) return;
  const std::vector<float> window(
      heard.end() - static_cast<std::ptrdiff_t>(history.window_frames()),
      heard.end());
  const double expected =
      measured_peak_db(flat, window) - measured_peak_db(bass, window);
  std::printf("  predicted %+.3f dB, measured %+.3f dB, over %.1f s\n",
              level->shift_db, expected, level->seconds);
  // POSITIVE CONTROL: the boost does raise this music's peak, by less than
  // the 6 dB the curve's worst case would have taken off.
  CHECK(expected < -1.0 && expected > -6.0);
  CHECK(std::abs(level->shift_db - expected) < 0.05);
  CHECK(level->seconds > 8.5);
  // And back: the same distance the other way.
  predictor.accept(bass, history.written());
  const auto back = predictor.predict(flat, history, kNeverStop);
  CHECK(back.has_value() && std::abs(back->shift_db + level->shift_db) < 0.05);
}

void a_curve_is_judged_on_less_music_and_still_right() {
  std::printf("a graphic curve is judged on less music, and still right\n");
  const std::vector<float> heard = music(kRate * 12);
  InputHistory history(kRate, 2, fluideq_engine::kLevelHistorySeconds);
  record(history, heard);
  LevelPredictor predictor(kRate, 2, history.window_frames());
  const Chain flat = auto_chain("", -0.2);
  const Chain curve = auto_chain("GraphicEQ: 20 5; 150 5; 400 0; 20000 0\n", -5.2);
  predictor.accept(flat, history.written());
  const auto level = predictor.predict(curve, history, kNeverStop);
  CHECK(level.has_value());
  if (!level) return;
  const std::vector<float> window(heard.end() - kRate * 4, heard.end());
  const double expected =
      measured_peak_db(flat, window) - measured_peak_db(curve, window);
  std::printf("  predicted %+.3f dB, measured %+.3f dB, over %.1f s\n",
              level->shift_db, expected, level->seconds);
  CHECK(level->seconds < 4.0 && level->seconds > 2.5);
  CHECK(expected < -1.0);
  CHECK(std::abs(level->shift_db - expected) < 0.05);
}

/**
 * The level predicted for `next` over music `playing` has put through its own
 * graph, so the guard measured every block — `playing` published before the
 * music, or just now, when nothing has been measured on it yet.
 */
std::optional<LevelPredictor::Prediction> predicted_after_playing(
    const Chain& playing, const Chain& next, bool published_before) {
  InputHistory history(kRate, 2, fluideq_engine::kLevelHistorySeconds);
  Graph graph(playing, kRate, 2, 480);
  graph.set_history(&history);
  std::vector<std::vector<float>> played(2, music(kRate * 12));
  run_blocks(graph, played, 480);
  LevelPredictor predictor(kRate, 2, history.window_frames());
  predictor.accept(playing, published_before ? 0 : history.written());
  return predictor.predict(next, history, kNeverStop);
}

void what_the_guard_measured_stands_in_for_a_replay() {
  std::printf("what the guard measured stands in for a replay\n");
  // A band of Your EQ's, so its phase choice applies to it.
  const Chain bright = auto_chain(
      "# FluidEQEqLayer: ON\nFilter: ON PK Fc 8000 Hz Gain 6 dB Q 1\n", -6.2);
  const Chain bass = auto_chain(kBass6, -6.2);
  // Published before the music: measured over the whole window. Published
  // just now: nothing measured on it yet, so replayed.
  const auto measured = predicted_after_playing(bright, bass, true);
  const auto replayed = predicted_after_playing(bright, bass, false);
  CHECK(measured.has_value() && replayed.has_value());
  if (!measured || !replayed) return;
  std::printf("  measured %+.3f dB, replayed %+.3f dB\n", measured->shift_db,
              replayed->shift_db);
  CHECK(replayed->shift_db < -1.0);
  CHECK(std::abs(measured->shift_db - replayed->shift_db) < 0.1);
}

void a_chain_in_linear_phase_is_replayed() {
  std::printf("a chain playing in linear phase is replayed, not measured\n");
  // A narrow boost on the kick: in linear phase its ringing is spread either
  // side of the hit, and the loudest peak lands lower than in minimum phase.
  const std::string boom =
      "# FluidEQEqLayer: ON\nFilter: ON PK Fc 58 Hz Gain 12 dB Q 4\n";
  const Chain minimum = auto_chain(boom, -12.2);
  Chain linear = minimum;
  linear.minimum_eq_phase = false;
  linear.minimum_curve_phase = false;
  const Chain airy =
      auto_chain(boom + "Filter: ON PK Fc 8000 Hz Gain 1 dB Q 1\n", -12.2);
  const auto replayed = predicted_after_playing(minimum, airy, false);
  const auto from_linear = predicted_after_playing(linear, airy, true);
  CHECK(replayed.has_value() && from_linear.has_value());
  if (!replayed || !from_linear) return;
  std::printf("  replayed %+.3f dB, with linear phase playing %+.3f dB\n",
              replayed->shift_db, from_linear->shift_db);
  // Judged by its measured peaks, the linear chain would read as the edit
  // changing the level by how far linear and minimum phase differ.
  CHECK(std::abs(from_linear->shift_db - replayed->shift_db) < 0.05);
}

void nothing_to_go_on_is_no_prediction() {
  std::printf("nothing to go on is no prediction\n");
  const Chain flat = auto_chain("", -0.2);
  const Chain bass = auto_chain(kBass6, -6.2);
  InputHistory quiet(kRate, 2, fluideq_engine::kLevelHistorySeconds);
  record(quiet, std::vector<float>(kRate * 12, 0.0f));
  InputHistory loud(kRate, 2, fluideq_engine::kLevelHistorySeconds);
  record(loud, music(kRate * 12));
  InputHistory short_one(kRate, 2, fluideq_engine::kLevelHistorySeconds);
  record(short_one, music(kRate));
  LevelPredictor predictor(kRate, 2, loud.window_frames());
  // No chain playing yet.
  CHECK(!predictor.predict(bass, loud, kNeverStop));
  predictor.accept(flat, loud.written());
  // POSITIVE CONTROL: with music heard, the same edit is predicted.
  CHECK(predictor.predict(bass, loud, kNeverStop).has_value());
  CHECK(!predictor.predict(bass, quiet, kNeverStop));
  CHECK(!predictor.predict(bass, short_one, kNeverStop));
  // The EQ unchanged: a rack change, or a preamp the app sized again.
  Chain rack_only = flat;
  rack_only.dsp_values = {1.0, 2.0};
  rack_only.auto_preamp_start_db = -3.0;
  CHECK(!predictor.predict(rack_only, loud, kNeverStop));
  // Auto normalize off on either side.
  const Chain manual = chain_from(std::string(kBass6) +
                                  "Preamp: -6 dB\n# FluidEQAutoPreamp: OFF\n");
  CHECK(!predictor.predict(manual, loud, kNeverStop));
  predictor.accept(manual, loud.written());
  CHECK(!predictor.predict(flat, loud, kNeverStop));
  // Asked to stop, it stops.
  predictor.accept(flat, loud.written());
  CHECK(!predictor.predict(bass, loud, [] { return true; }));
}

void a_drags_steps_add_up_to_the_whole_change() {
  std::printf("a drag's steps add up to the whole change\n");
  const std::vector<float> heard = music(kRate * 14);
  InputHistory history(kRate, 2, fluideq_engine::kLevelHistorySeconds);
  record(history, std::vector<float>(heard.begin(), heard.begin() + kRate * 12));
  LevelPredictor predictor(kRate, 2, history.window_frames());
  const Chain flat = auto_chain("", -0.2);
  predictor.accept(flat, history.written());
  double total = 0.0;
  size_t played = kRate * 12;
  for (int gain = 1; gain <= 8; ++gain) {
    const Chain step = auto_chain("Filter: ON LSC Fc 100 Hz Gain " +
                                      std::to_string(gain) + " dB Q 0.71\n",
                                  -0.2 - gain);
    const auto level = predictor.predict(step, history, kNeverStop);
    CHECK(level.has_value());
    if (level) total += level->shift_db;
    predictor.accept(step, history.written());
    // A step every quarter of a second, the music going on in between.
    record(history, std::vector<float>(heard.begin() + static_cast<std::ptrdiff_t>(played),
                                       heard.begin() + static_cast<std::ptrdiff_t>(played + kRate / 4)));
    played += kRate / 4;
  }
  LevelPredictor whole(kRate, 2, history.window_frames());
  whole.accept(flat, history.written());
  const auto at_once = whole.predict(auto_chain("Filter: ON LSC Fc 100 Hz Gain 8 dB Q 0.71\n", -8.2),
                                     history, kNeverStop);
  CHECK(at_once.has_value());
  if (!at_once) return;
  std::printf("  eight steps %+.3f dB, one edit %+.3f dB\n", total, at_once->shift_db);
  // Each step judged against the chain it replaces: the steps telescope into
  // the one edit rather than counting the first steps again at every step.
  CHECK(std::abs(total - at_once->shift_db) < 0.1);
  CHECK(at_once->shift_db < -2.0);
}

/** The guard's gain once the handover has settled, and three seconds later. */
struct Handover {
  double before = 0, soon = 0, later = 0;
};

Handover hand_over(bool predicted, bool right_basis) {
  const Chain flat = auto_chain("", -0.2);
  const Chain bass = auto_chain(kBass6, -6.2);
  const std::vector<float> heard = music(kRate * 20);
  InputHistory history(kRate, 2, fluideq_engine::kLevelHistorySeconds);
  Graph previous(flat, kRate, 2, 480);
  previous.set_history(&history);
  // Twelve seconds: the history full, and the guard settled on this music.
  std::vector<std::vector<float>> played(
      2, std::vector<float>(heard.begin(), heard.begin() + kRate * 12));
  run_blocks(previous, played, 480);
  Handover result;
  result.before = previous.auto_preamp_gain_db();
  LevelPredictor predictor(kRate, 2, history.window_frames());
  predictor.accept(flat, 0);
  Graph next(bass, kRate, 2, 480);
  next.set_history(&history);
  next.request_state_transfer();
  if (predicted) {
    const auto level = predictor.predict(bass, history, kNeverStop);
    CHECK(level.has_value());
    if (level) {
      const Graph other(flat, kRate, 2, 480);
      next.plan_level_shift(level->shift_db, right_basis ? &previous : &other);
    }
  }
  next.adopt_state(&previous);
  std::vector<std::vector<float>> after(
      2, std::vector<float>(heard.begin() + kRate * 12, heard.begin() + kRate * 16));
  std::vector<float*> planes(2);
  for (uint32_t at = 0; at < after[0].size(); at += 480) {
    planes[0] = after[0].data() + at;
    planes[1] = after[1].data() + at;
    next.process(planes.data(), 480);
    if (at == kRate / 2) result.soon = next.auto_preamp_gain_db();
    if (at == kRate * 7 / 2) result.later = next.auto_preamp_gain_db();
  }
  return result;
}

void the_handover_takes_the_predicted_level_at_once() {
  std::printf("the handover takes the predicted level at once\n");
  const Handover old_way = hand_over(false, false);
  const Handover new_way = hand_over(true, true);
  const Handover wrong_basis = hand_over(true, false);
  std::printf("  old way   %.2f -> %.2f -> %.2f dB\n", old_way.before, old_way.soon, old_way.later);
  std::printf("  predicted %.2f -> %.2f -> %.2f dB\n", new_way.before, new_way.soon, new_way.later);
  // POSITIVE CONTROL: the old way drops by the curve's worst case and is
  // still climbing seconds later.
  CHECK(old_way.soon < old_way.before - 4.0);
  CHECK(old_way.later > old_way.soon + 1.0);
  // Predicted: down once, by what the bass adds to this music, and there.
  CHECK(new_way.soon < new_way.before - 1.0);
  CHECK(new_way.soon > old_way.soon + 1.0);
  CHECK(std::abs(new_way.later - new_way.soon) < 0.3);
  // A prediction made against another graph is not taken.
  CHECK(std::abs(wrong_basis.soon - old_way.soon) < 0.05);
}

}  // namespace

int main() {
  std::printf("fluideq engine level prediction\n");
  history_keeps_the_window_and_what_it_was_given();
  a_graph_records_the_music_as_it_reaches_the_eq();
  the_level_moves_by_what_the_new_eq_does_to_this_music();
  a_curve_is_judged_on_less_music_and_still_right();
  what_the_guard_measured_stands_in_for_a_replay();
  a_chain_in_linear_phase_is_replayed();
  nothing_to_go_on_is_no_prediction();
  a_drags_steps_add_up_to_the_whole_change();
  the_handover_takes_the_predicted_level_at_once();
  return report();
}

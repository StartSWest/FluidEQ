/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The EQ tap's live spectrum: the window ending now, unsmoothed, and the long
 * window that gives the bass its detail (`meters_eq_live.h`).
 *
 * Every claim is held against a tap that still works the old way — the
 * exciter's, one smoothed window in every 2048 samples — fed the same audio,
 * so a pass here is the EQ tap behaving differently, not a reading that
 * happens to clear a line.
 */
#include "fluideq/meters.h"

#include <algorithm>
#include <cmath>
#include <cstdio>
#include <vector>

namespace {

int g_failures = 0;

void check(bool condition, const char* what) {
  std::printf("  %s %s\n", condition ? "ok  " : "FAIL", what);
  if (!condition) {
    ++g_failures;
  }
}

constexpr double kPi = 3.14159265358979323846;
constexpr double kRate = 48000.0;
constexpr uint32_t kBlock = 480;

struct Tone {
  double hz;
  double amplitude;
};

/** `frames` of a sum of tones into both taps, in device-sized blocks. */
void feed(FeqMeters* meters, const std::vector<Tone>& tones, uint32_t frames,
          double* clock) {
  std::vector<float> left(kBlock);
  std::vector<float> right(kBlock);
  float* planes[2] = {left.data(), right.data()};
  uint32_t sent = 0;
  while (sent < frames) {
    const uint32_t count = std::min(kBlock, frames - sent);
    for (uint32_t at = 0; at < count; at += 1) {
      double value = 0.0;
      for (const Tone& tone : tones) {
        value += tone.amplitude * std::sin(2.0 * kPi * tone.hz * *clock);
      }
      left[at] = static_cast<float>(value);
      right[at] = static_cast<float>(value);
      *clock += 1.0 / kRate;
    }
    feq_meters_capture(meters, FEQ_METER_STAGE_EQ, planes, count);
    feq_meters_capture(meters, FEQ_METER_STAGE_EXCITER, planes, count);
    sent += count;
  }
}

double short_db(const std::vector<float>& bins, double hz) {
  return bins[static_cast<size_t>(hz / kRate * FEQ_METER_WINDOW + 0.5)];
}

double long_db(const std::vector<float>& bins, double hz) {
  return bins[static_cast<size_t>(hz / kRate * FEQ_METER_DETAIL_WINDOW + 0.5)];
}

FeqMeters* open_meters() {
  FeqMeters* meters = feq_meters_create(2);
  feq_meters_set_sample_rate(meters, kRate);
  feq_meters_set_enabled(meters, 1);
  return meters;
}

/**
 * A tone that stops is gone from the EQ tap within one window.
 *
 * The old tap blended each window into the last at 0.56, so a tone that had
 * stopped still read about 15 dB above the floor two windows later, which is
 * the trail that made the page look a sixth of a second behind the music.
 */
void test_reads_the_window_ending_now() {
  std::printf("\nthe EQ tap reads the window ending now\n");
  FeqMeters* meters = open_meters();
  std::vector<float> eq(FEQ_METER_BINS);
  std::vector<float> exciter(FEQ_METER_BINS);
  double clock = 0.0;
  for (int window = 0; window < 40; window += 1) {
    feed(meters, {{1500.0, 0.5}}, FEQ_METER_WINDOW, &clock);
    feq_meters_read_spectrum(meters, FEQ_METER_STAGE_EQ, eq.data(),
                             FEQ_METER_BINS);
    feq_meters_read_spectrum(meters, FEQ_METER_STAGE_EXCITER, exciter.data(),
                             FEQ_METER_BINS);
  }
  // 1500 Hz lands on a bin centre in both windows: the coherent gain alone,
  // 20 * log10(0.5 / 2 * 0.42) = -19.6 dB.
  std::printf("       steady 1.5 kHz: EQ tap %.2f dB, exciter tap %.2f dB\n",
              short_db(eq, 1500.0), short_db(exciter, 1500.0));
  check(std::fabs(short_db(eq, 1500.0) + 19.58) < 0.05,
        "a steady tone reads its own level, unsmoothed");

  // Two windows of silence: one to empty the window, one more to show it.
  feed(meters, {}, FEQ_METER_WINDOW, &clock);
  feq_meters_read_spectrum(meters, FEQ_METER_STAGE_EQ, eq.data(),
                           FEQ_METER_BINS);
  feq_meters_read_spectrum(meters, FEQ_METER_STAGE_EXCITER, exciter.data(),
                             FEQ_METER_BINS);
  feed(meters, {}, FEQ_METER_WINDOW, &clock);
  feq_meters_read_spectrum(meters, FEQ_METER_STAGE_EQ, eq.data(),
                           FEQ_METER_BINS);
  feq_meters_read_spectrum(meters, FEQ_METER_STAGE_EXCITER, exciter.data(),
                           FEQ_METER_BINS);
  std::printf("       after it stops: EQ tap %.1f dB, exciter tap %.1f dB\n",
              short_db(eq, 1500.0), short_db(exciter, 1500.0));
  check(short_db(eq, 1500.0) < -150.0, "a tone that stopped is gone at once");
  check(short_db(exciter, 1500.0) > -60.0,
        "control: the smoothed tap still shows it fading");
  feq_meters_destroy(meters);
}

/**
 * A fresh window whenever audio has arrived, as a device delivers it.
 *
 * The old tap had one every 2048 samples, 23 a second, and a page polling at
 * 60 Hz drew the same picture two or three times in a row. A floor set at a
 * ninetieth of a second was no better against real blocks: a poll that found
 * one 10 ms block was told nothing was new, one poll in three.
 */
void test_a_fresh_window_with_every_block() {
  std::printf("\nthe EQ tap has a fresh window with every block\n");
  FeqMeters* meters = open_meters();
  std::vector<float> bins(FEQ_METER_BINS);
  double clock = 0.0;
  feed(meters, {{1500.0, 0.5}}, FEQ_METER_WINDOW, &clock);
  check(feq_meters_read_spectrum(meters, FEQ_METER_STAGE_EQ, bins.data(),
                                 FEQ_METER_BINS) != 0,
        "a window is there once audio has arrived");
  const uint32_t floor = static_cast<uint32_t>(kRate / 240.0);
  std::vector<float> left(floor), right(floor);
  float* planes[2] = {left.data(), right.data()};
  feq_meters_capture(meters, FEQ_METER_STAGE_EQ, planes, floor - 1);
  check(feq_meters_read_spectrum(meters, FEQ_METER_STAGE_EQ, bins.data(),
                                 FEQ_METER_BINS) == 0,
        "one frame short of a 240th of a second, nothing new");
  feq_meters_capture(meters, FEQ_METER_STAGE_EQ, planes, 1);
  check(feq_meters_read_spectrum(meters, FEQ_METER_STAGE_EQ, bins.data(),
                                 FEQ_METER_BINS) != 0,
        "and one frame more, a fresh window");

  // A second of 480-frame blocks, the page polling at 60 Hz between them.
  int polls = 0;
  int fresh = 0;
  int exciter_fresh = 0;
  const uint32_t poll_every = static_cast<uint32_t>(kRate / 60.0);
  uint32_t next_poll = poll_every;
  for (uint32_t fed = kBlock; fed <= static_cast<uint32_t>(kRate);
       fed += kBlock) {
    feed(meters, {{1500.0, 0.5}}, kBlock, &clock);
    if (fed < next_poll) {
      continue;
    }
    next_poll += poll_every;
    polls += 1;
    fresh += feq_meters_read_spectrum(meters, FEQ_METER_STAGE_EQ, bins.data(),
                                      FEQ_METER_BINS);
    exciter_fresh += feq_meters_read_spectrum(
        meters, FEQ_METER_STAGE_EXCITER, bins.data(), FEQ_METER_BINS);
  }
  std::printf("       %d polls: %d fresh on the EQ tap, %d on the exciter's\n",
              polls, fresh, exciter_fresh);
  check(polls > 50 && fresh == polls,
        "a 60 Hz page gets a new picture on every poll");
  check(exciter_fresh < polls / 2,
        "control: the old tap answers under half of them");

  // The long window keeps its own, slower pace.
  std::vector<float> detail(FEQ_METER_DETAIL_BINS);
  int long_fresh = 0;
  for (int poll = 0; poll < 60; poll += 1) {
    feed(meters, {{1500.0, 0.5}}, static_cast<uint32_t>(kRate / 60.0), &clock);
    long_fresh += feq_meters_read_eq_detail(meters, detail.data(),
                                            FEQ_METER_DETAIL_BINS);
  }
  std::printf("       60 polls: %d fresh long windows\n", long_fresh);
  check(long_fresh == 30, "the long window is new on every other poll");
  check(feq_meters_read_eq_detail(meters, detail.data(), 100) == 0,
        "and refuses a buffer of any other size");
  feq_meters_destroy(meters);
}

/**
 * The bass's detail: two notes 20 Hz apart.
 *
 * The short window's bins are 23 Hz wide and its main lobe six bins, so 40
 * and 60 Hz are one hump in it; the long window's are 2.9 Hz, and it shows
 * two notes with a valley between. That valley is what the page could not
 * draw.
 */
void test_the_long_window_separates_bass_notes() {
  std::printf("\nthe long window separates two bass notes\n");
  FeqMeters* meters = open_meters();
  std::vector<float> bins(FEQ_METER_BINS);
  std::vector<float> detail(FEQ_METER_DETAIL_BINS);
  double clock = 0.0;
  feed(meters, {{40.0, 0.3}, {60.0, 0.3}}, FEQ_METER_DETAIL_WINDOW * 2,
       &clock);
  check(feq_meters_read_spectrum(meters, FEQ_METER_STAGE_EQ, bins.data(),
                                 FEQ_METER_BINS) != 0 &&
            feq_meters_read_eq_detail(meters, detail.data(),
                                      FEQ_METER_DETAIL_BINS) != 0,
        "both windows read");
  const double long_valley =
      std::min(long_db(detail, 40.0), long_db(detail, 60.0)) -
      long_db(detail, 50.0);
  const double short_valley =
      std::min(short_db(bins, 40.0), short_db(bins, 60.0)) -
      short_db(bins, 50.0);
  std::printf("       valley at 50 Hz: long %.1f dB deep, short %.1f dB\n",
              long_valley, short_valley);
  check(long_valley > 30.0, "the long window shows two notes");
  check(short_valley < 3.0, "control: the short window shows one hump");

  // The same level in both, on a bin centre of each: the graph joins the two
  // and a step between them would be drawn as a cliff in the music.
  feed(meters, {{1500.0, 0.5}}, FEQ_METER_DETAIL_WINDOW * 2, &clock);
  feq_meters_read_spectrum(meters, FEQ_METER_STAGE_EQ, bins.data(),
                           FEQ_METER_BINS);
  feq_meters_read_eq_detail(meters, detail.data(), FEQ_METER_DETAIL_BINS);
  std::printf("       1.5 kHz: short %.3f dB, long %.3f dB\n",
              short_db(bins, 1500.0), long_db(detail, 1500.0));
  check(std::fabs(short_db(bins, 1500.0) - long_db(detail, 1500.0)) < 0.01,
        "a tone reads the same level in both windows");
  feq_meters_destroy(meters);
}

/**
 * The panel reopened shows the music now, not the end of the last song.
 *
 * The ring outlives a closed panel; without the restart a long window opened
 * onto it drew a third of a second of whatever was playing when it closed.
 */
void test_a_reopened_panel_starts_from_silence() {
  std::printf("\na reopened panel starts from silence\n");
  FeqMeters* meters = open_meters();
  std::vector<float> detail(FEQ_METER_DETAIL_BINS);
  double clock = 0.0;
  feed(meters, {{1500.0, 0.5}}, FEQ_METER_DETAIL_WINDOW * 2, &clock);
  check(feq_meters_read_eq_detail(meters, detail.data(),
                                  FEQ_METER_DETAIL_BINS) != 0 &&
            long_db(detail, 1500.0) > -21.0,
        "control: the tone is there while the panel is open");
  feq_meters_set_enabled(meters, 0);
  feq_meters_set_enabled(meters, 1);
  feed(meters, {}, FEQ_METER_WINDOW, &clock);
  check(feq_meters_read_eq_detail(meters, detail.data(),
                                  FEQ_METER_DETAIL_BINS) != 0,
        "the long window reads after reopening");
  std::printf("       reopened onto silence: %.1f dB at 1.5 kHz\n",
              long_db(detail, 1500.0));
  check(long_db(detail, 1500.0) < -150.0,
        "and holds nothing from before it closed");

  // "On" again while already on is every frame the engine asks for, and must
  // not throw away what the window already holds.
  feed(meters, {{1500.0, 0.5}}, FEQ_METER_DETAIL_WINDOW * 2, &clock);
  feq_meters_set_enabled(meters, 1);
  feed(meters, {{1500.0, 0.5}}, FEQ_METER_WINDOW, &clock);
  feq_meters_read_eq_detail(meters, detail.data(), FEQ_METER_DETAIL_BINS);
  check(long_db(detail, 1500.0) > -21.0,
        "being told \"on\" while on keeps the window whole");
  feq_meters_destroy(meters);
}

}  // namespace

int main() {
  std::printf("meters: the EQ tap's live spectrum\n");
  test_reads_the_window_ending_now();
  test_a_fresh_window_with_every_block();
  test_the_long_window_separates_bass_notes();
  test_a_reopened_panel_starts_from_silence();
  std::printf("\n%s (%d failures)\n", g_failures == 0 ? "PASS" : "FAIL",
              g_failures);
  return g_failures == 0 ? 0 : 1;
}

/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * A deck's layer: the Karaoke's voice over its backing track, two files
 * played as one, each under a fader of its own.
 *
 * Most checks lay a file over its own negative ("neg" in
 * `player_test_support.h`). In step, the two sum to exactly nothing, and a
 * single frame of drift leaves a residue the size of the signal's slope — so
 * a null is the whole proof of the lock, and each one stands beside a
 * control showing the same file is far from silent alone. The rest use
 * constant signals, where a sample is the sum of the levels heard and a
 * click is a sample that jumps.
 */

#include "player_test_support.h"

#include <atomic>
#include <cmath>
#include <cstdio>
#include <thread>
#include <vector>

namespace {

using player_test::Block;
using player_test::check;
using player_test::generating_ops;

constexpr uint32_t kBlock = 512;
constexpr double kRate = 48000.0;
/** Twenty milliseconds at 48 kHz: the glide every gain and entry takes. */
constexpr double kGlide = 960.0;
/** A long constant: 100 s, longer than any check plays. */
#define LONG_DC(level) "dc:48000:4800000:" level

const FeqDecoderOps& ops() {
  static const FeqDecoderOps table = generating_ops();
  return table;
}

FeqPlayer* make_player() {
  return feq_player_create(kRate, 2, kBlock, 48000, &ops());
}

/** Render blocks, pumping before each, and keep the left channel. */
std::vector<float> render_blocks(FeqPlayer* player, uint32_t blocks) {
  std::vector<float> heard;
  Block block(kBlock);
  for (uint32_t index = 0; index < blocks; ++index) {
    feq_player_pump(player);
    feq_player_render(player, block.pointers.data(), kBlock);
    heard.insert(heard.end(), block.storage.begin(),
                 block.storage.begin() + kBlock);
  }
  return heard;
}

double loudest(const std::vector<float>& samples, size_t from = 0) {
  double peak = 0.0;
  for (size_t at = from; at < samples.size(); ++at) {
    peak = std::fmax(peak, std::fabs(static_cast<double>(samples[at])));
  }
  return peak;
}

double largest_step(const std::vector<float>& samples, float before) {
  double largest = 0.0;
  float previous = before;
  for (const float sample : samples) {
    largest = std::fmax(largest, std::fabs(static_cast<double>(sample) -
                                           static_cast<double>(previous)));
    previous = sample;
  }
  return largest;
}

bool near(double value, double wanted, double tolerance = 1e-6) {
  return std::fabs(value - wanted) <= tolerance;
}

/** A deck playing `own` with `layer` over it, both faders up, past entry. */
FeqPlayer* layered(const char* own, const char* layer) {
  FeqPlayer* player = make_player();
  feq_player_load(player, 0, own);
  feq_player_load_layer(player, 0, layer);
  feq_player_set_deck_gain(player, 0, 1.0);
  feq_player_set_layer_gain(player, 0, 1.0);
  feq_player_set_playing(player, 1);
  return player;
}

void test_locked_from_the_first_frame() {
  std::printf("a layer loaded with its deck\n");
  FeqPlayer* player = layered("ramp:48000:480000", "negramp:48000:480000");
  check(feq_player_has_layer(player, 0) == 1, "is on the deck");
  const std::vector<float> heard = render_blocks(player, 40);
  check(loudest(heard) == 0.0,
        "over its own negative is silence from the first frame");

  feq_player_seek(player, 0, 3.0);
  const std::vector<float> sought = render_blocks(player, 20);
  check(feq_player_position_seconds(player, 0) > 3.0, "follows a seek");
  check(loudest(sought) == 0.0, "and is still in step after it");

  feq_player_set_playing(player, 0);
  render_blocks(player, 5);
  feq_player_set_playing(player, 1);
  check(loudest(render_blocks(player, 20)) == 0.0, "and after a pause");
  feq_player_destroy(player);

  FeqPlayer* control = layered("ramp:48000:480000", "negramp:48000:480000");
  feq_player_set_layer_gain(control, 0, 0.0);
  check(loudest(render_blocks(control, 40)) > 0.01,
        "control: the same deck with the layer's fader down is not silent");
  feq_player_destroy(control);
}

void test_locked_through_a_converter() {
  std::printf("a layer at another rate than the device\n");
  FeqPlayer* player =
      layered("tone:44100:2205000:997", "negtone:44100:2205000:997");
  check(loudest(render_blocks(player, 30)) == 0.0,
        "comes through its converter in step with the deck's");
  feq_player_seek(player, 0, 12.3);
  check(loudest(render_blocks(player, 30)) == 0.0, "and after a seek");
  feq_player_destroy(player);

  /**
   * Joined mid-song, the layer's converter starts afresh while the deck's has
   * run since the top. One file frame of drift is a residue of 0.14 on this
   * tone; joined on the cursor where the two converters' phases meet, all
   * that is left is the deck's phase accumulated in a double.
   */
  FeqPlayer* joining = make_player();
  feq_player_load(joining, 0, "tone:44100:2205000:997");
  feq_player_set_layer_gain(joining, 0, 1.0);
  feq_player_set_playing(joining, 1);
  // 31 blocks: 15872 frames, not a whole number of the 160 frames in which
  // 44.1 kHz and 48 kHz come back into phase — thirty would be, and would
  // join in phase by luck.
  const std::vector<float> alone = render_blocks(joining, 31);
  check(loudest(alone) > 0.9, "control: the deck alone plays its tone");
  check(feq_player_load_layer(joining, 0, "negtone:44100:2205000:997") == 1,
        "joins a deck already playing");
  const std::vector<float> joined = render_blocks(joining, 30);
  check(loudest(joined, 10 * kBlock) < 1e-4,
        "on the frame and the phase the deck has reached");
  feq_player_destroy(joining);
}

void test_joining_mid_song() {
  std::printf("a layer joining a deck that is playing\n");
  FeqPlayer* player = make_player();
  feq_player_load(player, 0, "ramp:48000:480000");
  feq_player_set_layer_gain(player, 0, 1.0);
  feq_player_set_playing(player, 1);
  const std::vector<float> before = render_blocks(player, 20);
  check(loudest(before) > 0.005, "control: the deck alone is heard");
  feq_player_load_layer(player, 0, "negramp:48000:480000");
  const std::vector<float> after = render_blocks(player, 20);
  check(loudest(after, 10 * kBlock) == 0.0,
        "is in step with it from where it joins");
  check(largest_step(after, before.back()) < 1e-4,
        "and comes in over a glide, not on the sample");
  feq_player_destroy(player);
}

void test_faders_glide() {
  std::printf("the two faders\n");
  FeqPlayer* player = layered(LONG_DC("0.5"), LONG_DC("0.25"));
  const std::vector<float> both = render_blocks(player, 10);
  check(near(both.back(), 0.75), "sum the deck and the layer at full level");

  feq_player_set_deck_gain(player, 0, 0.0);
  const std::vector<float> down = render_blocks(player, 4);
  check(near(down.back(), 0.25), "the deck's own down leaves the layer");
  check(largest_step(down, both.back()) <= 0.5 / kGlide * 1.01,
        "gliding, never stepping");
  check(near(down[480], 0.5, 0.01), "over twenty milliseconds");

  feq_player_set_layer_gain(player, 0, 0.5);
  const std::vector<float> half = render_blocks(player, 4);
  check(near(half.back(), 0.125), "the layer's own scales the layer alone");
  check(largest_step(half, down.back()) <= 0.125 / kGlide * 1.01,
        "gliding too");

  feq_player_set_deck_gain(player, 0, 2.0);
  check(near(render_blocks(player, 4).back(), 0.625),
        "a gain past full is full");
  feq_player_set_layer_gain(player, 0, std::nan(""));
  check(near(render_blocks(player, 4).back(), 0.5),
        "and one that is not a number is silence");

  feq_player_set_playing(player, 0);
  feq_player_set_layer_gain(player, 0, 1.0);
  render_blocks(player, 1);
  feq_player_set_playing(player, 1);
  const std::vector<float> resumed = render_blocks(player, 1);
  // Under play's own 80 ms entry, which is 200/3840 of the way up here; a
  // glide still running from 0.5 would read 0.55.
  check(near(resumed[200] / (200.0 / 3840.0), 0.75, 1e-3),
        "moved while paused, a fader is where it was put on play");
  feq_player_destroy(player);
}

void test_off_back_and_replaced() {
  std::printf("a layer taken off, put back and replaced\n");
  FeqPlayer* player = layered(LONG_DC("0.5"), LONG_DC("0.25"));
  const std::vector<float> on = render_blocks(player, 10);
  check(feq_player_load_layer(player, 0, nullptr) == 1, "comes off");
  check(feq_player_has_layer(player, 0) == 0, "and says so");
  const std::vector<float> off = render_blocks(player, 6);
  check(near(off.back(), 0.5), "leaving the deck alone");
  check(largest_step(off, on.back()) <= 0.25 / kGlide * 1.5,
        "over a glide, not on the sample");

  feq_player_load_layer(player, 0, LONG_DC("0.125"));
  const std::vector<float> back = render_blocks(player, 10);
  check(near(back.back(), 0.625), "a new one is heard");
  check(largest_step(back, off.back()) <= 0.125 / kGlide * 1.5,
        "coming in over a glide");

  feq_player_load_layer(player, 0, "neg" LONG_DC("0.25"));
  const std::vector<float> replaced = render_blocks(player, 10);
  check(near(replaced.back(), 0.25), "replaced, the new one is heard");
  check(largest_step(replaced, back.back()) <= 0.25 / kGlide * 1.5,
        "the old one leaving and the new one coming in, neither stepping");
  feq_player_destroy(player);
}

void test_a_load_takes_the_layer_off() {
  std::printf("a deck loaded with something else\n");
  FeqPlayer* player = layered(LONG_DC("0.5"), LONG_DC("0.25"));
  feq_player_set_deck_gain(player, 0, 0.3);
  const std::vector<float> before = render_blocks(player, 10);
  check(near(before.back(), 0.4), "control: deck at 0.3 and layer at 1");
  feq_player_load(player, 0, LONG_DC("0.2"));
  check(feq_player_has_layer(player, 0) == 0, "loses its layer");
  const std::vector<float> after = render_blocks(player, 12);
  check(near(after.back(), 0.2), "and plays the new file at full level");
  check(largest_step(after, before.back()) < 2e-3, "without a click");

  feq_player_load(player, 0, LONG_DC("0.4"));
  feq_player_set_deck_gain(player, 0, 0.5);
  check(near(render_blocks(player, 12).back(), 0.2),
        "a fader moved just after a load is kept");
  feq_player_destroy(player);
}

void test_a_short_layer() {
  std::printf("a layer shorter than its deck\n");
  FeqPlayer* player = layered(LONG_DC("0.5"), "dc:48000:4800:0.25");
  const std::vector<float> heard = render_blocks(player, 30);
  // Past play's 80 ms entry (3840 frames) and short of the layer's end.
  check(near(heard[4000], 0.75), "plays while it lasts");
  check(near(heard.back(), 0.5), "and is silence after its end");
  check(feq_player_deck_state(player, 0) == FEQ_DECK_READY,
        "while the deck plays on");
  feq_player_destroy(player);

  // Sought past the layer's end: the deck alone, from the seek's first frame.
  FeqPlayer* sought = layered(LONG_DC("0.5"), "dc:48000:240000:0.25");
  check(near(render_blocks(sought, 20).back(), 0.75),
        "control: both heard before the seek");
  feq_player_seek(sought, 0, 20.0);
  const std::vector<float> after = render_blocks(sought, 1);
  // Under the seek's own 80 ms entry, 400/3840 of the way up.
  check(near(after[400] / (400.0 / 3840.0), 0.5, 1e-4),
        "sought past its end, the deck plays alone");
  feq_player_destroy(sought);
}

void test_refusals() {
  std::printf("a layer that cannot be played\n");
  FeqPlayer* player = make_player();
  check(feq_player_load_layer(player, 0, LONG_DC("0.25")) == 0,
        "is refused on an empty deck");
  check(feq_player_load_layer(player, 0, nullptr) == 1,
        "and taking none off always succeeds");
  check(feq_player_load_layer(player, 2, LONG_DC("0.25")) == 0,
        "a deck that does not exist has none");
  feq_player_load(player, 0, LONG_DC("0.5"));
  check(feq_player_load_layer(player, 0, "no-such-file") == 0,
        "a file that will not open is refused");
  check(feq_player_has_layer(player, 0) == 0, "and is not on the deck");
  feq_player_set_playing(player, 1);
  check(near(render_blocks(player, 10).back(), 0.5),
        "which plays as it did");
  feq_player_destroy(player);
}

void test_locked_through_a_fade() {
  std::printf("a layered deck fading out\n");
  FeqPlayer* player = layered("ramp:48000:480000", "negramp:48000:480000");
  render_blocks(player, 10);
  feq_player_load(player, 1, LONG_DC("0.3"));
  feq_player_start_crossfade(player, 1, 200.0, FEQ_CROSSFADE_EQUAL_POWER);
  const std::vector<float> fade = render_blocks(player, 30);
  double lowest = 0.0;
  double highest = 0.0;
  for (const float sample : fade) {
    lowest = std::fmin(lowest, static_cast<double>(sample));
    highest = std::fmax(highest, static_cast<double>(sample));
  }
  // The incoming deck is a positive constant; any residue of the outgoing
  // pair would be a ramp's slope times the drift, and negative.
  check(lowest >= 0.0, "stays in step all the way out");
  check(highest <= 0.3 + 1e-6 && near(fade.back(), 0.3),
        "while the next track comes in");
  feq_player_destroy(player);
}

/**
 * The decoder and the audio thread at once, as in the host: seeks both ways
 * and the layer replaced while blocks are rendered. A ramp under its own
 * negative is `f(n) - g·f(m)`: never below zero while the layer frame is the
 * deck's own (m = n) at any gain up to 1, entering, leaving or missing — and
 * below zero whenever a frame decoded for somewhere the deck has left is
 * heard ahead of it, which is what a stale generation or a slot rewritten
 * under the reader would be.
 *
 * The layer ends at 45 s and the seeks reach 90, so it is also sought past
 * its end, refused when it rejoins out there, and taken up again by a load
 * that lands inside it.
 */
void test_two_threads_never_part() {
  std::printf("a layer under a decoder and an audio thread at once\n");
  FeqPlayer* player =
      layered("ramp:48000:4800000", "negramp:48000:2160000");
  std::atomic<bool> done{false};
  std::atomic<uint32_t> moves{0};
  std::thread decoder([&]() {
    uint32_t step = 0;
    while (!done.load(std::memory_order_acquire)) {
      feq_player_pump(player);
      ++step;
      if (step % 23 == 0) {
        // Anywhere in the first 90 s, back as often as forward.
        const double to = static_cast<double>((step * 7919u) % 90000u) / 1e3;
        feq_player_seek(player, 0, to);
        moves.fetch_add(1, std::memory_order_relaxed);
      }
      if (step % 97 == 0) {
        feq_player_load_layer(player, 0, "negramp:48000:2160000");
        moves.fetch_add(1, std::memory_order_relaxed);
      }
    }
  });
  Block block(kBlock);
  double lowest = 0.0;
  double highest = 0.0;
  // Until the decoder has moved things 400 times, however long that takes
  // on this machine; the cap is only there so a decoder that never moves
  // fails the control instead of hanging the run.
  for (uint32_t index = 0;
       moves.load(std::memory_order_relaxed) < 400 && index < 4000000;
       ++index) {
    feq_player_render(player, block.pointers.data(), kBlock);
    for (uint32_t at = 0; at < kBlock; ++at) {
      lowest = std::fmin(lowest, static_cast<double>(block.storage[at]));
      highest = std::fmax(highest, static_cast<double>(block.storage[at]));
    }
  }
  done.store(true, std::memory_order_release);
  decoder.join();
  check(moves.load() >= 400, "control: the decoder moved the deck and layer");
  check(highest > 0.0, "control: the deck was heard alone at times");
  check(lowest >= 0.0, "no frame of the layer was ever heard out of step");
  feq_player_destroy(player);
}

}  // namespace

int main() {
  test_locked_from_the_first_frame();
  test_locked_through_a_converter();
  test_joining_mid_song();
  test_faders_glide();
  test_off_back_and_replaced();
  test_a_load_takes_the_layer_off();
  test_a_short_layer();
  test_refusals();
  test_locked_through_a_fade();
  test_two_threads_never_part();
  return player_test::finish();
}

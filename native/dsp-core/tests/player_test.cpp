/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The player, driven by a decoder that generates rather than reads.
 *
 * No file touches this test. What is being checked is the transport — the
 * rings, the seek handshake, the fade and the promotion at the end of it — and
 * a real file would only add a way for the test to fail for reasons that are
 * not the player's.
 */

#include "fluideq/player.h"

#include <cmath>
#include <cstdio>
#include <cstring>
#include <string>
#include <vector>

namespace {

constexpr double kPi = 3.14159265358979323846;
int g_failures = 0;

void check(bool ok, const char* what) {
  std::printf("  %-4s %s\n", ok ? "ok" : "FAIL", what);
  if (!ok) {
    ++g_failures;
  }
}

/**
 * A decoder whose files are described by their name.
 *
 * "tone:<rate>:<frames>:<hz>" is a sine; "ramp:<rate>:<frames>" counts upwards
 * so a test can name the exact frame it is looking at, which is what makes the
 * seek check possible at all.
 */
struct Source {
  bool ramp = false;
  uint32_t rate = 48000;
  uint64_t frames = 0;
  double hz = 0.0;
  uint64_t position = 0;
};

double sample_at(const Source& source, uint64_t frame) {
  if (source.ramp) {
    // One per frame, scaled so a whole track stays inside a float's exact
    // integer range and a test can read the frame number back out.
    return static_cast<double>(frame) / 1000000.0;
  }
  return std::sin((2.0 * kPi * source.hz * static_cast<double>(frame)) /
                  static_cast<double>(source.rate));
}

/** Split on colons. Hand-rolled because MSVC rejects `sscanf` under /WX. */
std::vector<std::string> split(const std::string& text) {
  std::vector<std::string> parts;
  size_t at = 0;
  for (;;) {
    const size_t next = text.find(':', at);
    if (next == std::string::npos) {
      parts.push_back(text.substr(at));
      return parts;
    }
    parts.push_back(text.substr(at, next - at));
    at = next + 1;
  }
}

void* decoder_open(void* /*user*/, const char* path, FeqDecoderInfo* info) {
  const std::vector<std::string> parts = split(std::string(path));
  if (parts.size() < 3) {
    return nullptr;
  }
  auto* source = new Source();
  source->ramp = parts[0] == "ramp";
  if (!source->ramp && (parts[0] != "tone" || parts.size() < 4)) {
    delete source;
    return nullptr;
  }
  source->rate = static_cast<uint32_t>(std::stoul(parts[1]));
  source->frames = std::stoull(parts[2]);
  source->hz = source->ramp ? 0.0 : std::stod(parts[3]);

  info->sample_rate = source->rate;
  info->channels = 2;
  info->total_frames = source->frames;
  return source;
}

void decoder_close(void* /*user*/, void* handle) {
  delete static_cast<Source*>(handle);
}

uint32_t decoder_read(void* /*user*/, void* handle, float* const* channels,
                      uint32_t frames) {
  auto* source = static_cast<Source*>(handle);
  uint32_t produced = 0;
  while (produced < frames && source->position < source->frames) {
    const double value = sample_at(*source, source->position);
    channels[0][produced] = static_cast<float>(value);
    channels[1][produced] = static_cast<float>(value);
    ++produced;
    ++source->position;
  }
  return produced;
}

int decoder_seek(void* /*user*/, void* handle, uint64_t frame) {
  auto* source = static_cast<Source*>(handle);
  if (frame > source->frames) {
    return 0;
  }
  source->position = frame;
  return 1;
}

FeqDecoderOps generating_ops() {
  FeqDecoderOps ops{};
  ops.user = nullptr;
  ops.open = decoder_open;
  ops.close = decoder_close;
  ops.read = decoder_read;
  ops.seek = decoder_seek;
  return ops;
}

struct Block {
  std::vector<float> storage;
  std::vector<float*> pointers;

  explicit Block(uint32_t frames) {
    storage.assign(static_cast<size_t>(2) * frames, 0.0f);
    pointers = {storage.data(), storage.data() + frames};
  }
};

void test_plays_what_was_loaded() {
  std::printf("playback\n");
  const FeqDecoderOps ops = generating_ops();
  FeqPlayer* player = feq_player_create(48000.0, 2, 512, 48000, &ops);
  check(player != nullptr, "a player is built");
  check(feq_player_load(player, 0, "ramp:48000:96000") != 0,
        "a deck loads");
  check(feq_player_deck_state(player, 0) == FEQ_DECK_READY,
        "and reports itself ready");
  check(feq_player_deck_primed(player, 0) == 0,
        "but not primed before anything has been decoded");

  feq_player_pump(player);
  check(feq_player_deck_primed(player, 0) != 0,
        "primed once the read-ahead has filled");
  check(std::fabs(feq_player_duration_seconds(player, 0) - 2.0) < 1e-9,
        "the duration comes from the decoder");

  // Silence while stopped, and not the buffer's contents: a paused player that
  // emitted whatever was in the ring would play a burst on every pause.
  Block block(512);
  feq_player_render(player, block.pointers.data(), 512);
  bool silent = true;
  for (uint32_t at = 0; at < 512; ++at) {
    silent = silent && block.storage[at] == 0.0f;
  }
  check(silent, "a stopped player emits silence, not the buffer");

  feq_player_set_playing(player, 1);
  feq_player_render(player, block.pointers.data(), 512);
  bool in_order = true;
  for (uint32_t at = 0; at < 512; ++at) {
    const double expected = static_cast<double>(at) / 1000000.0;
    in_order = in_order && std::fabs(static_cast<double>(block.storage[at]) -
                                     expected) < 1e-7;
  }
  check(in_order, "the first block is the file's first frames, in order");

  feq_player_destroy(player);
}

void test_seek_drops_what_was_read_ahead() {
  std::printf("seek\n");
  const FeqDecoderOps ops = generating_ops();
  FeqPlayer* player = feq_player_create(48000.0, 2, 512, 48000, &ops);
  feq_player_load(player, 0, "ramp:48000:480000");
  feq_player_set_playing(player, 1);
  feq_player_pump(player);

  Block block(512);
  feq_player_render(player, block.pointers.data(), 512);

  /**
   * A second of audio is already decoded and waiting when the seek lands.
   *
   * If the reader did not drop it, the next block would be the frames after
   * the ones just played — the seek would appear to do nothing for a whole
   * second and then jump, which is the shape of the bug this checks for.
   */
  check(feq_player_seek(player, 0, 5.0) != 0, "a seek is accepted");
  feq_player_pump(player);
  feq_player_render(player, block.pointers.data(), 512);

  const double expected = 5.0 * 48000.0 / 1000000.0;
  const double landed = static_cast<double>(block.storage[0]);
  std::printf("       landed at frame %.0f, wanted %.0f\n", landed * 1000000.0,
              expected * 1000000.0);
  check(std::fabs(landed - expected) < 1e-6,
        "the next block starts where the seek asked, not a second later");
  check(feq_player_position_seconds(player, 0) > 4.9 &&
            feq_player_position_seconds(player, 0) < 5.2,
        "and the reported position agrees");
  feq_player_destroy(player);
}

void test_crossfade_between_decks() {
  std::printf("crossfade\n");
  const FeqDecoderOps ops = generating_ops();
  FeqPlayer* player = feq_player_create(48000.0, 2, 512, 48000, &ops);
  // Two constants rather than two tones, so a fade is readable by eye: deck 0
  // sits at zero and deck 1 climbs, and any sample of the output says exactly
  // how far the fade has travelled.
  feq_player_load(player, 0, "tone:48000:480000:0");
  feq_player_load(player, 1, "tone:48000:480000:12000");
  feq_player_set_playing(player, 1);
  feq_player_pump(player);

  Block block(512);
  feq_player_render(player, block.pointers.data(), 512);
  bool from_deck_zero = true;
  for (uint32_t at = 0; at < 512; ++at) {
    from_deck_zero = from_deck_zero && block.storage[at] == 0.0f;
  }
  check(from_deck_zero, "only the active deck is audible before a fade");

  const uint32_t fade_frames = 4096;
  feq_player_start_crossfade(player, 1, 1000.0 * fade_frames / 48000.0,
                             FEQ_CROSSFADE_EQUAL_POWER);
  double loudest = 0.0;
  for (uint32_t rendered = 0; rendered < fade_frames + 1024;
       rendered += 512) {
    feq_player_pump(player);
    feq_player_render(player, block.pointers.data(), 512);
    for (uint32_t at = 0; at < 512; ++at) {
      const double magnitude = std::fabs(static_cast<double>(block.storage[at]));
      loudest = magnitude > loudest ? magnitude : loudest;
    }
  }
  check(loudest > 0.9, "the incoming deck arrives at full level");
  check(feq_player_crossfade_progress(player) == 1.0,
        "the fade reports itself finished");
  check(feq_player_active_deck(player) == 1,
        "and the incoming deck was promoted without the caller asking");

  /**
   * The reason promotion happens inside `render`.
   *
   * If it waited for another thread to notice, the mixer would fall back to
   * the outgoing deck for however many blocks that took — the track that just
   * faded out, back at full level. Rendering again immediately is the check.
   */
  feq_player_pump(player);
  feq_player_render(player, block.pointers.data(), 512);
  double after = 0.0;
  for (uint32_t at = 0; at < 512; ++at) {
    const double magnitude = std::fabs(static_cast<double>(block.storage[at]));
    after = magnitude > after ? magnitude : after;
  }
  check(after > 0.5, "the block after the fade is still the incoming deck");
  feq_player_destroy(player);
}

void test_end_of_file() {
  std::printf("end of file\n");
  const FeqDecoderOps ops = generating_ops();
  FeqPlayer* player = feq_player_create(48000.0, 2, 512, 48000, &ops);
  // Shorter than the prime threshold, so a deck that only ever primes on a
  // frame count would never start this one.
  feq_player_load(player, 0, "tone:48000:2000:440");
  feq_player_pump(player);
  check(feq_player_deck_primed(player, 0) != 0,
        "a file shorter than the prime threshold is still primed");

  feq_player_set_playing(player, 1);
  Block block(512);
  for (int index = 0; index < 8; ++index) {
    feq_player_pump(player);
    feq_player_render(player, block.pointers.data(), 512);
  }
  check(feq_player_deck_state(player, 0) == FEQ_DECK_ENDED,
        "the deck reports the file finished once the buffer runs dry");

  bool silent = true;
  for (uint32_t at = 0; at < 512; ++at) {
    silent = silent && block.storage[at] == 0.0f;
  }
  // Silence rather than the last block again: an underrun that repeated the
  // previous block would be a stutter, which is louder than a gap and sounds
  // like the material.
  check(silent, "and emits silence past the end rather than repeating");
  feq_player_destroy(player);
}

void test_rate_conversion_in_the_deck() {
  std::printf("44.1 in a 48 player\n");
  const FeqDecoderOps ops = generating_ops();
  FeqPlayer* player = feq_player_create(48000.0, 2, 512, 96000, &ops);
  feq_player_load(player, 0, "tone:44100:441000:1000");
  feq_player_set_playing(player, 1);

  /**
   * Ten seconds of 44.1 kHz has to come out as ten seconds of 48 kHz.
   *
   * A deck that ignored the file's rate would play it 8.8% fast — a semitone
   * and a half sharp, which is obvious on a voice and easy to miss on a test
   * that only checks the samples are not silent.
   */
  uint64_t rendered = 0;
  Block block(512);
  while (feq_player_deck_state(player, 0) != FEQ_DECK_ENDED &&
         rendered < 48000 * 12) {
    feq_player_pump(player);
    feq_player_render(player, block.pointers.data(), 512);
    rendered += 512;
  }
  const double seconds = static_cast<double>(rendered) / 48000.0;
  std::printf("       ten seconds of 44.1 rendered as %.2f seconds\n", seconds);
  check(seconds > 9.9 && seconds < 10.3,
        "the file's rate is converted, not ignored");
  feq_player_destroy(player);
}

}  // namespace

int main() {
  std::printf("fluideq player\n");
  test_plays_what_was_loaded();
  test_seek_drops_what_was_read_ahead();
  test_crossfade_between_decks();
  test_end_of_file();
  test_rate_conversion_in_the_deck();
  if (g_failures == 0) {
    std::printf("\nall checks passed\n");
    return 0;
  }
  std::printf("\n%d check(s) failed\n", g_failures);
  return 1;
}

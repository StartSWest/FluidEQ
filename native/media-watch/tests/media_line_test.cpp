/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/*
 * The media helper's lines, byte for byte.
 *
 * The app reads them with the parser it had for the PowerShell watcher, and
 * a line that parses but is spelled differently degrades silently: a key the
 * parser does not find reads as "no", "nothing" or "nobody". So the text is
 * pinned here, and systemMedia.test.ts parses the same reference line
 * (`NATIVE_READING`) — change one side and change the other in the same
 * commit.
 *
 * Non-ASCII text is written as its UTF-8 bytes: MSVC reads a source file
 * without a BOM in the machine's code page.
 */

#include "media_line.h"

#include <cstdint>
#include <cstdio>
#include <cstring>
#include <initializer_list>
#include <string>
#include <vector>

namespace {

int failures = 0;

void check(bool condition, const char* description) {
  std::printf("  %s %s\n", condition ? "ok  " : "FAIL", description);
  if (!condition) {
    ++failures;
  }
}

using fluideq_media::Cover;
using fluideq_media::Reading;

// A five-character Japanese song title (U+591C U+306B U+99C6 U+3051
// U+308B), split so no hex escape runs into the next character.
const std::string kNight =
    "\xe5\xa4\x9c"
    "\xe3\x81\xab"
    "\xe9\xa7\x86"
    "\xe3\x81\x91"
    "\xe3\x82\x8b";

Reading reference_reading() {
  Reading reading;
  reading.app = "Spotify.exe";
  reading.title = kNight + " \"Live\" \\ Tab\t";
  reading.artist = "YOASOBI\x01";
  reading.is_playing = true;
  reading.position_ms = 61500;
  reading.duration_ms = 261000;
  reading.can_next = true;
  reading.can_previous = false;
  reading.can_seek = true;
  reading.playing = {"Spotify.exe", "Chrome"};
  reading.cover_id = "0123456789abcdef";
  return reading;
}

void the_reading_line_is_the_watch_scripts() {
  const std::string expected =
      "{\"app\":\"Spotify.exe\",\"title\":\"" + kNight +
      " \\\"Live\\\" \\\\ Tab\\t\",\"artist\":\"YOASOBI\\u0001\","
      "\"isPlaying\":true,\"positionMs\":61500,\"durationMs\":261000,"
      "\"canNext\":true,\"canPrevious\":false,\"canSeek\":true,"
      "\"playing\":[\"Spotify.exe\",\"Chrome\"],"
      "\"coverId\":\"0123456789abcdef\"}";
  check(fluideq_media::reading_line(reference_reading()) == expected,
        "a reading is the reference line systemMedia.test.ts parses");

  Reading alone;
  alone.app = "Chrome";
  alone.title = "Song";
  alone.playing = {"Chrome"};
  check(fluideq_media::reading_line(alone) ==
            "{\"app\":\"Chrome\",\"title\":\"Song\",\"artist\":\"\","
            "\"isPlaying\":false,\"positionMs\":0,\"durationMs\":0,"
            "\"canNext\":false,\"canPrevious\":false,\"canSeek\":false,"
            "\"playing\":[\"Chrome\"],\"coverId\":\"\"}",
        "one program playing is still a list, and no cover is an empty id");

  Reading nobody = alone;
  nobody.playing.clear();
  check(fluideq_media::reading_line(nobody).find("\"playing\":[]") !=
            std::string::npos,
        "nobody playing is an empty list");
  check(std::string(fluideq_media::kNothingLine) == "null",
        "nothing playing is the word the parser reads as nothing");
}

void every_control_character_is_escaped() {
  std::string all;
  for (int value = 0; value < 0x20; ++value) {
    all.push_back(static_cast<char>(value));
  }
  const std::string escaped = fluideq_media::json_string(all);
  bool clean = true;
  for (const char value : escaped) {
    if (static_cast<unsigned char>(value) < 0x20) {
      clean = false;
    }
  }
  check(clean, "no raw control character reaches the line");
  // The positive control: a line break inside a title, raw, would end the
  // line on the pipe and split the reading in two.
  check(escaped.find("\\n") != std::string::npos &&
            escaped.find("\\u001f") != std::string::npos,
        "they go out as escapes, not dropped");
  check(fluideq_media::json_string(kNight) == "\"" + kNight + "\"",
        "text beyond ASCII goes out as the UTF-8 it is");
}

void the_shape_moves_in_whole_seconds() {
  Reading first = reference_reading();
  Reading later = first;
  later.position_ms = 61900;
  check(fluideq_media::reading_shape(first) ==
            fluideq_media::reading_shape(later),
        "400 ms of drift inside one second prints nothing");
  // Beside the null result, the control that proves the shape sees the
  // position at all.
  later.position_ms = 62600;
  check(fluideq_media::reading_shape(first) !=
            fluideq_media::reading_shape(later),
        "a new second prints");
  // The script's [int] rounded to nearest, ties to even.
  check(fluideq_media::whole_seconds(1500) == 2 &&
            fluideq_media::whole_seconds(2500) == 2 &&
            fluideq_media::whole_seconds(3500) == 4 &&
            fluideq_media::whole_seconds(1499) == 1,
        "seconds round the way the watch script's cast did");
  check(fluideq_media::ticks_to_ms(10000) == 1 &&
            fluideq_media::ticks_to_ms(15000) == 2 &&
            fluideq_media::ticks_to_ms(25000) == 2 &&
            fluideq_media::ticks_to_ms(612345678) == 61235,
        "100 ns ticks become milliseconds the same way");

  Reading other = first;
  other.playing = {"Spotify.exe"};
  check(fluideq_media::reading_shape(first) !=
            fluideq_media::reading_shape(other),
        "somebody else starting or stopping prints");
  other = first;
  other.cover_id = "fedcba9876543210";
  check(fluideq_media::reading_shape(first) !=
            fluideq_media::reading_shape(other),
        "a cover arriving prints");
  other = first;
  other.title = "a|b";
  other.artist = "c";
  Reading swapped = first;
  swapped.title = "a";
  swapped.artist = "b|c";
  check(fluideq_media::reading_shape(other) !=
            fluideq_media::reading_shape(swapped),
        "a title containing | is not confused with the artist after it");
}

std::vector<std::uint8_t> bytes_of(const char* text) {
  return std::vector<std::uint8_t>(text, text + std::strlen(text));
}

void base64_is_the_standard_one() {
  const char* plain[] = {"", "f", "fo", "foo", "foob", "fooba", "foobar"};
  const char* encoded[] = {"",         "Zg==",     "Zm8=",    "Zm9v",
                           "Zm9vYg==", "Zm9vYmE=", "Zm9vYmFy"};
  bool all = true;
  for (std::size_t at = 0; at < 7; ++at) {
    const auto bytes = bytes_of(plain[at]);
    if (fluideq_media::base64(bytes.data(), bytes.size()) != encoded[at]) {
      all = false;
    }
  }
  check(all, "RFC 4648's test vectors");
  const std::uint8_t png[] = {0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A};
  check(fluideq_media::base64(png, sizeof(png)) == "iVBORw0KGgo=",
        "a PNG's signature is the data systemMedia.test.ts reads");
}

std::vector<std::uint8_t> picture(std::initializer_list<std::uint8_t> head,
                                  std::size_t size) {
  std::vector<std::uint8_t> bytes(size, 0);
  std::size_t at = 0;
  for (const std::uint8_t value : head) {
    bytes[at++] = value;
  }
  return bytes;
}

void pictures_are_sniffed_by_their_bytes() {
  const auto jpeg = picture({0xFF, 0xD8, 0xFF}, 64);
  const auto png = picture({0x89, 0x50, 0x4E, 0x47}, 64);
  const auto webp =
      picture({0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50}, 64);
  const auto gif = picture({0x47, 0x49, 0x46, 0x38}, 64);
  const char* jpeg_type = fluideq_media::image_type(jpeg.data(), jpeg.size());
  const char* png_type = fluideq_media::image_type(png.data(), png.size());
  const char* webp_type = fluideq_media::image_type(webp.data(), webp.size());
  const char* gif_type = fluideq_media::image_type(gif.data(), gif.size());
  check(jpeg_type != nullptr && std::strcmp(jpeg_type, "image/jpeg") == 0 &&
            png_type != nullptr && std::strcmp(png_type, "image/png") == 0 &&
            webp_type != nullptr && std::strcmp(webp_type, "image/webp") == 0 &&
            gif_type != nullptr && std::strcmp(gif_type, "image/gif") == 0,
        "the four formats the app admits");

  const auto svg = bytes_of(
      "<svg xmlns='http://www.w3.org/2000/svg'>"
      "<rect width='10' height='10'/></svg>                ");
  check(svg.size() >= 64 &&
            fluideq_media::image_type(svg.data(), svg.size()) == nullptr,
        "anything else is refused, never guessed at");

  const auto tiny = picture({0x89, 0x50, 0x4E, 0x47}, 63);
  const auto huge =
      picture({0x89, 0x50, 0x4E, 0x47}, fluideq_media::kCoverMaxBytes + 1);
  const auto largest =
      picture({0x89, 0x50, 0x4E, 0x47}, fluideq_media::kCoverMaxBytes);
  check(fluideq_media::image_type(tiny.data(), tiny.size()) == nullptr &&
            fluideq_media::image_type(huge.data(), huge.size()) == nullptr,
        "under 64 bytes or over 3 MB is no picture");
  check(fluideq_media::image_type(largest.data(), largest.size()) != nullptr,
        "3 MB exactly still is one");
}

void the_cover_line_and_its_id() {
  // MD5 of nothing: d41d8cd98f00b204e9800998ecf8427e.
  const std::uint8_t md5[16] = {0xd4, 0x1d, 0x8c, 0xd9, 0x8f, 0x00,
                                0xb2, 0x04, 0xe9, 0x80, 0x09, 0x98,
                                0xec, 0xf8, 0x42, 0x7e};
  check(fluideq_media::cover_id(md5) == "d41d8cd98f00b204",
        "an id is the first eight bytes of the MD5, lower-case hex");

  Cover cover;
  cover.id = "0123456789abcdef";
  cover.type = "image/png";
  cover.data = "iVBORw0KGgo=";
  check(fluideq_media::cover_line(cover) ==
            "{\"cover\":{\"id\":\"0123456789abcdef\",\"type\":\"image/png\","
            "\"data\":\"iVBORw0KGgo=\"}}",
        "a cover line is the one systemMedia.test.ts reads");
}

}  // namespace

int main() {
  the_reading_line_is_the_watch_scripts();
  every_control_character_is_escaped();
  the_shape_moves_in_whole_seconds();
  base64_is_the_standard_one();
  pictures_are_sniffed_by_their_bytes();
  the_cover_line_and_its_id();
  if (failures != 0) {
    std::printf("%d media line check(s) failed\n", failures);
    return 1;
  }
  std::printf("media lines: all checks passed\n");
  return 0;
}

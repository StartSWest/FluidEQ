/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/*
 * The lines FluidEQ-Media.exe prints, as text and nothing else.
 *
 * Kept apart from main.cpp, and free of Windows, so the exact bytes can be
 * held by a test that runs on every platform (tests/media_line_test.cpp):
 * the app's parser (`parseSystemMediaLine`, `parseSystemMediaCover` in
 * src/main/systemMedia.ts) reads these lines unchanged from the PowerShell
 * watcher they replace, and a field spelled differently here would not fail
 * loudly — it would read as "absent", which the parser turns into "no",
 * "nothing" or "nobody". systemMedia.test.ts parses the reference lines this
 * test pins, so the two sides are held to the same text.
 *
 * Every piece of text arrives here as UTF-8 (main.cpp converts Windows'
 * UTF-16 once), and the app decodes the pipe as UTF-8.
 */

#pragma once

#include <cmath>
#include <cstddef>
#include <cstdint>
#include <cstdio>
#include <string>
#include <string_view>
#include <vector>

namespace fluideq_media {

/** One reading: what the one session the bar shows is doing. */
struct Reading {
  std::string app;
  std::string title;
  std::string artist;
  bool is_playing = false;
  std::int64_t position_ms = 0;
  std::int64_t duration_ms = 0;
  bool can_next = false;
  bool can_previous = false;
  bool can_seek = false;
  /** Every other program playing right now, this app's own left out. */
  std::vector<std::string> playing;
  /** Empty until a picture for this song has been read. */
  std::string cover_id;
};

/** A picture, sent once on a line of its own before the reading naming it. */
struct Cover {
  std::string id;
  /** One of the four `image_type` answers; never anything else. */
  const char* type = "";
  std::string data;
};

/** Smallest and largest picture taken, as the watch script took them. */
constexpr std::size_t kCoverMinBytes = 64;
constexpr std::size_t kCoverMaxBytes = 3u * 1024u * 1024u;

/**
 * Milliseconds from WinRT's 100 ns ticks, rounded to nearest with ties to
 * even — which is what the watch script's `[int]` cast did, and the default
 * rounding mode `nearbyint` uses.
 */
inline std::int64_t ticks_to_ms(std::int64_t ticks) {
  return static_cast<std::int64_t>(
      std::nearbyint(static_cast<double>(ticks) / 10000.0));
}

/**
 * The position as the bar shows it, in whole seconds — rounded the same way
 * as `ticks_to_ms`, again because that is the `[int]` the script compared.
 */
inline std::int64_t whole_seconds(std::int64_t ms) {
  return static_cast<std::int64_t>(
      std::nearbyint(static_cast<double>(ms) / 1000.0));
}

/**
 * A JSON string. Only what JSON requires is escaped — the quote, the
 * backslash and the control characters — and everything else goes out as the
 * UTF-8 it already is.
 */
inline std::string json_string(std::string_view text) {
  std::string out;
  out.reserve(text.size() + 2);
  out.push_back('"');
  for (const char value : text) {
    const auto byte = static_cast<unsigned char>(value);
    if (value == '"') {
      out += "\\\"";
    } else if (value == '\\') {
      out += "\\\\";
    } else if (value == '\n') {
      out += "\\n";
    } else if (value == '\r') {
      out += "\\r";
    } else if (value == '\t') {
      out += "\\t";
    } else if (byte < 0x20) {
      char escaped[8]{};
      std::snprintf(escaped, sizeof(escaped), "\\u%04x",
                    static_cast<unsigned int>(byte));
      out += escaped;
    } else {
      out.push_back(value);
    }
  }
  out.push_back('"');
  return out;
}

/** The reading line, keys in the order the watch script wrote them. */
inline std::string reading_line(const Reading& reading) {
  std::string out = "{\"app\":";
  out += json_string(reading.app);
  out += ",\"title\":";
  out += json_string(reading.title);
  out += ",\"artist\":";
  out += json_string(reading.artist);
  out += ",\"isPlaying\":";
  out += reading.is_playing ? "true" : "false";
  out += ",\"positionMs\":";
  out += std::to_string(reading.position_ms);
  out += ",\"durationMs\":";
  out += std::to_string(reading.duration_ms);
  out += ",\"canNext\":";
  out += reading.can_next ? "true" : "false";
  out += ",\"canPrevious\":";
  out += reading.can_previous ? "true" : "false";
  out += ",\"canSeek\":";
  out += reading.can_seek ? "true" : "false";
  // Always a list, a list of one included. The script's JSON collapsed a
  // list of one into a bare string, and the parser still reads both.
  out += ",\"playing\":[";
  for (std::size_t at = 0; at < reading.playing.size(); ++at) {
    if (at > 0) {
      out.push_back(',');
    }
    out += json_string(reading.playing[at]);
  }
  out += "],\"coverId\":";
  out += json_string(reading.cover_id);
  out.push_back('}');
  return out;
}

/**
 * What decides whether a reading is worth a line: everything the bar draws,
 * with the position in whole seconds. A player's timeline moves on every
 * update it publishes, and a second's drift is invisible on a seek bar and
 * worth nothing on the wire.
 *
 * The line itself with the position swapped for its second, so no field can
 * run into its neighbour — the script's `|`-joined shape could not tell a
 * title containing `|` from the artist after it.
 */
inline std::string reading_shape(const Reading& reading) {
  Reading shape = reading;
  shape.position_ms = whole_seconds(reading.position_ms);
  return reading_line(shape);
}

/** Nothing playing: no session, or one that could not be read. */
constexpr const char* kNothingLine = "null";

/**
 * The picture's line. Every part is already safe inside a JSON string — a
 * hex id, one of four fixed types, base64 — so nothing is escaped.
 */
inline std::string cover_line(const Cover& cover) {
  std::string out = "{\"cover\":{\"id\":\"";
  out += cover.id;
  out += "\",\"type\":\"";
  out += cover.type;
  out += "\",\"data\":\"";
  out += cover.data;
  out += "\"}}";
  return out;
}

/**
 * The picture's format from its own first bytes, or nothing for anything but
 * the four the app admits. Read from the bytes rather than from the stream's
 * content type, which the watch script could not read either and which is
 * whatever the other program says.
 */
inline const char* image_type(const std::uint8_t* bytes, std::size_t size) {
  if (size < kCoverMinBytes || size > kCoverMaxBytes) {
    return nullptr;
  }
  if (bytes[0] == 0xFF && bytes[1] == 0xD8) {
    return "image/jpeg";
  }
  if (bytes[0] == 0x89 && bytes[1] == 0x50 && bytes[2] == 0x4E &&
      bytes[3] == 0x47) {
    return "image/png";
  }
  if (bytes[0] == 0x52 && bytes[1] == 0x49 && bytes[8] == 0x57 &&
      bytes[9] == 0x45) {
    return "image/webp";
  }
  if (bytes[0] == 0x47 && bytes[1] == 0x49 && bytes[2] == 0x46) {
    return "image/gif";
  }
  return nullptr;
}

/** Standard base64 with padding: what a `data:` URL takes. */
inline std::string base64(const std::uint8_t* bytes, std::size_t size) {
  static constexpr char kDigits[] =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  std::string out;
  out.reserve(((size + 2) / 3) * 4);
  std::size_t at = 0;
  for (; at + 3 <= size; at += 3) {
    const std::uint32_t group = (std::uint32_t{bytes[at]} << 16) |
                                (std::uint32_t{bytes[at + 1]} << 8) |
                                std::uint32_t{bytes[at + 2]};
    out.push_back(kDigits[(group >> 18) & 0x3F]);
    out.push_back(kDigits[(group >> 12) & 0x3F]);
    out.push_back(kDigits[(group >> 6) & 0x3F]);
    out.push_back(kDigits[group & 0x3F]);
  }
  const std::size_t left = size - at;
  if (left == 1) {
    const std::uint32_t group = std::uint32_t{bytes[at]} << 16;
    out.push_back(kDigits[(group >> 18) & 0x3F]);
    out.push_back(kDigits[(group >> 12) & 0x3F]);
    out += "==";
  } else if (left == 2) {
    const std::uint32_t group = (std::uint32_t{bytes[at]} << 16) |
                                (std::uint32_t{bytes[at + 1]} << 8);
    out.push_back(kDigits[(group >> 18) & 0x3F]);
    out.push_back(kDigits[(group >> 12) & 0x3F]);
    out.push_back(kDigits[(group >> 6) & 0x3F]);
    out.push_back('=');
  }
  return out;
}

/** A cover's id: the first eight bytes of its MD5, in lower-case hex. */
inline std::string cover_id(const std::uint8_t (&md5)[16]) {
  static constexpr char kHex[] = "0123456789abcdef";
  std::string out;
  out.reserve(16);
  for (std::size_t at = 0; at < 8; ++at) {
    out.push_back(kHex[(md5[at] >> 4) & 0x0F]);
    out.push_back(kHex[md5[at] & 0x0F]);
  }
  return out;
}

}  // namespace fluideq_media

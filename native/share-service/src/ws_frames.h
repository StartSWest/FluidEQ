/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#pragma once

/**
 * RFC 6455 as the `ws` package speaks it, with no I/O: the opening
 * handshake both ways, frames written and read, and every rule `ws` holds a
 * peer to — so a FluidEQ in C++ and one in TypeScript accept and refuse the
 * same things. The checks and their order are `ws`'s own (receiver.js,
 * websocket-server.js, websocket.js), and so is every status code a broken
 * frame is answered with.
 */

#include <array>
#include <cstddef>
#include <cstdint>
#include <optional>
#include <span>
#include <string>
#include <string_view>
#include <utility>
#include <vector>

namespace feq::share::service::ws {

using Bytes = std::vector<std::uint8_t>;

inline constexpr std::uint8_t kContinuation = 0x0;
inline constexpr std::uint8_t kText = 0x1;
inline constexpr std::uint8_t kBinary = 0x2;
inline constexpr std::uint8_t kClose = 0x8;
inline constexpr std::uint8_t kPing = 0x9;
inline constexpr std::uint8_t kPong = 0xA;

/** A close code a frame may carry (`isValidStatusCode`). */
bool valid_status_code(int code);
/** Well-formed UTF-8: no overlong form, no surrogate, nothing past U+10FFFF. */
bool valid_utf8(std::span<const std::uint8_t> bytes);

/** `Sec-WebSocket-Accept` for a key. */
std::string accept_for(std::string_view key);
/** A fresh `Sec-WebSocket-Key`: sixteen random bytes in base64. */
std::string new_key();

struct HttpHead {
  /** A request's. */
  std::string method;
  std::string target;
  /** A response's. */
  int status = 0;
  /** Names in lower case, in the order they came; a repeat is joined
   * with ", " as Node joins them. */
  std::vector<std::pair<std::string, std::string>> headers;

  const std::string* header(std::string_view name) const;
};

/** The longest head Node's HTTP parser reads before refusing it. */
inline constexpr std::size_t kMaxHeadBytes = 16 * 1024;

/** Where the head ends, past its blank line; nothing while it has not. */
std::optional<std::size_t> head_end(std::span<const std::uint8_t> bytes);
std::optional<HttpHead> parse_request(std::string_view head);
std::optional<HttpHead> parse_response(std::string_view head);

struct UpgradeAnswer {
  bool accepted = false;
  /** What is written back: the 101, or the refusal the connection ends on. */
  std::string response;
};

/** The listener's answer to a request, as `ws`'s server gives it. */
UpgradeAnswer answer_upgrade(const HttpHead& request);
/** The answer to a request too long or malformed to read at all. */
std::string refusal(int status);

/** The client's request, as `ws` and Node's HTTP client write it. */
std::string client_request(std::string_view host, int port,
                           std::string_view path, std::string_view key);
/** Why a response does not open the connection; nothing when it does. */
std::optional<std::string> check_response(const HttpHead& response,
                                          std::string_view key);

/**
 * One whole frame, FIN set. A client masks what it sends (`mask`); a
 * server never does.
 */
Bytes frame(std::uint8_t opcode, std::span<const std::uint8_t> payload,
            const std::optional<std::array<std::uint8_t, 4>>& mask);
/** A close frame's payload: nothing, or the code and the reason. */
Bytes close_payload(std::optional<int> code, std::string_view reason);

/** Frames in, messages out, as `ws`'s Receiver reads them. */
class FrameReader {
 public:
  struct Event {
    enum class Kind { kMessage, kPing, kPong, kClose, kError };
    Kind kind = Kind::kMessage;
    Bytes data;
    bool binary = false;
    /** A close frame's code (1005 for none), or the error's status code. */
    int code = 0;
    /** A close frame's reason, or what the error was. */
    std::string text;
  };

  FrameReader(bool server, std::size_t max_payload)
      : server_(server), max_payload_(max_payload) {}

  /** Reads what arrived; stops for good after a close frame or an error. */
  void push(std::span<const std::uint8_t> bytes, std::vector<Event>& events);
  bool finished() const { return finished_; }

 private:
  bool read_one(std::vector<Event>& events);
  void fail(int code, std::string text, std::vector<Event>& events);

  bool server_;
  std::size_t max_payload_;
  Bytes pending_;
  std::size_t offset_ = 0;
  std::uint8_t fragmented_ = 0;
  std::size_t total_payload_ = 0;
  Bytes fragments_;
  bool finished_ = false;
};

}  // namespace feq::share::service::ws

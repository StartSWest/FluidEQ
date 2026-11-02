/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

// The opening handshake as `ws` and Node's HTTP parser hold a peer to it:
// the request and the answer, both ways (`ws_frames.h`).

#include <algorithm>
#include <cctype>
#include <charconv>

#include "fluideq/share/crypto.h"
#include "ws_frames.h"

namespace feq::share::service::ws {
namespace {

constexpr std::string_view kGuid = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";

/** `http.STATUS_CODES` for every status this side writes. */
std::string_view status_text(int status) {
  switch (status) {
    case 101:
      return "Switching Protocols";
    case 400:
      return "Bad Request";
    case 405:
      return "Method Not Allowed";
    case 426:
      return "Upgrade Required";
    case 431:
      return "Request Header Fields Too Large";
    default:
      return "Service Unavailable";
  }
}

std::string lower(std::string_view text) {
  std::string out(text);
  for (char& c : out) {
    c = static_cast<char>(std::tolower(static_cast<unsigned char>(c)));
  }
  return out;
}

std::string_view trim_ows(std::string_view text) {
  while (!text.empty() && (text.front() == ' ' || text.front() == '\t')) {
    text.remove_prefix(1);
  }
  while (!text.empty() && (text.back() == ' ' || text.back() == '\t')) {
    text.remove_suffix(1);
  }
  return text;
}

bool is_token_char(char c) {
  return std::isalnum(static_cast<unsigned char>(c)) != 0 ||
         std::string_view("!#$%&'*+-.^_`|~").find(c) != std::string_view::npos;
}

bool is_token(std::string_view text) {
  return !text.empty() && std::all_of(text.begin(), text.end(), is_token_char);
}

bool is_visible(std::string_view text) {
  return !text.empty() && std::all_of(text.begin(), text.end(), [](char c) {
    const auto byte = static_cast<unsigned char>(c);
    return byte > 0x20 && byte != 0x7F;
  });
}

/**
 * The lines of a head and its headers; the first line is left to the
 * caller. Nothing for a head Node's parser would refuse.
 */
std::optional<std::pair<std::string_view, HttpHead>> split_head(
    std::string_view head) {
  if (head.size() < 4 || head.substr(head.size() - 4) != "\r\n\r\n") {
    return std::nullopt;
  }
  head.remove_suffix(2);
  const std::size_t first_end = head.find("\r\n");
  HttpHead parsed;
  const std::string_view first = head.substr(0, first_end);
  std::size_t at = first_end + 2;
  while (at < head.size()) {
    const std::size_t end = head.find("\r\n", at);
    const std::string_view line = head.substr(at, end - at);
    at = end + 2;
    const std::size_t colon = line.find(':');
    if (colon == std::string_view::npos || !is_token(line.substr(0, colon))) {
      return std::nullopt;
    }
    const std::string name = lower(line.substr(0, colon));
    const std::string_view value = trim_ows(line.substr(colon + 1));
    if (std::any_of(value.begin(), value.end(), [](char c) {
          const auto byte = static_cast<unsigned char>(c);
          return (byte < 0x20 && byte != '\t') || byte == 0x7F;
        })) {
      return std::nullopt;
    }
    auto found = std::find_if(
        parsed.headers.begin(), parsed.headers.end(),
        [&name](const auto& header) { return header.first == name; });
    if (found != parsed.headers.end()) {
      found->second += ", ";
      found->second += value;
    } else {
      parsed.headers.emplace_back(name, std::string(value));
    }
  }
  return std::make_pair(first, std::move(parsed));
}

/** Whether a comma-separated header lists `token`, as llhttp reads one. */
bool lists_token(const std::string* value, std::string_view token) {
  if (value == nullptr) {
    return false;
  }
  std::string_view rest = *value;
  while (!rest.empty()) {
    const std::size_t comma = rest.find(',');
    if (lower(trim_ows(rest.substr(0, comma))) == token) {
      return true;
    }
    if (comma == std::string_view::npos) {
      break;
    }
    rest.remove_prefix(comma + 1);
  }
  return false;
}

/** `abortHandshake` on the server: the status, why, and the end. */
std::string aborted(int status, std::string_view message,
                    std::string_view extra = {}) {
  std::string text = "HTTP/1.1 " + std::to_string(status) + " ";
  text += status_text(status);
  text += "\r\nConnection: close\r\nContent-Type: text/html\r\nContent-Length: ";
  text += std::to_string(message.size());
  text += "\r\n";
  text += extra;
  text += "\r\n";
  text += message;
  return text;
}

/** `Number(value)` is 13 or 8: the versions `ws` takes. */
bool supported_version(const std::string* value) {
  if (value == nullptr) {
    return false;
  }
  const std::string_view text = trim_ows(*value);
  double number = 0;
  const auto [end, error] =
      std::from_chars(text.data(), text.data() + text.size(), number);
  return error == std::errc() && end == text.data() + text.size() &&
         (number == 13 || number == 8);
}

bool valid_key(const std::string* key) {
  // /^[+/0-9A-Za-z]{22}==$/
  if (key == nullptr || key->size() != 24 || key->substr(22) != "==") {
    return false;
  }
  return std::all_of(key->begin(), key->begin() + 22, [](char c) {
    return std::isalnum(static_cast<unsigned char>(c)) != 0 || c == '+' ||
           c == '/';
  });
}

}  // namespace

std::string accept_for(std::string_view key) {
  std::string text(key);
  text += kGuid;
  return crypto::base64(crypto::sha1(crypto::bytes_of(text)));
}

std::string new_key() {
  std::array<std::uint8_t, 16> bytes{};
  crypto::random_bytes(bytes);
  return crypto::base64(bytes);
}

const std::string* HttpHead::header(std::string_view name) const {
  for (const auto& [key, value] : headers) {
    if (key == name) {
      return &value;
    }
  }
  return nullptr;
}

std::optional<std::size_t> head_end(std::span<const std::uint8_t> bytes) {
  constexpr std::array<std::uint8_t, 4> kBlank{'\r', '\n', '\r', '\n'};
  const auto found =
      std::search(bytes.begin(), bytes.end(), kBlank.begin(), kBlank.end());
  if (found == bytes.end()) {
    return std::nullopt;
  }
  return static_cast<std::size_t>(found - bytes.begin()) + kBlank.size();
}

std::optional<HttpHead> parse_request(std::string_view head) {
  auto split = split_head(head);
  if (!split) {
    return std::nullopt;
  }
  auto& [first, parsed] = *split;
  const std::size_t one = first.find(' ');
  const std::size_t two =
      one == std::string_view::npos ? one : first.find(' ', one + 1);
  if (two == std::string_view::npos ||
      first.find(' ', two + 1) != std::string_view::npos) {
    return std::nullopt;
  }
  const std::string_view method = first.substr(0, one);
  const std::string_view target = first.substr(one + 1, two - one - 1);
  const std::string_view version = first.substr(two + 1);
  if (!is_token(method) || !is_visible(target) ||
      (version != "HTTP/1.1" && version != "HTTP/1.0")) {
    return std::nullopt;
  }
  parsed.method = method;
  parsed.target = target;
  return std::move(parsed);
}

std::optional<HttpHead> parse_response(std::string_view head) {
  auto split = split_head(head);
  if (!split) {
    return std::nullopt;
  }
  auto& [first, parsed] = *split;
  // HTTP/1.1 101 Switching Protocols
  if (first.size() < 12 || first.substr(0, 7) != "HTTP/1." ||
      first[8] != ' ' || (first.size() > 12 && first[12] != ' ')) {
    return std::nullopt;
  }
  int status = 0;
  const auto [end, error] =
      std::from_chars(first.data() + 9, first.data() + 12, status);
  if (error != std::errc() || end != first.data() + 12) {
    return std::nullopt;
  }
  parsed.status = status;
  return std::move(parsed);
}

UpgradeAnswer answer_upgrade(const HttpHead& request) {
  const std::string* upgrade = request.header("upgrade");
  // Node hands a request to the WebSocket server only when it asks to be
  // upgraded; anything else gets `ws`'s plain HTTP answer.
  if (upgrade == nullptr || !lists_token(request.header("connection"), "upgrade")) {
    std::string text =
        "HTTP/1.1 426 Upgrade Required\r\nContent-Length: 16\r\n"
        "Content-Type: text/plain\r\nConnection: close\r\n\r\nUpgrade Required";
    return {false, std::move(text)};
  }
  if (request.method != "GET") {
    return {false, aborted(405, "Invalid HTTP method")};
  }
  if (lower(*upgrade) != "websocket") {
    return {false, aborted(400, "Invalid Upgrade header")};
  }
  const std::string* key = request.header("sec-websocket-key");
  if (!valid_key(key)) {
    return {false, aborted(400, "Missing or invalid Sec-WebSocket-Key header")};
  }
  if (!supported_version(request.header("sec-websocket-version"))) {
    return {false, aborted(400, "Missing or invalid Sec-WebSocket-Version header",
                           "Sec-WebSocket-Version: 13, 8\r\n")};
  }
  std::string text =
      "HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\n"
      "Connection: Upgrade\r\nSec-WebSocket-Accept: ";
  text += accept_for(*key);
  text += "\r\n\r\n";
  return {true, std::move(text)};
}

std::string refusal(int status) {
  std::string text = "HTTP/1.1 " + std::to_string(status) + " ";
  text += status_text(status);
  text += "\r\nConnection: close\r\n\r\n";
  return text;
}

std::string client_request(std::string_view host, int port,
                           std::string_view path, std::string_view key) {
  std::string text = "GET ";
  text += path;
  text += " HTTP/1.1\r\nSec-WebSocket-Version: 13\r\nSec-WebSocket-Key: ";
  text += key;
  text += "\r\nConnection: Upgrade\r\nUpgrade: websocket\r\nHost: ";
  text += host;
  text += ":" + std::to_string(port);
  text += "\r\n\r\n";
  return text;
}

std::optional<std::string> check_response(const HttpHead& response,
                                          std::string_view key) {
  if (response.status != 101) {
    return "Unexpected server response: " + std::to_string(response.status);
  }
  const std::string* upgrade = response.header("upgrade");
  if (upgrade == nullptr || lower(*upgrade) != "websocket") {
    return "Invalid Upgrade header";
  }
  const std::string* accept = response.header("sec-websocket-accept");
  if (accept == nullptr || *accept != accept_for(key)) {
    return "Invalid Sec-WebSocket-Accept header";
  }
  if (response.header("sec-websocket-protocol") != nullptr) {
    return "Server sent a subprotocol but none was requested";
  }
  if (response.header("sec-websocket-extensions") != nullptr) {
    return "Server sent a Sec-WebSocket-Extensions header but no extension "
           "was requested";
  }
  return std::nullopt;
}

}  // namespace feq::share::service::ws

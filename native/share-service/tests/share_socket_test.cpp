/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

// The Share Audio service's sockets: RFC 6455 as `ws` speaks it — the
// handshake both ways, frames written and read, every frame `ws` refuses
// refused with its status code — and then a real connection on this
// machine's loopback, client to listener, through the loop: a message each
// way, a close with a code both ends hear, a client closed while it is
// still connecting, and a connection nobody answers.

#include <winsock2.h>

#include <algorithm>
#include <cstdio>
#include <string>
#include <vector>

#include "loop.h"
#include "tcp.h"
#include "websocket.h"
#include "ws_frames.h"

namespace {

namespace service = feq::share::service;
namespace ws = feq::share::service::ws;
using Event = ws::FrameReader::Event;

int failures = 0;

void check(bool ok, const std::string& what) {
  if (!ok) {
    std::printf("FAIL: %s\n", what.c_str());
    ++failures;
  }
}

ws::Bytes bytes(std::string_view text) { return {text.begin(), text.end()}; }

std::vector<Event> read(bool server, const ws::Bytes& wire,
                        std::size_t max_payload = 512 * 1024) {
  ws::FrameReader reader(server, max_payload);
  std::vector<Event> events;
  reader.push(wire, events);
  return events;
}

/** The first error `read` gave, as its code and text. */
std::string refusal_of(bool server, const ws::Bytes& wire,
                       std::size_t max_payload = 512 * 1024) {
  for (const Event& event : read(server, wire, max_payload)) {
    if (event.kind == Event::Kind::kError) {
      return std::to_string(event.code) + " " + event.text;
    }
  }
  return "none";
}

const std::array<std::uint8_t, 4> kMask{0x11, 0x22, 0x33, 0x44};

void handshake() {
  // RFC 6455's own example.
  check(ws::accept_for("dGhlIHNhbXBsZSBub25jZQ==") ==
            "s3pPLMBiTxaQ9kYGzzhZRbK+xOo=",
        "the RFC's accept for the RFC's key");
  check(ws::new_key().size() == 24 && ws::new_key() != ws::new_key(),
        "a fresh key each time, sixteen bytes in base64");

  const std::string request =
      "GET /?computer=abc HTTP/1.1\r\nHost: 10.0.0.2:5000\r\n"
      "Upgrade: websocket\r\nConnection: Upgrade\r\n"
      "Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==\r\n"
      "Sec-WebSocket-Version: 13\r\n\r\n";
  const auto parsed = ws::parse_request(request);
  check(parsed && parsed->method == "GET" && parsed->target == "/?computer=abc",
        "a request is read with its target");
  const auto answer = ws::answer_upgrade(*parsed);
  check(answer.accepted &&
            answer.response ==
                "HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\n"
                "Connection: Upgrade\r\n"
                "Sec-WebSocket-Accept: s3pPLMBiTxaQ9kYGzzhZRbK+xOo=\r\n\r\n",
        "the upgrade is answered as ws answers it");

  const auto with = [&request](std::string_view from, std::string_view to) {
    std::string changed = request;
    changed.replace(changed.find(from), from.size(), to);
    return ws::answer_upgrade(*ws::parse_request(changed));
  };
  check(with("GET", "PUT").response.starts_with("HTTP/1.1 405 Method Not Allowed"),
        "another method is refused with 405");
  check(with("Upgrade: websocket", "Upgrade: h2c")
            .response.find("Invalid Upgrade header") != std::string::npos,
        "another protocol is refused");
  check(with("dGhlIHNhbXBsZSBub25jZQ==", "short")
            .response.find("invalid Sec-WebSocket-Key") != std::string::npos,
        "a malformed key is refused");
  const auto version = with("Version: 13", "Version: 12");
  check(!version.accepted &&
            version.response.find("Sec-WebSocket-Version: 13, 8\r\n") !=
                std::string::npos,
        "an unsupported version is refused, naming the ones taken");
  check(with("Version: 13", "Version: 8").accepted,
        "version 8 is taken, as ws takes it");
  check(with("Connection: Upgrade", "Connection: keep-alive")
            .response.starts_with("HTTP/1.1 426 Upgrade Required"),
        "a request that asks for no upgrade gets 426");
  check(with("Connection: Upgrade", "Connection: keep-alive, Upgrade").accepted,
        "upgrade is found among other connection tokens");
  check(!ws::parse_request("GET / HTTP/1.1\r\nBad header\r\n\r\n"),
        "a header with no colon is not a request");
  check(!ws::parse_request("GET /  HTTP/1.1\r\n\r\n"),
        "a request line with two spaces is not a request");

  const std::string key = "dGhlIHNhbXBsZSBub25jZQ==";
  check(ws::client_request("10.0.0.2", 5000, "/?computer=abc", key) ==
            "GET /?computer=abc HTTP/1.1\r\nSec-WebSocket-Version: 13\r\n"
            "Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==\r\n"
            "Connection: Upgrade\r\nUpgrade: websocket\r\n"
            "Host: 10.0.0.2:5000\r\n\r\n",
        "the client asks as ws and Node's HTTP client ask");
  const auto response = ws::parse_response(answer.response);
  check(response && response->status == 101 &&
            !ws::check_response(*response, key),
        "the listener's own answer opens the client");
  check(ws::check_response(*response, "AAAAAAAAAAAAAAAAAAAAAA==") ==
            "Invalid Sec-WebSocket-Accept header",
        "an accept for another key does not");
  const auto refused =
      ws::parse_response("HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n");
  check(refused && ws::check_response(*refused, key) ==
                       "Unexpected server response: 400",
        "a refusal is named by its status");
}

void frames() {
  for (const std::size_t size : {0u, 5u, 125u, 126u, 65535u, 65536u, 300000u}) {
    ws::Bytes payload(size);
    for (std::size_t at = 0; at < size; at += 1) {
      payload[at] = static_cast<std::uint8_t>(at * 7);
    }
    const auto from_client = read(true, ws::frame(ws::kBinary, payload, kMask));
    check(from_client.size() == 1 &&
              from_client[0].kind == Event::Kind::kMessage &&
              from_client[0].binary && from_client[0].data == payload,
          "a masked frame of " + std::to_string(size) + " bytes reads back");
    const auto from_server =
        read(false, ws::frame(ws::kBinary, payload, std::nullopt));
    check(from_server.size() == 1 && from_server[0].data == payload,
          "an unmasked frame of " + std::to_string(size) + " bytes reads back");
  }

  // Byte by byte: a frame split anywhere is the same frame.
  const ws::Bytes payload = bytes("split anywhere");
  const ws::Bytes wire = ws::frame(ws::kBinary, payload, kMask);
  ws::FrameReader reader(true, 1024);
  std::vector<Event> events;
  for (const std::uint8_t byte : wire) {
    reader.push(std::span(&byte, 1), events);
  }
  check(events.size() == 1 && events[0].data == payload,
        "a frame fed a byte at a time reads once, whole");

  // Fragments, with a ping between them.
  ws::Bytes fragmented;
  const auto add = [&fragmented](std::uint8_t first, std::string_view text) {
    ws::Bytes frame = ws::frame(0, bytes(text), kMask);
    frame[0] = first;
    fragmented.insert(fragmented.end(), frame.begin(), frame.end());
  };
  add(ws::kBinary, "one ");
  add(0x80 | ws::kPing, "ping");
  add(ws::kContinuation, "two ");
  add(0x80 | ws::kContinuation, "three");
  const auto pieces = read(true, fragmented);
  check(pieces.size() == 2 && pieces[0].kind == Event::Kind::kPing &&
            pieces[1].data == bytes("one two three"),
        "fragments join into one message around a ping");

  const auto closed = read(
      false, ws::frame(ws::kClose, ws::close_payload(4001, "Not linked"),
                       std::nullopt));
  check(closed.size() == 1 && closed[0].kind == Event::Kind::kClose &&
            closed[0].code == 4001 && closed[0].text == "Not linked",
        "a close frame carries its code and reason");
  const auto bare =
      read(false, ws::frame(ws::kClose, ws::close_payload(std::nullopt, ""),
                            std::nullopt));
  check(bare.size() == 1 && bare[0].code == 1005,
        "a close frame with no code reads as 1005");
  ws::Bytes after_close =
      ws::frame(ws::kClose, ws::close_payload(1000, ""), std::nullopt);
  const ws::Bytes extra = ws::frame(ws::kBinary, bytes("late"), std::nullopt);
  after_close.insert(after_close.end(), extra.begin(), extra.end());
  check(read(false, after_close).size() == 1,
        "nothing is read after a close frame");
}

void refusals() {
  check(refusal_of(true, ws::frame(ws::kBinary, bytes("x"), std::nullopt)) ==
            "1002 MASK must be set",
        "a listener refuses an unmasked frame");
  check(refusal_of(false, ws::frame(ws::kBinary, bytes("x"), kMask)) ==
            "1002 MASK must be clear",
        "a client refuses a masked frame");
  ws::Bytes rsv = ws::frame(ws::kBinary, bytes("x"), kMask);
  rsv[0] |= 0x40;
  check(refusal_of(true, rsv) == "1002 RSV1 must be clear",
        "a compressed frame is refused: nothing was negotiated");
  rsv[0] = static_cast<std::uint8_t>((rsv[0] & ~0x40) | 0x20);
  check(refusal_of(true, rsv) == "1002 RSV2 and RSV3 must be clear",
        "RSV2 is refused");
  check(refusal_of(true, ws::frame(0x3, bytes("x"), kMask)) ==
            "1002 invalid opcode 3",
        "an unknown opcode is refused");
  ws::Bytes stray = ws::frame(ws::kContinuation, bytes("x"), kMask);
  check(refusal_of(true, stray) == "1002 invalid opcode 0",
        "a continuation with nothing to continue is refused");
  ws::Bytes unfinished_ping = ws::frame(ws::kPing, bytes("x"), kMask);
  unfinished_ping[0] &= 0x7F;
  check(refusal_of(true, unfinished_ping) == "1002 FIN must be set",
        "a fragmented control frame is refused");
  check(refusal_of(true, ws::frame(ws::kPing, ws::Bytes(126), kMask)) ==
            "1002 invalid payload length 126",
        "a control frame over 125 bytes is refused");
  check(refusal_of(true, ws::frame(ws::kClose, ws::Bytes(1), kMask)) ==
            "1002 invalid payload length 1",
        "a one-byte close is refused");
  check(refusal_of(true, ws::frame(ws::kClose, ws::close_payload(1005, ""),
                                   kMask)) == "1002 invalid status code 1005",
        "a close code no frame may carry is refused");
  check(refusal_of(true, ws::frame(ws::kText, ws::Bytes{0xC0, 0x80}, kMask)) ==
            "1007 invalid UTF-8 sequence",
        "text that is not UTF-8 is refused");
  // Refused at the header, before any of the payload arrives.
  ws::Bytes oversize = ws::frame(ws::kBinary, ws::Bytes(1025), kMask);
  oversize.resize(8);
  check(refusal_of(true, oversize, 1024) == "1009 Max payload size exceeded",
        "a frame over the limit is refused at its header");
  ws::Bytes two_halves;
  for (int half = 0; half < 2; half += 1) {
    ws::Bytes piece = ws::frame(0, ws::Bytes(600), kMask);
    piece[0] = half == 0 ? ws::kBinary : (0x80 | ws::kContinuation);
    two_halves.insert(two_halves.end(), piece.begin(), piece.end());
  }
  check(refusal_of(true, two_halves, 1024) == "1009 Max payload size exceeded",
        "fragments are held to the limit together");
  // Three: each pair alone is under the limit, so only a running total of
  // the whole message refuses it.
  const auto in_thirds = [](std::size_t each) {
    ws::Bytes message;
    for (int third = 0; third < 3; third += 1) {
      ws::Bytes piece = ws::frame(0, ws::Bytes(each), kMask);
      piece[0] = third == 0   ? ws::kBinary
                 : third == 1 ? ws::kContinuation
                              : (0x80 | ws::kContinuation);
      message.insert(message.end(), piece.begin(), piece.end());
    }
    return message;
  };
  check(refusal_of(true, in_thirds(400), 1024) == "1009 Max payload size exceeded",
        "every fragment of a message counts toward its limit");
  check(refusal_of(true, in_thirds(300), 1024) == "none",
        "and a message in thirds under the limit is taken");
  check(refusal_of(true, ws::frame(ws::kBinary, ws::Bytes(1024), kMask), 1024) ==
            "none",
        "a frame exactly at the limit is taken");
  check(ws::valid_utf8(bytes("h\xC3\xA9llo \xF0\x9F\x8E\xB5")) &&
            !ws::valid_utf8(ws::Bytes{0xED, 0xA0, 0x80}) &&
            !ws::valid_utf8(ws::Bytes{0xED, 0xB0, 0x80}) &&
            !ws::valid_utf8(ws::Bytes{0xF4, 0x90, 0x80, 0x80}) &&
            !ws::valid_utf8(ws::Bytes{0xE2, 0x82}),
        "UTF-8: no surrogates, nothing past U+10FFFF, nothing cut short");
}

/** A listener and a client on the loopback, through the loop. */
void live() {
  service::Loop loop;
  service::set_loop(&loop);
  auto listening = service::WebSocketServer::listen("127.0.0.1", 0, 1024 * 1024);
  if (listening.index() != 0) {
    check(false, "the loopback listener starts");
    return;
  }
  const auto server = std::get<0>(listening);
  server->start();
  std::vector<std::string> log;
  std::shared_ptr<service::WebSocket> accepted;
  std::string url;
  server->on_connection.on(
      [&](const std::shared_ptr<service::WebSocket>& socket,
          const service::UpgradeRequest& request) {
        accepted = socket;
        url = request.url;
        check(request.remote_address == "127.0.0.1",
              "the listener knows where the client is");
        socket->on_message.on([&, socket](const service::Bytes& data) {
          log.push_back("server heard " + std::string(data.begin(), data.end()));
          socket->close(4001, "Not linked");
        });
        socket->on_close.on([&](int code) {
          log.push_back("server closed " + std::to_string(code));
          server->close();
          loop.stop(0);
        });
        socket->send(bytes("challenge"));
      });
  const auto client = service::WebSocket::connect(
      "127.0.0.1", server->port(), "/?computer=abc", 1024 * 1024);
  client->on_open.on([&] { log.push_back("client open"); });
  client->on_message.on([&](const service::Bytes& data) {
    log.push_back("client heard " + std::string(data.begin(), data.end()));
    client->send(bytes("ready"));
  });
  client->on_close.on([&](int code) {
    log.push_back("client closed " + std::to_string(code));
  });
  loop.run();
  const std::vector<std::string> expected = {
      "client open",   "client heard challenge", "server heard ready",
      "client closed 4001", "server closed 4001"};
  check(url == "/?computer=abc", "the listener reads the path the client asked");
  if (log.size() < 5 || !std::is_permutation(log.begin(), log.end(),
                                               expected.begin())) {
    std::string seen;
    for (const auto& line : log) {
      seen += line + "; ";
    }
    check(false, "a message each way, then 4001 heard at both ends: " + seen);
  }
  check(std::find(log.begin(), log.end(), "client open") <
            std::find(log.begin(), log.end(), "client heard challenge"),
        "the client opens before it hears anything");
}

void aborted_and_refused() {
  service::Loop loop;
  service::set_loop(&loop);
  // A port this machine is not listening on: bind one and let it go.
  auto probe = service::TcpListener::listen("127.0.0.1", 0);
  const int free_port = std::get<0>(probe)->port();
  std::get<0>(probe)->close();

  std::vector<std::string> log;
  int ended = 0;
  const auto refused =
      service::WebSocket::connect("127.0.0.1", free_port, "/", 1024);
  refused->on_error.on([&](const service::Failure& failure) {
    log.push_back("refused error " + failure.code);
  });
  refused->on_close.on([&](int code) {
    log.push_back("refused closed " + std::to_string(code));
    if (++ended == 2) {
      loop.stop(0);
    }
  });
  const auto cancelled =
      service::WebSocket::connect("127.0.0.1", free_port, "/", 1024);
  cancelled->on_error.on([&](const service::Failure& failure) {
    log.push_back("cancelled error " + failure.message);
  });
  cancelled->on_close.on([&](int code) {
    log.push_back("cancelled closed " + std::to_string(code));
    if (++ended == 2) {
      loop.stop(0);
    }
  });
  cancelled->close();
  check(cancelled->state() == service::WebSocket::State::kClosing,
        "closing a connecting client marks it closing at once");
  loop.run();
  const auto has = [&log](const std::string& line) {
    return std::find(log.begin(), log.end(), line) != log.end();
  };
  check(has("refused error ECONNREFUSED") && has("refused closed 1006"),
        "nobody listening: ECONNREFUSED, then a close with 1006");
  check(has("cancelled error WebSocket was closed before the connection was "
            "established") &&
            has("cancelled closed 1006"),
        "closed while connecting: ws's error, then a close with 1006");
  const auto error_at = std::find(log.begin(), log.end(),
                                  "refused error ECONNREFUSED");
  const auto close_at =
      std::find(log.begin(), log.end(), "refused closed 1006");
  check(error_at < close_at, "the error comes before the close");
}

}  // namespace

int main() {
  WSADATA data;
  if (WSAStartup(MAKEWORD(2, 2), &data) != 0 ||
      !service::load_socket_extensions()) {
    std::printf("FAIL: Winsock did not start\n");
    return 1;
  }
  handshake();
  frames();
  refusals();
  live();
  aborted_and_refused();
  WSACleanup();
  if (failures != 0) {
    std::printf("%d failure(s)\n", failures);
    return 1;
  }
  std::printf("share sockets: ws's handshake and frames, both ends live\n");
  return 0;
}

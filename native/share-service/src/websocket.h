/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#pragma once

/**
 * A WebSocket connection and a WebSocket listener on the service's loop,
 * with the life `ws` gives them, because the link code was written against
 * it:
 *
 *  - a client starts CONNECTING; closing it then aborts the handshake with
 *    an error and a close, both as an event of their own;
 *  - `close` sends a close frame and the connection ends once both sides
 *    have sent theirs; the close event carries the code the other side
 *    sent (1005 for none, 1006 when no close frame came at all);
 *  - a frame `ws` would refuse is answered with the status code `ws`
 *    answers it with, an error, and the close;
 *  - a TCP failure on an open connection is a close (1006), never an error.
 *
 * Messages keep arriving while CLOSING, as they do from `ws`.
 */

#include <cstddef>
#include <cstdint>
#include <list>
#include <memory>
#include <optional>
#include <string>
#include <variant>
#include <vector>

#include "emitter.h"
#include "loop.h"
#include "tcp.h"
#include "ws_frames.h"

namespace feq::share::service {

class WebSocket : public std::enable_shared_from_this<WebSocket> {
 public:
  enum class State { kConnecting = 0, kOpen = 1, kClosing = 2, kClosed = 3 };

  /** A client connection to `ws://address:port{path}`. */
  static std::shared_ptr<WebSocket> connect(const std::string& address,
                                            int port, const std::string& path,
                                            std::size_t max_payload);

  WebSocket(bool server, std::size_t max_payload);
  WebSocket(const WebSocket&) = delete;
  WebSocket& operator=(const WebSocket&) = delete;

  Emitter<> on_open;
  Emitter<const Bytes&> on_message;
  Emitter<const Failure&> on_error;
  Emitter<int> on_close;

  State state() const { return state_; }
  bool is_open() const { return state_ == State::kOpen; }

  /** A binary message; `done` hears when it left, or why it could not. */
  void send(Bytes payload,
            std::function<void(const std::optional<Failure>&)> done = {});
  void close(std::optional<int> code = std::nullopt,
             const std::string& reason = {});
  void terminate();

  /** What was sent and has not left yet. */
  std::size_t buffered_amount() const;
  /** `probeWhileQuiet`: TCP keep-alive after this long without traffic. */
  void keep_alive(int idle_seconds);
  void remove_all_listeners();
  const std::string& remote_address() const { return remote_address_; }

  /** The listener's side: the upgraded socket, and what followed the head. */
  void adopt(std::shared_ptr<TcpSocket> tcp, Bytes head);

 private:
  void begin_handshake(std::shared_ptr<TcpSocket> tcp, const std::string& host,
                       int port, const std::string& path);
  void handshake_data(std::span<const std::uint8_t> data);
  void read_frames(std::span<const std::uint8_t> data);
  void handle(ws::FrameReader::Event& event);
  void socket_ended();
  void socket_closed();
  void abort_handshake(std::string message, std::string code = {});
  void emit_error_and_close(const Failure& failure);
  void emit_close();
  std::optional<std::array<std::uint8_t, 4>> mask() const;

  bool server_;
  ws::FrameReader reader_;
  State state_ = State::kConnecting;
  std::shared_ptr<TcpSocket> tcp_;
  std::string remote_address_;
  std::string key_;
  Bytes response_;
  bool close_frame_sent_ = false;
  bool close_frame_received_ = false;
  bool receiver_errored_ = false;
  bool error_emitted_ = false;
  bool close_emitted_ = false;
  int close_code_ = 1006;
};

/** What the listener knew of a request when it upgraded it. */
struct UpgradeRequest {
  /** The request target: path and query (`request.url`). */
  std::string url;
  std::string remote_address;
};

class WebSocketServer : public std::enable_shared_from_this<WebSocketServer> {
 public:
  /** Listening, or why not (EADDRINUSE when the port is taken). */
  static std::variant<std::shared_ptr<WebSocketServer>, Failure> listen(
      const std::string& host, int port, std::size_t max_payload);

  WebSocketServer(std::shared_ptr<TcpListener> listener,
                  std::size_t max_payload);
  WebSocketServer(const WebSocketServer&) = delete;
  WebSocketServer& operator=(const WebSocketServer&) = delete;

  /** Starts taking connections; until then none is accepted. */
  void start();

  Emitter<const std::shared_ptr<WebSocket>&, const UpgradeRequest&>
      on_connection;
  Emitter<const Failure&> on_error;

  int port() const { return listener_->port(); }
  /** Every upgraded connection still open, oldest first. */
  std::vector<std::shared_ptr<WebSocket>> clients() const;
  void close();

 private:
  struct Upgrading {
    std::shared_ptr<TcpSocket> tcp;
    Bytes head;
  };

  void accepted(const std::shared_ptr<TcpSocket>& tcp);
  void upgrading_data(std::list<Upgrading>::iterator at,
                      std::span<const std::uint8_t> data);
  void forget(const std::shared_ptr<TcpSocket>& tcp);
  void make_room(const std::string& address);

  std::shared_ptr<TcpListener> listener_;
  std::size_t max_payload_;
  std::list<Upgrading> upgrading_;
  std::list<std::shared_ptr<WebSocket>> clients_;
  bool closed_ = false;
};

}  // namespace feq::share::service

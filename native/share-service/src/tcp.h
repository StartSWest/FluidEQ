/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#pragma once

/**
 * TCP on the service's loop, behaving as a Node `net.Socket` does where
 * the link depends on it: a read stream that ends when the other side
 * finishes, writes that complete in order once Windows has the bytes, the
 * count still waiting to go out (`bufferedAmount`), a graceful end after
 * the queued writes, and a `closed` event of its own once the socket is
 * gone — never inside the call that ended it.
 */

#include <winsock2.h>

#include <cstddef>
#include <cstdint>
#include <functional>
#include <memory>
#include <optional>
#include <span>
#include <string>
#include <vector>

#include "io.h"

namespace feq::share::service {

using Bytes = std::vector<std::uint8_t>;

class TcpSocket : public std::enable_shared_from_this<TcpSocket> {
 public:
  struct Events {
    std::function<void(std::span<const std::uint8_t>)> data;
    /** The other side finished sending (Node's `end`). */
    std::function<void()> end;
    /** Gone, once: with what ended it, or nothing for a clean close. */
    std::function<void(const std::optional<Failure>&)> closed;
  };

  /** Takes an accepted or connected socket the loop already owns. */
  TcpSocket(SOCKET socket, std::string remote_address, int remote_port);
  ~TcpSocket();
  TcpSocket(const TcpSocket&) = delete;
  TcpSocket& operator=(const TcpSocket&) = delete;

  /** Connects to an IPv4 address; the socket or why not, as an event. */
  static void connect(
      const std::string& address, int port,
      std::function<void(std::shared_ptr<TcpSocket>, std::optional<Failure>)>
          done);

  void start(Events events);
  void replace_events(Events events) { events_ = std::move(events); }

  /** Queued after every earlier write; `done` hears when Windows took it. */
  void write(Bytes bytes,
             std::function<void(const std::optional<Failure>&)> done = {});
  /** Bytes written and not yet taken by Windows. */
  std::size_t buffered() const { return buffered_; }

  /**
   * TCP keep-alive as `probeWhileQuiet` sets it through Node: probes once
   * the link has carried nothing for `idle_seconds`, ten a second apart.
   */
  void keep_alive(int idle_seconds);

  /** Finishes sending after the queued writes (Node's `end`). */
  void end();
  /** Closes now; whatever was queued is dropped (Node's `destroy`). */
  void destroy();

  bool destroyed() const { return closed_socket_; }
  const std::string& remote_address() const { return remote_address_; }
  int remote_port() const { return remote_port_; }

 private:
  void read();
  void wrote(std::size_t size, DWORD error,
             const std::function<void(const std::optional<Failure>&)>& done);
  void shut_down_when_written();
  void close_with(std::optional<Failure> failure);
  void finish_if_done();

  SOCKET socket_;
  std::string remote_address_;
  int remote_port_;
  Events events_;
  std::size_t buffered_ = 0;
  std::size_t writes_in_flight_ = 0;
  bool reading_ = false;
  bool read_ended_ = false;
  bool ending_ = false;
  bool write_ended_ = false;
  bool closed_socket_ = false;
  bool announced_ = false;
};

/** A listening socket; each connection is handed over as a `TcpSocket`. */
class TcpListener : public std::enable_shared_from_this<TcpListener> {
 public:
  using Accepted = std::function<void(std::shared_ptr<TcpSocket>)>;

  /**
   * Listens on `host:port` (0 for any free port). Fails the way Node's
   * `listen` fails: EADDRINUSE when the port is taken.
   */
  static std::variant<std::shared_ptr<TcpListener>, Failure> listen(
      const std::string& host, int port);

  explicit TcpListener(SOCKET socket, int port);
  ~TcpListener();
  TcpListener(const TcpListener&) = delete;
  TcpListener& operator=(const TcpListener&) = delete;

  /** Starts accepting; `failed` hears a listener that broke. */
  void start(Accepted accepted, std::function<void(const Failure&)> failed);
  int port() const { return port_; }
  void close();

 private:
  void accept_next();

  SOCKET socket_;
  int port_;
  Accepted accepted_;
  std::function<void(const Failure&)> failed_;
  bool closed_ = false;
};

/** Winsock's extension calls, looked up once. */
bool load_socket_extensions();

/** "a.b.c.d" of an IPv4 address in network order. */
std::string ipv4_text(const in_addr& address);

}  // namespace feq::share::service

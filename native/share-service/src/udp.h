/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#pragma once

/**
 * The discovery socket: UDP on IPv4, shared with any other FluidEQ on the
 * machine as Node's `reuseAddr` shares it, able to broadcast. A failed
 * receive never ends it — an adapter that leaves and comes back must not
 * take discovery with it — so receiving simply carries on.
 */

#include <winsock2.h>

#include <cstdint>
#include <functional>
#include <memory>
#include <span>
#include <string>
#include <variant>
#include <vector>

#include "io.h"

namespace feq::share::service {

class UdpSocket : public std::enable_shared_from_this<UdpSocket> {
 public:
  using Heard = std::function<void(std::span<const std::uint8_t> data,
                                   const std::string& address, int port)>;

  /** Bound to `port` on every adapter; fails as Node's `bind` does. */
  static std::variant<std::shared_ptr<UdpSocket>, Failure> bind(int port);

  explicit UdpSocket(SOCKET socket);
  ~UdpSocket();
  UdpSocket(const UdpSocket&) = delete;
  UdpSocket& operator=(const UdpSocket&) = delete;

  void set_broadcast(bool on);
  void start(Heard heard);
  /** `done` runs once the datagram has left, whether it could be sent or not. */
  void send(std::vector<std::uint8_t> data, int port,
            const std::string& address, std::function<void()> done = {});
  void close();
  bool closed() const { return closed_; }

 private:
  void receive();

  SOCKET socket_;
  Heard heard_;
  bool closed_ = false;
};

}  // namespace feq::share::service
